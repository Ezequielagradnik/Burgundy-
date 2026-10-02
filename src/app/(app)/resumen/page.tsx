import Link from "next/link";
import type { ReactNode } from "react";
import { CategoryBars } from "@/components/category-bars";
import { CumulativeChart, type PuntoAcumulado } from "@/components/cumulative-chart";
import { MonthSwitcher, parseMonth } from "@/components/month-switcher";
import { MonthlyChart } from "@/components/monthly-chart";
import { SplitBar } from "@/components/split-bar";
import { logout } from "@/lib/actions";
import {
  getCategorias,
  getGastosDelMes,
  getGastosFijos,
  getResumenMensual,
  type Gasto,
  type MesResumen,
} from "@/lib/data";
import { fijosPendientes } from "@/lib/fijos";
import { addMonths, currentMonth, dayLabel, money, monthLabel, today } from "@/lib/format";

export default async function ResumenPage({ searchParams }: PageProps<"/resumen">) {
  const mes = parseMonth((await searchParams).mes);
  const mesAnterior = addMonths(mes, -1);
  const [categorias, gastos, gastosAnterior, resumen, reglasFijas] = await Promise.all([
    getCategorias(),
    getGastosDelMes(mes),
    getGastosDelMes(mesAnterior),
    getResumenMensual(12),
    getGastosFijos(),
  ]);

  const conGastos = resumen.filter((r) => r.total > 0);
  const promedio = conGastos.length ? conGastos.reduce((s, r) => s + r.total, 0) / conGastos.length : 0;
  const maximo = conGastos.reduce<MesResumen | null>((m, r) => (!m || r.total > m.total ? r : m), null);

  const fijos = gastos.filter((g) => g.tipo === "fijo").reduce((s, g) => s + g.monto, 0);
  const variables = gastos.filter((g) => g.tipo === "variable").reduce((s, g) => s + g.monto, 0);
  const mayores = gastos
    .filter((g) => g.tipo === "variable")
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);
  const catName = new Map(categorias.map((c) => [c.id, c.nombre]));

  // Solo el mes en curso tiene fijos por venir
  const anotados = new Set(gastos.filter((g) => g.gasto_fijo_id).map((g) => `${g.gasto_fijo_id}|${g.fecha}`));
  const pendientes = mes === currentMonth() ? fijosPendientes(reglasFijas, anotados, mes, today()) : [];
  const acumulado = acumularPorDia(mes, gastos, gastosAnterior, pendientes);
  const nombreMes = monthLabel(mes, true).split(" ")[0];
  const nombreAnterior = monthLabel(mesAnterior, true).split(" ")[0];
  const hayAnterior = gastosAnterior.length > 0;
  const proyectado = acumulado.at(-1)?.proyectado ?? null;
  const subtitulo = [
    hayAnterior
      ? `Acumulado día por día contra ${nombreAnterior}`
      : `Acumulado día por día (${nombreAnterior} no tiene gastos cargados)`,
    proyectado !== null ? `Con los fijos que faltan cierra en ${money(proyectado)}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  const tabla = <TablaMensual resumen={resumen} seleccionado={mes} />;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 pt-2 lg:max-w-7xl lg:pt-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl lg:text-3xl">Resumen</h1>
        <div className="hidden w-80 lg:block">
          <MonthSwitcher month={mes} basePath="/resumen" />
        </div>
      </header>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start">
        {/* Izquierda: la evolución */}
        <div className="flex flex-col gap-5">
          <Card title="Mes a mes" subtitle="Últimos 12 meses">
            <MonthlyChart data={resumen} height={240} />
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <Stat label="Promedio mensual" value={money(promedio)} />
              <Stat
                label="Mes más alto"
                value={maximo ? money(maximo.total) : "-"}
                extra={maximo ? monthLabel(maximo.mes) : undefined}
              />
            </div>
          </Card>

          <Card title="Cómo viene el mes" subtitle={subtitulo}>
            <CumulativeChart
              data={acumulado}
              labelActual={nombreMes}
              labelAnterior={hayAnterior ? nombreAnterior : null}
              height={200}
            />
          </Card>
        </div>

        {/* Medio: el mes elegido */}
        <div className="flex flex-col gap-5">
          <div className="lg:hidden">
            <MonthSwitcher month={mes} basePath="/resumen" />
          </div>

          <Card title="Fijos y variables" subtitle={`Total ${money(fijos + variables)}`}>
            <SplitBar fijos={fijos} variables={variables} />
          </Card>

          <Card title="En qué se fue la plata">
            <CategoryBars gastos={gastos} categorias={categorias} />
          </Card>

          <Card title="Los gastos más grandes" subtitle="Sin contar los fijos">
            {mayores.length ? (
              <ol className="flex flex-col divide-y divide-line">
                {mayores.map((g, i) => (
                  <li key={g.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="tabular w-4 text-sm text-ink-3">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{g.descripcion}</span>
                      <span className="text-xs text-ink-3">
                        {(g.categoria_id && catName.get(g.categoria_id)) ?? "Sin categoría"} · {dayLabel(g.fecha)}
                      </span>
                    </span>
                    <span className="tabular text-sm font-medium">{money(g.monto)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-2 text-center text-sm text-ink-3">Sin gastos variables este mes.</p>
            )}
          </Card>
        </div>

        {/* Derecha: la tabla. En el celu queda plegada */}
        <div className="flex flex-col gap-5">
          <div className="hidden lg:block">
            <Card title="Tabla por mes" subtitle="Tocá un mes para verlo">
              {tabla}
            </Card>
          </div>
          <details className="rounded-3xl bg-surface p-4 lg:hidden">
            <summary className="cursor-pointer font-medium">Ver tabla por mes</summary>
            <div className="mt-3">{tabla}</div>
          </details>
        </div>
      </div>

      <form action={logout} className="text-center">
        <button type="submit" className="py-2 text-sm text-ink-3">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-4 lg:p-5">
      <div className="mb-3">
        <h2 className="font-medium">{title}</h2>
        {subtitle ? <p className="text-xs text-ink-3">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="tabular font-medium">
        {value} {extra ? <span className="font-normal text-ink-3">{extra}</span> : null}
      </p>
    </div>
  );
}

function TablaMensual({ resumen, seleccionado }: { resumen: MesResumen[]; seleccionado: string }) {
  return (
    <table className="tabular w-full text-sm">
      <thead className="text-left text-xs text-ink-3">
        <tr>
          <th className="py-1 font-normal">Mes</th>
          <th className="py-1 text-right font-normal">Fijos</th>
          <th className="py-1 text-right font-normal">Variables</th>
          <th className="py-1 text-right font-normal">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {[...resumen].reverse().map((r) => {
          const activo = r.mes === seleccionado;
          const href = r.mes === currentMonth() ? "/resumen" : `/resumen?mes=${r.mes}`;
          return (
            <tr key={r.mes} className={activo ? "bg-wine-soft" : ""}>
              <td className="py-2 pl-1 capitalize">
                <Link href={href} className={activo ? "font-medium text-wine" : "text-ink-2"}>
                  {monthLabel(r.mes)} {r.mes.slice(2, 4)}
                </Link>
              </td>
              <td className="py-2 text-right">{money(r.fijos)}</td>
              <td className="py-2 text-right">{money(r.variables)}</td>
              <td className="py-2 pr-1 text-right font-medium">{money(r.total)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Gasto acumulado por día del mes elegido y del anterior. El mes en curso se corta en hoy y,
 * desde hoy, sigue como proyección sumando los fijos que faltan.
 */
function acumularPorDia(
  mes: string,
  actual: Gasto[],
  anterior: Gasto[],
  pendientes: { fecha: string; monto: number }[],
): PuntoAcumulado[] {
  const dias = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(Date.UTC(y, mo, 0)).getUTCDate();
  };
  const porDia = (gastos: Gasto[]) => {
    const totales = new Map<number, number>();
    for (const g of gastos) {
      const d = Number(g.fecha.slice(8, 10));
      totales.set(d, (totales.get(d) ?? 0) + g.monto);
    }
    return totales;
  };

  const diasActual = dias(mes);
  const diasAnterior = dias(addMonths(mes, -1));
  const hasta = mes === currentMonth() ? Number(today().slice(8, 10)) : diasActual;
  const totActual = porDia(actual);
  const totAnterior = porDia(anterior);
  const totPendiente = new Map<number, number>();
  for (const p of pendientes) {
    const d = Number(p.fecha.slice(8, 10));
    totPendiente.set(d, (totPendiente.get(d) ?? 0) + p.monto);
  }
  const conProyeccion = mes === currentMonth() && pendientes.length > 0;

  let sumaActual = 0;
  let sumaAnterior = 0;
  let sumaProyectada = 0;
  return Array.from({ length: Math.max(diasActual, diasAnterior) }, (_, i) => {
    const dia = i + 1;
    // Lo ya anotado con fecha futura (un fijo cargado por adelantado) cuenta en la proyección
    if (dia <= hasta) sumaActual += totActual.get(dia) ?? 0;
    else sumaProyectada += totActual.get(dia) ?? 0;
    sumaProyectada += dia > hasta ? (totPendiente.get(dia) ?? 0) : 0;
    sumaAnterior += totAnterior.get(dia) ?? 0;
    return {
      dia,
      actual: dia <= hasta && dia <= diasActual ? sumaActual : null,
      anterior: dia <= diasAnterior ? sumaAnterior : null,
      // Arranca en hoy, pegada a la línea real, y sigue hasta fin de mes
      proyectado: conProyeccion && dia >= hasta && dia <= diasActual ? sumaActual + sumaProyectada : null,
    };
  });
}
