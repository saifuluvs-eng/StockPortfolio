export type TechPayload = {
  summary: string;
  indicators: Record<string, any>;
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
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    summary: `Technical snapshot for ${symbol} @ ${tf}`,
    indicators: { rsi: 60, macd: "bullish" },
    generatedAt: new Date().toISOString(),
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
