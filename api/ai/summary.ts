import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runSummaryWithIndicators } from "../../gemini_tech_summary.js";

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

    // Check if technical data is missing or empty
    const isMissingData = !technicals ||
      (typeof technicals === "object" && Object.keys(technicals).length === 0) ||
      (Array.isArray(technicals) && technicals.length === 0);

    if (isMissingData) {
      return res.json({
        data: `Error: No technical data received.`,
      });
    }

    // Call the shared Gemini summary logic
    // We assume 'technicals' contains the precomputed indicators
    // If the frontend sends raw candles, we would use runSummary({ symbol, timeframe: tf, candles: technicals })
    // But based on context, it seems to be precomputed indicators.

    const result = await runSummaryWithIndicators({
      symbol,
      timeframe: tf,
      indicatorsOverride: technicals
    });

    res.setHeader("Cache-Control", "private, max-age=60");
    return res.json({
      data: result.geminiText,
    });

  } catch (error: any) {
    console.error("POST /api/ai/summary failed", error?.message || error);
    return res.status(502).json({
      error: "upstream",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
