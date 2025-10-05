import type { VercelRequest, VercelResponse } from "vercel";

const BINANCE = "https://api.binance.com";

// Exclude leveraged/fan/ETF style tokens by suffix
const EXCLUDE_REGEX = /(UP|DOWN|BULL|BEAR|\d+L|\d+S)USDT$/;

// Volume floors (progressively relaxed so we never return empty)
const FLOORS = [1_000_000, 300_000, 50_000, 1]; // USDT quote volume

async function getJson(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "stock-portfolio/1.0" } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // --- Build SPOT-USDT allowlist (try permissions=SPOT first, then full) ---
    let exInfo: any;
    try {
      exInfo = await getJson(`${BINANCE}/api/v3/exchangeInfo?permissions=SPOT`);
    } catch {
      exInfo = await getJson(`${BINANCE}/api/v3/exchangeInfo`);
    }

    const allowUSDT = new Set<string>();
    for (const s of exInfo?.symbols ?? []) {
      const hasSpot = s?.permissions?.includes?.("SPOT") || s?.isSpotTradingAllowed === true;
      if (
        hasSpot &&
        s?.status === "TRADING" &&
        s?.quoteAsset === "USDT" &&
        typeof s?.symbol === "string" &&
        !EXCLUDE_REGEX.test(s.symbol)
      ) {
        allowUSDT.add(s.symbol);
      }
    }

    // --- 24h stats (array) ---
    const tickers: any = await getJson(`${BINANCE}/api/v3/ticker/24hr`);
    if (!Array.isArray(tickers)) throw new Error("ticker/24hr not array");

    // --- Join + safe parse ---
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    let rows = tickers
      .filter((t: any) => allowUSDT.has(t.symbol))
      .map((t: any) => ({
        symbol: t.symbol,
        price: toNum(t.lastPrice),
        changePct: toNum(t.priceChangePercent),
        volume: toNum(t.quoteVolume),
        high: toNum(t.highPrice),
        low: toNum(t.lowPrice),
      }));

    // Fallback: if allowlist unexpectedly tiny, derive from tickers to avoid empties
    if (rows.length === 0 && allowUSDT.size < 50) {
      rows = tickers
        .filter((t: any) => /USDT$/.test(t.symbol) && !EXCLUDE_REGEX.test(t.symbol))
        .map((t: any) => ({
          symbol: t.symbol,
          price: toNum(t.lastPrice),
          changePct: toNum(t.priceChangePercent),
          volume: toNum(t.quoteVolume),
          high: toNum(t.highPrice),
          low: toNum(t.lowPrice),
        }));
    }

    // Kill zero rows, apply progressive volume floors so we always have data
    rows = rows.filter(r => r.price > 0 && r.volume > 0 && r.high > 0 && r.low > 0);
    let filtered: typeof rows = [];
    for (const floor of FLOORS) {
      filtered = rows.filter(r => r.volume >= floor);
      if (filtered.length >= 20) break; // good enough for the UI
    }
    if (filtered.length === 0) filtered = rows; // absolute fallback

    // Sort and cap (keep the list light)
    const top = filtered.sort((a, b) => b.changePct - a.changePct).slice(0, 120);

    // Exact payload shape the FE expects — NO extra keys
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json({ rows: top });
  } catch (e) {
    // Return a valid (empty) shape rather than an error object
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json({ rows: [] });
  }
}
