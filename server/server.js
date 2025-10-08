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

const ohlcvTimeframeMap = Object.freeze({
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
});

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

const KL_INTERVAL_TO_MS = Object.freeze({
  '1m': 60000,
  '3m': 3 * 60000,
  '5m': 5 * 60000,
  '15m': 15 * 60000,
  '30m': 30 * 60000,
  '1h': 60 * 60000,
  '2h': 2 * 60 * 60000,
  '4h': 4 * 60 * 60000,
  '6h': 6 * 60 * 60000,
  '8h': 8 * 60 * 60000,
  '12h': 12 * 60 * 60000,
  '1d': 24 * 60 * 60000,
  '3d': 3 * 24 * 60 * 60000,
  '1w': 7 * 24 * 60 * 60000,
  '1M': 30 * 24 * 60 * 60000,
});

const fallbackBasePrice = (symbol) => {
  const s = symbol.toUpperCase();
  if (s.includes('BTC')) return 45000;
  if (s.includes('ETH')) return 3000;
  if (s.includes('BNB')) return 430;
  if (s.includes('SOL')) return 110;
  if (s.includes('ADA')) return 0.55;
  if (s.includes('DOGE')) return 0.12;
  return 25;
};

const hashSeed = (input) => {
  let h = 2166136261 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const createRng = (seed) => {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t ^= t >>> 15;
    t = Math.imul(t, t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    t ^= t >>> 14;
    return (t >>> 0) / 4294967296;
  };
};

const intervalToMs = (interval) => {
  if (!interval) return KL_INTERVAL_TO_MS['1h'];
  if (KL_INTERVAL_TO_MS[interval]) return KL_INTERVAL_TO_MS[interval];
  const normalized = interval.toLowerCase();
  return KL_INTERVAL_TO_MS[normalized] || KL_INTERVAL_TO_MS['1h'];
};

const generateSyntheticCandles = (symbol, interval, limit) => {
  const ms = intervalToMs(interval);
  const rng = createRng(`${symbol}:${interval}:${limit}`);
  const basePrice = fallbackBasePrice(symbol);
  const now = Date.now();
  const candles = [];
  let previousClose = basePrice * (0.9 + rng() * 0.2);

  for (let i = limit - 1; i >= 0; i -= 1) {
    const openTime = now - (limit - 1 - i) * ms;
    const drift = (rng() - 0.5) * 0.02;
    const shock = (rng() - 0.5) * 0.04;
    const close = Math.max(0.0001, previousClose * (1 + drift + shock));
    const open = previousClose;
    const high = Math.max(open, close) * (1 + Math.abs(shock) * 0.5);
    const low = Math.min(open, close) * (1 - Math.abs(shock) * 0.5);
    const volume = Math.max(
      1,
      (basePrice * 1000 * (0.6 + rng() * 0.8)) / Math.max(ms / 60000, 1),
    );
    const closeTime = openTime + ms - 1;
    candles.push({ openTime, closeTime, open, high, low, close, volume });
    previousClose = close;
  }

  return candles;
};

const buildKlineResponse = (candles) => {
  const opens = [];
  const highs = [];
  const lows = [];
  const closes = [];
  const volumes = [];

  for (const candle of candles) {
    const { openTime, closeTime, open, high, low, close, volume } = candle;
    opens.push(open);
    highs.push(high);
    lows.push(low);
    closes.push(close);
    volumes.push(volume);
  }

  return {
    opens,
    highs,
    lows,
    closes,
    volumes,
    lastClose: closes.at(-1),
    candles,
  };
};

async function getKlines(symbol, timeframe, limit = 500) {
  const interval = intervalMap(timeframe);
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
    symbol,
  )}&interval=${interval}&limit=${limit}`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`binance ${r.status}`);
    }
    const rows = await r.json();
    const candles = rows.map((k) => ({
      openTime: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      closeTime: Number(k[6]),
    }));
    return buildKlineResponse(candles);
  } catch (error) {
    console.warn(
      '[getKlines] Falling back to synthetic candles due to upstream error:',
      error,
    );
    const synthetic = generateSyntheticCandles(symbol, interval, limit);
    return buildKlineResponse(synthetic);
  }
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
const normalizeOrigin = (origin) => origin?.replace(/\/+$/, '') ?? null;

const ALLOW_ORIGINS = [
  normalizeOrigin(process.env.DASH_ORIGIN),
  normalizeOrigin("http://localhost:3000"),
  normalizeOrigin("http://localhost:5173"),
].filter((value) => value);

const allowedOriginSet = new Set(ALLOW_ORIGINS);
const vercelPreviewOrigin = (origin) =>
  typeof origin === "string" && origin.toLowerCase().endsWith(".vercel.app");

const ALLOWED_METHODS = ["GET", "POST", "OPTIONS"];
const ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "X-Requested-With",
  "Accept",
  "Origin",
  "authorization",
  "content-type",
  "x-requested-with",
  "accept",
  "origin",
];

const appendVaryHeader = (res, value) => {
  const current = res.get('Vary');
  if (!current) {
    res.header('Vary', value);
    return;
  }
  const values = current.split(/,\s*/);
  if (!values.includes(value)) {
    res.header('Vary', `${current}, ${value}`);
  }
};

const resolveAllowedOrigin = (originHeader) => {
  if (!originHeader) return null;
  const normalizedOrigin = normalizeOrigin(originHeader);
  if (normalizedOrigin && allowedOriginSet.has(normalizedOrigin)) {
    return originHeader;
  }
  if (vercelPreviewOrigin(originHeader)) {
    return originHeader;
  }
  return null;
};

const applyCorsHeaders = (req, res) => {
  const allowedOrigin = resolveAllowedOrigin(req.get('Origin'));
  if (allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  }
  appendVaryHeader(res, 'Origin');
  appendVaryHeader(res, 'Access-Control-Request-Method');
  appendVaryHeader(res, 'Access-Control-Request-Headers');
  res.header('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  const requestedHeaders = req.get('Access-Control-Request-Headers');
  if (requestedHeaders) {
    res.header('Access-Control-Allow-Headers', requestedHeaders);
  } else if (!res.get('Access-Control-Allow-Headers')) {
    res.header('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  }
};

const app = express();

const corsOptions = {
  origin(origin, cb) {
    if (!origin) {
      return cb(null, false);
    }
    const allowedOrigin = resolveAllowedOrigin(origin);
    if (allowedOrigin) {
      return cb(null, allowedOrigin);
    }
    return cb(null, false);
  },
  methods: ALLOWED_METHODS,
  allowedHeaders: ALLOWED_HEADERS,
  credentials: false,
  optionsSuccessStatus: 204,
};

const corsMiddleware = cors(corsOptions);

app.use((req, res, next) => {
  corsMiddleware(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    applyCorsHeaders(req, res);
    next();
  });
});
app.options('*', cors(corsOptions), (req, res) => {
  applyCorsHeaders(req, res);
  res.sendStatus(204);
});
app.use(express.json());

// ensure memory store exists once
const memory =
  globalThis.__MEM__ ?? (globalThis.__MEM__ = { portfolio: { users: {} }, scans: [] });

function ensurePortfolioStore() {
  const store = memory.portfolio;
  if (!store || typeof store !== "object" || Array.isArray(store)) {
    memory.portfolio = { users: {} };
    return memory.portfolio;
  }
  if (!store.users || typeof store.users !== "object") {
    store.users = {};
  }
  return store;
}

function resolveUid(value) {
  if (Array.isArray(value)) {
    return resolveUid(value[0]);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getUid(req, body) {
  return resolveUid(body?.uid) ?? resolveUid(req.query?.uid) ?? "demo-user";
}

function getUserPortfolio(uid) {
  const store = ensurePortfolioStore();
  const key = uid ?? "__default__";
  if (!store.users[key]) {
    store.users[key] = { positions: [] };
  }
  return store.users[key];
}

function resolveSymbol(...inputs) {
  for (const input of inputs) {
    if (typeof input !== "string") continue;
    const trimmed = input.trim();
    if (!trimmed) continue;
    return normalizeSymbol(trimmed);
  }
  return "";
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function refreshPositionMetrics(position) {
  const qty = toFiniteNumber(position.qty) ?? 0;
  const avg = toFiniteNumber(position.avgPrice) ?? 0;
  const liveCandidate = toFiniteNumber(position.livePrice);
  const live =
    liveCandidate != null && liveCandidate > 0 ? liveCandidate : avg > 0 ? avg : 0;
  position.qty = qty;
  position.avgPrice = avg;
  position.livePrice = live;
  position.pnl = live * qty - avg * qty;
}

function serializePositions(positions) {
  return positions.map((position) => {
    refreshPositionMetrics(position);
    const { id, ...rest } = position;
    return rest;
  });
}

function computeTotals(positions) {
  let totalValue = 0;
  let invested = 0;
  for (const position of positions) {
    refreshPositionMetrics(position);
    totalValue += position.livePrice * position.qty;
    invested += position.avgPrice * position.qty;
  }
  const totalPnL = totalValue - invested;
  const totalPnLPercent = invested > 0 ? (totalPnL / invested) * 100 : 0;
  return { totalValue, totalPnL, totalPnLPercent };
}

app.get("/", (_req, res) => {
  res.json({ message: "Stock Portfolio backend is running" });
});

const healthPayload = () => ({ ok: true, ts: Date.now() });

app.get("/health", (_req, res) => {
  res.json(healthPayload());
});

app.get("/api/health", (_req, res) => {
  res.json(healthPayload());
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

app.get("/api/ohlcv", async (req, res) => {
  const rawSymbol = Array.isArray(req.query.symbol) ? req.query.symbol[0] : req.query.symbol;
  const rawTf = Array.isArray(req.query.tf) ? req.query.tf[0] : req.query.tf;
  const symbolInput = typeof rawSymbol === "string" ? rawSymbol.trim() : "";
  const tfInput = typeof rawTf === "string" ? rawTf.trim() : "";
  const mappedTf = ohlcvTimeframeMap[tfInput];

  if (!symbolInput || !mappedTf) {
    res.status(400).json({ error: "bad_params" });
    return;
  }

  const symbol = normalizeSymbol(symbolInput);

  try {
    const kl = await getKlines(symbol, mappedTf, 500);
    if (kl?.error) {
      const status = kl.status ?? 502;
      res.status(status).json({ error: kl.error, status });
      return;
    }

    const candles = Array.isArray(kl.candles) ? kl.candles : [];
    res.set("cache-control", "public, max-age=30, s-maxage=30");
    res.json({
      symbol,
      tf: tfInput,
      generatedAt: new Date().toISOString(),
      candles,
    });
  } catch (error) {
    res.status(502).json({
      error: "upstream",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/portfolio", (req, res) => {
  const uid = getUid(req, req.body ?? {});
  if (!uid) {
    res.status(400).json({ error: "missing_uid" });
    return;
  }
  const user = getUserPortfolio(uid);
  const totals = computeTotals(user.positions);
  res.json({ ...totals, positions: serializePositions(user.positions) });
});

app.post("/api/portfolio", (req, res) => {
  const body = req.body ?? {};
  const uid = getUid(req, body);
  if (!uid) {
    res.status(400).json({ error: "missing_uid" });
    return;
  }

  const user = getUserPortfolio(uid);
  const action = typeof body.action === "string" ? body.action.toLowerCase() : "add";

  if (action === "delete") {
    const targetId =
      typeof body.id === "string" && body.id.trim().length > 0 ? body.id.trim() : null;
    const symbol = resolveSymbol(body.symbol, body.position?.symbol, req.query?.symbol);
    if (!symbol && !targetId) {
      res.status(400).json({ error: "invalid_symbol" });
      return;
    }

    const before = user.positions.length;
    user.positions = user.positions.filter((position) => {
      const matchesSymbol = symbol ? resolveSymbol(position.symbol) === symbol : false;
      const matchesId = targetId ? position.id === targetId : false;
      return !matchesSymbol && !matchesId;
    });
    const totals = computeTotals(user.positions);
    res.json({ ok: before !== user.positions.length, ...totals, positions: serializePositions(user.positions) });
    return;
  }

  const payload =
    body.position && typeof body.position === "object" ? body.position : body;
  const symbol = resolveSymbol(payload?.symbol, payload?.sym);
  if (!symbol) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }

  const qty = toFiniteNumber(payload?.qty);
  if (qty == null || qty <= 0) {
    res.status(400).json({ error: "invalid_quantity" });
    return;
  }

  const avgPrice = toFiniteNumber(payload?.avgPrice ?? body?.entry ?? payload?.entry);
  if (avgPrice == null || avgPrice <= 0) {
    res.status(400).json({ error: "invalid_avg_price" });
    return;
  }

  const existing = user.positions.find(
    (position) => resolveSymbol(position.symbol) === symbol || position.id === symbol,
  );

  if (existing) {
    const newQty = existing.qty + qty;
    const newAvg =
      newQty > 0
        ? (existing.avgPrice * existing.qty + avgPrice * qty) / newQty
        : avgPrice;
    existing.qty = newQty;
    existing.avgPrice = newAvg;
    if (!toFiniteNumber(existing.livePrice)) {
      existing.livePrice = avgPrice;
    }
    refreshPositionMetrics(existing);
  } else {
    const position = {
      id: randomUUID(),
      symbol,
      qty,
      avgPrice,
      livePrice: avgPrice,
      pnl: 0,
    };
    refreshPositionMetrics(position);
    user.positions.unshift(position);
  }

  const totals = computeTotals(user.positions);
  res.json({ ok: true, ...totals, positions: serializePositions(user.positions) });
});

app.delete("/api/portfolio/:id", (req, res) => {
  const uid = getUid(req, req.body ?? {});
  if (!uid) {
    res.status(400).json({ error: "missing_uid" });
    return;
  }

  const user = getUserPortfolio(uid);
  const rawParam = typeof req.params?.id === "string" ? req.params.id.trim() : "";
  const targetId = rawParam || (typeof req.query?.id === "string" ? req.query.id.trim() : "");
  const symbol = resolveSymbol(req.query?.symbol, rawParam);
  if (!symbol && !targetId) {
    res.status(400).json({ error: "invalid_symbol" });
    return;
  }

  const before = user.positions.length;
  user.positions = user.positions.filter((position) => {
    const matchesSymbol = symbol ? resolveSymbol(position.symbol) === symbol : false;
    const matchesId =
      targetId && typeof position.id === "string" ? position.id === targetId : false;
    return !matchesSymbol && !matchesId;
  });

  if (before === user.positions.length) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const totals = computeTotals(user.positions);
  res.json({ ok: true, ...totals, positions: serializePositions(user.positions) });
});

const BINANCE = "https://api.binance.com";
const EXCLUDE_REGEX = /(UP|DOWN|BULL|BEAR|\d+L|\d+S)USDT$/;
const FLOORS = [1_000_000, 300_000, 50_000, 1];

app.get("/api/market/gainers", async (_req, res) => {
  const headers = { "User-Agent": "stock-portfolio/1.0" };
  const toNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const getJson = async (url) => {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  };

  try {
    let exInfo;
    try {
      exInfo = await getJson(`${BINANCE}/api/v3/exchangeInfo?permissions=SPOT`);
    } catch (_) {
      exInfo = await getJson(`${BINANCE}/api/v3/exchangeInfo`);
    }

    const allowUSDT = new Set();
    for (const symbolInfo of exInfo?.symbols ?? []) {
      const hasSpot =
        symbolInfo?.permissions?.includes?.("SPOT") || symbolInfo?.isSpotTradingAllowed === true;
      if (
        hasSpot &&
        symbolInfo?.status === "TRADING" &&
        symbolInfo?.quoteAsset === "USDT" &&
        typeof symbolInfo?.symbol === "string" &&
        !EXCLUDE_REGEX.test(symbolInfo.symbol)
      ) {
        allowUSDT.add(symbolInfo.symbol);
      }
    }

    const tickers = await getJson(`${BINANCE}/api/v3/ticker/24hr`);
    if (!Array.isArray(tickers)) throw new Error("ticker/24hr not array");

    let rows = tickers
      .filter((ticker) => allowUSDT.has(ticker.symbol))
      .map((ticker) => ({
        symbol: ticker.symbol,
        price: toNum(ticker.lastPrice),
        changePct: toNum(ticker.priceChangePercent),
        volume: toNum(ticker.quoteVolume),
        high: toNum(ticker.highPrice),
        low: toNum(ticker.lowPrice),
      }));

    if (rows.length === 0 && allowUSDT.size < 50) {
      rows = tickers
        .filter((ticker) => /USDT$/.test(ticker.symbol) && !EXCLUDE_REGEX.test(ticker.symbol))
        .map((ticker) => ({
          symbol: ticker.symbol,
          price: toNum(ticker.lastPrice),
          changePct: toNum(ticker.priceChangePercent),
          volume: toNum(ticker.quoteVolume),
          high: toNum(ticker.highPrice),
          low: toNum(ticker.lowPrice),
        }));
    }

    rows = rows.filter((row) => row.price > 0 && row.volume > 0 && row.high > 0 && row.low > 0);

    let filtered = [];
    for (const floor of FLOORS) {
      filtered = rows.filter((row) => row.volume >= floor);
      if (filtered.length >= 20) break;
    }
    if (filtered.length === 0) filtered = rows;

    const top = filtered.sort((a, b) => b.changePct - a.changePct).slice(0, 120);

    res.set("cache-control", "no-store");
    res.json({ rows: top });
  } catch (_) {
    res.set("cache-control", "no-store");
    res.json({ rows: [] });
  }
});

app.get("/api/watchlist", (_req, res) => {
  res.json({ data: [] });
});

app.post("/api/watchlist", (req, res) => res.json({ data: [] }));

// Minimal metrics endpoint (stub)
// GET /api/metrics?symbol=INJUSDT&tf=1h
app.get("/api/metrics", async (req, res) => {
  const { symbol, tf } = req.query;
  res.json({
    ok: true,
    symbol: String(symbol ?? ""),
    timeframe: String(tf ?? ""),
    indicators: {
      rsi: null,
      macd: { macd: null, signal: null, histogram: null },
      ema: { ema20: null, ema50: null, ema200: null },
      atr: null,
      trendScore: 0,
    },
    message: "stub",
  });
});

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

const parseQueryNumber = (value, fallback) => {
  if (Array.isArray(value)) return parseQueryNumber(value[0], fallback);
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseQueryBoolean = (value, fallback) => {
  if (Array.isArray(value)) return parseQueryBoolean(value[0], fallback);
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase();
  if (["false", "0", "no"].includes(str)) return false;
  if (["true", "1", "yes"].includes(str)) return true;
  return fallback;
};

// history should return the latest scans (newest first)
app.get("/api/scanner/history", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: [...memory.scans].reverse().map(compat) });
});
app.post("/api/scanner/history", (_req, res) => {
  res.set("cache-control", "no-store");
  res.json({ data: [...memory.scans].reverse().map(compat) });
});

app.get("/api/ai/market-overview", (_req, res) => {
  res.json({ summary: "Market overview data not available" });
});

app.use((req, res) => {
  applyCorsHeaders(req, res);
  res.status(404).json({ message: "Not Found" });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error', err);
  applyCorsHeaders(req, res);
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || 'Internal Server Error';
  res.status(status).json({ error: message });
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

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export { app, server, wss };
