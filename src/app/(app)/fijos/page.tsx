import { FijosManager } from "@/components/fijos-manager";
import { aiEnabled } from "@/lib/ai";
import { getCategorias, getGastosFijos } from "@/lib/data";
import { estimadoMensual } from "@/lib/fijos";
import { currentMonth, money } from "@/lib/format";

export default async function FijosPage() {
  const [categorias, fijos] = await Promise.all([getCategorias(), getGastosFijos()]);
  const mes = currentMonth();
  const total = fijos.filter((f) => f.activo).reduce((s, f) => s + estimadoMensual(f, mes), 0);
  // Activos primero y, dentro de cada grupo, lo que más pesa en el mes arriba
  const ordenados = [...fijos].sort(
    (a, b) => Number(b.activo) - Number(a.activo) || estimadoMensual(b, mes) - estimadoMensual(a, mes),
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pt-2">
      <div>
        <h1 className="font-display text-2xl">Gastos fijos</h1>
        <p className="mt-1 text-sm text-ink-2">
          Se anotan solos cuando llega el día: el alquiler el 1, las flores cada lunes y miércoles.
        </p>
      </div>
      <p className="tabular px-1 text-sm text-ink-2">
        Total estimado este mes: <span className="font-medium text-ink">{money(total)}</span>
      </p>
      <FijosManager fijos={ordenados} categorias={categorias} aiEnabled={aiEnabled()} />
    </div>
  );
}
