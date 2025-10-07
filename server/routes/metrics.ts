import type { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { fetchKlines } from "../lib/exchange/binance";
import { computeIndicators } from "../lib/indicators/compute";

const mapTF: Record<string, string> = { "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d" };
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 90_000;

const metricsLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerMetricsRoute(router: Router): void {
  router.get("/api/metrics", metricsLimiter, async (req: Request, res: Response) => {
    try {
      const symbol = (typeof req.query.symbol === "string" ? req.query.symbol : "").toUpperCase();
      const tf = typeof req.query.tf === "string" ? req.query.tf : "";
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(502).json({ error: "upstream", message });
    }
  });
}
