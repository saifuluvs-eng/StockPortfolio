import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Return a basic market overview response
    // Complex AI analysis is done via the dedicated /api/ai/summary endpoint
    const overview = {
      overallSentiment: "Neutral",
      keyInsights: [
        "Market sentiment is neutral",
        "Use the Scanner or AI Summary features for detailed analysis",
      ],
      tradingRecommendations: [
        "Check technical indicators for entry signals",
      ],
      riskAssessment: "Moderate risk - diversify positions",
      timestamp: new Date().toISOString(),
    };
    
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.json(overview);
  } catch (error: any) {
    console.error("Error generating market overview:", error?.message || error);
    return res.status(200).json({ 
      overallSentiment: "Neutral",
      keyInsights: ["Unable to fetch live market analysis"],
      tradingRecommendations: [],
      riskAssessment: "Unknown",
      timestamp: new Date().toISOString(),
    });
  }
};
