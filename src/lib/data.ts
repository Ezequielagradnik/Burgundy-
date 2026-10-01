import "server-only";
import { cache } from "react";
import { db } from "./supabase";
import { addMonths, currentMonth, monthRange, today } from "./format";
import type { Frecuencia } from "./fijos";

export type Categoria = { id: string; nombre: string; color: string };

export type Gasto = {
  id: string;
  fecha: string;
  monto: number;
  descripcion: string;
  categoria_id: string | null;
  tipo: "fijo" | "variable";
  origen: "audio" | "texto" | "manual" | "fijo";
  gasto_fijo_id: string | null;
};

export type GastoFijo = {
  id: string;
  nombre: string;
  monto: number;
  categoria_id: string | null;
  dia: number;
  activo: boolean;
  frecuencia: Frecuencia;
  dias_semana: number[];
};

export type MesResumen = { mes: string; fijos: number; variables: number; total: number };

// Una sola consulta por request aunque la pidan el layout y la página
export const getCategorias = cache(async (): Promise<Categoria[]> => {
  const { data, error } = await db().from("categorias").select("id, nombre, color").order("orden");
  if (error) throw error;
  return data;
});

/** Anota los fijos que ya cayeron hasta hoy y falten (las flores del lunes, el lunes). Idempotente. */
export async function ensureFijosAlDia() {
  const { error } = await db().rpc("generar_gastos_fijos", { p_hasta: today() });
  if (error) console.error("generar_gastos_fijos", error);
}

export async function getGastosDelMes(month: string): Promise<Gasto[]> {
  const { from, to } = monthRange(month);
  const { data, error } = await db()
    .from("gastos")
    .select("id, fecha, monto, descripcion, categoria_id, tipo, origen, gasto_fijo_id")
    .gte("fecha", from)
    .lt("fecha", to)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((g) => ({ ...g, monto: Number(g.monto) }));
}

export async function getUltimosGastos(limit = 8): Promise<Gasto[]> {
  const { data, error } = await db()
    .from("gastos")
    .select("id, fecha, monto, descripcion, categoria_id, tipo, origen, gasto_fijo_id")
    .lte("fecha", `${addMonths(currentMonth(), 1)}-01`)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((g) => ({ ...g, monto: Number(g.monto) }));
}

/** Últimos N meses (incluye el actual), con ceros en los meses sin gastos. */
export async function getResumenMensual(meses = 6, hasta = currentMonth()): Promise<MesResumen[]> {
  const desde = addMonths(hasta, -(meses - 1));
  const { data, error } = await db()
    .from("resumen_mensual")
    .select("mes, fijos, variables, total")
    .gte("mes", `${desde}-01`)
    .lte("mes", `${hasta}-01`);
  if (error) throw error;

  const porMes = new Map(data.map((r) => [String(r.mes).slice(0, 7), r]));
  return Array.from({ length: meses }, (_, i) => {
    const mes = addMonths(desde, i);
    const r = porMes.get(mes);
    return {
      mes,
      fijos: Number(r?.fijos ?? 0),
      variables: Number(r?.variables ?? 0),
      total: Number(r?.total ?? 0),
    };
  });
}

export async function getGastosFijos(): Promise<GastoFijo[]> {
  const { data, error } = await db()
    .from("gastos_fijos")
    .select("id, nombre, monto, categoria_id, dia, activo, frecuencia, dias_semana")
    .order("activo", { ascending: false })
    .order("dia");
  if (error) throw error;
  return data.map((f) => ({ ...f, monto: Number(f.monto) }));
}
