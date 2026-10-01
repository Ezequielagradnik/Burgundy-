"use client";

import { useEffect, useState, useTransition } from "react";
import { crearGastos } from "@/lib/actions";
import type { Categoria } from "@/lib/data";
import { money, today } from "@/lib/format";
import { GastoFields, isValidDraft, toInput, type Draft } from "./gasto-fields";
import { KeyboardIcon, MicIcon, PlusIcon, StopIcon, TrashIcon } from "./icons";
import { Sheet } from "./sheet";
import { interpretar, useRecorder } from "./use-recorder";

type Step =
  | { name: "recording" }
  | { name: "typing" }
  | { name: "processing" }
  | { name: "review"; origen: "audio" | "texto" | "manual"; texto?: string }
  | { name: "error"; message: string };

type GastoLeido = { descripcion: string; monto: number; categoria_id: string | null; fecha: string };

const emptyDraft = (): Draft => ({ descripcion: "", monto: "", categoria_id: null, fecha: today() });

export function VoiceCapture({ categorias, aiEnabled }: { categorias: Categoria[]; aiEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ name: "recording" });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [texto, setTexto] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const recorder = useRecorder({
    onAudio: (audio) => void send(audio),
    onError: (message) => setStep({ name: "error", message }),
  });
  const { seconds } = recorder;

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(id);
  }, [saved]);

  // Sin IA: el botón abre directo la carga campo por campo
  function openManual() {
    recorder.cancel();
    setDrafts([emptyDraft()]);
    setStep({ name: "review", origen: "manual" });
    setOpen(true);
  }

  // Texto libre ("flores 45 mil y nafta 20 mil"), escrito o dictado con el teclado
  function openTyping() {
    recorder.cancel();
    setTexto("");
    setStep({ name: "typing" });
    setOpen(true);
  }

  function startRecording() {
    setStep({ name: "recording" });
    setOpen(true);
    void recorder.start();
  }

  function stopRecording() {
    recorder.stop();
  }

  async function send(payload: Blob | string) {
    setStep({ name: "processing" });
    try {
      const data = await interpretar<{ gastos?: GastoLeido[] }>(payload, "gastos");
      const found = (data.gastos ?? []).map((g) => ({ ...g, monto: String(g.monto) }));
      setDrafts(found.length ? found : [{ ...emptyDraft(), descripcion: data.texto?.slice(0, 80) ?? "" }]);
      setStep({
        name: "review",
        origen: typeof payload === "string" ? "texto" : "audio",
        texto: data.texto,
      });
    } catch (error) {
      setStep({
        name: "error",
        message:
          error instanceof TypeError
            ? "Sin conexión. Revisá internet y probá de nuevo."
            : String((error as Error).message),
      });
    }
  }

  function close() {
    recorder.cancel();
    setOpen(false);
    setTexto("");
  }

  function save() {
    if (step.name !== "review") return;
    const valid = drafts.filter(isValidDraft);
    if (!valid.length) return;
    startSaving(async () => {
      try {
        await crearGastos(valid.map(toInput), step.origen, step.texto);
        const total = valid.reduce((s, d) => s + Number(d.monto), 0);
        setSaved(`${valid.length === 1 ? "Anotado" : `${valid.length} gastos anotados`} · ${money(total)}`);
        close();
      } catch {
        setStep({ name: "error", message: "No se pudo guardar. Probá de nuevo." });
      }
    });
  }

  const validCount = drafts.filter(isValidDraft).length;
  const total = drafts.filter(isValidDraft).reduce((s, d) => s + Number(d.monto), 0);

  return (
    <>
      <button
        type="button"
        onClick={aiEnabled ? startRecording : openManual}
        aria-label="Anotar un gasto"
        className="-mt-7 mb-1 flex size-16 items-center justify-center rounded-full bg-wine text-bg shadow-lg shadow-wine/30 ring-4 ring-bg active:scale-95"
      >
        <MicIcon width={28} height={28} />
      </button>

      {saved ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-30 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-bg shadow-lg"
        >
          {saved}
        </div>
      ) : null}

      <Sheet
        open={open}
        onClose={close}
        title={
          step.name === "review"
            ? step.origen === "manual"
              ? "Nuevo gasto"
              : "Revisá y guardá"
            : step.name === "typing" && aiEnabled
              ? "Escribí el gasto"
              : "Nuevo gasto"
        }
      >
        {step.name === "recording" ? (
          <div className="flex flex-col items-center gap-6 py-4 text-center">
            <p className="max-w-64 text-sm text-ink-2">
              Decí qué pagaste y cuánto. Ej: <em>“50 rosas a 80 mil y el flete 12 mil”</em>
            </p>
            <div className="relative flex size-28 items-center justify-center">
              <span className="pulse-ring absolute inset-0 rounded-full bg-wine/30" />
              <button
                type="button"
                onClick={stopRecording}
                aria-label="Terminar y anotar"
                className="relative flex size-24 items-center justify-center rounded-full bg-wine text-bg active:scale-95"
              >
                <StopIcon width={32} height={32} />
              </button>
            </div>
            <p className="tabular font-display text-3xl">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </p>
            <p className="text-sm text-ink-3">Tocá el cuadrado cuando termines</p>
            <button
              type="button"
              onClick={() => {
                recorder.cancel();
                setStep({ name: "typing" });
              }}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-ink-2 active:bg-bg"
            >
              <KeyboardIcon width={18} height={18} /> Prefiero escribir
            </button>
          </div>
        ) : null}

        {step.name === "typing" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (texto.trim()) void send(texto.trim());
            }}
          >
            {!aiEnabled ? (
              <p className="text-sm text-ink-2">
                Tocá <MicIcon width={15} height={15} className="inline -mt-0.5" aria-label="el micrófono" /> en el
                teclado y decí el gasto. Ej: <em>“50 rosas a 80 mil y el flete 12 mil”</em>
              </p>
            ) : null}
            <textarea
              autoFocus
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej: flores 45000, nafta 20000"
              className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus:border-wine-2 focus:bg-surface"
            />
            <button
              type="submit"
              disabled={!texto.trim()}
              className="rounded-2xl bg-wine py-3.5 font-medium text-bg disabled:opacity-40"
            >
              Anotar
            </button>
            <button
              type="button"
              onClick={() => {
                setDrafts([emptyDraft()]);
                setStep({ name: "review", origen: "manual" });
              }}
              className="py-2 text-sm text-ink-2"
            >
              Cargar campo por campo
            </button>
          </form>
        ) : null}

        {step.name === "processing" ? (
          <div className="flex flex-col items-center gap-4 py-12" role="status">
            <span className="size-10 animate-spin rounded-full border-4 border-wine-soft border-t-wine" />
            <p className="text-sm text-ink-2">Anotando…</p>
          </div>
        ) : null}

        {step.name === "error" ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-ink-2" role="alert">
              {step.message}
            </p>
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={aiEnabled ? startRecording : openTyping}
                className="rounded-2xl bg-wine py-3.5 font-medium text-bg"
              >
                {aiEnabled ? "Grabar de nuevo" : "Probar de nuevo"}
              </button>
              <button type="button" onClick={() => setStep({ name: "typing" })} className="py-2 text-sm text-ink-2">
                Escribir
              </button>
            </div>
          </div>
        ) : null}

        {step.name === "review" ? (
          <div className="flex flex-col gap-4">
            {step.texto ? <p className="rounded-xl bg-bg px-3 py-2 text-sm text-ink-2 italic">“{step.texto}”</p> : null}

            <ul className="flex flex-col gap-4">
              {drafts.map((d, i) => (
                <li key={i} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
                  {drafts.length > 1 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium tracking-wide text-ink-3 uppercase">Gasto {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => setDrafts((all) => all.filter((_, j) => j !== i))}
                        aria-label={`Quitar gasto ${i + 1}`}
                        className="-mr-1 rounded-full p-1.5 text-ink-3 active:bg-bg"
                      >
                        <TrashIcon width={18} height={18} />
                      </button>
                    </div>
                  ) : null}
                  <GastoFields
                    value={d}
                    categorias={categorias}
                    onChange={(next) => setDrafts((all) => all.map((x, j) => (j === i ? next : x)))}
                  />
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setDrafts((all) => [...all, emptyDraft()])}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-sm text-ink-2 active:bg-bg"
            >
              <PlusIcon width={16} height={16} /> Agregar otro
            </button>

            <button
              type="button"
              onClick={save}
              disabled={!validCount || saving}
              className="tabular rounded-2xl bg-wine py-3.5 font-medium text-bg disabled:opacity-40"
            >
              {saving
                ? "Guardando…"
                : validCount > 1
                  ? `Guardar ${validCount} gastos · ${money(total)}`
                  : `Guardar · ${money(total)}`}
            </button>

            {step.origen === "manual" && !aiEnabled ? (
              <button type="button" onClick={openTyping} className="py-1 text-sm text-ink-2">
                Dictar o escribir varios juntos
              </button>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
