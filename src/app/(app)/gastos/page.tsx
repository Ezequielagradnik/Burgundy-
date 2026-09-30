import { GastoList } from "@/components/gasto-list";
import { MonthSwitcher, parseMonth } from "@/components/month-switcher";
import { getCategorias, getGastosDelMes } from "@/lib/data";
import { money } from "@/lib/format";

export default async function GastosPage({ searchParams }: PageProps<"/gastos">) {
  const mes = parseMonth((await searchParams).mes);
  const [categorias, gastos] = await Promise.all([getCategorias(), getGastosDelMes(mes)]);
  const total = gastos.reduce((s, g) => s + g.monto, 0);

  return (
    <div className="mx-auto max-w-md flex flex-col gap-4 pt-2">
      <h1 className="font-display text-2xl">Gastos</h1>
      <MonthSwitcher month={mes} basePath="/gastos" />
      <p className="tabular px-1 text-sm text-ink-2">
        {gastos.length} {gastos.length === 1 ? "gasto" : "gastos"} · <span className="font-medium text-ink">{money(total)}</span>
      </p>
      <GastoList gastos={gastos} categorias={categorias} empty="No hay gastos en este mes." />
    </div>
  );
}
