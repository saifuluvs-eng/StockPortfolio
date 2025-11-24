import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Import service instances
    const binanceModule = await import("../../server/services/binanceService");
    const aiModule = await import("../../server/services/aiService");
    
    const binanceService = binanceModule.binanceService;
    const aiService = aiModule.aiService;

    if (!binanceService || typeof binanceService.getTopGainers !== 'function') {
      throw new Error("Binance service not properly initialized");
    }
    if (!aiService || typeof aiService.generateMarketOverview !== 'function') {
      throw new Error("AI service not properly initialized");
    }

    // Get top gainers and market data
    const gainers = await binanceService.getTopGainers(20);
    
    // Create market summary
    const marketSummary = {
      topGainers: gainers.slice(0, 5),
      averageGain: gainers.reduce((sum, g) => sum + parseFloat(g.priceChangePercent), 0) / gainers.length,
      highVolumeCount: gainers.filter(g => parseFloat(g.quoteVolume) > 10000000).length,
      timestamp: new Date().toISOString(),
    };
    
    // Generate AI market overview
    const overview = await aiService.generateMarketOverview(marketSummary);
    
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.json(overview);
  } catch (error: any) {
    console.error("Error generating market overview:", error?.message || error);
    return res.status(502).json({ 
      error: "upstream",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
