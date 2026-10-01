"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "./supabase";
import { SESSION_COOKIE, SESSION_MAX_AGE, checkPin, createSessionToken, verifySessionToken } from "./session";
import { currentMonth, today } from "./format";

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

const fijoSchema = z
  .object({
    nombre: z.string().trim().min(1).max(100),
    monto: z.coerce.number().nonnegative().max(1_000_000_000),
    categoria_id: z.string().uuid().nullable(),
    frecuencia: z.enum(["mensual", "quincenal", "semanal"]),
    dia: z.coerce.number().int().min(1).max(31),
    dias_semana: z.array(z.number().int().min(1).max(7)).max(7),
    activo: z.boolean(),
  })
  .refine((f) => f.frecuencia !== "semanal" || f.dias_semana.length > 0, "Elegí al menos un día de la semana")
  .refine((f) => f.frecuencia !== "quincenal" || f.dia <= 15, "En quincenal el primer día va del 1 al 15")
  .transform((f) => ({ ...f, dias_semana: f.frecuencia === "semanal" ? [...new Set(f.dias_semana)].sort() : [] }));

export type FijoInput = z.input<typeof fijoSchema>;

/**
 * Desde cuándo anotar un fijo nuevo o reactivado. Mensual y quincenal cuentan el mes entero
 * (el alquiler cargado el 5 es el de este mes); semanal arranca hoy, sin inventar compras pasadas.
 */
function desdeParaFrecuencia(frecuencia: string) {
  return frecuencia === "semanal" ? today() : `${currentMonth()}-01`;
}

async function anotarFijosAlDia(supabase: ReturnType<typeof db>) {
  const { error } = await supabase.rpc("generar_gastos_fijos", { p_hasta: today() });
  if (error) throw new Error(error.message);
}

export async function guardarFijo(id: string | null, fijo: FijoInput) {
  await requireSession();
  const data = fijoSchema.parse(fijo);
  const supabase = db();

  if (id) {
    const fijoId = z.string().uuid().parse(id);
    const { data: antes, error: errorAntes } = await supabase
      .from("gastos_fijos")
      .select("activo")
      .eq("id", fijoId)
      .single();
    if (errorAntes) throw new Error(errorAntes.message);

    const reactivado = !antes.activo && data.activo;
    const { error } = await supabase
      .from("gastos_fijos")
      .update(reactivado ? { ...data, desde: desdeParaFrecuencia(data.frecuencia) } : data)
      .eq("id", fijoId);
    if (error) throw new Error(error.message);

    // Mensual: el cambio también corrige el de este mes. Semanal y quincenal no tocan lo que ya se pagó.
    if (data.activo && data.frecuencia === "mensual") {
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
    const { error } = await supabase
      .from("gastos_fijos")
      .insert({ ...data, desde: desdeParaFrecuencia(data.frecuencia) });
    if (error) throw new Error(error.message);
  }

  await anotarFijosAlDia(supabase);
  refresh();
}

/** Varios fijos de una, dictados o pegados. */
export async function crearFijos(fijos: FijoInput[]) {
  await requireSession();
  const rows = z
    .array(fijoSchema)
    .min(1)
    .max(30)
    .parse(fijos)
    .map((f) => ({ ...f, desde: desdeParaFrecuencia(f.frecuencia) }));
  const supabase = db();
  const { error } = await supabase.from("gastos_fijos").insert(rows);
  if (error) throw new Error(error.message);
  await anotarFijosAlDia(supabase);
  refresh();
}

export async function borrarFijo(id: string) {
  await requireSession();
  const fijoId = z.string().uuid().parse(id);
  const supabase = db();
  const { data: fijo, error: errorFijo } = await supabase
    .from("gastos_fijos")
    .select("frecuencia")
    .eq("id", fijoId)
    .single();
  if (errorFijo) throw new Error(errorFijo.message);

  // Mensual: se saca el de este mes. Semanal y quincenal: lo ya pagado queda.
  // En todos los casos los meses anteriores quedan en el historial (gasto_fijo_id pasa a null).
  if (fijo.frecuencia === "mensual") {
    const { error: errorMes } = await supabase
      .from("gastos")
      .delete()
      .eq("gasto_fijo_id", fijoId)
      .eq("periodo", `${currentMonth()}-01`);
    if (errorMes) throw new Error(errorMes.message);
  }
  const { error } = await supabase.from("gastos_fijos").delete().eq("id", fijoId);
  if (error) throw new Error(error.message);
  refresh();
}
