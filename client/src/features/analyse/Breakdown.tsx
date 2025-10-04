import type { ReactNode } from "react";
import { ListChecks } from "lucide-react";

export type BreakdownRow = {
  title: string;
  value: string | number;
  signal: "bullish" | "neutral" | "bearish";
  reason?: string;
};

const COLORS = {
  bullish: {
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/30",
    text: "text-emerald-400",
  },
  neutral: {
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/30",
    text: "text-amber-400",
  },
  bearish: {
    bg: "bg-rose-500/10",
    ring: "ring-rose-500/30",
    text: "text-rose-400",
  },
} as const;

interface BreakdownSectionProps {
  rows?: BreakdownRow[];
  emptyState?: ReactNode;
}

export function BreakdownSection({
  rows = [],
  emptyState,
}: BreakdownSectionProps) {
  const hasRows = rows.length > 0;

  return (
    <section
      className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur p-4 md:p-6 mb-8 overflow-hidden"
      aria-label="Breakdown Technicals"
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
        <ListChecks className="h-5 w-5 opacity-80" />
        Breakdown Technicals
      </h3>

      {hasRows ? (
        <ul className="grid gap-3">
          {rows.map((r, i) => {
            const c = COLORS[r.signal] ?? COLORS.neutral;
            return (
              <li
                key={`${r.title}-${i}`}
                className={`rounded-xl ring-1 ${c.ring} ${c.bg} p-4 md:p-5`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-base font-medium">{r.title}</div>
                  <div className={`text-sm font-semibold tabular-nums ${c.text}`}>
                    {r.value}
                  </div>
                </div>
                {r.reason && (
                  <div className="mt-1 text-sm text-white/70">{r.reason}</div>
                )}
                <div
                  className={`mt-2 text-xs uppercase tracking-wide ${c.text}`}
                >
                  {r.signal}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        emptyState ?? (
          <div className="py-12 text-center text-white/70">
            <div>No technical checks yet.</div>
          </div>
        )
      )}
    </section>
  );
}
