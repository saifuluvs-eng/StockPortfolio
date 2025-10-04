import type { VercelRequest, VercelResponse } from "vercel";

const BINANCE = "https://api.binance.com";
// Exclude leveraged tokens / ETFs
const EXCLUDE_REGEX = /(UP|DOWN|BULL|BEAR|\d+L|\d+S)USDT$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // --- A) SPOT allowlist (authoritative) ---
    // Use permissions=SPOT to avoid symbols with no spot trading.
    const exInfoRes = await fetch(`${BINANCE}/api/v3/exchangeInfo?permissions=SPOT`);
    if (!exInfoRes.ok) {
      throw new Error(`exchangeInfo failed: ${exInfoRes.status}`);
    }

    const exInfo = await exInfoRes.json();

    if (!exInfo || !Array.isArray(exInfo.symbols)) {
      throw new Error("exchangeInfo malformed");
    }

    const allowUSDT = new Set<string>();
    for (const s of exInfo.symbols) {
      const isTrading = s.status === "TRADING";
      const isUSDT = s.quoteAsset === "USDT";
      if (isTrading && isUSDT && !EXCLUDE_REGEX.test(s.symbol)) {
        allowUSDT.add(s.symbol);
      }
    }

    // --- B) 24h stats (must be array) ---
    const statsRes = await fetch(`${BINANCE}/api/v3/ticker/24hr`);
    if (!statsRes.ok) {
      throw new Error(`ticker/24hr failed: ${statsRes.status}`);
    }

    const stats = await statsRes.json();
    if (!Array.isArray(stats)) {
      // Rate limit or error object – surface a controlled error
      throw new Error(`ticker/24hr not array: ${JSON.stringify(stats).slice(0, 120)}`);
    }

    // --- C) Join, parse safely, drop dead rows ---
    const rowsRaw = stats
      .filter((t: any) => allowUSDT.has(t.symbol))
      .map((t: any) => {
        const num = (v: any) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        };
        return {
          symbol: t.symbol,
          price: num(t.lastPrice),
          changePct: num(t.priceChangePercent),
          volume: num(t.quoteVolume), // USDT volume
          high: num(t.highPrice),
          low: num(t.lowPrice),
        };
      });

    // Primary filter: real trading activity
    let rows = rowsRaw.filter((r) => r.price > 0 && r.volume > 0);

    // Fallback (in case of partial Binance hiccups): keep price>0 only
    if (rows.length === 0 && rowsRaw.length > 0) {
      rows = rowsRaw.filter((r) => r.price > 0);
    }

    rows = rows
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 120); // cap to 100–150; using 120

    // Short CDN cache so we don’t hammer Binance
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    res.status(200).json({ rows });

    // Debug counters (visible in logs)
    console.log("gainers counts:", {
      allowUSDT: allowUSDT.size,
      stats: stats.length,
      rowsRaw: rowsRaw.length,
      rows: rows.length,
    });
  } catch (err: any) {
    console.error("gainers spot error:", err?.message || err);
    res.status(200).json({ rows: [] }); // return empty payload (client handles “No data”)
  }
}
