import type { VercelRequest, VercelResponse } from "@vercel/node";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    const result = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!result) throw new Error("No response from Gemini API");
    return result;
}

export default async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("Missing GEMINI_API_KEY");
            return res.status(500).json({ error: "Configuration Error", message: "GEMINI_API_KEY is not set" });
        }

        const { positions } = req.body;
        if (!positions || !Array.isArray(positions)) {
            return res.status(400).json({ error: "Invalid positions data" });
        }

        const prompt = `You are a ruthless hedge fund portfolio manager. Analyze this portfolio snapshot and provide strategic advice. Always respond with valid JSON format only.

Portfolio Snapshot:
${JSON.stringify(positions.map((p: any) => ({
            symbol: p.symbol,
            weight: p.weight,
            pnlPercent: p.pnlPercent,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
            value: p.value
        })), null, 2)}

Analyze for:
1. Concentration Risk
2. Profit Taking
3. Cut Losers
4. Opportunity Cost

Respond with ONLY valid JSON in this exact format:
{
  "healthScore": 75,
  "topInsight": "One sentence summary.",
  "actionableMove": "Specific instruction.",
  "detailedAnalysis": "Markdown formatted explanation."
}`;

        const responseText = await callGemini(prompt, apiKey);
        let strategy;
        try {
            strategy = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse Gemini response:", responseText);
            throw new Error("Invalid JSON response from AI");
        }

        const result = {
            healthScore: Math.max(0, Math.min(100, strategy.healthScore || 50)),
            topInsight: strategy.topInsight || "Analysis unavailable.",
            actionableMove: strategy.actionableMove || "Hold current positions.",
            detailedAnalysis: strategy.detailedAnalysis || "No detailed analysis available."
        };

        res.setHeader("Cache-Control", "private, max-age=300");
        return res.json(result);

    } catch (error: any) {
        console.error("POST /api/ai/portfolio-strategy failed", error?.message || error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : String(error),
        });
    }
};
