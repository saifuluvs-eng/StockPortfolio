import type { VercelRequest, VercelResponse } from "@vercel/node";

type Binance24hr = {
  symbol: string;
  lastPrice?: string;
  priceChange?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
  quoteVolume?: string;
};

const BINANCE_24H = "https://api.binance.com/api/v3/ticker/24hr";

const safeNum = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(BINANCE_24H, { cache: "no-store" });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ ok: false, error: `binance_${response.status}`, detail: await response.text() });
    }

    const tickers = (await response.json()) as Binance24hr[];
    const usdt = tickers
      .filter((row) => typeof row.symbol === "string" && row.symbol.endsWith("USDT"))
      .map((row) => {
        const last = safeNum(row.lastPrice, 0);
        const high = safeNum(row.highPrice, 0);
        const low = safeNum(row.lowPrice, 0);
        const changePct = safeNum(row.priceChangePercent, 0);
        const range = Math.max(1e-8, high - low);
        const rangePos = range <= 0 ? 0 : Math.max(0, Math.min(1, (last - low) / range));
        return {
          symbol: row.symbol!,
          lastPrice: last,
          priceChange: safeNum(row.priceChange, 0),
          priceChangePercent: changePct,
          highPrice: high,
          lowPrice: low,
          volume: safeNum(row.volume, 0),
          quoteVolume: safeNum(row.quoteVolume, 0),
          rangePos,
        };
      });

    const byMomentum = [...usdt].sort((a, b) => b.priceChangePercent - a.priceChangePercent);
    const byRange = [...usdt].sort((a, b) => b.rangePos - a.rangePos);
    const byVolume = [...usdt].sort((a, b) => b.quoteVolume - a.quoteVolume);

    const topBreakouts = byRange
      .filter((row) => row.priceChangePercent > 3 && row.rangePos > 0.7)
      .slice(0, 5)
      .map((row) => row.symbol.replace(/USDT$/i, ""));
    const momentumLeaders = byMomentum.slice(0, 5).map((row) => row.symbol.replace(/USDT$/i, ""));
    const liquidityLeaders = byVolume.slice(0, 5).map((row) => row.symbol.replace(/USDT$/i, ""));
    const overheated = usdt
      .filter((row) => row.priceChangePercent > 15 && row.rangePos > 0.9)
      .slice(0, 5)
      .map((row) => row.symbol.replace(/USDT$/i, ""));

    const insights = [
      {
        title: "Breakout candidates near 24h highs",
        detail: topBreakouts.length ? topBreakouts.join(", ") : "No clear breakout clusters right now.",
        tags: ["breakout", "price-action"],
      },
      {
        title: "Top momentum leaders (24h %)",
        detail: momentumLeaders.length ? momentumLeaders.join(", ") : "Momentum is muted across majors.",
        tags: ["momentum"],
      },
      {
        title: "Highest liquidity (quote volume)",
        detail: liquidityLeaders.length ? liquidityLeaders.join(", ") : "Liquidity remains thin—monitor closely.",
        tags: ["liquidity"],
      },
      {
        title: "Potentially overheated (extended move)",
        detail: overheated.length ? overheated.join(", ") : "No major overextensions at the moment.",
        tags: ["risk", "overextension"],
      },
    ];

    const table = byMomentum.slice(0, 50).map((row) => ({
      symbol: row.symbol,
      lastPrice: row.lastPrice,
      priceChangePercent: row.priceChangePercent,
      highPrice: row.highPrice,
      lowPrice: row.lowPrice,
      quoteVolume: row.quoteVolume,
    }));

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ insights, table });
  } catch (error: any) {
    console.error("/api/ai/insights error", error);
    return res.status(500).json({ ok: false, error: error?.message || "internal_error", insights: [], table: [] });
  }
}
