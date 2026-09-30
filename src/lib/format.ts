export const TZ = "America/Argentina/Buenos_Aires";

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const pesosCompact = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const money = (n: number | string | null | undefined) => pesos.format(Number(n ?? 0));
export const moneyShort = (n: number) => `$${pesosCompact.format(n)}`;

/** Fecha de hoy en Argentina, formato YYYY-MM-DD */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** "2026-09" del mes actual */
export function currentMonth() {
  return today().slice(0, 7);
}

/** Suma meses a "YYYY-MM" */
export function addMonths(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: string) {
  return { from: `${month}-01`, to: `${addMonths(month, 1)}-01` };
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function monthLabel(month: string, long = false) {
  const [y, m] = month.split("-").map(Number);
  return long ? `${MESES_LARGO[m - 1]} ${y}` : MESES[m - 1];
}

export function dayLabel(date: string) {
  const t = today();
  if (date === t) return "Hoy";
  const [y, m, d] = t.split("-").map(Number);
  const ayer = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  if (date === ayer) return "Ayer";
  const [, mm, dd] = date.split("-").map(Number);
  return `${dd} ${MESES[mm - 1]}`;
}
