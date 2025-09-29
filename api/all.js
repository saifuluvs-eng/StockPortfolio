// api/all.js
// Router via query param: /api/all?path=market/ticker/BTCUSDT
// Rewrites in vercel.json map /api/(.*) -> /api/all?path=$1

function json(res, code, body) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  return res.status(code).json(body);
}
const ok  = (res, body) => json(res, 200, body);
const bad = (res, code, message, extra = {}) => json(res, code, { ok: false, message, ...extra });

const BINANCE = "https://api.binance.com";

// ---------- indicators ----------
const VALID = new Set(["1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1M"]);
function normTF(tf) {
  const t = String(tf || "").toLowerCase().trim();
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
const sma = (arr, p) => {
  if (arr.length < p) return [];
  const out = []; let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= p) sum -= arr[i - p];
    if (i >= p - 1) out.push(sum / p);
  }
  return out;
};
const ema = (arr, p) => {
  if (arr.length < p) return [];
  const k = 2 / (p + 1), out = [];
  let prev = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out.push(prev);
  for (let i = p; i < arr.length; i++) {
    const cur = arr[i] * k + prev * (1 - k);
    out.push(cur); prev = cur;
  }
  return out;
};
const rsi = (arr, p = 14) => {
  if (arr.length < p + 1) return [];
  const gains = [], losses = [];
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    gains.push(Math.max(d, 0)); losses.push(Math.max(-d, 0));
  }
  let g = gains.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let l = losses.slice(0, p).reduce((a, b) => a + b, 0) / p;
  const out = [];
  out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  for (let i = p; i < gains.length; i++) {
    g = (g * (p - 1) + gains[i]) / p;
    l = (l * (p - 1) + losses[i]) / p;
    out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  return out;
};
const macd = (arr, fast = 12, slow = 26, signal = 9) => {
  if (arr.length < slow + signal) return { macd: [], signal: [], hist: [] };
  const f = ema(arr, fast), s = ema(arr, slow);
  const off = f.length - s.length, m = [];
  for (let i = 0; i < s.length; i++) m.push(f[i + off] - s[i]);
  const sig = ema(m, signal);
  const hoff = m.length - sig.length, h = [];
  for (let i = 0; i < sig.length; i++) h.push(m[i + hoff] - sig[i]);
  return { macd: m.slice(m.length - sig.length), signal: sig, hist: h };
};
const stochastic = (high, low, close, p = 14, smoothD = 3) => {
  if (close.length < p) return { k: [], d: [] };
  const k = [];
  for (let i = p - 1; i < close.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) { if (high[j] > hh) hh = high[j]; if (low[j] < ll) ll = low[j]; }
    k.push(hh === ll ? 50 : ((close[i] - ll) / (hh - ll)) * 100);
  }
  const d = sma(k, smoothD);
  return { k: k.slice(k.length - d.length), d };
};

// ---------- handlers ----------
async function alive(_req, res) { return ok(res, { ok: true, message: "alive", time: new Date().toISOString() }); }
async function health(_req, res) { return ok(res, { ok: true, message: "healthy", time: new Date().toISOString() }); }

