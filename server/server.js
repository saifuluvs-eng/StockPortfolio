import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import {
  MACD,
  RSI,
  EMA,
  SMA,
  BollingerBands,
  Stochastic,
  ADX,
  ATR,
  MFI,
  OBV,
  CCI,
} from 'technicalindicators';
import { randomUUID } from 'node:crypto';

const intervalMap = (tf) =>
  ({
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '2h': '2h',
    '3h': '3h',
    '4h': '4h',
    '6h': '6h',
    '8h': '8h',
    '12h': '12h',
    '1d': '1d',
    '1D': '1d',
    '1day': '1d',
    '1Day': '1d',
    '1w': '1w',
    '1W': '1w',
    '1M': '1M',
    '1m': '1M',
  }[String(tf)] || '4h');

const fmt = (v) =>
  typeof v === 'string'
    ? v
    : v == null || Number.isNaN(+v)
    ? '—'
    : (+v).toFixed(2);

function normalizeSymbol(s) {
  if (!s) return "BTCUSDT";
  let sym = String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (sym.endsWith("USD") && !sym.endsWith("USDT")) sym = sym.slice(0, -3) + "USDT";
  if (!/(USDT|BTC|BUSD|FDUSD|TUSD|USDC)$/.test(sym)) sym = sym + "USDT";
  return sym;
}

async function getKlines(symbol, timeframe, limit = 500) {
  const interval = intervalMap(timeframe);
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
    symbol,
  )}&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) return { error: "binance_request_failed", status: r.status };
  const rows = await r.json();
  const opens = [];
  const highs = [];
  const lows = [];
  const closes = [];
  const volumes = [];
  for (const k of rows) {
    opens.push(+k[1]);
    highs.push(+k[2]);
    lows.push(+k[3]);
    closes.push(+k[4]);
    volumes.push(+k[5]);
  }
  return { opens, highs, lows, closes, volumes, lastClose: closes.at(-1) };
}

function classify(value, { gt, lt }) {
  const n = +value;
  if (Number.isNaN(n)) return 'neutral';
  if (gt != null && n > gt) return 'bullish';
  if (lt != null && n < lt) return 'bearish';
  return 'neutral';
}

function push(arr, title, value, signal = 'neutral', reason = '') {
  arr.push({ title, value: fmt(value), signal, reason });
}

const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);
const ALLOW_ORIGINS = [
  "https://stock-portfolio-khaki-nine.vercel.app",
  "http://localhost:5173",
];

