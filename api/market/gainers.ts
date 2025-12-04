import type { VercelRequest, VercelResponse } from "@vercel/node";
import { binanceService } from "../../_lib/binanceService";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const limit = Math.min(parseInt(String(req.query?.limit || "50"), 10) || 50, 100);
        const gainers = await binanceService.getTopGainers(limit);

        // Transform to match expected frontend format if needed, or just return as is
        // Frontend expects: { rows: [...] } or just array?
        // Looking at client code or previous api/[...all].ts:
        // It returned { rows: list.map(...) }

        const rows = gainers.map(t => ({
            symbol: t.symbol,
            price: parseFloat(t.lastPrice),
            changePct: parseFloat(t.priceChangePercent),
            volume: parseFloat(t.quoteVolume),
            high: parseFloat(t.highPrice),
            low: parseFloat(t.lowPrice),
        }));

        res.status(200).json({ rows });
    } catch (e: any) {
        console.error("gainers error:", e);
        res.status(500).json({ ok: false, message: "Failed to fetch gainers", error: e.message });
    }
}
