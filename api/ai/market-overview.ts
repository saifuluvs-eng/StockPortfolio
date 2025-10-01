import type { VercelRequest, VercelResponse } from "@vercel/node";

type BinanceTicker = {
  symbol: string;
  lastPrice?: string;
  weightedAvgPrice?: string;
  priceChangePercent?: string;
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

const sentimentFromAverage = (avg: number): "Bullish" | "Neutral" | "Bearish" => {
  if (avg >= 2) return "Bullish";
  if (avg <= -2) return "Bearish";
  return "Neutral";
};

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(BINANCE_24H, { cache: "no-store" });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ ok: false, error: `binance_${response.status}`, detail: await response.text() });
    }

    const tickers = (await response.json()) as BinanceTicker[];
    const usdtTickers = tickers.filter((row) => typeof row.symbol === "string" && row.symbol.endsWith("USDT"));

    const ranked = usdtTickers
      .map((row) => ({
        symbol: row.symbol!,
        lastPrice: safeNum(row.lastPrice ?? row.weightedAvgPrice, 0),
        priceChangePercent: safeNum(row.priceChangePercent, 0),
        quoteVolume: safeNum(row.quoteVolume, 0),
      }))
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent);

    const top = ranked.slice(0, 8);
    const avgChange = top.reduce((sum, item) => sum + item.priceChangePercent, 0) / Math.max(top.length, 1);
    const positiveLeaders = top.filter((item) => item.priceChangePercent >= 0);
    const highLiquidity = top.filter((item) => item.quoteVolume >= 25_000_000);

    const overallSentiment = sentimentFromAverage(avgChange);

    const keyInsights: string[] = [];
    keyInsights.push(`Average 24h change among leaders: ${avgChange.toFixed(2)}%.`);
    if (top[0]) {
      keyInsights.push(`${top[0].symbol} tops the board at ${top[0].priceChangePercent.toFixed(2)}% in 24h gains.`);
    }
    keyInsights.push(
      `${highLiquidity.length} of the top movers trade above $25M quote volume, signalling ${
        highLiquidity.length >= 3 ? "healthy" : "fragile"
      } liquidity.`
    );

    const tradingRecommendations: string[] = [];
    if (overallSentiment === "Bullish") {
      tradingRecommendations.push("Momentum favors long setups—buy pullbacks in high-volume leaders.");
    } else if (overallSentiment === "Bearish") {
      tradingRecommendations.push("Momentum is fading—consider hedging or focusing on defensive trades.");
    } else {
      tradingRecommendations.push("Momentum is mixed—prioritize range or mean-reversion setups.");
    }
    tradingRecommendations.push(
      highLiquidity.length >= 3
        ? "Liquidity looks supportive—scaling into positions with confirmation is safer."
        : "Liquidity is thin—use smaller size and limit orders to manage risk."
    );

    const signals = top.slice(0, 5).map((item) => ({
      symbol: item.symbol,
      changePercent: item.priceChangePercent,
      quoteVolume: item.quoteVolume,
      note:
        item.priceChangePercent >= 15
          ? "Strong breakout momentum"
          : item.priceChangePercent >= 8
            ? "Sustained upside trend"
            : "Early strength forming",
    }));

    const payload = {
      overallSentiment,
      keyInsights,
      tradingRecommendations,
      riskAssessment:
        overallSentiment === "Bullish"
          ? "Momentum-driven market—monitor for overextension."
          : overallSentiment === "Bearish"
            ? "Defensive stance recommended—volatility likely."
            : "Balanced conditions—stay nimble as direction resolves.",
      averageGain: avgChange,
      positiveLeaders: positiveLeaders.length,
      highVolumeCount: highLiquidity.length,
      topGainers: top,
      signals,
      timestamp: new Date().toISOString(),
    };

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(payload);
  } catch (error: any) {
    console.error("/api/ai/market-overview error", error);
    return res.status(500).json({ ok: false, error: error?.message || "internal_error" });
  }
}
