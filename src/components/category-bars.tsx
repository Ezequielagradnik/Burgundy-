import type { Categoria, Gasto } from "@/lib/data";
import { money } from "@/lib/format";

/** Ranking de categorías del mes. Un solo color: la barra mide, el texto identifica. */
export function CategoryBars({ gastos, categorias }: { gastos: Gasto[]; categorias: Categoria[] }) {
  const nombres = new Map(categorias.map((c) => [c.id, c.nombre]));
  const totales = new Map<string, number>();
  for (const g of gastos) {
    const key = (g.categoria_id && nombres.get(g.categoria_id)) || "Sin categoría";
    totales.set(key, (totales.get(key) ?? 0) + g.monto);
  }
  const rows = [...totales.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const max = rows[0]?.[1] ?? 0;

  if (!rows.length) return <p className="py-4 text-center text-sm text-ink-3">Sin gastos este mes.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {rows.map(([nombre, monto]) => (
        <li key={nombre}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{nombre}</span>
            <span className="tabular shrink-0 font-medium">
              {money(monto)} <span className="font-normal text-ink-3">{Math.round((monto / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-bg">
            <div className="h-2 rounded-full bg-wine-2" style={{ width: `${Math.max((monto / max) * 100, 2)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