async function ticker(_req, res, symbol) {
  if (!symbol) return bad(res, 400, "symbol required");
  const sym = String(symbol).toUpperCase();
  const r = await fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=${encodeURIComponent(sym)}`, { cache: "no-store" });
  if (!r.ok) return bad(res, r.status, "binance error", { detail: await r.text() });
  const data = await r.json();
  return ok(res, { ok: true, symbol: sym, data, time: new Date().toISOString() });
}

async function gainers(_req, res) {
  const r = await fetch(`${BINANCE}/api/v3/ticker/24hr`, { cache: "no-store" });
  if (!r.ok) return bad(res, r.status, "binance error", { detail: await r.text() });
  const list = await r.json();
  const items = list
    .filter(t => t?.symbol?.endsWith?.("USDT"))
    .map(t => ({
      symbol: t.symbol,
      last: parseFloat(t.lastPrice),
      changePct: parseFloat(t.priceChangePercent),
      quoteVolume: parseFloat(t.quoteVolume),
    }))
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 20);
  return ok(res, { ok: true, items, time: new Date().toISOString() });
}

async function highPotential(_req, res) {
  const r = await fetch(`${BINANCE}/api/v3/ticker/24hr`, { cache: "no-store" });
  if (!r.ok) return bad(res, r.status, "binance error", { detail: await r.text() });
  const list = await r.json();
  const items = list
    .filter(t => t?.symbol?.endsWith?.("USDT"))
    .map(t => ({
      symbol: t.symbol,
      changePct: parseFloat(t.priceChangePercent),
      lastPrice: parseFloat(t.lastPrice),
      quoteVolume: parseFloat(t.quoteVolume),
    }))
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 10);
  return ok(res, { ok: true, items, time: new Date().toISOString() });
}

async function aiOverview(_req, res) {
  const [btc, eth] = await Promise.all([
    fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=BTCUSDT`).then(r => r.json()),
    fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=ETHUSDT`).then(r => r.json()),
  ]);
  return ok(res, {
    ok: true,
    overview: {
      BTCUSDT: { last: parseFloat(btc.lastPrice), changePct: parseFloat(btc.priceChangePercent) },
      ETHUSDT: { last: parseFloat(eth.lastPrice), changePct: parseFloat(eth.priceChangePercent) },
    },
    note: "AI summary pending; live snapshot only.",
    time: new Date().toISOString(),
  });
}

async function scan(req, res) {
  const q = req.query || {};
  const symbol = String(q.symbol || "BTCUSDT").toUpperCase();
  const timeframe = normTF(String(q.timeframe || "1d"));
  const limit = Math.min(parseInt(String(q.limit || "250"), 10) || 250, 500);

  const r = await fetch(`${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${limit}`, { cache: "no-store" });
  if (!r.ok) return bad(res, r.status, "binance error", { detail: await r.text() });
  const klines = await r.json();
  if (!Array.isArray(klines) || klines.length < 50) return bad(res, 422, "Not enough data");

  const highs = [], lows = [], closes = [];
  for (const k of klines) { highs.push(parseFloat(k[2])); lows.push(parseFloat(k[3])); closes.push(parseFloat(k[4])); }

  const rsiArr = rsi(closes, 14);
  const ema20Arr = ema(closes, 20), ema50Arr = ema(closes, 50), ema200Arr = ema(closes, 200);
  const { macd: macdLine, signal: sigLine, hist } = macd(closes, 12, 26, 9);
  const { k: stochK, d: stochD } = stochastic(highs, lows, closes, 14, 3);

  const lastClose = closes.at(-1);
  const lastRSI = rsiArr.at(-1) ?? null;
  const lastMACD = macdLine.at(-1) ?? null;
  const lastSignal = sigLine.at(-1) ?? null;
  const lastHist = hist.at(-1) ?? null;
  const lastEMA20 = ema20Arr.at(-1) ?? null;
  const lastEMA50 = ema50Arr.at(-1) ?? null;
  const lastEMA200 = ema200Arr.at(-1) ?? null;
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
    symbol, timeframe, price: lastClose,
    indicators: {
      rsi: lastRSI,
      macd: { line: lastMACD, signal: lastSignal, hist: lastHist },
      ema: { ema20: lastEMA20, ema50: lastEMA50, ema200: lastEMA200 },
      stochastic: { k: lastK, d: lastD },
    },
    summary: { buy, neutral, sell, verdict },
    time: new Date().toISOString(),
  });
}

// ---------- router ----------
export default async function handler(req, res) {
  try {
    const path = String(req.query?.path ?? "").replace(/^\/+/, "");
    if (!path) return alive(req, res);
    const seg = path.split("/").filter(Boolean);

    if (seg[0] === "health") return health(req, res);

    if (seg[0] === "market") {
      if (seg[1] === "ticker" && seg[2]) return ticker(req, res, seg[2]);
      if (seg[1] === "gainers") return gainers(req, res);
      return bad(res, 404, "Unknown market route", { path });
    }

    if (seg[0] === "scanner") {
      if (seg[1] === "high-potential") return highPotential(req, res);
      if (seg[1] === "scan") return scan(req, res);
      return bad(res, 404, "Unknown scanner route", { path });
    }

    if (seg[0] === "watchlist") return ok(res, { ok: true, items: [], time: new Date().toISOString() });
    if (seg[0] === "portfolio") return ok(res, { ok: true, positions: [], time: new Date().toISOString() });

    if (seg[0] === "ai" && seg[1] === "market-overview") return aiOverview(req, res);

    return bad(res, 404, "Unknown API route", { path });
  } catch (e) {
    console.error("api/all error:", e);
    return bad(res, 500, e?.message || "internal_error");
  }
}
