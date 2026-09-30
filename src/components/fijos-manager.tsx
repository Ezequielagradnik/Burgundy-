"use client";

import { useState, useTransition } from "react";
import { borrarFijo, guardarFijo } from "@/lib/actions";
import type { Categoria, GastoFijo } from "@/lib/data";
import { money } from "@/lib/format";
import { onlyDigits } from "./gasto-fields";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { Sheet } from "./sheet";

type FijoDraft = { nombre: string; monto: string; categoria_id: string | null; dia: string; activo: boolean };

const miles = new Intl.NumberFormat("es-AR");
const input =
  "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-wine-2 focus:bg-surface";

const SUGERENCIAS = ["Luz", "Gas", "Alquiler", "Internet", "Agua", "Monotributo"];

export function FijosManager({ fijos, categorias }: { fijos: GastoFijo[]; categorias: Categoria[] }) {
  const [editing, setEditing] = useState<GastoFijo | "new" | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const catName = new Map(categorias.map((c) => [c.id, c.nombre]));

  return (
    <>
      {fijos.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {fijos.map((f) => (
            <li key={f.id}>
              {borrando === f.id ? (
                <div className="flex items-center gap-2 bg-wine-soft px-4 py-3">
                  <span className="min-w-0 flex-1 text-sm text-wine">
                    ¿Borrar <strong>{f.nombre}</strong>? Se saca de este mes, los anteriores quedan.
                  </span>
                  <button
                    type="button"
                    onClick={() => setBorrando(null)}
                    className="rounded-full px-3 py-1.5 text-sm text-ink-2 active:bg-surface"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await borrarFijo(f.id);
                        setBorrando(null);
                      })
                    }
                    className="rounded-full bg-danger px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {pending ? "Borrando…" : "Borrar"}
                  </button>
                </div>
              ) : (
                <div className={`flex items-center gap-1 py-1.5 pr-2 pl-4 ${f.activo ? "" : "opacity-50"}`}>
                  <button type="button" onClick={() => setEditing(f)} className="min-w-0 flex-1 py-1.5 text-left">
                    <span className="block truncate font-medium">{f.nombre}</span>
                    <span className="text-xs text-ink-3">
                      Día {f.dia} · {(f.categoria_id && catName.get(f.categoria_id)) ?? "Sin categoría"}
                      {f.activo ? "" : " · Pausado"}
                    </span>
                  </button>
                  <span className="tabular shrink-0 pr-1 font-medium">{money(f.monto)}</span>
                  <button
                    type="button"
                    onClick={() => setEditing(f)}
                    aria-label={`Editar ${f.nombre}`}
                    className="rounded-full p-2 text-ink-2 active:bg-bg"
                  >
                    <PencilIcon width={18} height={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBorrando(f.id)}
                    aria-label={`Borrar ${f.nombre}`}
                    className="rounded-full p-2 text-danger active:bg-bg"
                  >
                    <TrashIcon width={18} height={18} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-ink-3">
          Cargá la luz, el gas, el alquiler y todo lo que pagás todos los meses.
        </p>
      )}

      <button
        type="button"
        onClick={() => setEditing("new")}
        className="flex items-center justify-center gap-2 rounded-2xl bg-wine py-3.5 font-medium text-bg active:scale-[0.99]"
      >
        <PlusIcon width={18} height={18} /> Agregar gasto fijo
      </button>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nuevo gasto fijo" : "Editar gasto fijo"}
      >
        {editing ? (
          <FijoForm fijo={editing === "new" ? null : editing} categorias={categorias} onDone={() => setEditing(null)} />
        ) : null}
      </Sheet>
    </>
  );
}

function FijoForm({
  fijo,
  categorias,
  onDone,
}: {
  fijo: GastoFijo | null;
  categorias: Categoria[];
  onDone: () => void;
}) {
  const servicios = categorias.find((c) => c.nombre === "Servicios")?.id ?? null;
  const [d, setD] = useState<FijoDraft>(
    fijo
      ? {
          nombre: fijo.nombre,
          monto: String(Math.round(fijo.monto)),
          categoria_id: fijo.categoria_id,
          dia: String(fijo.dia),
          activo: fijo.activo,
        }
      : { nombre: "", monto: "", categoria_id: servicios, dia: "10", activo: true },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<FijoDraft>) => setD((prev) => ({ ...prev, ...patch }));

  const valid = d.nombre.trim() !== "" && Number(d.monto) > 0 && Number(d.dia) >= 1 && Number(d.dia) <= 31;

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
        onDone();
      } catch {
        setError("No se pudo guardar. Probá de nuevo.");
      }
    });

  return (
    <div className="flex flex-col gap-4">
      {!fijo ? (
        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                const cat =
                  s === "Alquiler"
                    ? categorias.find((c) => c.nombre === "Alquiler")?.id
                    : s === "Monotributo"
                      ? categorias.find((c) => c.nombre === "Impuestos")?.id
                      : servicios;
                set({ nombre: s, categoria_id: cat ?? null });
              }}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                d.nombre === s ? "border-wine bg-wine-soft text-wine" : "border-line text-ink-2"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <label className="col-span-2">
          <span className="mb-1 block text-xs text-ink-3">Nombre</span>
          <input
            className={input}
            value={d.nombre}
            onChange={(e) => set({ nombre: e.target.value })}
            placeholder="Ej: Luz"
            maxLength={100}
          />
        </label>
        <label className="relative">
          <span className="mb-1 block text-xs text-ink-3">{fijo ? "Monto" : "Monto aprox."}</span>
          <span className="pointer-events-none absolute bottom-3 left-3 text-ink-3">$</span>
          <input
            className={`${input} tabular pl-7 font-medium`}
            inputMode="numeric"
            placeholder="0"
            value={d.monto ? miles.format(Number(d.monto)) : ""}
            onChange={(e) => set({ monto: onlyDigits(e.target.value) })}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-ink-3">Día del mes</span>
          <input
            className={`${input} tabular`}
            inputMode="numeric"
            value={d.dia}
            onChange={(e) => set({ dia: onlyDigits(e.target.value).slice(0, 2) })}
          />
        </label>
        <label className="col-span-2">
          <span className="mb-1 block text-xs text-ink-3">Categoría</span>
          <select
            className={`${input} min-h-[46px] appearance-none`}
            value={d.categoria_id ?? ""}
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

      {fijo ? (
        <label className="flex items-center justify-between rounded-xl bg-bg px-3 py-3">
          <span>
            <span className="block text-sm font-medium">Activo</span>
            <span className="block text-xs text-ink-3">Si lo pausás, deja de anotarse los meses que vienen</span>
          </span>
          <input
            type="checkbox"
            checked={d.activo}
            onChange={(e) => set({ activo: e.target.checked })}
            className="size-5 accent-[var(--wine)]"
          />
        </label>
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!valid || pending}
        onClick={() =>
          run(() =>
            guardarFijo(fijo?.id ?? null, {
              nombre: d.nombre.trim(),
              monto: Number(d.monto),
              categoria_id: d.categoria_id,
              dia: Number(d.dia),
              activo: d.activo,
            }),
          )
        }
        className="rounded-2xl bg-wine py-3.5 font-medium text-bg disabled:opacity-40"
      >
        {pending ? "Guardando…" : fijo ? "Guardar cambios" : "Agregar"}
      </button>

      {fijo ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => (confirmDelete ? run(() => borrarFijo(fijo.id)) : setConfirmDelete(true))}
          className={`rounded-2xl py-3 text-sm font-medium ${confirmDelete ? "bg-danger text-white" : "text-danger"}`}
        >
          {confirmDelete ? "Tocá de nuevo para borrar" : "Borrar (se saca de este mes, los anteriores quedan)"}
        </button>
      ) : null}
    </div>
  );
}
