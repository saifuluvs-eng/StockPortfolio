// api/scanner/scan.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

// --- utils -------------------------------------------------------------
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const stdev = (arr: number[]) => {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
};

const SMA = (arr: number[], p: number) =>
  arr.length >= p ? mean(arr.slice(-p)) : NaN;

const EMA = (arr: number[], p: number) => {
  if (arr.length < p) return NaN;
  const k = 2 / (p + 1);
  let ema = mean(arr.slice(0, p));
  for (let i = p; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k);
  return ema;
};

const RSI = (closes: number[], p = 14) => {
  if (closes.length <= p) return NaN;
  let gains = 0, losses = 0;
  for (let i = 1; i <= p; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / p, avgLoss = losses / p;
  for (let i = p + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (p - 1) + Math.max(diff, 0)) / p;
    avgLoss = (avgLoss * (p - 1) + Math.max(-diff, 0)) / p;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

const MACD = (closes: number[], fast = 12, slow = 26, signal = 9) => {
  if (closes.length < slow + signal) return { macd: NaN, signal: NaN, hist: NaN };
  const emaFast = emaSeries(closes, fast);
  const emaSlow = emaSeries(closes, slow);
  const macdSeries = emaFast.map((v, i) => v - (emaSlow[i] ?? NaN)).slice(slow - 1);
  const signalSeries = emaSeries(macdSeries, signal);
  const macd = macdSeries[macdSeries.length - 1];
  const sig = signalSeries[signalSeries.length - 1];
  return { macd, signal: sig, hist: macd - sig };
};
function emaSeries(arr: number[], p: number) {
  const out: number[] = [];
  const k = 2 / (p + 1);
  let ema = mean(arr.slice(0, p));
  for (let i = 0; i < arr.length; i++) {
    if (i < p - 1) { out.push(NaN); continue; }
    if (i === p - 1) { out.push(ema); continue; }
    ema = arr[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

const Bollinger = (closes: number[], p = 20, mult = 2) => {
  if (closes.length < p) return { mid: NaN, upper: NaN, lower: NaN, width: NaN, pctB: NaN };
  const slice = closes.slice(-p);
  const mid = mean(slice);
  const sd = stdev(slice);
  const upper = mid + mult * sd;
  const lower = mid - mult * sd;
  const last = closes[closes.length - 1];
  const pctB = (last - lower) / (upper - lower);
  const width = (upper - lower) / mid;
  return { mid, upper, lower, width, pctB };
};

const Stoch = (highs: number[], lows: number[], closes: number[], p = 14, d = 3) => {
  if (closes.length < p) return { k: NaN, d: NaN };
  const hh = Math.max(...highs.slice(-p));
  const ll = Math.min(...lows.slice(-p));
  const last = closes[closes.length - 1];
  const k = ((last - ll) / Math.max(hh - ll, 1e-9)) * 100;
  // Smooth %K for %D:
  const kSeries: number[] = [];
  for (let i = closes.length - p - (d - 1); i <= closes.length - p; i++) {
    const hhx = Math.max(...highs.slice(i, i + p));
    const llx = Math.min(...lows.slice(i, i + p));
    const cx = closes[i + p - 1];
    kSeries.push(((cx - llx) / Math.max(hhx - llx, 1e-9)) * 100);
  }
  const dVal = mean(kSeries.slice(-d));
  return { k, d: dVal };
};

const ATR = (high: number[], low: number[], close: number[], p = 14) => {
  const trs: number[] = [];
  for (let i = 1; i < high.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trs.push(tr);
  }
  if (trs.length < p) return NaN;
  return mean(trs.slice(-p));
};

const ADX = (high: number[], low: number[], close: number[], p = 14) => {
  if (high.length < p + 1) return NaN;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < high.length; i++) {
    const upMove = high[i] - high[i - 1];
    const downMove = low[i - 1] - low[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      )
    );
  }
  const smooth = (arr: number[], period: number) => {
    let s = arr.slice(0, period).reduce((a, b) => a + b, 0);
    const out = [s];
    for (let i = period; i < arr.length; i++) {
      s = s - s / period + arr[i];
      out.push(s);
    }
    return out;
  };
  const trN = smooth(tr, p);
  const plusDMN = smooth(plusDM, p);
  const minusDMN = smooth(minusDM, p);
  const plusDI = plusDMN.map((v, i) => (v / trN[i]) * 100);
  const minusDI = minusDMN.map((v, i) => (v / trN[i]) * 100);
  const dx = plusDI.map((v, i) => (100 * Math.abs(v - minusDI[i])) / Math.max(v + minusDI[i], 1e-9)).slice(p - 1);
  return EMA(dx, p);
};

const MFI = (high: number[], low: number[], close: number[], vol: number[], p = 14) => {
  if (close.length < p + 1) return NaN;
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 1; i < tp.length; i++) {
    const flow = tp[i] * vol[i];
    if (tp[i] > tp[i - 1]) pos.push(flow);
    else if (tp[i] < tp[i - 1]) neg.push(flow);
    else { pos.push(0); neg.push(0); }
  }
  const posSum = pos.slice(-p).reduce((a, b) => a + b, 0);
  const negSum = neg.slice(-p).reduce((a, b) => a + b, 0);
  if (negSum === 0) return 100;
  const mr = posSum / negSum;
  return 100 - 100 / (1 + mr);
};

const OBV = (close: number[], vol: number[]) => {
  let obv = 0;
  for (let i = 1; i < close.length; i++) {
    if (close[i] > close[i - 1]) obv += vol[i];
    else if (close[i] < close[i - 1]) obv -= vol[i];
  }
  return obv;
};

const CCI = (high: number[], low: number[], close: number[], p = 20) => {
  if (close.length < p) return NaN;
  const tp = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const tpSlice = tp.slice(-p);
  const sma = mean(tpSlice);
  const md = mean(tpSlice.map((x) => Math.abs(x - sma)));
  return (tp[tp.length - 1] - sma) / (0.015 * Math.max(md, 1e-9));
};

const VWAP = (high: number[], low: number[], close: number[], vol: number[], p = 20) => {
  const n = Math.min(p, close.length);
  const start = close.length - n;
  let pv = 0, v = 0;
  for (let i = start; i < close.length; i++) {
    const tp = (high[i] + low[i] + close[i]) / 3;
    pv += tp * vol[i];
    v += vol[i];
  }
  return v ? pv / v : NaN;
};

// --- scoring helpers ---------------------------------------------------
type Signal = "bullish" | "bearish" | "neutral";
const scoreFrom = (sig: Signal, strong = false) =>
  sig === "bullish" ? (strong ? 3 : 2) : sig === "bearish" ? (strong ? -3 : -2) : 0;
const recFromTotal = (s: number) =>
  s >= 12 ? "strong_buy"
  : s >= 6  ? "buy"
  : s <= -12 ? "strong_sell"
  : s <= -6  ? "sell"
  : "hold";

// --- main handler ------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { symbol, timeframe } = (req.body || {}) as { symbol?: string; timeframe?: string };
    const sym = (symbol || "BTCUSDT").toUpperCase();
    const tf = (timeframe || "4h").toLowerCase();

    // Map incoming timeframe to Binance intervals
    const intervalMap: Record<string, string> = {
      "15": "15m", "15m": "15m",
      "60": "1h",  "1h": "1h",
      "240": "4h", "4h": "4h",
      "d": "1d",   "1d": "1d",
      "w": "1w",   "1w": "1w",
      "day": "1d", "week": "1w"
    };
    const interval = intervalMap[tf] || "4h";

    // Pull enough candles for MA200 etc.
    const limit = 500;
    const url = `https://api.binance.us/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${interval}&limit=${limit}`;

    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) {
      // propagate code (e.g., 451)
      return res.status(r.status).json({ error: `Upstream error ${r.status}`, details: await safeText(r) });
    }
    const raw = (await r.json()) as any[];

    // Extract OHLCV as numbers
    const openTime = raw.map((k) => k[0] as number);
    const opens = raw.map((k) => Number(k[1]));
    const highs = raw.map((k) => Number(k[2]));
    const lows = raw.map((k) => Number(k[3]));
    const closes = raw.map((k) => Number(k[4]));
    const volumes = raw.map((k) => Number(k[5]));

    if (closes.length < 50) {
      return res.status(422).json({ error: "Not enough data returned for analysis" });
    }

    const last = closes[closes.length - 1];
    const prev24Index = Math.max(0, closes.length - guessBarsFor24h(interval));
    const change24 = ((last - closes[prev24Index]) / closes[prev24Index]) * 100;

    // Indicators
    const rsi = RSI(closes, 14);
    const macd = MACD(closes, 12, 26, 9);
    const ema20 = EMA(closes, 20);
    const ema50 = EMA(closes, 50);
    const ema200 = EMA(closes, 200);
    const sma20 = SMA(closes, 20);
    const sma50 = SMA(closes, 50);
    const sma200 = SMA(closes, 200);
    const bb = Bollinger(closes, 20, 2);
    const stoch = Stoch(highs, lows, closes, 14, 3);
    const atr = ATR(highs, lows, closes, 14);
    const adx = ADX(highs, lows, closes, 14);
    const mfi = MFI(highs, lows, closes, volumes, 14);
    const obv = OBV(closes, volumes);
    const cci = CCI(highs, lows, closes, 20);
    const vwap = VWAP(highs, lows, closes, volumes, 20);

    // Signals
    const rsiSig: Signal =
      rsi >= 70 ? "bearish" : rsi <= 30 ? "bullish" : "neutral";

    const macdSig: Signal =
      macd.hist > 0 ? "bullish" : macd.hist < 0 ? "bearish" : "neutral";

    const trendSig: Signal =
      last > (ema200 || Number.MAX_VALUE) ? "bullish"
      : last < (ema200 || Number.MIN_VALUE) ? "bearish"
      : "neutral";

    const maStackSig: Signal =
      (ema20 > ema50 && ema50 > ema200) ? "bullish"
      : (ema20 < ema50 && ema50 < ema200) ? "bearish"
      : "neutral";

    const bbSig: Signal =
      bb.pctB >= 0.95 ? "bearish"
      : bb.pctB <= 0.05 ? "bullish"
      : "neutral";

    const stochSig: Signal =
      stoch.k >= 80 && stoch.d >= 80 ? "bearish"
      : stoch.k <= 20 && stoch.d <= 20 ? "bullish"
      : "neutral";

    const adxSig: Signal =
      adx >= 25 ? (trendSig === "bullish" ? "bullish" : trendSig === "bearish" ? "bearish" : "neutral")
      : "neutral";

    const mfiSig: Signal =
      mfi >= 80 ? "bearish" : mfi <= 20 ? "bullish" : "neutral";

    const cciSig: Signal =
      cci >= 100 ? "bearish" : cci <= -100 ? "bullish" : "neutral";

    const vwapSig: Signal =
      !isNaN(vwap) && last > vwap ? "bullish"
      : !isNaN(vwap) && last < vwap ? "bearish"
      : "neutral";

    const obvSig: Signal = (() => {
      // very light OBV slope check
      const window = Math.min(20, closes.length - 1);
      const obvRecent = (() => {
        let o = 0, out: number[] = [0];
        for (let i = closes.length - window; i < closes.length; i++) {
          if (i <= 0) continue;
          if (closes[i] > closes[i - 1]) o += volumes[i];
          else if (closes[i] < closes[i - 1]) o -= volumes[i];
          out.push(o);
        }
        return out;
      })();
      const rising = obvRecent[obvRecent.length - 1] > obvRecent[0];
      const falling = obvRecent[obvRecent.length - 1] < obvRecent[0];
      return rising ? "bullish" : falling ? "bearish" : "neutral";
    })();

    const change24Sig: Signal =
      change24 >= 3 ? "bullish"
      : change24 <= -3 ? "bearish"
      : "neutral";

    // Scores (tier ~ visual importance 1..3)
    const indicators = {
      "RSI(14)":          pack(rsi, rsiSig, 2, "Momentum oscillator; 70 overbought / 30 oversold"),
      "MACD(12,26,9)":    pack(macd.hist, macdSig, 3, "MACD histogram (fast/slow EMA with signal)"),
      "EMA20":            pack(last - ema20, last > ema20 ? "bullish" : last < ema20 ? "bearish" : "neutral", 2, "Price vs EMA20"),
      "EMA50":            pack(last - ema50, last > ema50 ? "bullish" : last < ema50 ? "bearish" : "neutral", 2, "Price vs EMA50"),
      "EMA200":           pack(last - ema200, trendSig, 3, "Primary trend (EMA200)"),
      "SMA20":            pack(last - sma20, last > sma20 ? "bullish" : last < sma20 ? "bearish" : "neutral", 1, "Price vs SMA20"),
      "SMA50":            pack(last - sma50, last > sma50 ? "bullish" : last < sma50 ? "bearish" : "neutral", 1, "Price vs SMA50"),
      "SMA200":           pack(last - sma200, last > sma200 ? "bullish" : last < sma200 ? "bearish" : "neutral", 2, "Price vs SMA200"),
      "MA Stack":         pack( (ema20 - ema50) + (ema50 - ema200), maStackSig, 3, "EMA20>EMA50>EMA200 or inverse"),
      "Bollinger(20,2)":  pack(bb.pctB, bbSig, 1, "Band position (0=lower, 1=upper)"),
      "Stochastic(14,3)": pack(stoch.k - stoch.d, stochSig, 1, "%K/%D in OB/OS zones"),
      "ADX(14)":          pack(adx, adxSig, 2, "Trend strength (>=25 trending)"),
      "ATR(14)":          pack(atr, "neutral", 1, "Volatility (no direction)"),
      "MFI(14)":          pack(mfi, mfiSig, 1, "Money Flow Index"),
      "CCI(20)":          pack(cci, cciSig, 1, "Commodity Channel Index"),
      "VWAP(20)":         pack(last - vwap, vwapSig, 2, "Price vs VWAP"),
      "24h Change":       pack(change24, change24Sig, 1, "Heuristic based on 24h change (source: binance.us)")
    } as const;

    // Sum score
    const totalScore = Object.values(indicators).reduce((acc, it) => acc + it.score, 0);
    const recommendation = recFromTotal(totalScore) as
      "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

    res.status(200).json({
      symbol: sym,
      price: last,
      indicators,
      totalScore,
      recommendation,
      meta: {
        interval,
        candles: closes.length,
        source: "binance.us",
        asOf: openTime[openTime.length - 1]
      }
    });
  } catch (err: any) {
    console.error("scan error:", err);
    res.status(500).json({ error: "Scan failed", message: err?.message || String(err) });
  }
}

function pack(value: number, signal: Signal, tier: 1 | 2 | 3, description: string) {
  const strong = tier >= 3;
  const score = scoreFrom(signal, strong);
  return {
    value: Number.isFinite(value) ? Number(value.toFixed(6)) : null,
    signal,
    score,
    tier,
    description
  };
}

function guessBarsFor24h(interval: string) {
  switch (interval) {
    case "15m": return 96;
    case "1h": return 24;
    case "4h": return 6;
    case "1d": return 1;
    case "1w": return 1; // approximation
    default: return 6;
  }
}

async function safeText(r: Response) {
  try { return await r.text(); } catch { return ""; }
}
