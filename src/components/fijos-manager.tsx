"use client";

import { useState, useTransition } from "react";
import { borrarFijo, crearFijos, guardarFijo, type FijoInput } from "@/lib/actions";
import type { Categoria, GastoFijo } from "@/lib/data";
import { DIAS_SEMANA, estimadoMensual, textoFrecuencia, type Frecuencia } from "@/lib/fijos";
import { currentMonth, money } from "@/lib/format";
import { adivinarCategoria } from "@/lib/interpretar";
import { onlyDigits } from "./gasto-fields";
import { MicIcon, PencilIcon, PlusIcon, StopIcon, TrashIcon } from "./icons";
import { Sheet } from "./sheet";
import { interpretar, useRecorder } from "./use-recorder";

type FijoDraft = {
  nombre: string;
  monto: string; // solo dígitos
  categoria_id: string | null;
  frecuencia: Frecuencia;
  dia: string;
  dias_semana: number[];
  activo: boolean;
};

const miles = new Intl.NumberFormat("es-AR");
const input =
  "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-wine-2 focus:bg-surface";

const SUGERENCIAS = ["Alquiler", "Luz", "Gas", "Expensas", "Internet", "Monotributo"];

const FRECUENCIAS: { value: Frecuencia; label: string }[] = [
  { value: "mensual", label: "Mensual" },
  { value: "quincenal", label: "Cada 15 días" },
  { value: "semanal", label: "Semanal" },
];

const draftVacio = (): FijoDraft => ({
  nombre: "",
  monto: "",
  categoria_id: null,
  frecuencia: "mensual",
  dia: "1",
  dias_semana: [],
  activo: true,
});

function esValido(d: FijoDraft) {
  const dia = Number(d.dia);
  if (!d.nombre.trim() || !(Number(d.monto) > 0)) return false;
  if (d.frecuencia === "semanal") return d.dias_semana.length > 0;
  return dia >= 1 && dia <= (d.frecuencia === "quincenal" ? 15 : 31);
}

function aInput(d: FijoDraft): FijoInput {
  return {
    nombre: d.nombre.trim(),
    monto: Number(d.monto),
    categoria_id: d.categoria_id,
    frecuencia: d.frecuencia,
    dia: d.frecuencia === "semanal" ? 1 : Number(d.dia),
    dias_semana: d.frecuencia === "semanal" ? d.dias_semana : [],
    activo: d.activo,
  };
}

const estimadoDraft = (d: FijoDraft) =>
  estimadoMensual(
    { frecuencia: d.frecuencia, dia: Number(d.dia), dias_semana: d.dias_semana, monto: Number(d.monto) },
    currentMonth(),
  );

