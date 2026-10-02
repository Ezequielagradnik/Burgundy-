"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, moneyShort } from "@/lib/format";

export type PuntoAcumulado = {
  dia: number;
  actual: number | null;
  anterior: number | null;
  /** Desde hoy: lo gastado más los fijos que faltan */
  proyectado: number | null;
};

// Mes elegido en bordó (la proyección es la misma serie, punteada); el anterior en gris, de contexto
const ACTUAL = "#8B2942";
const ANTERIOR = "#9c8a8e";

export function CumulativeChart({
  data,
  labelActual,
  labelAnterior,
  height = 200,
}: {
  data: PuntoAcumulado[];
  labelActual: string;
  /** null: el mes anterior no tiene datos y no se compara */
  labelAnterior: string | null;
  height?: number;
}) {
  const hayProyeccion = data.some((d) => d.proyectado !== null);

  return (
    <figure>
      <div className="mb-2 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5 capitalize">
          <span className="h-0.5 w-4 rounded-full" style={{ background: ACTUAL }} />
          {labelActual}
        </span>
        {hayProyeccion ? (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: ACTUAL }} />
            Con los fijos que faltan
          </span>
        ) : null}
        {labelAnterior ? (
          <span className="flex items-center gap-1.5 capitalize">
            <span className="w-4 border-t-2 border-dotted" style={{ borderColor: ANTERIOR }} />
            {labelAnterior}
          </span>
        ) : null}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eadfd8" />
            <XAxis
              dataKey="dia"
              tickLine={false}
              axisLine={false}
              ticks={[1, 8, 15, 22, 29]}
              tick={{ fill: "#6e5a5f", fontSize: 11 }}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9c8a8e", fontSize: 11 }}
              tickFormatter={(v: number) => (v ? moneyShort(v) : "0")}
            />
            <Tooltip
              cursor={{ stroke: "#eadfd8", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as PuntoAcumulado;
                return (
                  <div className="tabular rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 font-medium text-ink">Hasta el día {d.dia}</p>
                    {d.actual !== null ? (
                      <p className="text-ink-2 capitalize">
                        {labelActual}: {money(d.actual)}
                      </p>
                    ) : null}
                    {d.proyectado !== null && d.actual === null ? (
                      <p className="text-ink-2">Con los fijos que faltan: {money(d.proyectado)}</p>
                    ) : null}
                    {labelAnterior && d.anterior !== null ? (
                      <p className="text-ink-2 capitalize">
                        {labelAnterior}: {money(d.anterior)}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            {labelAnterior ? (
              <Line
                dataKey="anterior"
                stroke={ANTERIOR}
                strokeWidth={2}
                strokeDasharray="1 4"
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                connectNulls={false}
              />
            ) : null}
            {hayProyeccion ? (
              <Line
                dataKey="proyectado"
                stroke={ACTUAL}
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.6}
                dot={false}
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                connectNulls={false}
              />
            ) : null}
            <Line
              dataKey="actual"
              stroke={ACTUAL}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
