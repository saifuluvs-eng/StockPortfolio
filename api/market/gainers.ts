import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch("https://api.binance.com/api/v3/ticker/24hr", { cache: "no-store" });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: `binance ${r.status}`, detail: await r.text() });

    const list: any[] = await r.json();
    const items = list
      .filter((t: any) => typeof t?.symbol === "string" && t.symbol.endsWith("USDT"))
      .map((t: any) => ({
        symbol: t.symbol,
        last: parseFloat(t.lastPrice),
        changePct: parseFloat(t.priceChangePercent),
        quoteVolume: parseFloat(t.quoteVolume),
      }))
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 20);

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ ok: true, items, time: new Date().toISOString() });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "internal_error" });
  }
}
