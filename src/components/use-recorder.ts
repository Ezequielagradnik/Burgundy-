"use client";

import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 120;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/** Graba del micrófono. Al parar llama a onAudio con el audio; cancel() descarta y suelta el micrófono. */
export function useRecorder({ onAudio, onError }: { onAudio: (audio: Blob) => void; onError: (msg: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);

  // Timer y corte automático
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) recorder.current?.stop();
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  // Si el componente se desmonta grabando (se cerró la hoja), soltamos el micrófono
  useEffect(
    () => () => {
      cancelled.current = true;
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function releaseMic() {
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recorder.current = null;
    setRecording(false);
  }

  async function start() {
    setSeconds(0);
    cancelled.current = false;

    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      onError("Este navegador no permite grabar audio. Escribilo.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Si cerró la hoja mientras aceptaba el permiso, soltamos el micrófono
      if (cancelled.current) return stream.getTracks().forEach((t) => t.stop());
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        releaseMic();
        if (cancelled.current) return;
        onAudio(new Blob(chunks.current, { type: rec.mimeType || "audio/mp4" }));
      };
      recorder.current = rec;
      rec.start(1000);
      setRecording(true);
    } catch {
      onError("No tengo permiso para usar el micrófono. Activalo en Ajustes > Safari > Micrófono, o escribilo.");
    }
  }

  function stop() {
    recorder.current?.stop();
  }

  function cancel() {
    cancelled.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    releaseMic();
  }

  return { start, stop, cancel, seconds, recording };
}

/** Manda audio o texto a /api/audio para que lo interprete (IA o reglas). */
export async function interpretar<T>(payload: Blob | string, tipo: "gastos" | "fijos") {
  const form = new FormData();
  form.set("tipo", tipo);
  if (typeof payload === "string") form.set("texto", payload);
  else form.set("audio", payload, payload.type.includes("webm") ? "audio.webm" : "audio.m4a");

  const res = await fetch("/api/audio", { method: "POST", body: form });
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Sesión vencida");
  }
  const data = (await res.json()) as T & { texto?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Algo falló. Probá de nuevo.");
  return data;
}
