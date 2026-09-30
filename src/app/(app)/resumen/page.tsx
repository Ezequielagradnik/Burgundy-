import { CategoryBars } from "@/components/category-bars";
import { MonthSwitcher, parseMonth } from "@/components/month-switcher";
import { MonthlyChart } from "@/components/monthly-chart";
import { logout } from "@/lib/actions";
import { getCategorias, getGastosDelMes, getResumenMensual } from "@/lib/data";
import { money, monthLabel } from "@/lib/format";

export default async function ResumenPage({ searchParams }: PageProps<"/resumen">) {
  const mes = parseMonth((await searchParams).mes);
  const [categorias, gastos, resumen] = await Promise.all([
    getCategorias(),
    getGastosDelMes(mes),
    getResumenMensual(12),
  ]);

  const conGastos = resumen.filter((r) => r.total > 0);
  const promedio = conGastos.length ? conGastos.reduce((s, r) => s + r.total, 0) / conGastos.length : 0;
  const maximo = conGastos.reduce<(typeof resumen)[number] | null>((m, r) => (!m || r.total > m.total ? r : m), null);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="font-display text-2xl">Resumen</h1>

      <section className="rounded-3xl bg-surface p-4">
        <h2 className="mb-3 font-medium">Mes a mes</h2>
        <MonthlyChart data={resumen} height={220} />
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
          <div>
            <p className="text-xs text-ink-3">Promedio mensual</p>
            <p className="tabular font-medium">{money(promedio)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Mes más alto</p>
            <p className="tabular font-medium">
              {maximo ? (
                <>
                  {money(maximo.total)} <span className="font-normal text-ink-3">{monthLabel(maximo.mes)}</span>
                </>
              ) : (
                "-"
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <MonthSwitcher month={mes} basePath="/resumen" />
        <div className="rounded-3xl bg-surface p-4">
          <h2 className="mb-4 font-medium">En qué se fue la plata</h2>
          <CategoryBars gastos={gastos} categorias={categorias} />
        </div>
      </section>

      <details className="rounded-3xl bg-surface p-4">
        <summary className="cursor-pointer font-medium">Ver tabla por mes</summary>
        <table className="tabular mt-3 w-full text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr>
              <th className="py-1 font-normal">Mes</th>
              <th className="py-1 text-right font-normal">Fijos</th>
              <th className="py-1 text-right font-normal">Variables</th>
              <th className="py-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...resumen].reverse().map((r) => (
              <tr key={r.mes}>
                <td className="py-1.5 capitalize">{monthLabel(r.mes)} {r.mes.slice(2, 4)}</td>
                <td className="py-1.5 text-right">{money(r.fijos)}</td>
                <td className="py-1.5 text-right">{money(r.variables)}</td>
                <td className="py-1.5 text-right font-medium">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <form action={logout} className="text-center">
        <button type="submit" className="py-2 text-sm text-ink-3">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
