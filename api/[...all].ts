// api/all.ts
// Router via query param: /api/all?path=market/ticker/BTCUSDT
import { technicalIndicators } from "./lib/technicalIndicators";
import { binanceService } from "./lib/binanceService";

function json(res: any, code: number, body: any) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  return res.status(code).json(body);
}
const ok = (res: any, body: any) => json(res, 200, body);
const bad = (res: any, code: number, message: string, extra: any = {}) =>
  json(res, code, { ok: false, message, ...extra });

const BINANCE = "https://api.binance.com";

const VALID = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]);
function normTF(tf: string) {
  const t = (tf || "").toLowerCase().trim();
  if (VALID.has(t)) return t;
  if (t === "1" || t === "1min") return "1m";
  if (t === "5" || t === "5min") return "5m";
  if (t === "15" || t === "15min") return "15m";
  if (t === "60" || t === "1h") return "1h";
  if (t === "4h") return "4h";
  if (t === "1d" || t === "1day") return "1d";
  if (t === "1w" || t === "1week") return "1w";
  return "1d";
}

const sma = (arr: number[], p: number) => {
  if (arr.length < p) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= p) sum -= arr[i - p];
    if (i >= p - 1) out.push(sum / p);
  }
  return out;
};
const ema = (arr: number[], p: number) => {
  if (arr.length < p) return [];
  const k = 2 / (p + 1);
  const out: number[] = [];
  let prev = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out.push(prev);
  for (let i = p; i < arr.length; i++) {
    const cur = arr[i] * k + prev * (1 - k);
    out.push(cur);
    prev = cur;
  }
  return out;
};
const rsi = (arr: number[], p = 14) => {
  if (arr.length < p + 1) return [];
  const gains: number[] = [], losses: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    gains.push(Math.max(d, 0));
    losses.push(Math.max(-d, 0));
  }
  let g = gains.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let l = losses.slice(0, p).reduce((a, b) => a + b, 0) / p;
  const out: number[] = [];
  out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  for (let i = p; i < gains.length; i++) {
    g = (g * (p - 1) + gains[i]) / p;
    l = (l * (p - 1) + losses[i]) / p;
    out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  return out;
};
const macd = (arr: number[], fast = 12, slow = 26, signal = 9) => {
  if (arr.length < slow + signal) return { macd: [], signal: [], hist: [] };
  const f = ema(arr, fast), s = ema(arr, slow);
  const off = f.length - s.length;
  const m: number[] = [];
  for (let i = 0; i < s.length; i++) m.push(f[i + off] - s[i]);
  const sig = ema(m, signal);
  const hoff = m.length - sig.length;
  const h: number[] = [];
  for (let i = 0; i < sig.length; i++) h.push(m[i + hoff] - sig[i]);
  return { macd: m.slice(m.length - sig.length), signal: sig, hist: h };
};
const stochastic = (high: number[], low: number[], close: number[], p = 14, smoothD = 3) => {
  if (close.length < p) return { k: [], d: [] };
  const k: number[] = [];
  for (let i = p - 1; i < close.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) {
      if (high[j] > hh) hh = high[j];
      if (low[j] < ll) ll = low[j];
    }
    k.push(hh === ll ? 50 : ((close[i] - ll) / (hh - ll)) * 100);
  }
  const d = sma(k, smoothD);
  return { k: k.slice(k.length - d.length), d };
};

