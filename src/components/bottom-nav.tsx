"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Categoria } from "@/lib/data";
import { ChartIcon, HomeIcon, ListIcon, RepeatIcon } from "./icons";
import { VoiceCapture } from "./voice-capture";

const LEFT = [
  { href: "/", label: "Inicio", Icon: HomeIcon },
  { href: "/gastos", label: "Gastos", Icon: ListIcon },
] as const;
const RIGHT = [
  { href: "/resumen", label: "Resumen", Icon: ChartIcon },
  { href: "/fijos", label: "Fijos", Icon: RepeatIcon },
] as const;

export function BottomNav({ categorias, aiEnabled }: { categorias: Categoria[]; aiEnabled: boolean }) {
  const pathname = usePathname();

  const tab = ({ href, label, Icon }: (typeof LEFT)[number] | (typeof RIGHT)[number]) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        prefetch
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ${
          active ? "text-wine" : "text-ink-3"
        }`}
      >
        <Icon width={22} height={22} strokeWidth={active ? 2.2 : 1.8} />
        {label}
      </Link>
    );
  };

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-end px-2">
        {LEFT.map(tab)}
        <div className="flex flex-1 justify-center">
          <VoiceCapture categorias={categorias} aiEnabled={aiEnabled} />
        </div>
        {RIGHT.map(tab)}
      </div>
    </nav>
  );
}
