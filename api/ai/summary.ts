import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { symbol, tf = "4h", technicals = null } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Missing required field: symbol" });
    }

    // Log the technical data for debugging
    console.log("DEBUG: Raw technicals received:", technicals);
    console.log("DEBUG: technicals type:", typeof technicals);
    console.log("DEBUG: technicals is array?", Array.isArray(technicals));
    
    const technicalsJson = technicals || {};
    console.log("TECHNICAL JSON SENT TO GEMINI:", JSON.stringify(technicalsJson, null, 2));

    // Check if technical data is missing or empty
    const isMissingData = !technicals || 
      (typeof technicals === "object" && Object.keys(technicals).length === 0) ||
      (Array.isArray(technicals) && technicals.length === 0);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // If no data, return error message
    if (isMissingData) {
      return res.json({
        data: `Error: No technical data received.`,
      });
    }

    const technicalDataStr = JSON.stringify(technicalsJson, null, 2);

    const prompt = `You are a technical crypto analyst. You will receive structured indicator data in JSON format. Your job is to generate a concise AI Summary without inventing trends, news, patterns, or events. Use ONLY the information inside the JSON.

=====================
STRICT INSTRUCTIONS
=====================

1. DO NOT mention any indicator values or numbers.
2. DO NOT add news, fundamentals, macro events, or made-up narrative.
3. DO NOT assume chart patterns unless clearly implied by the indicators.
4. DO NOT repeat the JSON data — interpret it.
5. Keep the tone short, direct, and analytical.
6. Focus ONLY on: 
   - Trend direction
   - Momentum
   - Strength/weakness
   - Volume conditions
   - Volatility
   - Support & resistance (from JSON)
7. Output must ALWAYS follow this exact structure:

### AI Summary — ${symbol} ${tf}

**Overall Bias:**  
One-word bias only (Bullish / Bearish / Neutral).

**Why:**  
- 3 to 5 short bullet points summarizing the combined meaning of the indicators  
- No storytelling  
- No repeating values  
- No fake breakouts or predictions  

**What to Expect Next:**  
1–2 short lines describing the most likely next scenario based ONLY on momentum + trend + volatility in indicators.  
No certainty, only likelihood.

**Levels to Watch:**  
List support and resistance from JSON.  
Do NOT create new levels.

**Risk:**  
One short line on risk (trend weakness, volatility, strong momentum, etc.)

=====================
TECHNICAL INDICATORS DATA
=====================

${technicalDataStr}`;

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
        data: text,
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
