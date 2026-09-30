"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "./supabase";
import { SESSION_COOKIE, SESSION_MAX_AGE, checkPin, createSessionToken, verifySessionToken } from "./session";
import { currentMonth } from "./format";

async function requireSession() {
  const store = await cookies();
  if (!(await verifySessionToken(store.get(SESSION_COOKIE)?.value))) {
    throw new Error("No autorizado");
  }
}

function refresh() {
  revalidatePath("/", "layout");
}

// Login -----------------------------------------------------------------

export async function login(pin: string): Promise<{ error?: string }> {
  // Freno simple a la fuerza bruta: cada intento tarda un poco
  await new Promise((r) => setTimeout(r, 400));
  if (!checkPin(pin)) return { error: "PIN incorrecto" };

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// Gastos ----------------------------------------------------------------

const gastoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: z.coerce.number().nonnegative().max(1_000_000_000),
  descripcion: z.string().trim().min(1).max(200),
  categoria_id: z.string().uuid().nullable(),
});

export type GastoInput = z.input<typeof gastoSchema>;

export async function crearGastos(
  gastos: GastoInput[],
  origen: "audio" | "texto" | "manual",
  transcripcion?: string,
) {
  await requireSession();
  const rows = z.array(gastoSchema).min(1).max(20).parse(gastos).map((g) => ({
    ...g,
    tipo: "variable" as const,
    origen,
    transcripcion: transcripcion ?? null,
  }));
  const { error } = await db().from("gastos").insert(rows);
  if (error) throw new Error(error.message);
  refresh();
}

export async function actualizarGasto(id: string, gasto: GastoInput) {
  await requireSession();
  const data = gastoSchema.parse(gasto);
  const { error } = await db().from("gastos").update(data).eq("id", z.string().uuid().parse(id));
  if (error) throw new Error(error.message);
  refresh();
}

export async function borrarGasto(id: string) {
  await requireSession();
  const { error } = await db().from("gastos").delete().eq("id", z.string().uuid().parse(id));
  if (error) throw new Error(error.message);
  refresh();
}

// Gastos fijos ----------------------------------------------------------

const fijoSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  monto: z.coerce.number().nonnegative().max(1_000_000_000),
  categoria_id: z.string().uuid().nullable(),
  dia: z.coerce.number().int().min(1).max(31),
  activo: z.boolean(),
});

export type FijoInput = z.input<typeof fijoSchema>;

export async function guardarFijo(id: string | null, fijo: FijoInput) {
  await requireSession();
  const data = fijoSchema.parse(fijo);
  const supabase = db();

  if (id) {
    const fijoId = z.string().uuid().parse(id);
    const { error } = await supabase.from("gastos_fijos").update(data).eq("id", fijoId);
    if (error) throw new Error(error.message);

    // El cambio también corrige el gasto ya anotado de este mes (los meses anteriores no se tocan)
    if (data.activo) {
      const mes = currentMonth();
      const [y, m] = mes.split("-").map(Number);
      const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const { error: errorMes } = await supabase
        .from("gastos")
        .update({
          monto: data.monto,
          descripcion: data.nombre,
          categoria_id: data.categoria_id,
          fecha: `${mes}-${String(Math.min(data.dia, ultimoDia)).padStart(2, "0")}`,
        })
        .eq("gasto_fijo_id", fijoId)
        .eq("periodo", `${mes}-01`);
      if (errorMes) throw new Error(errorMes.message);
    }
  } else {
    const { error } = await supabase.from("gastos_fijos").insert(data);
    if (error) throw new Error(error.message);
  }

  // Si se crea o reactiva, que aparezca ya en el mes actual
  await supabase.rpc("generar_gastos_fijos", { p_mes: `${currentMonth()}-01` });
  refresh();
}

export async function borrarFijo(id: string) {
  await requireSession();
  const fijoId = z.string().uuid().parse(id);
  const supabase = db();
  // Se borra el de este mes; los meses anteriores quedan en el historial (gasto_fijo_id pasa a null)
  const { error: errorMes } = await supabase
    .from("gastos")
    .delete()
    .eq("gasto_fijo_id", fijoId)
    .eq("periodo", `${currentMonth()}-01`);
  if (errorMes) throw new Error(errorMes.message);
  const { error } = await supabase.from("gastos_fijos").delete().eq("id", fijoId);
  if (error) throw new Error(error.message);
  refresh();
}
