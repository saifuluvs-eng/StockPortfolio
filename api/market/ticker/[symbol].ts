import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
    if (!r.ok) return res.status(r.status).json({ error: `binance ${r.status}` });

    const data = await r.json();
    
    // Transform Binance response to expected format: extract lastPrice as price
    res.status(200).json({
      symbol,
      price: data.lastPrice,
      priceChangePercent: data.priceChangePercent,
      lastPrice: data.lastPrice,
      highPrice: data.highPrice,
      lowPrice: data.lowPrice,
      volume: data.volume,
      quoteVolume: data.quoteVolume,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "internal_error" });
  }
}
