// api/scanner/scan.ts
// Live technicals sourced from Binance public API, no API key required.
// Supports GET or POST. Params: symbol (e.g. BTCUSDT), timeframe (1m,5m,15m,1h,4h,1d,1w,1M)

import type { VercelRequest, VercelResponse } from "@vercel/node";

// --- utils: math helpers ---
const sma = (arr: number[], period: number) => {
  if (arr.length < period) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= period) sum -= arr[i - period];
    if (i >= period - 1) out.push(sum / period);
  }
  return out;
};

const ema = (arr: number[], period: number) => {
  if (arr.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  // seed with SMA of first period
  let prev = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < arr.length; i++) {
    const cur = arr[i] * k + prev * (1 - k);
    out.push(cur);
    prev = cur;
  }
  return out;
};

const rsi = (arr: number[], period = 14) => {
  if (arr.length < period + 1) return [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    const diff = arr[i] - arr[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  // seed average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out: number[] = [];
  out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  // Wilder smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return out;
};

const macd = (arr: number[], fast = 12, slow = 26, signal = 9) => {
  if (arr.length < slow + signal) return { macd: [], signal: [], hist: [] };
  const emaFast = ema(arr, fast);
  const emaSlow = ema(arr, slow);
  // align lengths: emaFast has (n - fast + 1), emaSlow has (n - slow + 1)
  const offset = emaFast.length - emaSlow.length;
  const macdLine: number[] = [];
  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + offset] - emaSlow[i]);
  }
  const signalLine = ema(macdLine, signal);
  const hist: number[] = [];
  const histOffset = macdLine.length - signalLine.length;
  for (let i = 0; i < signalLine.length; i++) {
    hist.push(macdLine[i + histOffset] - signalLine[i]);
  }
  return { macd: macdLine.slice(macdLine.length - signalLine.length), signal: signalLine, hist };
};

const stochastic = (highs: number[], lows: number[], closes: number[], period = 14, smoothD = 3) => {
  if (closes.length < period) return { k: [], d: [] };
  const k: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    const value = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
    k.push(value);
  }
  const d = sma(k, smoothD);
  return {
    k: k.slice(k.length - d.length),
    d
  };
};

// --- mapping for timeframes ---
const BINANCE_INTERVALS = new Set(["1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1M"]);
function normalizeInterval(tf: string): string {
  const t = tf.toLowerCase().replace("min","m").replace(" ", "");
  const m = {
    "1": "1m", "5": "5m", "15": "15m", "60": "1h",
    "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w", "1mth":"1M"
  } as Record<string,string>;
  const guess = m[t] || tf;
  return BINANCE_INTERVALS.has(guess) ? guess : "1d";
}

