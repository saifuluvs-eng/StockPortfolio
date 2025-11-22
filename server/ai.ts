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

    const { symbol, tf } = (req.body || {}) as { symbol?: string; tf?: string };
    if (!symbol || !tf) {
      return res.status(400).json({ error: "symbol and tf required" });
    }

    const key = `${symbol}:${tf}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) {
      return res.json({ data: cached.text, cached: true });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI not configured" });
    }

    try {
      // Use the new Gemini-based AIService
      const insight = await aiService.generateCryptoInsight(symbol, {}, { timeframe: tf });
      const text = insight.reasoning || "No summary available.";
      cache.set(key, { at: Date.now(), text });
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

