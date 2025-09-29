// api/all.js
// Router via query param: /api/all?path=market/ticker/BTCUSDT

function json(res, code, body) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  return res.status(code).json(body);
}
const ok  = (res, body) => json(res, 200, body);
const bad = (res, code, message, extra = {}) => json(res, code, { ok: false, message, ...extra });

const BINANCE = "https://api.binance.com";

async function alive(_req, res) {
  return ok(res, { ok: true, message: "alive", time: new Date().toISOString() });
}
async function health(_req, res) {
  return ok(res, { ok: true, message: "healthy", time: new Date().toISOString() });
}

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
  // Simple heuristic = top % gainers subset
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

export default async function handler(req, res) {
  try {
    const path = String(req.query?.path ?? "").replace(/^\/+/, ""); // e.g. "market/ticker/BTCUSDT"
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
      // scanner/scan can be added later
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
