"use client";

import { useState, useTransition } from "react";
import { actualizarGasto, borrarGasto } from "@/lib/actions";
import type { Categoria, Gasto } from "@/lib/data";
import { dayLabel, money } from "@/lib/format";
import { GastoFields, isValidDraft, toInput, type Draft } from "./gasto-fields";
import { MicIcon, RepeatIcon } from "./icons";
import { Sheet } from "./sheet";

export function GastoList({
  gastos,
  categorias,
  groupByDay = true,
  empty = "Todavía no hay gastos.",
}: {
  gastos: Gasto[];
  categorias: Categoria[];
  groupByDay?: boolean;
  empty?: string;
}) {
  const [editing, setEditing] = useState<Gasto | null>(null);
  const catName = new Map(categorias.map((c) => [c.id, c.nombre]));

  if (!gastos.length) {
    return <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-ink-3">{empty}</p>;
  }

  const groups = groupByDay
    ? Object.entries(
        gastos.reduce<Record<string, Gasto[]>>((acc, g) => {
          (acc[g.fecha] ??= []).push(g);
          return acc;
        }, {}),
      )
    : [["", gastos] as const];

  return (
    <>
      <div className="flex flex-col gap-4">
        {groups.map(([fecha, items]) => (
          <section key={fecha || "all"}>
            {fecha ? (
              <div className="mb-1.5 flex items-baseline justify-between px-1 text-xs font-medium text-ink-3">
                <span>{dayLabel(fecha)}</span>
                <span className="tabular">{money(items.reduce((s, g) => s + g.monto, 0))}</span>
              </div>
            ) : null}
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
              {items.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(g)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-bg"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{g.descripcion}</span>
                      <span className="flex items-center gap-1.5 text-xs text-ink-3">
                        {g.tipo === "fijo" ? <RepeatIcon width={12} height={12} aria-label="Fijo" /> : null}
                        {g.origen === "audio" ? <MicIcon width={12} height={12} aria-label="Por audio" /> : null}
                        {(g.categoria_id && catName.get(g.categoria_id)) ?? "Sin categoría"}
                        {!groupByDay ? ` · ${dayLabel(g.fecha)}` : ""}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-medium">{money(g.monto)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar gasto">
        {editing ? <EditForm gasto={editing} categorias={categorias} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

function EditForm({ gasto, categorias, onDone }: { gasto: Gasto; categorias: Categoria[]; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>({
    descripcion: gasto.descripcion,
    monto: String(Math.round(gasto.monto)),
    categoria_id: gasto.categoria_id,
    fecha: gasto.fecha,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
      {gasto.tipo === "fijo" ? (
        <p className="rounded-xl bg-wine-soft px-3 py-2 text-sm text-wine">
          Gasto fijo de este mes. Si la factura vino distinta, corregí el monto acá.
        </p>
      ) : null}
      <GastoFields value={draft} onChange={setDraft} categorias={categorias} />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!isValidDraft(draft) || pending}
        onClick={() => run(() => actualizarGasto(gasto.id, toInput(draft)))}
        className="rounded-2xl bg-wine py-3.5 font-medium text-bg disabled:opacity-40"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => (confirmDelete ? run(() => borrarGasto(gasto.id)) : setConfirmDelete(true))}
        className={`rounded-2xl py-3 text-sm font-medium ${confirmDelete ? "bg-danger text-white" : "text-danger"}`}
      >
        {confirmDelete ? "Tocá de nuevo para borrar" : "Borrar gasto"}
      </button>
    </div>
  );
}
