import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const r = await fetch("https://api.alternative.me/fng/?limit=1");
        if (!r.ok) {
            throw new Error("Failed to fetch fear and greed index");
        }
        const data = await r.json();
        res.status(200).json(data);
    } catch (e: any) {
        console.error("fear-greed error:", e);
        // Fallback data
        res.status(200).json({
            name: "Fear & Greed Index",
            data: [{ value: "50", value_classification: "Neutral", timestamp: String(Math.floor(Date.now() / 1000)) }]
        });
    }
}
