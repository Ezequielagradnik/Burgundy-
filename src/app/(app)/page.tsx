import Link from "next/link";
import { GastoList } from "@/components/gasto-list";
import { MonthlyChart } from "@/components/monthly-chart";
import { getCategorias, getGastosDelMes, getGastosFijos, getResumenMensual, getUltimosGastos } from "@/lib/data";
import { fijosPendientes } from "@/lib/fijos";
import { currentMonth, money, monthLabel, today } from "@/lib/format";

export default async function InicioPage() {
  const mes = currentMonth();
  const [categorias, resumen, ultimos, fijos, delMes] = await Promise.all([
    getCategorias(),
    getResumenMensual(6),
    getUltimosGastos(6),
    getGastosFijos(),
    getGastosDelMes(mes),
  ]);

  // Fijos que todavía no cayeron este mes (las flores del próximo lunes, la luz del 10)
  const hoy = today();
  const anotados = new Set(delMes.filter((g) => g.gasto_fijo_id).map((g) => `${g.gasto_fijo_id}|${g.fecha}`));
  const faltanFijos = fijosPendientes(fijos, anotados, mes, hoy).reduce((s, p) => s + p.monto, 0);

  const actual = resumen.at(-1)!;
  const anterior = resumen.at(-2)!;

  const dia = Number(today().slice(8, 10));
  const cambio = anterior.total > 0 ? Math.round(((actual.total - anterior.total) / anterior.total) * 100) : null;

  return (
    <div className="mx-auto max-w-md flex flex-col gap-5 pt-2">
      <header className="flex items-center justify-between">
        <p className="font-display text-2xl text-wine">Burgundy</p>
        <p className="text-sm text-ink-3 capitalize">{monthLabel(mes, true)}</p>
      </header>

      <section className="rounded-3xl bg-wine p-5 text-bg">
        <p className="text-sm opacity-80">Gastado este mes</p>
        <p className="tabular mt-1 font-display text-[2.6rem] leading-none tracking-tight">{money(actual.total)}</p>
        {cambio !== null ? (
          <p className="mt-2 text-sm opacity-80">
            {cambio > 0 ? `${cambio}% más` : cambio < 0 ? `${Math.abs(cambio)}% menos` : "Igual"} que{" "}
            {monthLabel(anterior.mes, true).split(" ")[0]} completo
            {dia < 25 ? " (el mes todavía no terminó)" : ""}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-bg/10 px-3 py-2.5">
            <p className="text-xs opacity-75">Fijos</p>
            <p className="tabular font-medium">{money(actual.fijos)}</p>
            {faltanFijos > 0 ? (
              <p className="tabular mt-0.5 text-xs opacity-75">Faltan {money(faltanFijos)}</p>
            ) : null}
          </div>
          <div className="rounded-2xl bg-bg/10 px-3 py-2.5">
            <p className="text-xs opacity-75">Variables</p>
            <p className="tabular font-medium">{money(actual.variables)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium">Últimos 6 meses</h2>
          <Link href="/resumen" className="text-sm text-wine-2">
            Ver más
          </Link>
        </div>
        <MonthlyChart data={resumen} height={180} />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="font-medium">Últimos gastos</h2>
          <Link href="/gastos" className="text-sm text-wine-2">
            Ver todos
          </Link>
        </div>
        <GastoList
          gastos={ultimos}
          categorias={categorias}
          groupByDay={false}
          empty="Tocá el micrófono y decí tu primer gasto."
        />
      </section>
    </div>
  );
}
