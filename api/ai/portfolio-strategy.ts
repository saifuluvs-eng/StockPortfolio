import type { VercelRequest, VercelResponse } from "@vercel/node";
import { aiService } from "../../server/services/aiService";

export default async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { positions } = req.body;
        if (!positions || !Array.isArray(positions)) {
            return res.status(400).json({ error: "Invalid positions data" });
        }

        const strategy = await aiService.generatePortfolioStrategy(positions);

        // Cache for 5 minutes
        res.setHeader("Cache-Control", "private, max-age=300");
        return res.json(strategy);

    } catch (error: any) {
        console.error("POST /api/ai/portfolio-strategy failed", error?.message || error);
        return res.status(500).json({
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : String(error),
        });
    }
};
