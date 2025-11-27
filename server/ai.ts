import express from "express";
import { AIService } from "./services/aiService";

export const ai = express.Router();

const aiService = new AIService();
const cache = new Map<string, { at: number; text: string }>();
const TTL_MS = 5 * 60 * 1000;

const hits = new Map<string, number>();
function allow(key: string) {
  const now = Date.now();
  const bucket = Math.floor(now / TTL_MS);
  const k = `${key}:${bucket}`;
  const n = (hits.get(k) || 0) + 1;
  hits.set(k, n);
  return n <= 20;
}

import { runSummaryWithIndicators } from "./gemini_tech_summary.js";

ai.post("/summary", express.json({ limit: "1mb" }), async (req, res) => {
  try {
    const userId =
      (req as any)?.user?.id ||
      req.headers["x-demo-user-id"] ||
      req.headers["x-demo-user"] ||
      req.ip;
    if (!allow(String(userId))) {
      return res.status(429).json({ error: "Rate limit" });
    }

    const { symbol, tf, technicals, candles } = req.body || {};

    if (!symbol || !tf) {
      return res.status(400).json({ error: "symbol and tf required" });
    }

    console.log(`[AI] /summary request for ${symbol} ${tf}. Candles present: ${candles ? candles.length : "No"}`);

    const key = `${symbol}:${tf}:${technicals ? "custom" : "auto"}`;
    // Skip cache if custom technicals provided, as they might change
    if (!technicals) {
      const cached = cache.get(key);
      if (cached && Date.now() - cached.at < TTL_MS) {
        return res.json({ data: cached.text, cached: true });
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI not configured" });
    }

    try {
      // Use the shared Gemini summary logic
      const result = await runSummaryWithIndicators({
        symbol,
        timeframe: tf,
        indicatorsOverride: technicals,
        candles
      });

      const text = result.geminiText || "No summary available.";
      if (!technicals) {
        cache.set(key, { at: Date.now(), text });
      }
      return res.json({ data: text });
    } catch (error) {
      console.error("Error generating AI insight:", error);
      return res.status(500).json({ error: "AI analysis unavailable" });
    }
  } catch (error) {
    console.error("AI summary error", error);
    return res.status(500).json({ error: "Internal error" });
  }
});

ai.post("/portfolio-strategy", express.json(), async (req, res) => {
  try {
    const { positions } = req.body;
    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({ error: "Invalid positions data" });
    }

    // Simple cache key based on positions length and total value (approximate)
    // In a real app, you'd hash the positions object
    const totalValue = positions.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
    const key = `strategy:${positions.length}:${Math.round(totalValue)}`;

    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) {
      return res.json(JSON.parse(cached.text));
    }

    const strategy = await aiService.generatePortfolioStrategy(positions);

    cache.set(key, { at: Date.now(), text: JSON.stringify(strategy) });
    return res.json(strategy);
  } catch (error) {
    console.error("Portfolio strategy error:", error);
    return res.status(500).json({ error: "Failed to generate strategy" });
  }
});

