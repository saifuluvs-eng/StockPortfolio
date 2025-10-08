import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchKlines } from "../server/lib/exchange/binance";
import { computeIndicators } from "../server/lib/indicators/compute";

type MetricsPayload = {
  symbol: string;
  tf: string;
  generatedAt: string;
  summary: string;
  indicators: ReturnType<typeof computeIndicators>;
};

const MAP_TF: Record<string, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

const CACHE_TTL_MS = 90_000;

type CacheEntry = { at: number; payload: MetricsPayload };
const cache = new Map<string, CacheEntry>();

function getParam(queryValue: string | string[] | undefined): string {
  if (Array.isArray(queryValue)) {
    return queryValue[0] ?? "";
  }
  return queryValue ?? "";
}

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

function createSummary(symbol: string, tf: string, indicators: ReturnType<typeof computeIndicators>): string {
  const parts: string[] = [];

  if (typeof indicators?.trendScore === "number") {
    const trendLabel = indicators.trendScore >= 60 ? "bullish" : indicators.trendScore <= 40 ? "bearish" : "neutral";
    parts.push(`Trend looks ${trendLabel}`);
  }

  if (indicators?.rsi != null) {
    const rsi = indicators.rsi;
    if (rsi >= 70) parts.push("RSI near overbought");
    else if (rsi <= 30) parts.push("RSI near oversold");
  }

  if (!parts.length) {
    parts.push("Fresh technical snapshot ready");
  }

  return `${symbol} · ${tf} · ${parts.join(". ")}.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const rawSymbol = normalizeSymbol(getParam(req.query?.symbol as any));
  const rawTf = getParam(req.query?.tf as any);
  const mappedTf = MAP_TF[rawTf];

  if (!rawSymbol || !mappedTf) {
    return res.status(400).json({ error: "bad_params" });
  }

  const cacheKey = `${rawSymbol}:${mappedTf}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);

  if (hit && now - hit.at < CACHE_TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
    return res.status(200).json(hit.payload);
  }

  try {
    const candles = await fetchKlines(rawSymbol, mappedTf, 500);
    const indicators = computeIndicators(candles);
    const payload: MetricsPayload = {
      symbol: rawSymbol,
      tf: rawTf,
      generatedAt: new Date().toISOString(),
      summary: createSummary(rawSymbol, rawTf, indicators),
      indicators,
    };

    cache.set(cacheKey, { at: now, payload });
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(payload);
  } catch (error) {
    console.error("/api/metrics error", error);
    return res.status(502).json({ error: "upstream", message: error instanceof Error ? error.message : String(error) });
  }
}

