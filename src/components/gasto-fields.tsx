"use client";

import type { Categoria } from "@/lib/data";
import { adivinarCategoria } from "@/lib/interpretar";

export type Draft = {
  descripcion: string;
  monto: string; // solo dígitos
  categoria_id: string | null;
  fecha: string;
};

const miles = new Intl.NumberFormat("es-AR");

export const onlyDigits = (v: string) => v.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

const input =
  "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-wine-2 focus:bg-surface";

export function GastoFields({
  value,
  onChange,
  categorias,
  showFecha = true,
}: {
  value: Draft;
  onChange: (next: Draft) => void;
  categorias: Categoria[];
  showFecha?: boolean;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <label className="col-span-2">
        <span className="sr-only">Descripción</span>
        <input
          className={input}
          placeholder="¿Qué fue?"
          value={value.descripcion}
          onChange={(e) => {
            const descripcion = e.target.value;
            // Sugiere la categoría mientras escribe, salvo que ya la haya elegido a mano
            const anterior = adivinarCategoria(value.descripcion, categorias);
            const nueva = adivinarCategoria(descripcion, categorias);
            const elegidaAMano = value.categoria_id !== null && value.categoria_id !== anterior;
            set(elegidaAMano || !nueva ? { descripcion } : { descripcion, categoria_id: nueva });
          }}
          maxLength={200}
        />
      </label>
      <label className="relative">
        <span className="sr-only">Monto</span>
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">$</span>
        <input
          className={`${input} tabular pl-7 font-medium`}
          inputMode="numeric"
          placeholder="0"
          value={value.monto ? miles.format(Number(value.monto)) : ""}
          onChange={(e) => set({ monto: onlyDigits(e.target.value) })}
        />
      </label>
      {showFecha ? (
        <label>
          <span className="sr-only">Fecha</span>
          <input
            type="date"
            className={`${input} min-h-[46px]`}
            value={value.fecha}
            onChange={(e) => set({ fecha: e.target.value })}
          />
        </label>
      ) : null}
      <label className={showFecha ? "col-span-2" : ""}>
        <span className="sr-only">Categoría</span>
        <select
          className={`${input} min-h-[46px] appearance-none`}
          value={value.categoria_id ?? ""}
          onChange={(e) => set({ categoria_id: e.target.value || null })}
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export const isValidDraft = (d: Draft) => d.descripcion.trim() !== "" && Number(d.monto) > 0 && !!d.fecha;

export const toInput = (d: Draft) => ({
  descripcion: d.descripcion.trim(),
  monto: Number(d.monto),
  categoria_id: d.categoria_id,
  fecha: d.fecha,
});