async function alive(_req: any, res: any) {
  return ok(res, { ok: true, message: "alive", time: new Date().toISOString() });
}
async function health(_req: any, res: any) {
  return ok(res, { ok: true, message: "healthy", time: new Date().toISOString() });
}
async function ticker(_req: any, res: any, symbol: string) {
  if (!symbol) return bad(res, 400, "symbol required");
  const sym = symbol.toUpperCase();
  const r = await fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=${encodeURIComponent(sym)}`, { cache: "no-store" });
  if (!r.ok) return bad(res, r.status, "binance error", { detail: await r.text() });
  const data = await r.json();
  return ok(res, { ok: true, symbol: sym, data });
}
async function gainers(_req: any, res: any) {
  try {
    const limit = Math.min(parseInt(String(_req.query?.limit || "50"), 10) || 50, 100);
    const gainers = await binanceService.getTopGainers(limit);

    const rows = gainers.map(t => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      changePct: parseFloat(t.priceChangePercent),
      volume: parseFloat(t.quoteVolume),
      high: parseFloat(t.highPrice),
      low: parseFloat(t.lowPrice),
    }));

    return ok(res, { rows });
  } catch (e: any) {
    console.error("gainers error:", e);
    return bad(res, 500, "Failed to fetch gainers", { error: e.message });
  }
}
async function scan(req: any, res: any) {
  const q = req.query || {};
  const symbol = String(q.symbol || "BTCUSDT").toUpperCase();
  const timeframe = normTF(String(q.timeframe || "1d"));
  const limit = Math.min(parseInt(String(q.limit || "250"), 10) || 250, 500);

  const r = await fetch(`${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${limit}`, { cache: "no-store" });
  if (!r.ok) return bad(res, r.status, "binance error", { detail: await r.text() });
  const klines: any[] = await r.json();
  if (!Array.isArray(klines) || klines.length < 50) return bad(res, 422, "Not enough data");

  const highs: number[] = [], lows: number[] = [], closes: number[] = [];
  for (const k of klines) {
    highs.push(parseFloat(k[2])); lows.push(parseFloat(k[3])); closes.push(parseFloat(k[4]));
  }

  const rsiArr = rsi(closes, 14);
  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const ema200Arr = ema(closes, 200);
  const sma20Arr = sma(closes, 20);
  const sma50Arr = sma(closes, 50);
  const sma200Arr = sma(closes, 200);
  const { macd: macdLine, signal: sigLine, hist } = macd(closes, 12, 26, 9);
  const { k: stochK, d: stochD } = stochastic(highs, lows, closes, 14, 3);

  const lastClose = closes[closes.length - 1];
  const lastRSI = rsiArr.length ? rsiArr[rsiArr.length - 1] : null;
  const lastMACD = macdLine.length ? macdLine[macdLine.length - 1] : null;
  const lastSignal = sigLine.length ? sigLine[sigLine.length - 1] : null;
  const lastHist = hist.length ? hist[hist.length - 1] : null;
  const lastEMA20 = ema20Arr.length ? ema20Arr[ema20Arr.length - 1] : null;
  const lastEMA50 = ema50Arr.length ? ema50Arr[ema50Arr.length - 1] : null;
  const lastEMA200 = ema200Arr.length ? ema200Arr[ema200Arr.length - 1] : null;
  const lastK = stochK.length ? stochK[stochK.length - 1] : null;
  const lastD = stochD.length ? stochD[stochD.length - 1] : null;

  const isMACDBull = lastMACD !== null && lastSignal !== null ? lastMACD > lastSignal : false;
  const priceVs20 = lastEMA20 !== null ? (lastClose > lastEMA20 ? "above" : "below") : "unknown";
  const priceVs50 = lastEMA50 !== null ? (lastClose > lastEMA50 ? "above" : "below") : "unknown";
  const priceVs200 = lastEMA200 !== null ? (lastClose > lastEMA200 ? "above" : "below") : "unknown";

  let buy = 0, sell = 0, neutral = 0;
  if (lastRSI === null) neutral++; else if (lastRSI > 70) sell++; else if (lastRSI < 30) buy++; else neutral++;
  if (isMACDBull) buy++; else sell++;
  for (const pv of [priceVs20, priceVs50, priceVs200]) {
    if (pv === "above") buy++; else if (pv === "below") sell++; else neutral++;
  }
  if (lastK !== null && lastD !== null) {
    if (lastK > 80 && lastD > 80) sell++;
    else if (lastK < 20 && lastD < 20) buy++;
    else neutral++;
  } else neutral++;
  const verdict = buy > sell ? "BUY" : buy < sell ? "SELL" : "NEUTRAL";

  return ok(res, {
    ok: true,
    symbol, timeframe, price: lastClose,
    indicators: {
      rsi: lastRSI,
      macd: { line: lastMACD, signal: lastSignal, hist: lastHist },
      ema: { ema20: lastEMA20, ema50: lastEMA50, ema200: lastEMA200 },
      stochastic: { k: lastK, d: lastD },
    },
    summary: { buy, neutral, sell, verdict }
  });
}

const obv = (closes: number[], volumes: number[]) => {
  if (closes.length === 0) return [];
  const out: number[] = [0];
  let acc = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) acc += volumes[i];
    else if (closes[i] < closes[i - 1]) acc -= volumes[i];
    out.push(acc);
  }
  return out;
};

const stdDev = (arr: number[]) => {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
};

const bollingerBands = (closes: number[], period = 20, mult = 2) => {
  if (closes.length < period) return { upper: [], middle: [], lower: [] };
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < middle.length; i++) {
    const slice = closes.slice(i, i + period);
    const sd = stdDev(slice);
    upper.push(middle[i] + mult * sd);
    lower.push(middle[i] - mult * sd);
  }
  return { upper, middle, lower };
};

async function marketRsi(req: any, res: any) {
  try {
    const limit = Math.min(parseInt(String(req.query?.limit || "50"), 10) || 50, 100);

    // 1. Get top pairs by volume
    const r = await fetch(`${BINANCE}/api/v3/ticker/24hr`, { cache: "no-store" });
    if (!r.ok) return bad(res, r.status, "binance error", { detail: await r.text() });

    const allTickers: any[] = await r.json();
    const pairs = allTickers
      .filter((t: any) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 10000000) // Filter for decent volume
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, limit)
      .map((t: any) => ({ symbol: t.symbol, price: parseFloat(t.lastPrice), change: parseFloat(t.priceChangePercent) }));

    const results: any[] = [];

    // 2. Fetch candles and calc RSI (batching to avoid rate limits/timeouts)
    const batchSize = 5;
    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize);
      const promises = batch.map(async (p: any) => {
        try {
          const kRes = await fetch(`${BINANCE}/api/v3/klines?symbol=${p.symbol}&interval=4h&limit=30`, { cache: "no-store" });
          if (!kRes.ok) return null;
          const klines: any[] = await kRes.json();
          if (!Array.isArray(klines) || klines.length < 20) return null;

          const closes = klines.map((k: any) => parseFloat(k[4]));
          const rsiArr = rsi(closes, 14);
          const lastRsi = rsiArr.length ? rsiArr[rsiArr.length - 1] : undefined;

          if (lastRsi === undefined) return null;

          return {
            symbol: p.symbol.replace('USDT', ''),
            rsi: parseFloat(lastRsi.toFixed(2)),
            price: p.price,
            change: p.change
          };
        } catch (e) {
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter(Boolean));
    }

    return ok(res, results.sort((a: any, b: any) => b.rsi - a.rsi));
  } catch (e: any) {
    console.error("marketRsi error:", e);
    return bad(res, 500, "Failed to fetch market RSI");
  }
}

async function highPotential(_req: any, res: any) {
  try {
    const filters = {
      timeframe: '1h',
      minScore: 5,
      excludeStablecoins: true
    };

    const results = await technicalIndicators.scanHighPotential(filters);

    const data = results.map(r => ({
      symbol: r.symbol,
      score: r.totalScore,
      passes: r.recommendation === 'buy' || r.recommendation === 'strong_buy',
      passesDetail: {
        trend: r.indicators.ema_crossover?.score > 0,
        rsi: r.indicators.rsi?.score > 0,
        macd: r.indicators.macd?.score > 0,
        volume: r.indicators.obv?.score > 0,
        obv: r.indicators.obv?.score > 0,
        volatility: r.indicators.bb_squeeze?.score > 0
      },
      price: r.price,
      rsi: r.indicators.rsi?.value || 50,
      volume: r.candles && r.candles.length ? r.candles[r.candles.length - 1].v : 0,
      avgVolume: 0,
      volatilityState: "normal"
    }));

    return ok(res, { data });
  } catch (e: any) {
    console.error("high-potential error:", e);
    return bad(res, 500, "Failed to scan high potential", { error: e.message });
  }
}

async function trendDipStrategy(req: any, res: any) {
  try {
    const data = await technicalIndicators.scanTrendDip();
    return ok(res, data);
  } catch (e: any) {
    console.error("TrendDip Error", e);
    return bad(res, 500, e.message);
  }
}

async function fearGreed(_req: any, res: any) {
  try {
    const r = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!r.ok) {
      throw new Error("Failed to fetch fear and greed index");
    }
    const data = await r.json();
    return ok(res, data);
  } catch (e: any) {
    console.error("fear-greed error:", e);
    return ok(res, {
      name: "Fear & Greed Index",
      data: [{ value: "50", value_classification: "Neutral", timestamp: String(Math.floor(Date.now() / 1000)) }]
    });
  }
}

export default async function handler(req: any, res: any) {
  try {
    // Vercel catch-all route provides path segments in req.query.all
    let seg: string[] = [];
    if (req.query && req.query.all) {
      if (Array.isArray(req.query.all)) {
        seg = req.query.all;
      } else {
        seg = [String(req.query.all)];
      }
    } else {
      // Fallback to parsing req.url if req.query.all is missing
      let p = String((req.query?.path ?? "")).replace(/^\/+/, "");
      if (!p && req.url) {
        const u = new URL(req.url, "http://localhost");
        if (u.pathname.startsWith("/api/")) {
          p = u.pathname.slice(5).replace(/^\/+/, "");
        }
      }
      seg = p.split("/").filter(Boolean);
    }

    if (seg.length === 0) return alive(req, res);

    if (seg[0] === "health") return health(req, res);

    if (seg[0] === "market") {
      if (seg[1] === "ticker" && seg[2]) return ticker(req, res, seg[2]);
      if (seg[1] === "gainers") return gainers(req, res);
      if (seg[1] === "rsi") return marketRsi(req, res);
      if (seg[1] === "strategies" && seg[2] === "trend-dip") return trendDipStrategy(req, res);
      if (seg[1] === "fear-greed") return fearGreed(req, res);
      return bad(res, 404, "Unknown market route", { path: p });
    }

    if (seg[0] === "scanner") {
      if (seg[1] === "scan") return scan(req, res);
      return bad(res, 404, "Unknown scanner route", { path: p });
    }

    if (seg[0] === "high-potential") return highPotential(req, res);

    if (seg[0] === "watchlist") return ok(res, { ok: true, items: [] });
    if (seg[0] === "portfolio") return ok(res, { ok: true, positions: [] });

    return bad(res, 404, "Unknown API route", { path: p });
  } catch (e: any) {
    console.error("api/all error:", e);
    return bad(res, 500, e?.message || "internal_error");
  }
}
