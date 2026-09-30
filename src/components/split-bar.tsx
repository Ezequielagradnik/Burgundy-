import { money } from "@/lib/format";

// Mismos colores que el gráfico mes a mes
const FIJOS = "#8B2942";
const VARIABLES = "#B7782F";

/** Qué parte del mes fue fijo y qué parte variable. */
export function SplitBar({ fijos, variables }: { fijos: number; variables: number }) {
  const total = fijos + variables;
  if (!total) return <p className="py-2 text-center text-sm text-ink-3">Sin gastos este mes.</p>;
  const pctFijos = Math.round((fijos / total) * 100);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Fijos ${pctFijos}%, variables ${100 - pctFijos}%`}>
        {fijos > 0 ? <div style={{ width: `${pctFijos}%`, background: FIJOS }} /> : null}
        {variables > 0 ? <div className="flex-1" style={{ background: VARIABLES }} /> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className="size-2.5 rounded-sm" style={{ background: FIJOS }} /> Fijos · {pctFijos}%
          </p>
          <p className="tabular font-medium">{money(fijos)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className="size-2.5 rounded-sm" style={{ background: VARIABLES }} /> Variables · {100 - pctFijos}%
          </p>
          <p className="tabular font-medium">{money(variables)}</p>
        </div>
      </div>
    </div>
  );
}
