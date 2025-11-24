import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Import the service instance
    const module = await import("../../server/services/coinmarketcapService");
    const coinmarketcapService = module.coinmarketcapService;
    
    if (!coinmarketcapService || typeof coinmarketcapService.getFearGreedIndex !== 'function') {
      throw new Error("CoinMarketCap service not properly initialized");
    }
    
    const fgData = await coinmarketcapService.getFearGreedIndex();
    
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.json(fgData);
  } catch (error: any) {
    console.error("Error fetching Fear & Greed index:", error?.message || error);
    return res.status(500).json({ 
      error: "upstream",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
