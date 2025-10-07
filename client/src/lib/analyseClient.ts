import { api } from "@/lib/api";

export type TechPayload = {
  summary?: string;
  indicators: {
    close: number;
    rsi?: number;
    macd?: { macd: number; signal: number; histogram: number };
    adx?: number;
    ema: { e20?: number; e50?: number; e200?: number };
    atrPct?: number;
    vol: { last: number; zScore: number; xAvg50: number };
    srProximityPct?: number;
    trendScore: number;
  };
  generatedAt: string;
};

export type AIPayload = {
  source: "openai" | "heuristic";
  summary: string;
  entry?: string;
  target?: string;
  stop?: string;
  confidence: "low" | "med" | "high";
  generatedAt: string;
};

type MetricsResponse = {
  symbol: string;
  tf: string;
  generatedAt: string;
  summary?: string;
  indicators: TechPayload["indicators"];
};

// TODO: replace with real calls later
export async function computeTechnicalAll(
  symbol: string,
  tf: string,
): Promise<TechPayload> {
  const url = `/api/metrics?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
  const res = await api(url);

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Failed to load metrics (${res.status})`);
  }

  const data = (await res.json()) as MetricsResponse;

  if (!data?.indicators) {
    throw new Error("Metrics response missing indicators");
  }

  return {
    summary: data.summary,
    indicators: data.indicators,
    generatedAt: data.generatedAt ?? new Date().toISOString(),
  };
}

export async function computeAI(
  symbol: string,
  tf: string,
  tech?: TechPayload,
): Promise<AIPayload> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    source: "heuristic",
    summary: `AI-style read for ${symbol} @ ${tf}`,
    entry: "—",
    target: "—",
    stop: "—",
    confidence: "med",
    generatedAt: new Date().toISOString(),
  };
}