// --- handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const method = (req.method || "GET").toUpperCase();
    const q = req.query || {};
    const body = (req.body || {}) as any;

    const symbol = (body.symbol || q.symbol || "BTCUSDT").toString().toUpperCase();
    const timeframe = normalizeInterval((body.timeframe || q.timeframe || "1d").toString());
    const limit = Math.min(parseInt((body.limit || q.limit || "250") as string, 10) || 250, 500);

    if (method !== "GET" && method !== "POST") {
      return res.status(405).json({ ok: false, message: "Method Not Allowed" });
    }

    // Fetch OHLCV from Binance
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${limit}`;
    const r = await fetch(url);
    if (!r.ok) {
      const msg = await r.text();
      return res.status(502).json({ ok: false, message: "Upstream error", detail: msg });
    }
    const klines: any[] = await r.json();
    if (!Array.isArray(klines) || klines.length < 50) {
      return res.status(422).json({ ok: false, message: "Not enough data returned" });
    }

    const opens: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const closes: number[] = [];

    for (const k of klines) {
      opens.push(parseFloat(k[1]));
      highs.push(parseFloat(k[2]));
      lows.push(parseFloat(k[3]));
      closes.push(parseFloat(k[4]));
    }

    // Indicators (based on closes; stoch uses highs/lows)
    const rsiArr = rsi(closes, 14);
    const ema20Arr = ema(closes, 20);
    const ema50Arr = ema(closes, 50);
    const ema200Arr = ema(closes, 200);
    const sma20Arr = sma(closes, 20);
    const sma50Arr = sma(closes, 50);
    const sma200Arr = sma(closes, 200);
    const { macd: macdLine, signal: signalLine, hist: histLine } = macd(closes, 12, 26, 9);
    const { k: stochK, d: stochD } = stochastic(highs, lows, closes, 14, 3);

    const lastClose = closes[closes.length - 1];
    const lastRSI = rsiArr[rsiArr.length - 1] ?? null;
    const lastMACD = macdLine[macdLine.length - 1] ?? null;
    const lastSignal = signalLine[signalLine.length - 1] ?? null;
    const lastHist = histLine[histLine.length - 1] ?? null;
    const lastEMA20 = ema20Arr[ema20Arr.length - 1] ?? null;
    const lastEMA50 = ema50Arr[ema50Arr.length - 1] ?? null;
    const lastEMA200 = ema200Arr[ema200Arr.length - 1] ?? null;
    const lastSMA20 = sma20Arr[sma20Arr.length - 1] ?? null;
    const lastSMA50 = sma50Arr[sma50Arr.length - 1] ?? null;
    const lastSMA200 = sma200Arr[sma200Arr.length - 1] ?? null;
    const lastK = stochK[stochK.length - 1] ?? null;
    const lastD = stochD[stochD.length - 1] ?? null;

    // Simple verdicts
    const isMACDBull = lastMACD !== null && lastSignal !== null ? lastMACD > lastSignal : false;
    const priceVs20 = lastEMA20 !== null ? (lastClose > lastEMA20 ? "above" : "below") : "unknown";
    const priceVs50 = lastEMA50 !== null ? (lastClose > lastEMA50 ? "above" : "below") : "unknown";
    const priceVs200 = lastEMA200 !== null ? (lastClose > lastEMA200 ? "above" : "below") : "unknown";

    let buys = 0, sells = 0, neutrals = 0;
    if (lastRSI !== null) {
      if (lastRSI > 70) sells++; else if (lastRSI < 30) buys++; else neutrals++;
    } else neutrals++;
    if (isMACDBull) buys++; else sells++;
    if (priceVs20 === "above") buys++; else if (priceVs20 === "below") sells++; else neutrals++;
    if (priceVs50 === "above") buys++; else if (priceVs50 === "below") sells++; else neutrals++;
    if (priceVs200 === "above") buys++; else if (priceVs200 === "below") sells++; else neutrals++;
    if (lastK !== null && lastD !== null) {
      if (lastK > 80 && lastD > 80) sells++;
      else if (lastK < 20 && lastD < 20) buys++;
      else neutrals++;
    } else neutrals++;

    const verdict = buys > sells ? "BUY" : buys < sells ? "SELL" : "NEUTRAL";

    const response = {
      ok: true,
      symbol,
      timeframe,
      price: lastClose,
      indicators: {
        rsi: lastRSI,
        macd: { line: lastMACD, signal: lastSignal, hist: lastHist },
        ema: { ema20: lastEMA20, ema50: lastEMA50, ema200: lastEMA200 },
        sma: { sma20: lastSMA20, sma50: lastSMA50, sma200: lastSMA200 },
        stochastic: { k: lastK, d: lastD }
      },
      summary: { buy: buys, neutral: neutrals, sell: sells, verdict },
      breakdown: [
        { name: "RSI(14)", value: lastRSI, status: lastRSI === null ? "neutral" : lastRSI > 70 ? "bearish" : lastRSI < 30 ? "bullish" : "neutral" },
        { name: "MACD(12,26,9)", value: isMACDBull ? "Bullish" : "Bearish", status: isMACDBull ? "bullish" : "bearish" },
        { name: "EMA(20)", value: `Price ${priceVs20} EMA20`, status: priceVs20 === "above" ? "bullish" : priceVs20 === "below" ? "bearish" : "neutral" },
        { name: "EMA(50)", value: `Price ${priceVs50} EMA50`, status: priceVs50 === "above" ? "bullish" : priceVs50 === "below" ? "bearish" : "neutral" },
        { name: "EMA(200)", value: `Price ${priceVs200} EMA200`, status: priceVs200 === "above" ? "bullish" : priceVs200 === "below" ? "bearish" : "neutral" },
        { name: "Stochastic(14,3)", value: `${lastK?.toFixed?.(0) ?? "-"} / ${lastD?.toFixed?.(0) ?? "-"}`, status: lastK !== null && lastD !== null ? (lastK > 80 && lastD > 80 ? "bearish" : lastK < 20 && lastD < 20 ? "bullish" : "neutral") : "neutral" }
      ]
    };

    // Cache for a minute to avoid rate limits
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(response);
  } catch (err: any) {
    console.error("scan error", err);
    return res.status(500).json({ ok: false, message: err?.message || "Internal Error" });
  }
}
