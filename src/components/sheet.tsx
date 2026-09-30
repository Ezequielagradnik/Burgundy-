"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Hoja que sube desde abajo, sobre un <dialog> nativo (maneja foco y Escape). */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface p-0 text-ink sm:mx-auto sm:mb-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="pb-safe px-5 pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full px-3 py-1.5 text-sm text-ink-2 active:bg-bg"
          >
            Cerrar
          </button>
        </div>
        <div className="pb-5">{open ? children : null}</div>
      </div>
    </dialog>
  );
}
