import { connection } from "next/server";
import { BottomNav } from "@/components/bottom-nav";
import { aiEnabled } from "@/lib/ai";
import { ensureFijosDelMes, getCategorias } from "@/lib/data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Datos siempre frescos: nada de esta sección se prerenderiza en el build
  await connection();
  const [categorias] = await Promise.all([getCategorias(), ensureFijosDelMes()]);

  return (
    <>
      <main className="pt-safe mx-auto min-h-dvh max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
        {children}
      </main>
      <BottomNav categorias={categorias} aiEnabled={aiEnabled()} />
    </>
  );
}
