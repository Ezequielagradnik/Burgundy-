// Se muestra al instante al cambiar de pestaña, mientras llegan los datos
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-md animate-pulse flex-col gap-4 pt-2" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-40 rounded-lg bg-line/70" />
      <div className="h-36 rounded-3xl bg-line/60" />
      <div className="h-52 rounded-3xl bg-line/50" />
      <div className="h-16 rounded-2xl bg-line/40" />
      <div className="h-16 rounded-2xl bg-line/40" />
    </div>
  );
}