const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      return cb(null, ALLOW_ORIGINS.includes(origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);
app.options("*", cors());
app.use(express.json());

// ensure memory store exists once
const memory = globalThis.__MEM__ ?? (globalThis.__MEM__ = { portfolio: [], scans: [] });

app.get("/", (_req, res) => {
  res.json({ message: "Stock Portfolio backend is running" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

function safeTicker(symbol, lastPrice = "0") {
  return {
    symbol,
    lastPrice,
    priceChangePercent: "0",
    highPrice: null,
    lowPrice: null,
    volume: null,
  };
}

async function handleTicker(req, res) {
  const raw = req.params.symbol || req.body?.symbol;
  const symbol = normalizeSymbol(raw);
  try {
    // 1) main: 24hr
    let r = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
    );
    if (r.ok) {
      const d = await r.json();
      res.set("cache-control", "no-store");
      return res.json(d);
    }
    const primaryStatus = r.status;
    // 2) fallback: price
    r = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
    );
    if (r.ok) {
      const p = await r.json();
      res.set("cache-control", "no-store");
      return res.json(safeTicker(p.symbol, p.price));
    }
    res.set("cache-control", "no-store");
    return res.json({ error: "binance_request_failed", status: r.status ?? primaryStatus });
  } catch (_) {}
  // 3) last resort: synthetic safe payload
  res.set("cache-control", "no-store");
  return res.json(safeTicker(symbol));
}

app.get("/api/market/ticker/:symbol", handleTicker);
app.get("/market/ticker/:symbol", handleTicker);

app.get("/api/time", (_req, res) => {
  res.json({ now: new Date().toISOString() });
});

app.post("/api/echo", (req, res) => {
  res.json({ echo: req.body ?? null });
});

app.get("/api/portfolio", (_req, res) => {
  res.json(memory.portfolio);
});

app.post("/api/portfolio", (req, res) => {
  const { symbol, qty = null, entry = null, createdAt = new Date().toISOString() } = req.body ?? {};

  const trimmed = typeof symbol === "string" ? symbol.trim() : "";
  const normalizedSymbol = trimmed ? normalizeSymbol(trimmed) : "";

  if (!normalizedSymbol) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }

  const row = {
    id: randomUUID(),
    symbol: normalizedSymbol,
    qty,
    entry,
    createdAt,
  };

  memory.portfolio.push(row);

  res.status(201).json(row);
});

app.delete("/api/portfolio/:id", (req, res) => {
  const { id } = req.params;
  const index = memory.portfolio.findIndex((item) => item.id === id);

  if (index === -1) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const [removed] = memory.portfolio.splice(index, 1);
  res.json(removed);
});

app.get("/api/market/gainers", (_req, res) => {
  res.json({ rows: [] });
});

app.get("/api/watchlist", (_req, res) => {
  res.json({ data: [] });
});

app.post("/api/watchlist", (req, res) => res.json({ data: [] }));

app.post('/api/scanner/scan', async (req, res) => {
  try {
    const { timeframe = '4h' } = req.body || {};
    const raw = req.body?.symbol;
    const sym = normalizeSymbol(raw);
    const tf = String(timeframe);
    const kl = await getKlines(sym, tf, 500);
    if (kl.error) return res.json({ data: [], error: kl.error, status: kl.status });
    const { opens, highs, lows, closes, volumes, lastClose } = kl;

    const out = [];
    const rsi = RSI.calculate({ values: closes, period: 14 }).at(-1);
    push(out, 'RSI', rsi, classify(rsi, { gt: 60, lt: 40 }), rsi > 60 ? 'RSI > 60' : rsi < 40 ? 'RSI < 40' : 'RSI neutral');

    const macd =
      MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      }).at(-1) || {};
    const macdSignal =
      macd.MACD > macd.signal ? 'bullish' : macd.MACD < macd.signal ? 'bearish' : 'neutral';
    push(out, 'MACD', macd.MACD, macdSignal, `MACD ${fmt(macd.MACD)} vs signal ${fmt(macd.signal)}`);

    const ema20 = EMA.calculate({ period: 20, values: closes }).at(-1);
    const ema50 = EMA.calculate({ period: 50, values: closes }).at(-1);
    const ema200 = EMA.calculate({ period: 200, values: closes }).at(-1);
    push(out, 'EMA 20', ema20, lastClose > ema20 ? 'bullish' : 'bearish', lastClose > ema20 ? 'Price > EMA20' : 'Price < EMA20');
    push(out, 'EMA 50', ema50, lastClose > ema50 ? 'bullish' : 'bearish', lastClose > ema50 ? 'Price > EMA50' : 'Price < EMA50');
    push(out, 'EMA 200', ema200, lastClose > ema200 ? 'bullish' : 'bearish', lastClose > ema200 ? 'Price > EMA200' : 'Price < EMA200');
    push(out, 'EMA 20/50 Cross', ema20 - ema50, ema20 > ema50 ? 'bullish' : 'bearish', ema20 > ema50 ? 'EMA20 > EMA50' : 'EMA20 < EMA50');
    push(out, 'EMA 50/200 Cross', ema50 - ema200, ema50 > ema200 ? 'bullish' : 'bearish', ema50 > ema200 ? 'EMA50 > EMA200' : 'EMA50 < EMA200');

    const sma20 = SMA.calculate({ period: 20, values: closes }).at(-1);
    const sma50 = SMA.calculate({ period: 50, values: closes }).at(-1);
    push(out, 'SMA 20', sma20, lastClose > sma20 ? 'bullish' : 'bearish', lastClose > sma20 ? 'Price > SMA20' : 'Price < SMA20');
    push(out, 'SMA 50', sma50, lastClose > sma50 ? 'bullish' : 'bearish', lastClose > sma50 ? 'Price > SMA50' : 'Price < SMA50');

    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes }).at(-1) || {};
    const bbSig = lastClose > bb.upper ? 'bearish' : lastClose < bb.lower ? 'bullish' : 'neutral';
    push(
      out,
      'Bollinger',
      `${fmt(bb.lower)}–${fmt(bb.upper)}`,
      bbSig,
      lastClose > bb.upper
        ? 'Above upper band'
        : lastClose < bb.lower
        ? 'Below lower band'
        : 'Inside bands',
    );

    const stoch =
      Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 }).at(-1) || {};
    const k = stoch.k;
    const d = stoch.d;
    const stSig = k > 80 ? 'bearish' : k < 20 ? 'bullish' : 'neutral';
    push(out, 'Stochastic %K', k, stSig, k > 80 ? 'Overbought' : k < 20 ? 'Oversold' : 'Mid-range');
    push(out, 'Stochastic %D', d, 'neutral', 'Signal line');

    const adx = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 }).at(-1) || {};
    push(out, 'ADX', adx.adx, classify(adx.adx, { gt: 25 }), adx.adx > 25 ? 'Strong trend' : 'Weak/No trend');

    const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 }).at(-1);
    push(out, 'ATR (14)', atr, 'neutral', 'Volatility');

    const mfi = MFI.calculate({ high: highs, low: lows, close: closes, volume: volumes, period: 14 }).at(-1);
    push(out, 'MFI', mfi, classify(mfi, { gt: 60, lt: 40 }), mfi > 60 ? 'Money inflow' : mfi < 40 ? 'Money outflow' : 'Balanced');

    const obv = OBV.calculate({ close: closes, volume: volumes }).at(-1);
    push(out, 'OBV', obv, 'neutral', 'Volume trend');

    const cci = CCI.calculate({ open: opens, high: highs, low: lows, close: closes, period: 20 }).at(-1);
    const cciSig = cci > 100 ? 'bullish' : cci < -100 ? 'bearish' : 'neutral';
    push(out, 'CCI', cci, cciSig, cci > 100 ? '> 100' : cci < -100 ? '< -100' : '≈ 0');

    let cumPV = 0;
    let cumV = 0;
    for (let i = 0; i < closes.length; i += 1) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      cumPV += tp * volumes[i];
      cumV += volumes[i];
    }
    const vwap = cumPV / (cumV || 1);
    push(out, 'VWAP', vwap, lastClose > vwap ? 'bullish' : 'bearish', lastClose > vwap ? 'Price > VWAP' : 'Price < VWAP');

    const score = out.reduce(
      (s, item) => s + (item.signal === 'bullish' ? 1 : item.signal === 'bearish' ? -1 : 0),
      0,
    );

    const result = {
      id: randomUUID(),
      ts: Date.now(),
      symbol: sym,
      timeframe: tf,
      summary: { label: score > 2 ? 'bullish' : score < -2 ? 'bearish' : 'neutral', score: String(score) },
      overallLabel: score > 2 ? 'bullish' : score < -2 ? 'bearish' : 'neutral',
      overallScore: String(score),
      checks: out,
      breakdown: out,
      technicals: out,
    };

    memory.scans.push(result);
    res.set('cache-control', 'no-store');
    res.json({ data: [result] });
  } catch (e) {
    console.error('[scan] error:', e);
    res.json({ data: [] });
  }
});

const compat = (s) => ({
  ...s,
  summary: s.summary || { label: s.overallLabel || "neutral", score: s.overallScore ?? "0" },
  breakdown: s.breakdown || s.checks || [],
  technicals: s.technicals || s.checks || [],
});

// history should return the latest scans (newest first)
app.get("/api/scanner/history", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: [...memory.scans].reverse().map(compat) });
});
app.post("/api/scanner/history", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: [...memory.scans].reverse().map(compat) });
});

// high-potential can surface the last few scans for now
app.get("/api/scanner/high-potential", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: memory.scans.slice(-5).reverse().map(compat) });
});
app.post("/api/scanner/high-potential", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: memory.scans.slice(-5).reverse().map(compat) });
});

app.get("/api/ai/market-overview", (_req, res) => {
  res.json({ summary: "Market overview data not available" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket) => {
  socket.on("message", (message) => {
    socket.send(message.toString());
  });
});

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit("connection", websocket, request);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
