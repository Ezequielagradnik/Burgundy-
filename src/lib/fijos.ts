// Cuándo cae cada gasto fijo. Tiene que dar lo mismo que generar_gastos_fijos() en la base.
// Sin imports: corre en el servidor, en el cliente y en los tests de Node.

export type Frecuencia = "mensual" | "quincenal" | "semanal";

/** dia: día del mes (mensual) o primer día (quincenal, 1-15). dias_semana: 1 = lunes ... 7 = domingo. */
export type ReglaFijo = { frecuencia: Frecuencia; dia: number; dias_semana: number[] };

export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function diasDelMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const fecha = (mes: string, dia: number) => `${mes}-${String(dia).padStart(2, "0")}`;

/** Fechas (YYYY-MM-DD) en las que cae el fijo dentro del mes "YYYY-MM", ordenadas. */
export function ocurrenciasEnMes(regla: ReglaFijo, mes: string): string[] {
  const ultimo = diasDelMes(mes);
  if (regla.frecuencia === "mensual") return [fecha(mes, Math.min(regla.dia, ultimo))];
  if (regla.frecuencia === "quincenal") {
    const dias = [Math.min(regla.dia, ultimo), Math.min(regla.dia + 15, ultimo)];
    return [...new Set(dias)].map((d) => fecha(mes, d));
  }
  const [y, m] = mes.split("-").map(Number);
  const out: string[] = [];
  for (let d = 1; d <= ultimo; d++) {
    const iso = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
    if (regla.dias_semana.includes(iso)) out.push(fecha(mes, d));
  }
  return out;
}

export function estimadoMensual(fijo: ReglaFijo & { monto: number }, mes: string) {
  return fijo.monto * ocurrenciasEnMes(fijo, mes).length;
}

function lista(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items.at(-1)}` : (items[0] ?? "");
}

export function textoFrecuencia(regla: ReglaFijo) {
  if (regla.frecuencia === "mensual") return `Día ${regla.dia} de cada mes`;
  if (regla.frecuencia === "quincenal") return `Días ${regla.dia} y ${regla.dia + 15}`;
  const dias = [...regla.dias_semana].sort((a, b) => a - b).map((d) => DIAS_SEMANA[d - 1]);
  const texto = lista(dias);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Fijos que todavía no cayeron este mes: después de hoy y sin anotar (un fijo puede estar anotado
 * por adelantado). anotados: claves "gasto_fijo_id|fecha" de lo que ya está en gastos.
 */
export function fijosPendientes(
  fijos: (ReglaFijo & { id: string; monto: number; activo: boolean })[],
  anotados: Set<string>,
  mes: string,
  hoy: string,
) {
  return fijos
    .filter((f) => f.activo)
    .flatMap((f) => ocurrenciasEnMes(f, mes).map((fecha) => ({ id: f.id, fecha, monto: f.monto })))
    .filter((o) => o.fecha > hoy && !anotados.has(`${o.id}|${o.fecha}`))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(({ fecha, monto }) => ({ fecha, monto }));
}
