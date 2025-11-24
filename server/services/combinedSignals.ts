/**
 * Combined Technical Signal Builder
 * This file computes 4 high-level states from raw indicator data
 * and returns a final JSON object ready to send to Gemini.
 *
 * Usage: const finalJson = buildTechnicalJSON(rawIndicators, symbol, timeframe);
 */

function computeTrendBias(price: number, ema20: number, ema50: number, vwap: number): "bullish" | "bearish" | "neutral" {
  let bias: "bullish" | "bearish" | "neutral" = "neutral";

  // EMA structure
  if (price < ema20 && ema20 < ema50) {
    bias = "bearish";
  } else if (price > ema20 && ema20 > ema50) {
    bias = "bullish";
  }

  // VWAP influence
  if (price < vwap && bias !== "bullish") bias = "bearish";
  if (price > vwap && bias !== "bearish") bias = "bullish";

  // If contradictory signals → neutral
  if ((price > ema20 && ema20 < ema50) || (price < ema20 && ema20 > ema50)) {
    bias = "neutral";
  }

  return bias;
}

function computeMomentumState(rsi: number, macd: number): "strong" | "weak" | "oversold" | "overbought" | "neutral" {
  if (rsi < 30) return "oversold";
  if (rsi > 70) return "overbought";

  if (rsi > 55 && macd > 0) return "strong";
  if (rsi < 45 && macd < 0) return "weak";

  if (macd > 0) return "strong";
  if (macd < 0) return "weak";

  return "neutral";
}

function computeVolumeContext(obvTrend: string | null, avgVol: number, prevAvgVol: number): "increasing" | "decreasing" | "neutral" {
  // If OBV trend provided
  if (obvTrend === "up") return "increasing";
  if (obvTrend === "down") return "decreasing";

  // Use volume averages if available
  if (avgVol && prevAvgVol) {
    if (avgVol > prevAvgVol) return "increasing";
    if (avgVol < prevAvgVol) return "decreasing";
  }

  return "neutral";
}

function computeVolatilityState(bbSqueeze: number | null, atr: number): "high" | "low" | "normal" {
  // BB squeeze indicator (1 = low volatility)
  if (bbSqueeze === 1) return "low";

  // ATR rules
  if (atr && atr < 0.5) return "low";
  if (atr && atr > 2.0) return "high";

  return "normal";
}

/**
 * Main builder - computes all 4 states and returns final JSON for Gemini
 */
export function buildTechnicalJSON(
  indicators: any,
  symbol: string,
  timeframe: string
): {
  symbol: string;
  timeframe: string;
  indicators: any;
  trend_bias: "bullish" | "bearish" | "neutral";
  momentum_state: "strong" | "weak" | "oversold" | "overbought" | "neutral";
  volume_context: "increasing" | "decreasing" | "neutral";
  volatility_state: "high" | "low" | "normal";
} {
  const price = indicators.price || 0;
  const ema20 = indicators.ema20?.value || indicators.ema20 || 0;
  const ema50 = indicators.ema50?.value || indicators.ema50 || 0;
  const vwap = indicators.vwap?.value || indicators.vwap || 0;
  const rsi = indicators.rsi?.value || indicators.rsi || 50;
  const macd = indicators.macd?.value || indicators.macd || 0;
  const bbSqueeze = indicators.bollingerBands?.squeeze || null;
  const atr = indicators.atr?.value || indicators.atr || 0;
  const obvTrend = indicators.obv?.trend || null;
  const avgVol = indicators.volume?.current || 0;
  const prevAvgVol = indicators.volume?.previous || avgVol;

  const trend_bias = computeTrendBias(price, ema20, ema50, vwap);
  const momentum_state = computeMomentumState(rsi, macd);
  const volume_context = computeVolumeContext(obvTrend, avgVol, prevAvgVol);
  const volatility_state = computeVolatilityState(bbSqueeze, atr);

  return {
    symbol,
    timeframe,
    indicators,
    trend_bias,
    momentum_state,
    volume_context,
    volatility_state
  };
}
