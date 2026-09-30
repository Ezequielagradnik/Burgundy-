import { PinPad } from "./pin-pad";

export default function LoginPage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10">
        <div className="text-center">
          <p className="font-display text-5xl tracking-tight text-wine">Burgundy</p>
          <p className="mt-2 text-sm text-ink-2">Gastos de la florería</p>
        </div>
        <PinPad />
      </div>
    </main>
  );
}
