// api/[...all].ts
// One function to handle ALL /api/* routes on Vercel Hobby.
// Live data via Binance public API (no key). Includes:
// - GET /api                       -> alive
// - GET /api/health                -> healthy
// - GET|POST /api/scanner/scan     -> technicals for symbol & timeframe
// - GET /api/market/ticker/:symbol -> 24h ticker for a symbol (e.g. BTCUSDT)
// - GET /api/market/gainers        -> top USDT gainers (24h)
// - GET /api/watchlist             -> empty list (valid empty state)
// - GET /api/portfolio             -> empty list (valid empty state)
// - GET /api/scanner/high-potential-> simple heuristic based on gainers

import type { VercelRequest, VercelResponse } from "@vercel/node";

// ---------- helpers ----------
function json(res: VercelResponse, code: number, body: any) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  return res.status(code).json(body);
}
const ok = (res: VercelResponse, body: any) => json(res, 200, body);
const bad = (res: VercelResponse, code: number, message: string, extra: any = {}) =>
  json(res, code, { ok: false, message, ...extra });

const BINANCE = "https://api.binance.com";

// map friendly timeframes to Binance intervals
const VALID = new Set(["1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1M"]);
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

// math utils
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

// ---------- route handlers ----------
async function handleAlive(_req: VercelRequest, res: VercelResponse) {
  return ok(res, { ok: true, message: "API is alive", time: new Date().toISOString() });
}
async function handleHealth(_req: VercelRequest, res: VercelResponse) {
  return ok(res, { ok: true, message: "healthy", time: new Date().toISOString() });
}

