import type { VercelRequest, VercelResponse } from "@vercel/node";
import { aiService } from "../services/aiService";

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
const USDT_SUFFIX = /USDT$/i;

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
      .map((row) => row.symbol.replace(USDT_SUFFIX, ""));
    const momentumLeaders = byMomentum.slice(0, 5).map((row) => row.symbol.replace(USDT_SUFFIX, ""));
    const liquidityLeaders = byVolume.slice(0, 5).map((row) => row.symbol.replace(USDT_SUFFIX, ""));
    const overheated = usdt
      .filter((row) => row.priceChangePercent > 15 && row.rangePos > 0.9)
      .slice(0, 5)
      .map((row) => row.symbol.replace(USDT_SUFFIX, ""));

    const heuristicHighlights = [
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

    const averageChange =
      usdt.length === 0
        ? 0
        : usdt.reduce((sum, row) => sum + row.priceChangePercent, 0) / usdt.length;
    const positiveCount = usdt.filter((row) => row.priceChangePercent > 0).length;
    const negativeCount = usdt.filter((row) => row.priceChangePercent < 0).length;
    const totalQuoteVolume = usdt.reduce((sum, row) => sum + row.quoteVolume, 0);

    const marketSummary = {
      generatedAt: new Date().toISOString(),
      totalPairs: usdt.length,
      advancers: positiveCount,
      decliners: negativeCount,
      averageChangePercent: Number.isFinite(averageChange) ? Number(averageChange.toFixed(2)) : 0,
      totalQuoteVolume,
      topGainers: byMomentum.slice(0, 10).map((row) => ({
        symbol: row.symbol.replace(USDT_SUFFIX, ""),
        priceChangePercent: row.priceChangePercent,
        quoteVolume: row.quoteVolume,
      })),
      topLosers: [...usdt]
        .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
        .slice(0, 10)
        .map((row) => ({
          symbol: row.symbol.replace(USDT_SUFFIX, ""),
          priceChangePercent: row.priceChangePercent,
          quoteVolume: row.quoteVolume,
        })),
      highVolumeLeaders: byVolume.slice(0, 10).map((row) => ({
        symbol: row.symbol.replace(USDT_SUFFIX, ""),
        quoteVolume: row.quoteVolume,
        priceChangePercent: row.priceChangePercent,
      })),
      breakoutCandidates: topBreakouts,
      overheatedSymbols: overheated,
    };

    const topSymbolsForAI = byMomentum.slice(0, 10).map((row) => {
      const recommendation = row.priceChangePercent > 5 ? "BUY" : row.priceChangePercent < -5 ? "SELL" : "HOLD";
      return {
        symbol: row.symbol.replace(USDT_SUFFIX, ""),
        technicalAnalysis: {
          recommendation,
          momentumScore: row.priceChangePercent,
          rangePosition: row.rangePos,
          totalScore: Math.max(0, Math.min(100, Math.round(50 + row.priceChangePercent))),
        },
        marketData: {
          lastPrice: row.lastPrice,
          priceChangePercent: row.priceChangePercent,
          highPrice: row.highPrice,
          lowPrice: row.lowPrice,
          quoteVolume: row.quoteVolume,
          rangePosition: row.rangePos,
        },
      };
    });

    let marketOverview: Awaited<ReturnType<typeof aiService.generateMarketOverview>> | null = null;
    let symbolInsights: Awaited<ReturnType<typeof aiService.analyzeMultipleCryptos>> = [];
    const fallbackSummary = {
      overallSentiment:
        averageChange > 2
          ? "bullish - broad upside momentum"
          : averageChange < -2
            ? "bearish - downside pressure dominating"
            : "neutral - mixed 24h performance",
      keyInsights: heuristicHighlights.map((highlight) => `${highlight.title}: ${highlight.detail}`),
      tradingRecommendations:
        averageChange > 2
          ? ["Consider momentum continuation setups", "Use trailing stops to protect gains"]
          : averageChange < -2
            ? ["Prioritize downside protection", "Size positions conservatively"]
            : ["Wait for confirmation before new entries", "Monitor liquidity leaders for breakouts"],
      riskAssessment:
        totalQuoteVolume > 0
          ? `Market breadth: ${positiveCount}/${usdt.length} advancers. Quote volume ${(totalQuoteVolume / 1e9).toFixed(2)}B indicates ${
              totalQuoteVolume > 5e9 ? "healthy" : "muted"
            } participation.`
          : "Limited data available for risk assessment.",
    };

    const canUseAI = Boolean(process.env.OPENAI_API_KEY);
    if (canUseAI) {
      try {
        marketOverview = await aiService.generateMarketOverview(marketSummary);
        symbolInsights = await aiService.analyzeMultipleCryptos(topSymbolsForAI);
      } catch (error) {
        console.error("AI market overview generation failed", error);
        marketOverview = fallbackSummary;
        symbolInsights = [];
      }
    } else {
      marketOverview = fallbackSummary;
      symbolInsights = [];
    }

    res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
    return res.status(200).json({
      lastUpdated: new Date().toISOString(),
      marketOverview,
      symbolInsights,
      heuristicHighlights,
      table,
    });
  } catch (error: any) {
    console.error("/api/ai/insights error", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "internal_error",
      lastUpdated: new Date().toISOString(),
      marketOverview: null,
      symbolInsights: [],
      heuristicHighlights: [],
      table: [],
    });
  }
}
