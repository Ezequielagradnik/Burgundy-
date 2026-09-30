import { FijosManager } from "@/components/fijos-manager";
import { getCategorias, getGastosFijos } from "@/lib/data";
import { money } from "@/lib/format";

export default async function FijosPage() {
  const [categorias, fijos] = await Promise.all([getCategorias(), getGastosFijos()]);
  const total = fijos.filter((f) => f.activo).reduce((s, f) => s + f.monto, 0);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="font-display text-2xl">Gastos fijos</h1>
        <p className="mt-1 text-sm text-ink-2">
          Se anotan solos cada mes. Si una factura vino distinta, corregí el monto desde Gastos.
        </p>
      </div>
      <p className="tabular px-1 text-sm text-ink-2">
        Total por mes: <span className="font-medium text-ink">{money(total)}</span>
      </p>
      <FijosManager fijos={fijos} categorias={categorias} />
    </div>
  );
}
