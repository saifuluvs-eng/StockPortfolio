import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { symbol, timeframe = "4h" } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Missing required field: symbol" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    const prompt = `You are a professional cryptocurrency market analyst. Analyze ${symbol} on the ${timeframe} timeframe and provide a brief trading analysis.

Format your response EXACTLY as:
**Overall Bias:** [Bullish/Bearish/Neutral]

**Why:** [2-3 sentences explaining the main reason]

**What to Expect:** [2-3 sentences about likely price action]

**Levels to Watch:** [2-3 key price levels]

**Risk Assessment:** [Low/Medium/High risk and why]

Be concise and focus on actionable insights for traders.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      clearTimeout(timeoutId);

      const response = result.response;
      const text = response.text();

      res.setHeader("Cache-Control", "private, max-age=60");
      return res.json({
        symbol,
        timeframe,
        analysis: text,
        generatedAt: new Date().toISOString(),
      });
    } catch (timeoutErr) {
      clearTimeout(timeoutId);
      if ((timeoutErr as any)?.name === "AbortError") {
        return res.status(504).json({
          error: "AI service timeout",
          message: "Gemini API took too long to respond. Try again.",
        });
      }
      throw timeoutErr;
    }
  } catch (error: any) {
    console.error("POST /api/ai/summary failed", error?.message || error);
    return res.status(502).json({
      error: "upstream",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
