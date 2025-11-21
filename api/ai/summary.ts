import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { symbol, indicators, priceData } = req.body;

    if (!symbol || !indicators) {
      return res.status(400).json({ error: "Missing required fields: symbol, indicators" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    const prompt = `
      As an expert crypto trader and market analyst, analyze the market for ${symbol} based on technical indicators and price data.
      
      Indicators: ${JSON.stringify(indicators, null, 2)}
      Recent Price Data: ${Array.isArray(priceData) ? priceData.slice(-10).join(", ") : "N/A"}
      Current Price: ${Array.isArray(priceData) ? priceData[priceData.length - 1] : "N/A"}
      
      Provide a comprehensive analysis including:
      1. Overall market sentiment (bullish/bearish/neutral)
      2. Confidence level (0.0 to 1.0)
      3. Trading recommendation (BUY/SELL/HOLD)
      4. Key technical factors
      5. Risk assessment
      6. Suggested timeframe
      
      Respond with JSON in this format:
      {
        "sentiment": "bullish|bearish|neutral",
        "confidence": 0.85,
        "recommendation": "BUY|SELL|HOLD",
        "reasoning": "detailed explanation",
        "keyFactors": ["factor1", "factor2"],
        "riskLevel": "low|medium|high",
        "timeframe": "1h|4h|1d|1w",
        "entryPoint": "price or indicator level",
        "exitPoint": "price or indicator level"
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional cryptocurrency market analyst. Always respond with valid JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || "{}";
    const analysis = JSON.parse(content);

    res.setHeader("Cache-Control", "private, max-age=60");
    return res.json({
      symbol,
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("POST /api/ai/summary failed", error?.message || error);
    return res.status(502).json({
      error: "upstream",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
