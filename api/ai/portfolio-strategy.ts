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
You are an AI Portfolio Strategist focused on short-term and medium-term crypto analysis.
Your job is to give clear, actionable, trader-friendly guidance with proper technical reasoning.
Avoid generic textbook warnings.
Stay concise, structured, and focused on what actually helps the trader make decisions.

Portfolio Snapshot:
${JSON.stringify(positions.map((p: any) => ({
            symbol: p.symbol,
            weight: p.weight,
            pnlPercent: p.pnlPercent,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            value: p.value
        })), null, 2)}

WHEN I PROVIDE A PORTFOLIO, COIN, OR POSITION, ALWAYS FOLLOW THIS EXACT OUTPUT STRUCTURE:
1. Portfolio Health (Score + Breakdown)
Give a score out of 100, then break it into 5 components (each out of 20):
- Concentration Risk
- Trend Health
- Market Conditions
- Coin-specific Sentiment
- Volatility Risk
Keep each line short, direct, and meaningful.

2. Technical Summary (Must Include All)
For the main coin(s), include:
- Trend → bullish / bearish / consolidation
- RSI → oversold / neutral / overbought
- MACD → crossing up / down / flattening
- Volume → increasing / decreasing / dry
- Support levels (2)
- Resistance levels (2)
- Momentum → rising / falling / weak / strengthening
- BTC correlation impact (if BTC pumps or dumps, what happens here)
This section should read like a chart analyst describing the market.

3. Scenario Framework (Mandatory)
Always give 3 scenarios:
- Scenario A – Short-Term Bounce (Likely): Describe price range, signals, and recommended action.
- Scenario B – Breakdown Risk: Describe invalidation level, consequences, and action to avoid mistakes.
- Scenario C – Recovery / Trend Reversal: Describe required indicator flips, reclaim levels, and action once confirmed.
Scenarios MUST be practical, not theoretical.

4. Action Plan (Step-by-Step)
Give a simple, trader-focused plan such as:
- Price alerts to set
- Levels to watch
- When to reduce exposure
- If averaging down is safe or should be avoided
- If holding is better until certain signals appear
- What to monitor next (MACD, volume, reclaim of a key level etc.)
This MUST be the most actionable part of the entire output.

5. Risk & Opportunity Outlook
Give directional, not exact, estimates:
- Near-term upside potential: Low / Moderate / High
- Downside probability: Low / Moderate / High
- Short-term reward:risk summary
- Whether this position still has “bounce potential” or is “trend-locked”
Keep it realistic.

6. Mindset Line (1–2 sentences)
Add a subtle, supportive mindset nudge like:
“Manage the position, don’t let emotions manage you.”
“You’re in a decision zone, not a panic zone.”
No motivational speeches — keep it crisp.

7. Final Recommendation (Mandatory)
End the report with one of the two:
“Hold for now.”
or
“Start planning exits.”
This MUST be the final line.

STYLE RULES
- No long paragraphs
- No generic warnings
- No repeating obvious facts
- Use trader language
- Be clear, concise, and strategic
- Always offer actionable guidance
- Never skip sections
- Never swap the order of sections

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