export function FijosManager({
  fijos,
  categorias,
  aiEnabled,
}: {
  fijos: GastoFijo[];
  categorias: Categoria[];
  aiEnabled: boolean;
}) {
  const [editing, setEditing] = useState<GastoFijo | "new" | null>(null);
  const [dictando, setDictando] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const catName = new Map(categorias.map((c) => [c.id, c.nombre]));
  const mes = currentMonth();

  return (
    <>
      {fijos.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
          {fijos.map((f) => (
            <li key={f.id}>
              {borrando === f.id ? (
                <div className="flex items-center gap-2 bg-wine-soft px-4 py-3">
                  <span className="min-w-0 flex-1 text-sm text-wine">
                    ¿Borrar <strong>{f.nombre}</strong>? Lo ya anotado queda en el historial.
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
                    <span className="block truncate text-xs text-ink-3">
                      {textoFrecuencia(f)} · {(f.categoria_id && catName.get(f.categoria_id)) ?? "Sin categoría"}
                      {f.activo ? "" : " · Pausado"}
                    </span>
                  </button>
                  <span className="tabular shrink-0 pr-1 text-right">
                    <span className="block font-medium">
                      {money(f.monto)}
                      {f.frecuencia !== "mensual" ? <span className="text-xs font-normal text-ink-3"> c/u</span> : null}
                    </span>
                    {f.frecuencia !== "mensual" ? (
                      <span className="block text-xs text-ink-3">≈ {money(estimadoMensual(f, mes))}/mes</span>
                    ) : null}
                  </span>
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
          Cargá el alquiler, la luz, las flores de los lunes y todo lo que se repite.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setDictando(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-wine py-3.5 font-medium text-bg active:scale-[0.99]"
        >
          <MicIcon width={18} height={18} /> Dictar o pegar fijos
        </button>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 text-sm font-medium text-ink-2 active:bg-bg"
        >
          <PlusIcon width={16} height={16} /> Agregar uno a mano
        </button>
      </div>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nuevo gasto fijo" : "Editar gasto fijo"}
      >
        {editing ? (
          <FijoForm
            fijo={editing === "new" ? null : editing}
            categorias={categorias}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>

      <Sheet open={dictando} onClose={() => setDictando(false)} title="Dictar gastos fijos">
        {dictando ? (
          <DictarFijos categorias={categorias} aiEnabled={aiEnabled} onDone={() => setDictando(false)} />
        ) : null}
      </Sheet>
    </>
  );
}

// Campos de un fijo --------------------------------------------------------

function FijoFields({
  value: d,
  onChange,
  categorias,
}: {
  value: FijoDraft;
  onChange: (next: FijoDraft) => void;
  categorias: Categoria[];
}) {
  const set = (patch: Partial<FijoDraft>) => onChange({ ...d, ...patch });
  const toggleDia = (dia: number) =>
    set({
      dias_semana: d.dias_semana.includes(dia)
        ? d.dias_semana.filter((x) => x !== dia)
        : [...d.dias_semana, dia].sort((a, b) => a - b),
    });

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <label className="col-span-2">
        <span className="mb-1 block text-xs text-ink-3">Nombre</span>
        <input
          className={input}
          value={d.nombre}
          onChange={(e) => {
            const nombre = e.target.value;
            // Sugiere la categoría mientras escribe, salvo que ya la haya elegido a mano
            const anterior = adivinarCategoria(d.nombre, categorias);
            const nueva = adivinarCategoria(nombre, categorias);
            const elegidaAMano = d.categoria_id !== null && d.categoria_id !== anterior;
            set(elegidaAMano || !nueva ? { nombre } : { nombre, categoria_id: nueva });
          }}
          placeholder="Ej: Alquiler"
          maxLength={100}
        />
      </label>

      <label className="relative col-span-2 min-w-0">
        <span className="mb-1 block text-xs text-ink-3">
          {d.frecuencia === "mensual" ? "Monto" : "Monto de cada vez"}
        </span>
        <span className="pointer-events-none absolute bottom-3 left-3 text-ink-3">$</span>
        <input
          className={`${input} tabular pl-7 font-medium`}
          inputMode="numeric"
          placeholder="0"
          value={d.monto ? miles.format(Number(d.monto)) : ""}
          onChange={(e) => set({ monto: onlyDigits(e.target.value) })}
        />
      </label>

      <div className="col-span-2">
        <span className="mb-1 block text-xs text-ink-3">Cada cuánto</span>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1" role="radiogroup" aria-label="Frecuencia">
          {FRECUENCIAS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={d.frecuencia === f.value}
              onClick={() =>
                set({
                  frecuencia: f.value,
                  dia: f.value === "quincenal" ? String(Math.min(Number(d.dia) || 1, 15)) : d.dia,
                })
              }
              className={`rounded-lg py-2 text-sm ${
                d.frecuencia === f.value ? "bg-surface font-medium text-wine shadow-sm" : "text-ink-2"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {d.frecuencia === "semanal" ? (
        <div className="col-span-2">
          <span className="mb-1 block text-xs text-ink-3">Qué días</span>
          <div className="grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map((nombre, i) => {
              const dia = i + 1;
              const activo = d.dias_semana.includes(dia);
              return (
                <button
                  key={dia}
                  type="button"
                  aria-pressed={activo}
                  aria-label={nombre}
                  onClick={() => toggleDia(dia)}
                  className={`rounded-lg py-2 text-sm font-medium capitalize ${
                    activo ? "bg-wine text-bg" : "bg-bg text-ink-2"
                  }`}
                >
                  {nombre.slice(0, 2)}
                </button>
              );
            })}
          </div>
          {!d.dias_semana.length ? <p className="mt-1 text-xs text-danger">Elegí al menos un día</p> : null}
        </div>
      ) : (
        <label className="col-span-2">
          <span className="mb-1 block text-xs text-ink-3">
            {d.frecuencia === "quincenal" ? "Primer día del mes (1 al 15)" : "Día del mes"}
          </span>
          <div className="flex items-center gap-3">
            <input
              className={`${input} tabular w-20`}
              inputMode="numeric"
              value={d.dia}
              onChange={(e) => set({ dia: onlyDigits(e.target.value).slice(0, 2) })}
            />
            {d.frecuencia === "quincenal" && Number(d.dia) >= 1 && Number(d.dia) <= 15 ? (
              <span className="text-sm text-ink-2">y el día {Number(d.dia) + 15}</span>
            ) : null}
          </div>
        </label>
      )}

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
  );
}

// Alta y edición de uno ----------------------------------------------------

function FijoForm({
  fijo,
  categorias,
  onDone,
}: {
  fijo: GastoFijo | null;
  categorias: Categoria[];
  onDone: () => void;
}) {
  const [d, setD] = useState<FijoDraft>(
    fijo
      ? {
          nombre: fijo.nombre,
          monto: String(Math.round(fijo.monto)),
          categoria_id: fijo.categoria_id,
          frecuencia: fijo.frecuencia,
          dia: String(fijo.dia),
          dias_semana: fijo.dias_semana,
          activo: fijo.activo,
        }
      : draftVacio(),
  );
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
      {!fijo ? (
        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                setD((prev) => ({
                  ...prev,
                  nombre: s,
                  categoria_id: adivinarCategoria(s, categorias) ?? prev.categoria_id,
                }))
              }
              className={`rounded-full border px-3 py-1.5 text-sm ${
                d.nombre === s ? "border-wine bg-wine-soft text-wine" : "border-line text-ink-2"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <FijoFields value={d} onChange={setD} categorias={categorias} />

      {fijo ? (
        <label className="flex items-center justify-between rounded-xl bg-bg px-3 py-3">
          <span>
            <span className="block text-sm font-medium">Activo</span>
            <span className="block text-xs text-ink-3">Si lo pausás, deja de anotarse</span>
          </span>
          <input
            type="checkbox"
            checked={d.activo}
            onChange={(e) => setD((prev) => ({ ...prev, activo: e.target.checked }))}
            className="size-5 accent-[var(--wine)]"
          />
        </label>
      ) : null}

      {fijo && d.frecuencia === "mensual" ? (
        <p className="text-xs text-ink-3">Si cambiás el monto, se corrige también el de este mes.</p>
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!esValido(d) || pending}
        onClick={() => run(() => guardarFijo(fijo?.id ?? null, aInput(d)))}
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
          {confirmDelete ? "Tocá de nuevo para borrar" : "Borrar (lo ya anotado queda)"}
        </button>
      ) : null}
    </div>
  );
}

// Dictar o pegar varios -----------------------------------------------------

type FijoLeido = {
  nombre: string;
  monto: number;
  categoria_id: string | null;
  frecuencia: Frecuencia;
  dia: number;
  dias_semana: number[];
};

type Paso =
  | { name: "texto" }
  | { name: "grabando" }
  | { name: "procesando" }
  | { name: "revisar" }
  | { name: "error"; message: string };

function DictarFijos({
  categorias,
  aiEnabled,
  onDone,
}: {
  categorias: Categoria[];
  aiEnabled: boolean;
  onDone: () => void;
}) {
  const [paso, setPaso] = useState<Paso>({ name: "texto" });
  const [texto, setTexto] = useState("");
  const [drafts, setDrafts] = useState<FijoDraft[]>([]);
  const [saving, startSaving] = useTransition();
  const recorder = useRecorder({
    onAudio: (audio) => void leer(audio),
    onError: (message) => setPaso({ name: "error", message }),
  });

  async function leer(payload: Blob | string) {
    setPaso({ name: "procesando" });
    try {
      const data = await interpretar<{ fijos?: FijoLeido[] }>(payload, "fijos");
      const leidos = (data.fijos ?? []).map(
        (f): FijoDraft => ({
          nombre: f.nombre,
          monto: String(f.monto),
          categoria_id: f.categoria_id,
          frecuencia: f.frecuencia,
          dia: String(f.dia),
          dias_semana: f.dias_semana,
          activo: true,
        }),
      );
      setDrafts(leidos.length ? leidos : [draftVacio()]);
      setPaso({ name: "revisar" });
    } catch (error) {
      setPaso({
        name: "error",
        message:
          error instanceof TypeError ? "Sin conexión. Revisá internet y probá de nuevo." : (error as Error).message,
      });
    }
  }

  const validos = drafts.filter(esValido);
  const total = validos.reduce((s, d) => s + estimadoDraft(d), 0);

  function guardar() {
    startSaving(async () => {
      try {
        await crearFijos(validos.map(aInput));
        onDone();
      } catch {
        setPaso({ name: "error", message: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  if (paso.name === "grabando") {
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <p className="max-w-64 text-sm text-ink-2">
          Decí cada fijo con su monto y cada cuánto. Ej: <em>“flores lunes y miércoles 280 mil”</em>
        </p>
        <button
          type="button"
          onClick={recorder.stop}
          aria-label="Terminar y anotar"
          className="flex size-24 items-center justify-center rounded-full bg-wine text-bg active:scale-95"
        >
          <StopIcon width={32} height={32} />
        </button>
        <p className="tabular font-display text-3xl">
          {Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, "0")}
        </p>
        <button
          type="button"
          onClick={() => {
            recorder.cancel();
            setPaso({ name: "texto" });
          }}
          className="py-2 text-sm text-ink-2"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (paso.name === "procesando") {
    return (
      <div className="flex flex-col items-center gap-4 py-12" role="status">
        <span className="size-10 animate-spin rounded-full border-4 border-wine-soft border-t-wine" />
        <p className="text-sm text-ink-2">Leyendo los fijos…</p>
      </div>
    );
  }

  if (paso.name === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-ink-2" role="alert">
          {paso.message}
        </p>
        <button
          type="button"
          onClick={() => setPaso({ name: "texto" })}
          className="w-full rounded-2xl bg-wine py-3.5 font-medium text-bg"
        >
          Probar de nuevo
        </button>
      </div>
    );
  }

  if (paso.name === "revisar") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          {validos.length === 1 ? "Encontré 1 gasto fijo." : `Encontré ${validos.length} gastos fijos.`} Revisalos
          antes de guardar.
        </p>
        <ul className="flex flex-col gap-4">
          {drafts.map((d, i) => (
            <li key={i} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wide text-ink-3 uppercase">Fijo {i + 1}</span>
                <button
                  type="button"
                  onClick={() => setDrafts((all) => all.filter((_, j) => j !== i))}
                  aria-label={`Quitar fijo ${i + 1}`}
                  className="-mr-1 rounded-full p-1.5 text-ink-3 active:bg-bg"
                >
                  <TrashIcon width={18} height={18} />
                </button>
              </div>
              <FijoFields
                value={d}
                categorias={categorias}
                onChange={(next) => setDrafts((all) => all.map((x, j) => (j === i ? next : x)))}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setDrafts((all) => [...all, draftVacio()])}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-sm text-ink-2 active:bg-bg"
        >
          <PlusIcon width={16} height={16} /> Agregar otro
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={!validos.length || saving}
          className="tabular rounded-2xl bg-wine py-3.5 font-medium text-bg disabled:opacity-40"
        >
          {saving
            ? "Guardando…"
            : `Guardar ${validos.length} ${validos.length === 1 ? "fijo" : "fijos"} · ≈ ${money(total)}/mes`}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (texto.trim()) void leer(texto.trim());
      }}
    >
      <p className="text-sm text-ink-2">
        Decilos todos juntos, con su monto y cada cuánto. También podés pegar una lista. Ej:{" "}
        <em>“flores lunes y miércoles 280 mil, alquiler 1.370.000 el día 1, papelería cada 15 días 100 mil”</em>
      </p>
      {!aiEnabled ? (
        <p className="text-xs text-ink-3">
          Para dictar, tocá <MicIcon width={13} height={13} className="-mt-0.5 inline" aria-label="el micrófono" /> en
          el teclado.
        </p>
      ) : null}
      <textarea
        autoFocus
        rows={5}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ej: luz 160 mil el 10, expensas 160 mil"
        className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus:border-wine-2 focus:bg-surface"
      />
      <button
        type="submit"
        disabled={!texto.trim()}
        className="rounded-2xl bg-wine py-3.5 font-medium text-bg disabled:opacity-40"
      >
        Leer fijos
      </button>
      {aiEnabled ? (
        <button
          type="button"
          onClick={() => {
            setPaso({ name: "grabando" });
            void recorder.start();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-line py-3 text-sm font-medium text-ink-2 active:bg-bg"
        >
          <MicIcon width={16} height={16} /> Grabar un audio
        </button>
      ) : null}
    </form>
  );
}