async function handleTicker(_req: VercelRequest, res: VercelResponse, symbol: string) {
  if (!symbol) return bad(res, 400, "symbol required");
  const sym = symbol.toUpperCase();
  const r = await fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=${encodeURIComponent(sym)}`);
  if (!r.ok) return bad(res, 502, "Binance 24hr error", { detail: await r.text() });
  const data = await r.json();
  return ok(res, { ok: true, symbol: sym, data });
}

async function handleGainers(_req: VercelRequest, res: VercelResponse) {
  const r = await fetch(`${BINANCE}/api/v3/ticker/24hr`);
  if (!r.ok) return bad(res, 502, "Binance 24hr all error", { detail: await r.text() });
  const list: any[] = await r.json();
  const filtered = list
    .filter((t: any) => typeof t?.symbol === "string" && t.symbol.endsWith("USDT"))
    .map((t: any) => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      changePct: parseFloat(t.priceChangePercent),
      volume: parseFloat(t.volume),
      quoteVolume: parseFloat(t.quoteVolume),
    }))
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 20);
  return ok(res, { ok: true, gainers: filtered });
}

async function handleScan(req: VercelRequest, res: VercelResponse) {
  const q = req.query || {};
  const body = (req.body || {}) as any;
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") return bad(res, 405, "Method Not Allowed");

  const symbol = (body.symbol || q.symbol || "BTCUSDT").toString().toUpperCase();
  const timeframe = normTF((body.timeframe || q.timeframe || "1d").toString());
  const limit = Math.min(parseInt((body.limit || q.limit || "250") as string, 10) || 250, 500);

  const r = await fetch(`${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${limit}`);
  if (!r.ok) return bad(res, 502, "Binance klines error", { detail: await r.text() });
  const klines: any[] = await r.json();
  if (!Array.isArray(klines) || klines.length < 50) return bad(res, 422, "Not enough data");

  const highs: number[] = [], lows: number[] = [], closes: number[] = [];
  for (const k of klines) {
    highs.push(parseFloat(k[2]));
    lows.push(parseFloat(k[3]));
    closes.push(parseFloat(k[4]));
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

  const lastClose = closes.at(-1)!;
  const lastRSI = rsiArr.at(-1) ?? null;
  const lastMACD = macdLine.at(-1) ?? null;
  const lastSignal = sigLine.at(-1) ?? null;
  const lastHist = hist.at(-1) ?? null;
  const lastEMA20 = ema20Arr.at(-1) ?? null;
  const lastEMA50 = ema50Arr.at(-1) ?? null;
  const lastEMA200 = ema200Arr.at(-1) ?? null;
  const lastSMA20 = sma20Arr.at(-1) ?? null;
  const lastSMA50 = sma50Arr.at(-1) ?? null;
  const lastSMA200 = sma200Arr.at(-1) ?? null;
  const lastK = stochK.at(-1) ?? null;
  const lastD = stochD.at(-1) ?? null;

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
    symbol,
    timeframe,
    price: lastClose,
    indicators: {
      rsi: lastRSI,
      macd: { line: lastMACD, signal: lastSignal, hist: lastHist },
      ema: { ema20: lastEMA20, ema50: lastEMA50, ema200: lastEMA200 },
      sma: { sma20: lastSMA20, sma50: lastSMA50, sma200: lastSMA200 },
      stochastic: { k: lastK, d: lastD },
    },
    summary: { buy, neutral, sell, verdict },
    breakdown: [
      { name: "RSI(14)", value: lastRSI, status: lastRSI === null ? "neutral" : lastRSI > 70 ? "bearish" : lastRSI < 30 ? "bullish" : "neutral" },
      { name: "MACD(12,26,9)", value: isMACDBull ? "Bullish" : "Bearish", status: isMACDBull ? "bullish" : "bearish" },
      { name: "EMA(20)", value: `Price ${priceVs20} EMA20`, status: priceVs20 === "above" ? "bullish" : priceVs20 === "below" ? "bearish" : "neutral" },
      { name: "EMA(50)", value: `Price ${priceVs50} EMA50`, status: priceVs50 === "above" ? "bullish" : priceVs50 === "below" ? "bearish" : "neutral" },
      { name: "EMA(200)", value: `Price ${priceVs200} EMA200`, status: priceVs200 === "above" ? "bullish" : priceVs200 === "below" ? "bearish" : "neutral" },
      { name: "Stochastic(14,3)", value: `${lastK?.toFixed?.(0) ?? "-"} / ${lastD?.toFixed?.(0) ?? "-"}`, status: lastK !== null && lastD !== null ? (lastK > 80 && lastD > 80 ? "bearish" : lastK < 20 && lastD < 20 ? "bullish" : "neutral") : "neutral" }
    ],
  });
}

async function handleHighPotential(_req: VercelRequest, res: VercelResponse) {
  const r = await fetch(`${BINANCE}/api/v3/ticker/24hr`);
  if (!r.ok) return bad(res, 502, "Binance 24hr all error", { detail: await r.text() });
  const list: any[] = await r.json();
  const top = list
    .filter((t: any) => t?.symbol?.endsWith("USDT"))
    .map((t: any) => ({
      symbol: t.symbol,
      changePct: parseFloat(t.priceChangePercent),
      lastPrice: parseFloat(t.lastPrice),
      quoteVolume: parseFloat(t.quoteVolume),
    }))
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 10);
  return ok(res, { ok: true, items: top });
}

// ---------- router ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const full = (req.url || "/").split("?")[0];    // "/api/market/ticker/BTCUSDT"
    const path = full.replace(/^\/+/, "");          // "api/market/ticker/BTCUSDT"
    const seg = path.split("/");                    // ["api","market","ticker","BTCUSDT"]

    if (seg[0] !== "api") return bad(res, 404, "Not Found", { path: full });

    if (seg.length === 1 || (seg.length === 2 && seg[1] === "")) return handleAlive(req, res);
    if (seg[1] === "health") return handleHealth(req, res);

    if (seg[1] === "market") {
      if (seg[2] === "ticker" && seg[3]) return handleTicker(req, res, seg[3]);
      if (seg[2] === "gainers") return handleGainers(req, res);
      return bad(res, 404, "Unknown market route", { path: full });
    }

    if (seg[1] === "scanner") {
      if (seg[2] === "scan") return handleScan(req, res);
      if (seg[2] === "high-potential") return handleHighPotential(req, res);
      return bad(res, 404, "Unknown scanner route", { path: full });
    }

    if (seg[1] === "watchlist") return ok(res, { ok: true, items: [] });
    if (seg[1] === "portfolio") return ok(res, { ok: true, positions: [] });

    if (seg[1] === "ai" && seg[2] === "market-overview") {
      const [btc, eth] = await Promise.all([
        fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=BTCUSDT`).then((r) => r.json()),
        fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=ETHUSDT`).then((r) => r.json()),
      ]);
      return ok(res, {
        ok: true,
        overview: {
          BTCUSDT: { last: parseFloat(btc.lastPrice), changePct: parseFloat(btc.priceChangePercent) },
          ETHUSDT: { last: parseFloat(eth.lastPrice), changePct: parseFloat(eth.priceChangePercent) },
          note: "AI summary pending; showing live snapshot.",
        },
      });
    }

    return bad(res, 404, "Unknown API route", { path: full });
  } catch (err: any) {
    console.error("API error:", err);
    return bad(res, 500, err?.message || "Internal error");
  }
}
