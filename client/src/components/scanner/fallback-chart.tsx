// client/src/components/scanner/fallback-chart.tsx
import { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { OhlcvCandle } from "@/lib/analyseClient";

type FallbackChartProps = {
  symbol: string;
  interval: string; // accepts: "15" | "60" | "240" | "D" | "W" | "15m" | "1h" | "4h" | "1d" | "1w"
  candles?: OhlcvCandle[];
  isLoading?: boolean;
};

type ChartData = {
  time: string;
  price: number;
  volume: number;
};

function normalizeInterval(raw: string) {
  const v = (raw || "").toLowerCase();
  switch (v) {
    case "15":
    case "15m":
      return { key: "15m", points: 96, stepMs: 15 * 60 * 1000, label: "15m" };
    case "60":
    case "1h":
      return { key: "1h", points: 24, stepMs: 60 * 60 * 1000, label: "1h" };
    case "240":
    case "4h":
      return { key: "4h", points: 24, stepMs: 4 * 60 * 60 * 1000, label: "4h" };
    case "d":
    case "1d":
      return { key: "1d", points: 30, stepMs: 24 * 60 * 60 * 1000, label: "1D" };
    case "w":
    case "1w":
      return { key: "1w", points: 26, stepMs: 7 * 24 * 60 * 60 * 1000, label: "1W" };
    default:
      // sensible default
      return { key: "1d", points: 30, stepMs: 24 * 60 * 60 * 1000, label: "1D" };
  }
}

function inferBasePrice(sym: string) {
  const s = (sym || "").toUpperCase();
  if (s.includes("BTC")) return 45000;
  if (s.includes("ETH")) return 3000;
  if (s.includes("BNB")) return 400;
  if (s.includes("ADA")) return 0.5;
  if (s.includes("SOL")) return 100;
  return 50;
}

function decimalsForSymbol(sym: string) {
  const s = (sym || "").toUpperCase();
  if (s.includes("BTC") || s.includes("ETH") || s.includes("BNB")) return 2;
  if (s.includes("SOL")) return 3;
  return 4;
}

function generateFallbackData(symbol: string, intervalKey: string, points: number, stepMs: number): ChartData[] {
  const basePrice = inferBasePrice(symbol);
  const dec = decimalsForSymbol(symbol);

  const data: ChartData[] = [];
  const now = Date.now();

  for (let i = points - 1; i >= 0; i--) {
    // Slight, realistic movement: ±5% and a tiny trend
    const variation = (Math.random() - 0.5) * 0.10; // ±5% either side total = 10% span
    const trend = 0.04 * ((points - 1 - i) / Math.max(points - 1, 1)); // up to +4% across the window
    const priceRaw = basePrice * (1 + variation + trend);
    const timeMs = now - i * stepMs;

    const isDailyPlus = intervalKey === "1d" || intervalKey === "1w";
    const timeLabel = isDailyPlus
      ? new Date(timeMs).toLocaleDateString(undefined, { month: "short", day: "2-digit" })
      : new Date(timeMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    data.push({
      time: timeLabel,
      price: parseFloat(priceRaw.toFixed(dec)),
      // scale volume loosely to price so charts look natural
      volume: Math.round((Math.random() * 0.8 + 0.2) * basePrice * 1000),
    });
  }

  return data;
}

function candlesToChartData(symbol: string, candles: OhlcvCandle[]): ChartData[] {
  const dec = decimalsForSymbol(symbol);
  const subset = candles.slice(-150);
  return subset.map((candle) => {
    const timeLabel = new Date(candle.openTime).toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      time: timeLabel,
      price: parseFloat(candle.close.toFixed(dec)),
      volume: candle.volume,
    };
  });
}

export function FallbackChart({ symbol, interval, candles, isLoading }: FallbackChartProps) {
  const { key, points, stepMs, label } = useMemo(() => normalizeInterval(interval), [interval]);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  useEffect(() => {
    if (isLoading) {
      setChartData([]);
      return;
    }
    if (candles && candles.length) {
      setChartData(candlesToChartData(symbol, candles));
      return;
    }
    setChartData(generateFallbackData(symbol, key, points, stepMs));
  }, [symbol, key, points, stepMs, candles, isLoading]);

  const dec = decimalsForSymbol(symbol);

  return (
    <div className="h-[400px] w-full rounded-b-xl bg-card p-4" data-testid="fallback-chart">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">{symbol.toUpperCase()}</h3>
        <p className="text-sm text-muted-foreground">Demo Chart — {label} timeframe</p>
      </div>

      {isLoading && (
        <div className="mb-4 text-sm text-muted-foreground">Loading price data…</div>
      )}

      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            domain={[
              (dataMin: number) => (Number.isFinite(dataMin) ? dataMin * 0.985 : 0),
              (dataMax: number) => (Number.isFinite(dataMax) ? dataMax * 1.015 : 1),
            ]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              color: "hsl(var(--foreground))",
            }}
            formatter={(val: unknown) => {
              const num = typeof val === "number" ? val : Number(val);
              if (Number.isNaN(num)) return ["—", "Price"];
              return [`$${num.toLocaleString(undefined, { maximumFractionDigits: dec })}`, "Price"];
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-2 text-xs text-muted-foreground text-center">
        Fallback chart — using cached OHLC data when available.
      </div>
    </div>
  );
}

// Keep both named and default export to avoid import mismatches elsewhere.
export default FallbackChart;
