"use client";

import { useState, useTransition } from "react";
import { login } from "@/lib/actions";

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function PinPad() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function press(key: string) {
    if (pending) return;
    setError(null);
    if (key === "⌫") return setPin((p) => p.slice(0, -1));
    if (!key || pin.length >= PIN_LENGTH) return;

    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      startTransition(async () => {
        const result = await login(next);
        if (result?.error) {
          setError(result.error);
          setPin("");
          navigator.vibrate?.(120);
        }
      });
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-ink-2">Ingresá el PIN</p>
        <div className="flex gap-4" aria-live="polite" aria-label={`${pin.length} de ${PIN_LENGTH} dígitos`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`size-3.5 rounded-full border-2 transition-colors ${
                i < pin.length ? "border-wine bg-wine" : "border-ink-3"
              } ${error ? "border-danger" : ""}`}
            />
          ))}
        </div>
        <p className="h-5 text-sm text-danger" role="alert">
          {error ?? (pending ? <span className="text-ink-2">Entrando…</span> : null)}
        </p>
      </div>

      <div className="grid w-full max-w-72 grid-cols-3 gap-4">
        {KEYS.map((key, i) =>
          key ? (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              aria-label={key === "⌫" ? "Borrar" : key}
              className="tabular flex aspect-square items-center justify-center rounded-full bg-surface text-2xl font-medium text-ink shadow-[0_1px_0_var(--line)] active:scale-95 active:bg-wine-soft"
            >
              {key}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}
