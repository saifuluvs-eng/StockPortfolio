// client/src/components/scanner/technical-indicators.tsx
import * as React from "react";
import type {
  ScanIndicator,
  ScanResult,
  ScanSignal,
} from "@shared/types/scanner";

/**
 * Renders ALL indicators returned by the scan API instead of relying on a hardcoded list.
 * - Sorts by tier (3 -> 1), then by |score| desc, then by name.
 * - Colors: green=bullish, red=bearish, yellow=neutral.
 * - Robust to null/undefined fields so it never crashes the page.
 */

type NormalizedIndicator = {
  value: number | null;
  signal: ScanSignal;
  score: number;
  tier: number;
  description: string;
  key?: string;
};

export default function TechnicalIndicators({
  analysis,
}: {
  analysis?: ScanResult | null;
}) {
  const items = React.useMemo(() => {
    const entries = Object.entries(analysis?.indicators ?? {});
    return entries
      .map(([key, it]) => ({
        key,
        value: it?.value ?? null,
        signal: normalizeSignal(it?.signal),
        score: toNumber(it?.score, 0),
        tier: toNumber(it?.tier, 1),
        description: it?.description ?? "",
      }))
      .sort((a, b) => {
        // Tier desc (3..1)
        if (b.tier !== a.tier) return b.tier - a.tier;
        // Absolute score desc
        const abs = Math.abs(b.score) - Math.abs(a.score);
        if (abs !== 0) return abs;
        // Name asc
        return a.key.localeCompare(b.key);
      });
  }, [analysis]);

  if (!items.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 21l-4.35-4.35m2.1-5.4a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <h3 className="text-lg font-medium mb-2">No Analysis Available</h3>
        <p>Click “Scan” to analyze technical indicators and get detailed insights</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <IndicatorCard key={it.key} id={it.key} indicator={it} />
      ))}
    </div>
  );
}

function IndicatorCard({
  id,
  indicator,
}: {
  id: string;
  indicator: NormalizedIndicator;
}) {
  const { value, signal, score, tier, description } = indicator;

  const border =
    signal === "bullish"
      ? "border-green-500/40"
      : signal === "bearish"
      ? "border-red-500/40"
      : "border-yellow-500/40";

  const dot =
    signal === "bullish"
      ? "bg-green-500"
      : signal === "bearish"
      ? "bg-red-500"
      : "bg-yellow-500";

  const badge =
    signal === "bullish"
      ? "text-green-500"
      : signal === "bearish"
      ? "text-red-500"
      : "text-yellow-500";

  const scoreText = score > 0 ? `+${score}` : `${score}`;

  return (
    <div className={`relative rounded-xl border ${border} bg-card/40 p-3`}>
      {/* tier stripe */}
      <div
        className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${
          tier >= 3 ? "bg-primary" : tier === 2 ? "bg-primary/70" : "bg-primary/40"
        }`}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
            <h4 className="text-foreground text-sm font-semibold">{prettyName(id)}</h4>
            <span className={`text-xs font-semibold ${badge}`}>({scoreText})</span>
          </div>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Signal</div>
          <div className={`text-sm font-semibold ${badge}`}>{signal.toUpperCase()}</div>
          {isFiniteNumber(value) && (
            <div className="mt-1 text-xs text-muted-foreground">Value: {formatValue(value!)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function toNumber(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function normalizeSignal(sig: ScanIndicator["signal"]): ScanSignal {
  const s = String(sig ?? "").toLowerCase();
  if (s === "bullish" || s === "bearish" || s === "neutral") return s;
  return "neutral";
}

function prettyName(id: string) {
  // Best-effort prettifier for common IDs; otherwise title-case the id.
  const map: Record<string, string> = {
    rsi: "RSI (14)",
    macd: "MACD (12,26,9)",
    ema20: "EMA 20",
    ema50: "EMA 50",
    ema200: "EMA 200",
    sma20: "SMA 20",
    sma50: "SMA 50",
    sma200: "SMA 200",
    ma_stack: "MA Stack",
    bollinger: "Bollinger Bands (20,2)",
    stoch: "Stochastic (14,3)",
    adx: "ADX (14)",
    atr: "ATR (14)",
    mfi: "MFI (14)",
    cci: "CCI (20)",
    vwap: "VWAP (20)",
    change24: "24h Change",
  };
  if (map[id]) return map[id];
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  if (a === 0) return "0";
  const digits = a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return n.toFixed(digits);
}
