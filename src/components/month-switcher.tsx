import Link from "next/link";
import { addMonths, currentMonth, monthLabel } from "@/lib/format";
import { ChevronIcon } from "./icons";

export function MonthSwitcher({ month, basePath }: { month: string; basePath: string }) {
  const isCurrent = month >= currentMonth();
  const href = (m: string) => (m === currentMonth() ? basePath : `${basePath}?mes=${m}`);

  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface p-1.5">
      <Link
        href={href(addMonths(month, -1))}
        aria-label="Mes anterior"
        className="flex size-10 items-center justify-center rounded-xl text-ink-2 active:bg-bg"
      >
        <ChevronIcon className="rotate-180" width={20} height={20} />
      </Link>
      <span className="font-medium capitalize">{monthLabel(month, true)}</span>
      {isCurrent ? (
        <span className="size-10" />
      ) : (
        <Link
          href={href(addMonths(month, 1))}
          aria-label="Mes siguiente"
          className="flex size-10 items-center justify-center rounded-xl text-ink-2 active:bg-bg"
        >
          <ChevronIcon width={20} height={20} />
        </Link>
      )}
    </div>
  );
}

export function parseMonth(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) && v <= currentMonth() ? v : currentMonth();
}
