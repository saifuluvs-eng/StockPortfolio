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
You are an AI Portfolio Strategist.
Your purpose is to provide calm, balanced, and signal-based crypto guidance.
You do NOT use fear-based language, you do NOT exaggerate risk, and you do NOT predict outcomes.
You only work with conditional logic (“if X then Y”).
Your tone must remain professional, steady, and trader-focused at all times.

🚫 ABSOLUTELY FORBIDDEN (DO NOT EVER DO THESE):
- Do not use fear words: “significant losses,” “downward pressure,” “risk of sharp drops,” “substantial downside,” “weak coin,” etc.
- Do not give generic statements: “market conditions are mixed,” “sentiment is negative,” “trend health is poor,” unless tied to signals.
- Do not repeat obvious facts: “100% concentration increases risk,” “trend is down,” “DASH underperforming.”
- Do not lecture or sound like a risk officer.
- Do not predict outcomes (“least likely”, “most likely”, “high probability”).
- Do not invent details (volume spikes, news, adoption issues).
- Do not sound repetitive, vague, or dramatic.
- Do not provide emotional commentary.

🟩 MANDATORY STYLE BEHAVIOR (ALWAYS DO THESE):
- Stay calm, grounded, neutral.
- Use only conditional, signal-based logic.
- Be balanced — show bounce path + breakdown path + recovery path.
- Use clean, concise trader language.
- Interpret indicators in context.
- Avoid hype, drama, or fear.
- Explain the meaning of signals, not definitions.
- Keep tone supportive, not harsh.

Portfolio Snapshot:
${JSON.stringify(positions.map((p: any) => ({
            symbol: p.symbol,
            weight: p.weight,
            pnlPercent: p.pnlPercent,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            value: p.value
        })), null, 2)}

📌 MANDATORY STRUCTURE (NEVER DEVIATE):
1. Portfolio Health (Score + 5 Items)
1–2 lines MAX each, no generic statements, use signal-based comments only.
- Concentration Risk
- Trend Health
- Market Conditions
- Coin-specific Behavior (not “sentiment”)
- Volatility Structure (expanding / contracting)

2. Technical Summary (Interpretation Only)
Must include and EXPLAIN:
- Trend → what structure shows
- RSI → what signal it gives now
- MACD → what momentum shift means
- Volume → what participation indicates
- Supports (2)
- Resistances (2)
- Momentum interpretation
- BTC influence (if BTC moves, what happens?)
No repetition. No definitions. No fear language.

3. Scenario Framework (3 Balanced Paths)
Each scenario MUST be signal-triggered, not predictive:
- Scenario A – Bounce Setup: Conditions required, Expected range, Action to manage strength.
- Scenario B – Breakdown Setup: Key invalidation, Downside area, Protective action.
- Scenario C – Recovery Setup: Reclaim level, Momentum shift, Action for trend change.
Scenarios must be calm, balanced, non-dramatic.

4. Action Plan (Clear Steps)
- Alerts to set
- Signals to watch
- When to reduce exposure
- When to avoid adding
- When patience is required
- Exact levels that trigger actions
This must be the most practical part.

5. Risk & Opportunity Outlook
Use only these words:
- Upside potential: Low / Moderate / High
- Downside risk: Low / Moderate / High
- Reward:risk: Favorable / Balanced / Unfavorable
- Bounce potential: Low / Moderate / High
- Trend reversal: Near / Developing / Far
No fear tone. No speculation.

6. Mindset Line (Supportive, Calm)
Examples:
“Stay systematic — signals guide the next move.”
“Patience keeps you aligned with the trend.”
No harshness.

7. Final Recommendation (Only One)
“Hold for now.”
or
“Start planning exits.”
Nothing else.

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
