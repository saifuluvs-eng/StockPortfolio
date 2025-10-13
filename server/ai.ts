import express from "express";
import fetch from "node-fetch";

export const ai = express.Router();

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

    const baseUrl =
      process.env.PUBLIC_API_BASE?.replace(/\/$/, "") ||
      "https://crypto-backend-wat1.onrender.com";
    const metricsURL = `${baseUrl}/api/metrics?symbol=${encodeURIComponent(
      symbol,
    )}&tf=${encodeURIComponent(tf)}&limit=200`;

    const mRes = await fetch(metricsURL);
    const mOk = mRes.ok ? await mRes.json().catch(() => null) : null;

    const ctx = {
      symbol,
      tf,
      lastPrice: mOk?.data?.last?.price ?? null,
      rsi: mOk?.data?.indicators?.rsi ?? null,
      macd: mOk?.data?.indicators?.macd ?? null,
      ema20: mOk?.data?.indicators?.ema20 ?? null,
      ema50: mOk?.data?.indicators?.ema50 ?? null,
      atr: mOk?.data?.indicators?.atr ?? null,
      swing: mOk?.data?.swing ?? null,
    };

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "AI not configured" });
    }

    const body = {
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a concise trading assistant. Output short, actionable analysis for the given symbol & timeframe. Avoid hype. No financial advice.",
        },
        {
          role: "user",
          content: [
            `Symbol: ${symbol}`,
            `Timeframe: ${tf}`,
            `Context: ${JSON.stringify(ctx)}`,
            "",
            "Write 5–8 short bullets covering: trend, momentum, key supports/resistances (approx), risk note, and a one-line game plan.",
            "Strict format:",
            "- Trend: ...",
            "- Momentum: ...",
            "- Levels: ...",
            "- Volatility/Risk: ...",
            "- Plan: ...",
          ].join("\n"),
        },
      ],
    };

    const oai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!oai.ok) {
      const errText = await oai.text().catch(() => "");
      return res.status(502).json({ error: "OpenAI error", detail: errText.slice(0, 500) });
    }

    const json = await oai.json().catch(() => null);
    const text = json?.choices?.[0]?.message?.content?.trim() || "No summary.";
    cache.set(key, { at: Date.now(), text });

    return res.json({ data: text, cached: false });
  } catch (error) {
    console.error("AI summary error", error);
    return res.status(500).json({ error: "Internal error" });
  }
});

