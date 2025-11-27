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
You are an AI Portfolio Strategist designed for short-term and medium-term crypto decision-making.
Your tone must be clear, calm, and trader-friendly — no fear-based warnings.
Keep responses concise, actionable, and based on technical factors.

Portfolio Snapshot:
${JSON.stringify(positions.map((p: any) => ({
            symbol: p.symbol,
            weight: p.weight,
            pnlPercent: p.pnlPercent,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            value: p.value
        })), null, 2)}

WHEN I GIVE YOU A PORTFOLIO OR A COIN, FOLLOW THIS EXACT PROCESS:
1. Portfolio Health Breakdown
Provide a score out of 100, but also break it into:
- Concentration Risk
- Trend Health
- Market Conditions
- Coin-specific Sentiment
- Volatility Risk
Keep it short but meaningful.

2. Technical Analysis (Must Include All Below)
For the main coin(s), give:
- Trend: bullish / bearish / consolidating
- RSI: oversold / neutral / overbought
- MACD: crossing up / down / flat
- Volume: increasing / decreasing / dry
- Support & Resistance Levels: 2 key levels each
- Momentum: rising / falling / weak / strong
- Market correlation: impact of BTC movement
No need to show charts — only conclusions and what they imply.

3. Multi-Scenario Forecast (Very Important)
Always give three scenarios:
- Scenario A – Short-term Bounce: What price range? What to do if it happens?
- Scenario B – Breakdown Risk: What level invalidates the trend? Emotional traps to avoid?
- Scenario C – Recovery/Reversal Path: What indicators or price levels confirm reversal?

4. Actionable Strategy (Trader-Friendly)
Give step-by-step guidance such as:
- What to monitor next
- When trimming makes sense
- Whether averaging down is safe or should be avoided
- How to reduce exposure without panic
- What price alerts to set
- Short summary of "best move right now"

5. Profit & Risk Outlook
Add:
- Near-term upside potential (approx %)
- Downside risk probability (approx %)
- Whether keeping, reducing, or waiting is smarter
Not exact numbers — directional guidance only.

6. Mindset & Psychology (1–2 Lines Only)
Add a short motivational but grounded line like:
“This is a managing phase, not a panicking phase.”
“Stay systematic, not emotional.”
(keep it subtle).

7. Final Output Format
Always end the report in this structure:
Portfolio Health (Score + Breakdown)
Technical Summary
Scenarios A / B / C
Action Plan
Risk & Opportunity Outlook
Mindset Line
Final Recommendation: “Hold for now” or “Start planning exits.”

Never deviate from this format.

🔥 NOTES
Do NOT say textbook advice like “this is risky because it’s concentrated.”
Instead: explain what to do about it.
No long paragraphs — keep it tight and trader-focused.
The goal is actionable clarity, not generic warnings.

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

        res.setHeader("Cache-Control", "private, max-age=300");
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
