import type { VercelRequest, VercelResponse } from "@vercel/node";
import { technicalIndicators } from "../../../server/services/technicalIndicators";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const data = await technicalIndicators.scanTrendDip();
        res.status(200).json(data);
    } catch (error: any) {
        console.error("[api/market/strategies/trend-dip] Error:", error);
        res.status(500).json({
            message: "Failed to fetch trend-dip strategy",
            error: error?.message
        });
    }
}
