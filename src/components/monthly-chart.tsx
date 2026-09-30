"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MesResumen } from "@/lib/data";
import { money, monthLabel, moneyShort } from "@/lib/format";

// Paleta validada (CVD + contraste sobre blanco): bordó = fijos, dorado = variables
const FIJOS = "#8B2942";
const VARIABLES = "#B7782F";

export function MonthlyChart({ data, height = 200 }: { data: MesResumen[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.mes) }));

  return (
    <figure>
      <div className="mb-2 flex gap-4 text-xs text-ink-2">
        <Legend color={FIJOS} label="Fijos" />
        <Legend color={VARIABLES} label="Variables" />
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#eadfd8" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              interval={0}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6e5a5f", fontSize: rows.length > 8 ? 10 : 12 }}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9c8a8e", fontSize: 11 }}
              tickFormatter={(v: number) => (v ? moneyShort(v) : "0")}
            />
            <Tooltip
              cursor={{ fill: "rgba(107,29,52,0.06)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof rows)[number];
                return (
                  <div className="tabular rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 font-medium text-ink capitalize">{monthLabel(d.mes, true)}</p>
                    <p className="text-ink-2">Fijos: {money(d.fijos)}</p>
                    <p className="text-ink-2">Variables: {money(d.variables)}</p>
                    <p className="mt-1 font-medium text-ink">Total: {money(d.total)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="fijos" stackId="a" fill={FIJOS} stroke="#fff" strokeWidth={2} radius={0} />
            <Bar dataKey="variables" stackId="a" fill={VARIABLES} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {rows.map((d) => `${monthLabel(d.mes, true)}: ${money(d.total)}`).join(". ")}
      </figcaption>
    </figure>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
