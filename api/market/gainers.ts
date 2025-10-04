import type { VercelRequest, VercelResponse } from "vercel";

const BINANCE = "https://api.binance.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const exInfo = await fetch(`${BINANCE}/api/v3/exchangeInfo?permissions=SPOT`).then((r) => r.json());

    const spotUSDT = new Set<string>();
    for (const s of exInfo.symbols ?? []) {
      if (s.status === "TRADING" && s.isSpotTradingAllowed && s.quoteAsset === "USDT") {
        spotUSDT.add(s.symbol);
      }
    }

    const stats: any[] = await fetch(`${BINANCE}/api/v3/ticker/24hr`).then((r) => r.json());

    const rows = stats
      .filter((t) => spotUSDT.has(t.symbol))
      .map((t) => ({
        symbol: t.symbol,
        price: Number(t.lastPrice),
        changePct: Number(t.priceChangePercent),
        volume: Number(t.quoteVolume),
        high: Number(t.highPrice),
        low: Number(t.lowPrice),
      }))
      .sort((a, b) => b.changePct - a.changePct);

    res.status(200).json({ rows });
  } catch (err: any) {
    console.error("gainers spot error:", err);
    res.status(500).json({ error: "Failed to load gainers" });
  }
}
