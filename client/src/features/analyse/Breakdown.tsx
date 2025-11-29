import React, { type ReactNode } from "react";

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
  symbol?: string;
  timeframe?: string;
}

export function BreakdownSection({
  rows = [],
  emptyState,
  symbol,
  timeframe,
}: BreakdownSectionProps) {
  const hasRows = rows.length > 0;

  return (
    <section
      className="
        rounded-2xl border border-border bg-card backdrop-blur
        overflow-hidden flex flex-col mb-8
      "
      aria-label="Breakdown Technicals"
    >
      {/* sticky header stays visible while list scrolls */}
      <header className="sticky top-0 z-10 bg-muted/60 backdrop-blur px-4 md:px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <span className="i-lucide-list-checks h-5 w-5 opacity-80" />
          Breakdown Technicals
        </h3>
        {symbol && timeframe && (
          <div className="text-sm font-medium text-muted-foreground uppercase">
            {symbol} <span className="text-xs opacity-70">{timeframe}</span>
          </div>
        )}
      </header>

      {/* scrollable list area */}
      <div
        className="
          flex-1 overflow-y-auto overscroll-contain px-4 md:px-5 py-4
          space-y-3 min-h-[400px] md:min-h-[520px] lg:min-h-[620px]
        "
        // desktop: tall card; mobile: slightly shorter
        style={{ maxHeight: "70vh" }}
      >
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
                    <div className="mt-1 text-sm text-muted-foreground">{r.reason}</div>
                  )}
                  <div className={`mt-2 text-xs uppercase tracking-wide ${c.text}`}>
                    {r.signal}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          emptyState ?? (
            <div className="flex h-full w-full items-center justify-center py-12 text-center text-muted-foreground">
              <div>No technical checks yet.</div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
