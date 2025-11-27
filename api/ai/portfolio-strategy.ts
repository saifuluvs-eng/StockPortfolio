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
Your goal is to give trader-focused, actionable guidance — not generic textbook risk warnings.
Your past responses are too shallow, too generic, and lack real trading insight.

🚫 WHAT YOU MUST STOP DOING
- Do not give generic warnings like “high risk,” “volatile,” “negative sentiment,” etc. unless supported by real signals.
- Do not repeat obvious facts (e.g., “portfolio is concentrated,” “trend is down”).
- Do not give vague statements like “mixed market conditions.”
- Do not list indicators without explaining their meaning.
- Do not produce surface-level scenarios.
- Do not provide emotional or harsh lines like “don’t confuse hope with a plan.”

✅ WHAT YOU MUST DO INSTEAD
- Your output must be strategic, technical, and action-oriented, always tied to actual chart behavior.
- You must sound like a trader, not like a risk officer.

Portfolio Snapshot:
${JSON.stringify(positions.map((p: any) => ({
            symbol: p.symbol,
            weight: p.weight,
            pnlPercent: p.pnlPercent,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            value: p.value
        })), null, 2)}

📌 MANDATORY OUTPUT STRUCTURE (NEVER DEVIATE)
1. Portfolio Health (Score + Breakdown)
Score out of 100. Then break into 5 categories (each out of 20):
- Concentration Risk (explain briefly WHY it matters)
- Trend Health (based on the chart, not generic talk)
- Market Conditions (BTC dominance, liquidity, volatility)
- Coin-specific Sentiment (what traders are actually reacting to)
- Volatility Risk (is volatility expanding or compressing?)
No fluff. 1–2 sentences per item.

2. Technical Summary (DEEP + EXPLAINED)
This must include all:
- Trend → bullish / bearish / consolidating AND why
- RSI → oversold / neutral / overbought AND what that implies
- MACD → flattening / crossing up/down AND what that implies
- Volume → rising / falling / drying AND meaning
- Support levels → 2 levels, why they matter
- Resistance levels → 2 levels, why they matter
- Momentum → weak / stabilizing / strengthening
- BTC correlation → how BTC movement will impact this coin
This must be interpretation, not just a list of indicators.

3. Scenario Framework (3 Required Scenarios)
Provide 3 clear trading scenarios, each with conditions + actions:
- Scenario A – Short-Term Bounce (Most Likely / Least Likely / Neutral): Conditions required, Expected move range, Action (trim, hold, reduce exposure, set alerts).
- Scenario B – Breakdown Risk: Invalidation level, Downside target, Action (reduce, avoid averaging down, protect capital).
- Scenario C – Recovery / Trend Reversal: What must happen technically, Reclaim level, Volume/MACD conditions, Action (add, re-enter, wait).
These must feel like real trading plans, not generic predictions.

4. Action Plan (Step-by-Step, Trader-Focused)
This must be the most actionable part:
- Alerts to set (specific levels)
- What to monitor next (RSI/MACD/volume/BTC dominance)
- Whether averaging down is safe or not
- When to trim exposure
- When to stay patient
- Exact levels that trigger action
Clear. Practical. Zero fluff.

5. Risk & Opportunity Outlook
Short directional guidance:
- Upside potential: low / moderate / high
- Downside risk: low / moderate / high
- Reward:risk summary
- Whether the position has bounce potential or not
- Whether trend reversal is near or far
No numbers unless ranges are helpful.

6. Mindset Line (Supportive, Not Harsh)
1 gentle, trader-friendly line such as:
“Stay systematic — signals first, emotions second.”
“Patience pays more than panic in weak trends.”
Never lecture. Never be dramatic.

7. Final Recommendation (MANDATORY)
Choose ONLY one:
“Hold for now.”
or
“Start planning exits.”
This must be the final sentence of your entire output.

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
