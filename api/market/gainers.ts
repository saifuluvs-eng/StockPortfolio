import type { VercelRequest, VercelResponse } from "@vercel/node";

const BINANCE_24H = "https://api.binance.com/api/v3/ticker/24hr";

const clampLimit = (raw: unknown, fallback: number, max = 100): number => {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.min(Math.floor(value), max));
};

const toString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  return "0";
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const limit = clampLimit(req.query?.limit, 20);
    const response = await fetch(BINANCE_24H, { cache: "no-store" });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ ok: false, error: `binance_${response.status}`, detail: await response.text() });
    }

    const list: any[] = await response.json();
    const sorted = list
      .filter((row: any) => typeof row?.symbol === "string" && row.symbol.endsWith("USDT"))
      .map((row: any) => ({
        symbol: String(row.symbol),
        price: toString(row.lastPrice ?? row.weightedAvgPrice ?? "0"),
        priceChange: toString(row.priceChange ?? "0"),
        priceChangePercent: toString(row.priceChangePercent ?? "0"),
        change24h: toString(row.priceChangePercent ?? "0"),
        highPrice: toString(row.highPrice ?? "0"),
        lowPrice: toString(row.lowPrice ?? "0"),
        volume: toString(row.volume ?? "0"),
        quoteVolume: toString(row.quoteVolume ?? "0"),
      }))
      .sort((a, b) => Number(b.priceChangePercent) - Number(a.priceChangePercent));

    const trimmed = sorted.slice(0, limit);

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json(trimmed);
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || "internal_error" });
  }
}
