import type { VercelRequest, VercelResponse } from "@vercel/node";
import { technicalIndicators } from "./_lib/technicalIndicators";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // Default filters
        const filters = {
            timeframe: '1h',
            minScore: 5,
            excludeStablecoins: true
        };

        const results = await technicalIndicators.scanHighPotential(filters);

        // Transform to match expected frontend format
        // Frontend expects: { data: [...] }
        // And items should have: symbol, score, passes, passesDetail, price, rsi, volume, avgVolume, volatilityState

        const data = results.map(r => ({
            symbol: r.symbol,
            score: r.totalScore, // Map totalScore to score
            passes: r.recommendation === 'buy' || r.recommendation === 'strong_buy',
            passesDetail: {
                trend: r.indicators.ema_crossover?.score > 0,
                rsi: r.indicators.rsi?.score > 0,
                macd: r.indicators.macd?.score > 0,
                volume: r.indicators.obv?.score > 0,
                obv: r.indicators.obv?.score > 0,
                volatility: r.indicators.bb_squeeze?.score > 0
            },
            price: r.price,
            rsi: r.indicators.rsi?.value || 50,
            volume: r.candles && r.candles.length ? r.candles[r.candles.length - 1].v : 0,
            avgVolume: 0, // Not explicitly in TechnicalAnalysis, maybe calc or omit
            volatilityState: "normal" // Placeholder
        }));

        res.status(200).json({ data });
    } catch (e: any) {
        console.error("high-potential error:", e);
        res.status(500).json({ ok: false, message: "Failed to scan high potential", error: e.message });
    }
}
