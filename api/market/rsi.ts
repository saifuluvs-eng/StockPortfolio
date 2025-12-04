import type { VercelRequest, VercelResponse } from "@vercel/node";

const BINANCE = "https://api.binance.com";

const rsi = (arr: number[], p = 14) => {
    if (arr.length < p + 1) return [];
    const gains: number[] = [], losses: number[] = [];
    for (let i = 1; i < arr.length; i++) {
        const d = arr[i] - arr[i - 1];
        gains.push(Math.max(d, 0));
        losses.push(Math.max(-d, 0));
    }
    let g = gains.slice(0, p).reduce((a, b) => a + b, 0) / p;
    let l = losses.slice(0, p).reduce((a, b) => a + b, 0) / p;
    const out: number[] = [];
    out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    for (let i = p; i < gains.length; i++) {
        g = (g * (p - 1) + gains[i]) / p;
        l = (l * (p - 1) + losses[i]) / p;
        out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    }
    return out;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const limit = Math.min(parseInt(String(req.query?.limit || "50"), 10) || 50, 100);

        // 1. Get top pairs by volume
        const r = await fetch(`${BINANCE}/api/v3/ticker/24hr`, { cache: "no-store" });
        if (!r.ok) {
            return res.status(r.status).json({ ok: false, error: "binance error", detail: await r.text() });
        }

        const allTickers: any[] = await r.json();
        const pairs = allTickers
            .filter((t: any) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 10000000)
            .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, limit)
            .map((t: any) => ({ symbol: t.symbol, price: parseFloat(t.lastPrice), change: parseFloat(t.priceChangePercent) }));

        const results: any[] = [];

        // 2. Fetch candles and calc RSI (batching to avoid rate limits/timeouts)
        const batchSize = 5;
        for (let i = 0; i < pairs.length; i += batchSize) {
            const batch = pairs.slice(i, i + batchSize);
            const promises = batch.map(async (p: any) => {
                try {
                    const kRes = await fetch(`${BINANCE}/api/v3/klines?symbol=${p.symbol}&interval=4h&limit=30`, { cache: "no-store" });
                    if (!kRes.ok) return null;
                    const klines: any[] = await kRes.json();
                    if (!Array.isArray(klines) || klines.length < 20) return null;

                    const closes = klines.map((k: any) => parseFloat(k[4]));
                    const rsiArr = rsi(closes, 14);
                    const lastRsi = rsiArr.length ? rsiArr[rsiArr.length - 1] : undefined;

                    if (lastRsi === undefined) return null;

                    return {
                        symbol: p.symbol.replace('USDT', ''),
                        rsi: parseFloat(lastRsi.toFixed(2)),
                        price: p.price,
                        change: p.change
                    };
                } catch (e) {
                    return null;
                }
            });

            const batchResults = await Promise.all(promises);
            results.push(...batchResults.filter(Boolean));
        }

        res.status(200).json({ ok: true, data: results.sort((a: any, b: any) => b.rsi - a.rsi) });
    } catch (e: any) {
        console.error("marketRsi error:", e);
        res.status(500).json({ ok: false, message: "Failed to fetch market RSI", error: e.message });
    }
}
