import type { ScanResultLike } from "./demoStore";

const BASE_INDICATORS: ScanResultLike["indicators"] = {
  rsi: {
    value: 56.2,
    signal: "bullish",
    score: 3,
    tier: 2,
    description: "RSI trending higher but below overbought territory.",
  },
  macd: {
    value: 1.8,
    signal: "bullish",
    score: 4,
    tier: 3,
    description: "MACD crossed above signal line with widening histogram.",
  },
  ema_crossover: {
    value: 0,
    signal: "bullish",
    score: 5,
    tier: 3,
    description: "Short-term EMA has crossed above long-term EMA, indicating strong momentum.",
  },
  bollinger: {
    value: 0,
    signal: "neutral",
    score: 1,
    tier: 1,
    description: "Price consolidating mid-band awaiting breakout confirmation.",
  },
  adx: {
    value: 28,
    signal: "bullish",
    score: 3,
    tier: 2,
    description: "Trending environment with ADX above 25.",
  },
};

export function buildSampleAnalysis(symbol: string): ScanResultLike {
  const priceSeed = symbol.charCodeAt(0) * 10 + symbol.charCodeAt(symbol.length - 1);
  const price = 25_000 + (priceSeed % 7_500);
  const totalScore = 18 + (priceSeed % 6);
  return {
    symbol,
    price,
    indicators: BASE_INDICATORS,
    totalScore,
    recommendation: totalScore > 20 ? "strong_buy" : "buy",
    meta: { sample: true },
  };
}

export function buildSampleHighPotential(): ScanResultLike[] {
  return ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT", "MATICUSDT"].map(
    (symbol, index) => {
      const analysis = buildSampleAnalysis(symbol);
      return {
        ...analysis,
        totalScore: analysis.totalScore + index,
        recommendation: index < 2 ? "strong_buy" : "buy",
      };
    },
  );
}
