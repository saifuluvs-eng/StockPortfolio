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

// TODO: replace with real calls later
export async function computeTechnicalAll(
  symbol: string,
  tf: string,
): Promise<TechPayload> {
  const r = await fetch(
    `/api/metrics?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`,
  );
  if (!r.ok) throw new Error("metrics_failed");
  const data = await r.json();
  return data as { indicators: TechPayload["indicators"]; generatedAt: string };
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
