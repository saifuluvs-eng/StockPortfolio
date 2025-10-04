import type { VercelRequest, VercelResponse } from "vercel";

const BINANCE = "https://api.binance.com";

// Exclude leveraged/ETF/fan tokens by symbol pattern
const EXCLUDE_REGEX = /(UP|DOWN|BULL|BEAR|\d+L|\d+S)USDT$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1) Build an allowlist of SPOT USDT symbols that are actively TRADING
    const exInfo = await fetch(`${BINANCE}/api/v3/exchangeInfo`).then((r) => r.json());

    const spotUSDT = new Set<string>();
    for (const s of exInfo?.symbols ?? []) {
      const isSpot = s.permissions?.includes?.("SPOT") || s.isSpotTradingAllowed === true;
      if (
        isSpot &&
        s.status === "TRADING" &&
        s.quoteAsset === "USDT" &&
        !EXCLUDE_REGEX.test(s.symbol)
      ) {
        spotUSDT.add(s.symbol);
      }
    }

    // 2) Pull 24h stats (spot endpoint)
    const stats: any[] = await fetch(`${BINANCE}/api/v3/ticker/24hr`).then((r) => r.json());

    // 3) Join using the allowlist AND drop dead/zero rows
    const rows = stats
      .filter((t) => {
        const price = Number(t.lastPrice);
        const vol = Number(t.quoteVolume);
        const high = Number(t.highPrice);
        const low = Number(t.lowPrice);
        return (
          spotUSDT.has(t.symbol) &&
          Number.isFinite(price) &&
          price > 0 &&
          Number.isFinite(vol) &&
          vol > 0 &&
          Number.isFinite(high) &&
          high > 0 &&
          Number.isFinite(low) &&
          low > 0
        );
      })
      .map((t) => ({
        symbol: t.symbol,
        price: Number(t.lastPrice),
        changePct: Number(t.priceChangePercent),
        volume: Number(t.quoteVolume),
        high: Number(t.highPrice),
        low: Number(t.lowPrice),
      }))
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 120);

    res.status(200).json({ rows });
  } catch (err) {
    console.error("gainers spot error:", err);
    res.status(500).json({ error: "Failed to load gainers" });
  }
}
