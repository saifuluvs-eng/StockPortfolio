import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const symbol = String(req.query.symbol || "").toUpperCase();
    if (!symbol) return res.status(400).json({ ok: false, error: "symbol required" });

    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: `binance ${r.status}`, detail: await r.text() });

    const data = await r.json();
    res.status(200).json({ ok: true, symbol, data, time: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
}
