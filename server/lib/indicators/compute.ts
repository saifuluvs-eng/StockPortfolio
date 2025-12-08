import { RSI, MACD, ADX, EMA, ATR } from "technicalindicators";

export function computeIndicators(
  ohlcv: { open: number; high: number; low: number; close: number; volume: number }[],
) {
  const closes = ohlcv.map((x) => x.close);
  const highs = ohlcv.map((x) => x.high);
  const lows = ohlcv.map((x) => x.low);
  const vols = ohlcv.map((x) => x.volume);

  const rsiArr = RSI.calculate({ period: 14, values: closes });
  const macdArr = MACD.calculate({
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
    values: closes,
  });
  const adxArr = ADX.calculate({ period: 14, close: closes, high: highs, low: lows });
  const ema20 = EMA.calculate({ period: 20, values: closes });
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const ema200 = EMA.calculate({ period: 200, values: closes });
  const atrArr = ATR.calculate({ period: 14, close: closes, high: highs, low: lows });

  const last = closes.length - 1;
  const take = <T>(arr: T[]) => (arr.length ? arr[arr.length - 1] : undefined);

  // volume z-score vs 50
  const n = 50;
  const recent = vols.slice(-n);
  const mean = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
  const sd = Math.sqrt(
    recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, recent.length),
  );
  const volZ = sd ? (vols[last] - mean) / sd : 0;
  const volX = mean ? vols[last] / mean : 1;

  // SR proximity (simple swing levels over last 50 bars)
  const window = 20;
  const slice = ohlcv.slice(-Math.max(window * 3, 60));
  let swingHigh = slice[0].high,
    swingLow = slice[0].low;
  for (let i = 1; i < slice.length - 1; i++) {
    if (slice[i].high > slice[i - 1].high && slice[i].high > slice[i + 1].high)
      swingHigh = Math.max(swingHigh, slice[i].high);
    if (slice[i].low < slice[i - 1].low && slice[i].low < slice[i + 1].low)
      swingLow = Math.min(swingLow, slice[i].low);
  }
  const close = closes[last];
  const toHigh = Math.abs(((swingHigh - close) / close) * 100);
  const toLow = Math.abs(((close - swingLow) / close) * 100);
  const srProximityPct = Math.min(toHigh, toLow); // distance to nearest swing

  // Trend score (0–100) simple weighting
  let score = 50;
  const e20 = take(ema20),
    e50 = take(ema50),
    e200 = take(ema200);
  if (e20 && e50 && e200) {
    if (e20 > e50 && e50 > e200) score += 15;
    if (e20 < e50 && e50 < e200) score -= 15;
    const emaDiff = ema20[ema20.length - 1] - (ema20[ema20.length - 2] || 0);
    score += Math.sign(emaDiff) * 5;
  }
  const rsi = take(rsiArr);
  if (typeof rsi === "number") {
    if (rsi >= 55 && rsi <= 65) score += 5;
    if (rsi < 45 || rsi > 75) score -= 5;
  }
  const adx = take(adxArr)?.adx;
  if (typeof adx === "number") {
    if (adx > 25) score += 5;
    if (adx < 15) score -= 5;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const macd = take(macdArr);
  const atr = take(atrArr);
  const atrPct = atr ? (atr / close) * 100 : undefined;

  return {
    close,
    rsi: rsi !== undefined ? Math.round(rsi * 10) / 10 : undefined,
    macd: macd
      ? { macd: round(macd.MACD), signal: round(macd.signal), histogram: round(macd.histogram) }
      : undefined,
    adx: adx !== undefined ? Math.round(adx * 10) / 10 : undefined,
    ema: { e20: round(e20), e50: round(e50), e200: round(e200) },
    atrPct: atrPct !== undefined ? Math.round(atrPct * 10) / 10 : undefined,
    vol: { last: vols[last], zScore: round(volZ), xAvg50: round(volX) },
    srProximityPct: round(srProximityPct),
    trendScore: score,
  };
  function round(v?: number) {
    return v === undefined ? undefined : Math.round(v * 100) / 100;
  }
}
