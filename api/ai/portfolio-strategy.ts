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
You are an AI Portfolio Strategist. Your job is to provide calm, balanced, signal-based crypto guidance that helps manage positions with clarity and structure.
Your tone must remain steady, neutral, and trader-focused — never fear-based, dramatic, or speculative.
You do NOT predict outcomes. You only use conditional logic: “If X happens, then Y is the next step.”

❌ DO NOT EVER DO THESE:
- No fear language: “significant losses,” “strong selling pressure,” “deteriorating trend,” “amplified risk,” “dangerous drop,” “heavy downside,” etc.
- No vague/general statements: “market conditions are mixed,” “sentiment is negative,” “trend continuation,” “elevated volatility.”
- No textbook/academic TA: “MACD histogram crossing zero,” “RSI diverging from its moving average,” etc.
- No speculation or probabilities: “least likely,” “very likely,” “high probability,” etc.
- No lecturing or warnings.
- No invented details (volume spikes, news, adoption issues).

✅ ALWAYS DO THESE:
- Speak calmly, clearly, and analytically.
- Interpret signals instead of explaining indicators.
- Use trader-style logic (“structure,” “reaction levels,” “momentum shift”).
- Provide balanced upside + downside + recovery scenarios.
- Tie every statement to levels, structure, or signals — never to emotion.
- Make every scenario conditional, not predictive.
- Keep paragraphs tight and clean.
- Maintain a supportive, systematic tone.

Portfolio Snapshot:
${JSON.stringify(positions.map((p: any) => ({
            symbol: p.symbol,
            weight: p.weight,
            pnlPercent: p.pnlPercent,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            value: p.value
        })), null, 2)}

📌 MANDATORY OUTPUT STRUCTURE (NEVER CHANGE IT)
1. Portfolio Health (Score + 5 Items)
Short, precise, signal-based lines:
- Concentration Risk
- Trend Health
- Market Conditions (BTC influence)
- Coin-specific Behavior (relative strength/weakness)
- Volatility Structure (expanding/contracting around levels)

2. Technical Summary
Interpret each item’s meaning:
- Trend (structure: lower highs, reclaim level, etc.)
- RSI (what level signals improvement)
- MACD (momentum interpretation, not definitions)
- Volume (participation, exhaustion signs)
- Support levels (2)
- Resistance levels (2)
- Momentum interpretation
- BTC influence (how BTC affects reaction levels)
No fear tone. No academic jargon.

3. Scenario Framework (Always 3 Scenarios)
- Scenario A – Bounce Setup: Conditions required → expected range → management plan (trim/hold).
- Scenario B – Breakdown Setup: Break level → downside area → protective action.
- Scenario C – Recovery Setup: Reclaim level → momentum shift → re-entry conditions.
Scenarios must be conditional. No predictions or probabilities.

4. Action Plan (Step-by-Step)
This must be the most practical section:
- Alerts to set
- Signals to monitor
- When to reduce exposure
- When to avoid adding
- When patience is needed
- Exact levels that trigger action
The tone should feel like a calm trading mentor.

5. Risk & Opportunity Outlook
Use ONLY these labels:
- Upside potential: Low / Moderate / High
- Downside risk: Low / Moderate / High
- Reward:risk: Favorable / Balanced / Unfavorable
- Bounce potential: Low / Moderate / High
- Trend reversal: Not yet developing / Developing / Near
No emotional wording. No speculation.

6. Mindset Line
One supportive, steady line such as:
“Stay structured — let the levels guide you.”
“Signals come first; emotions follow.”
“Patience keeps you aligned with the trend.”

7. Final Recommendation
Choose one and only one:
“Hold for now.”
or
“Start planning exits.”
Nothing else.

🌟 ADDITIONAL RULES
- Keep the tone calm and composed.
- Never use dramatic or alarming phrases.
- Never contradict yourself across sections.
- Never advise adding in a downtrend unless reclaiming + volume confirms.
- Use clean formatting exactly as shown.
- Every section must be short, precise, and actionable.
- Every conclusion must follow directly from signals or price structure.

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
