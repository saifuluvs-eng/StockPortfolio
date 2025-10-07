import type { Express, Request, Response } from "express";
import { fetchKlines } from "../lib/exchange/binance";
import { computeIndicators } from "../lib/indicators/compute";

const mapTF: Record<string, string> = { "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d" };
const cache = new Map<string, { at: number; data: any }>();
const TTL_MS = 90_000;

async function handleMetrics(req: Request, res: Response) {
  try {
    const symbol = ((req.query.symbol as string) || "").toUpperCase();
    const tf = req.query.tf as string;
    if (!symbol || !mapTF[tf]) {
      res.status(400).json({ error: "bad_params" });
      return;
    }

    const key = `${symbol}:${tf}`;
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL_MS) {
      res.setHeader("X-Cache", "HIT");
      res.json(hit.data);
      return;
    }

    const ohlcv = await fetchKlines(symbol, mapTF[tf], 500);
    const indicators = computeIndicators(ohlcv);
    const payload = {
      symbol,
      tf,
      generatedAt: new Date().toISOString(),
      indicators,
    };

    cache.set(key, { at: now, data: payload });
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    res.setHeader("X-Cache", "MISS");
    res.json(payload);
  } catch (e: any) {
    res.status(502).json({ error: "upstream", message: String(e?.message ?? e) });
  }
}

export function registerMetricsRoute(app: Express) {
  app.get("/api/metrics", handleMetrics);
}
