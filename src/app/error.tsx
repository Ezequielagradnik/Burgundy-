"use client";

import { useEffect } from "react";

// Si falla la carga (base pausada, sin conexión), en vez de la pantalla negra de Next
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-display text-4xl text-wine">Burgundy</p>
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-medium">No pudimos cargar los datos</h1>
        <p className="text-sm text-ink-2">
          Puede ser la conexión a internet o la base de datos. Esperá un minuto y probá de nuevo.
        </p>
      </div>
      <button type="button" onClick={retry} className="w-full rounded-2xl bg-wine py-3.5 font-medium text-bg">
        Probar de nuevo
      </button>
      {error.digest ? <p className="tabular text-xs text-ink-3">Código: {error.digest}</p> : null}
    </main>
  );
}
