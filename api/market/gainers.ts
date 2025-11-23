import type { VercelRequest, VercelResponse } from "@vercel/node";

type TickerData = {
  symbol: string;
  lastPrice?: string;
  price?: string;
  priceChangePercent?: string;
  changePct?: string;
  quoteVolume?: string;
  volume?: string;
  highPrice?: string;
  high?: string;
  lowPrice?: string;
  low?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Fetch all tickers from Binance
    const response = await fetch("https://api.binance.com/api/v3/ticker/24hr", { 
      cache: "no-store" 
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        ok: false, 
        error: `Binance API error: ${response.status}` 
      });
    }

    const allTickers: TickerData[] = await response.json();

    // Convert string values to numbers
    const toNumber = (value: unknown) => {
      if (typeof value === "number") return value;
      if (typeof value === "string" && value.trim().length) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    // Filter for USDT pairs, exclude leveraged tokens, sort by change %
    const gainers = allTickers
      .filter((ticker) => {
        const symbol = ticker.symbol || "";
        return (
          symbol.endsWith("USDT") &&
          !symbol.includes("DOWN") &&
          !symbol.includes("UP") &&
          !symbol.includes("BULL") &&
          !symbol.includes("BEAR")
        );
      })
      .sort(
        (a, b) =>
          toNumber(b.priceChangePercent ?? b.changePct) -
          toNumber(a.priceChangePercent ?? a.changePct)
      )
      .slice(0, 50)
      .map((item) => ({
        symbol: item.symbol,
        price: toNumber(item.lastPrice ?? item.price),
        changePct: toNumber(item.priceChangePercent ?? item.changePct),
        volume: toNumber(item.quoteVolume ?? item.volume),
        high: toNumber(item.highPrice ?? item.high),
        low: toNumber(item.lowPrice ?? item.low),
      }));

    res.status(200).json({ 
      ok: true,
      rows: gainers, 
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    console.error("[api/market/gainers] Error:", error);
    res.status(500).json({ 
      ok: false, 
      error: error?.message || "Failed to fetch gainers" 
    });
  }
}
