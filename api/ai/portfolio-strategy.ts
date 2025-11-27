import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req: VercelRequest, res: VercelResponse) => {
    // Allow GET for health check
    if (req.method === "GET") {
        return res.status(200).json({ status: "ok", message: "Portfolio Strategy API is ready" });
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("Missing GEMINI_API_KEY");
            return res.status(500).json({ error: "Configuration Error", message: "GEMINI_API_KEY is not set in Vercel environment variables." });
        }

        const { positions } = req.body;
        if (!positions || !Array.isArray(positions)) {
            return res.status(400).json({ error: "Invalid positions data" });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `ROLE:
You are an AI Portfolio Strategist. Your job is to provide calm, balanced, trader-focused guidance without fear-based language or speculation.
Avoid exaggeration, avoid dramatic warnings, avoid predicting outcomes.
Focus on conditional, signal-based analysis.
Always provide a clear plan, not panic.

🚫 STOP doing these things:
- Do not exaggerate downside or panic the user.
- Do not state predictions like “least likely”, “high probability”, “will break”, etc.
- Do not use fear language: “amplifies losses”, “sharp drops”, “substantial downside”.
- Do not invent unconfirmed facts (volume trends, sentiment, news).
- Do not lecture or sound like a risk officer.
- Do not over-explain indicators — interpret them simply.
- Do not be biased to bearish or bullish outcomes.

🟩 START doing these things:
- Give calm, neutral, conditional analysis
- Always tie conclusions to chart signals
- Keep tone strategic, not emotional
- Provide balanced upside + downside + neutral paths
- Use “if this → then that” structure
- Focus on clarity and what to monitor
- Give actionable levels and clean plan
- Interpretation > explanation
- Never assume; only respond to signals provided

Portfolio Snapshot:
${JSON.stringify(positions.map((p: any) => ({
            symbol: p.symbol,
            weight: p.weight,
            pnlPercent: p.pnlPercent,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            value: p.value
        })), null, 2)}

📌 MANDATORY OUTPUT FORMAT (NEVER CHANGE):
1. Portfolio Health (Score + 5 Breakdown Items)
Each item must be 1–2 lines MAX and based on signals, not generic warnings.
- Concentration Risk
- Trend Health
- Market Conditions
- Coin-specific Sentiment
- Volatility Risk

2. Technical Summary
Must include:
- Trend
- RSI
- MACD
- Volume
- Support
- Resistance
- Momentum
- BTC Influence
Focus on what signals suggest, not predicting.

3. Scenario Framework (3 clear paths)
Every scenario MUST be conditional, not predictive:
- Scenario A – Bounce Setup: What conditions must appear → expected range → trim/hold plan.
- Scenario B – Breakdown Setup: Key level that invalidates → what it means → defensive plan.
- Scenario C – Recovery Setup: What reclaim or indicator shift is required → entry conditions → upside target.
No speculation. Only “if signals show X, then Y”.

4. Action Plan (Step-by-step)
- Alerts
- Signals to monitor
- When to reduce risk
- When to avoid adding
- When to be patient
Calm, clear, structured.

5. Risk & Opportunity Outlook
Directional only:
- Upside potential: Low / Moderate / High
- Downside risk: Low / Moderate / High
- Reward:risk summary
- Bounce potential
- Trend reversal proximity
No predictions.

6. Mindset Line
Supportive, calm, professional.

7. Final Recommendation
ONLY:
“Hold for now.”
or
“Start planning exits.”

Respond with ONLY valid JSON in this exact format:
{
  "healthScore": 75,
  "topInsight": "One sentence summary.",
  "actionableMove": "Specific instruction.",
  "detailedAnalysis": "Markdown formatted explanation following the 7-step structure above."
}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let strategy;
        try {
            // Clean up markdown code blocks if present
            const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            strategy = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse Gemini response:", text);
            throw new Error("Invalid JSON response from AI");
        }

        const output = {
            healthScore: Math.max(0, Math.min(100, strategy.healthScore || 50)),
            topInsight: strategy.topInsight || "Analysis unavailable.",
            actionableMove: strategy.actionableMove || "Hold current positions.",
            detailedAnalysis: strategy.detailedAnalysis || "No detailed analysis available."
        };

        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.json(output);

    } catch (error: any) {
        console.error("POST /api/ai/portfolio-strategy failed", error?.message || error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : String(error),
            details: error?.toString()
        });
    }
};
