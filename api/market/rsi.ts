import type { VercelRequest, VercelResponse } from "@vercel/node";

const BINANCE = "https://api.binance.com";

// Simple RSI calculation
const calculateRSI = (closes: number[], period = 14) => {
    if (closes.length < period + 1) return 50;
    const gains: number[] = [], losses: number[] = [];
    for (let i = 1; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        gains.push(Math.max(d, 0));
        losses.push(Math.max(-d, 0));
    }
    let g = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let l = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const out: number[] = [];

    // First RSI
    out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));

    // Smoothed RSI
    for (let i = period; i < gains.length; i++) {
        g = (g * (period - 1) + gains[i]) / period;
        l = (l * (period - 1) + losses[i]) / period;
        out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    }
    return out;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const limit = Math.min(parseInt(String(req.query?.limit || "50"), 10) || 50, 100);
        const timeframe = String(req.query?.timeframe || "4h");
        const source = String(req.query?.source || "volume"); // 'volume' or 'gainers'

        // 1. Get top pairs
        const r = await fetch(`${BINANCE}/api/v3/ticker/24hr`, { cache: "no-store" });
        if (!r.ok) {
            return res.status(r.status).json({ ok: false, error: "Binance API error" });
        }

        const allTickers: any[] = await r.json();

        let pairs = allTickers
            .filter((t: any) => {
                const symbol = t.symbol;
                return symbol.endsWith("USDT") &&
                    !symbol.includes("DOWN") &&
                    !symbol.includes("UP") &&
                    !symbol.includes("BULL") &&
                    !symbol.includes("BEAR");
            });

        if (source === 'gainers') {
            // Sort by 24h change % descending
            pairs = pairs
                .filter((t: any) => parseFloat(t.quoteVolume) > 1_000_000) // Basic volume filter for gainers too
                .sort((a: any, b: any) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));
        } else {
            // Default: Sort by Volume descending
            pairs = pairs
                .filter((t: any) => parseFloat(t.quoteVolume) > 10_000_000) // Higher volume filter for main view
                .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        }

        pairs = pairs.slice(0, limit)
            .map((t: any) => ({ symbol: t.symbol, price: parseFloat(t.lastPrice), change: parseFloat(t.priceChangePercent) }));

        const results = [];

        // 2. Fetch candles and calc RSI (batching to avoid rate limits/timeouts)
        const batchSize = 5;
        for (let i = 0; i < pairs.length; i += batchSize) {
            const batch = pairs.slice(i, i + batchSize);
            const promises = batch.map(async (p: any) => {
                try {
                    const kRes = await fetch(`${BINANCE}/api/v3/klines?symbol=${p.symbol}&interval=${timeframe}&limit=30`, { cache: "no-store" });
                    if (!kRes.ok) return null;
                    const klines: any[] = await kRes.json();
                    if (!Array.isArray(klines) || klines.length < 20) return null;

                    const closes = klines.map((k: any) => parseFloat(k[4]));
                    const rsiArr = calculateRSI(closes, 14);
                    const lastRsi = rsiArr.at(-1);

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

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

        // If source is gainers, we might want to keep the gainers sort order (by change %), 
        // but usually RSI heatmap is visualized better if sorted by something else or just the list.
        // The user asked for "Gainers page" coins. 
        // If we return them, the frontend currently sorts by Volume (implicit from API return order if we don't re-sort).
        // Let's return them in the order we fetched them (which is sorted by source criteria).

        return res.status(200).json(results);
    } catch (e: any) {
        console.error("[api/market/rsi] Error:", e);
        return res.status(500).json({ ok: false, error: "Failed to fetch market RSI" });
    }
}
