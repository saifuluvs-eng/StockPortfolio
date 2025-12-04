import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
    // Return empty watchlist for now
    res.status(200).json({ ok: true, items: [] });
}
