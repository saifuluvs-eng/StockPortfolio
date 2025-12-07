import { technicalIndicators } from './server/services/technicalIndicators';
import { binanceService } from './server/services/binanceService';

async function analyzeMarketDistances() {
    console.log("\n--- MARKET DISTANCE ANALYSIS (90 DAYS / 1D) ---");

    // 1. Verify Pool Fetching
    console.log("Fetching Top 200 Pairs...");
    const topPairs = await binanceService.getTopVolumePairs(200);
    console.log(`Pool Size: ${topPairs.length}`);
    if (topPairs.length < 10) {
        console.error("CRITICAL: Failed to fetch enough pairs.");
        return;
    }

    // 2. Sample first 30 pairs for 90d distance analysis
    const sampleSize = 30;
    const batch = topPairs.slice(0, sampleSize);

    let totalDistSupport = 0;
    let totalDistRes = 0;
    let validCount = 0;
    let closeToSupport = 0; // < 20%
    let closeToRes = 0;     // < 20%

    console.log(`\nAnalyzing first ${sampleSize} pairs...`);

    for (const pair of batch) {
        try {
            const analysis = await technicalIndicators.analyzeSymbol(pair.symbol, '1d', 140);
            const candles = analysis.candles || [];
            if (candles.length < 30) continue;

            const recent = candles.slice(-90);
            const low = Math.min(...recent.map(c => c.l));
            const high = Math.max(...recent.map(c => c.h));
            const price = analysis.price;

            const distSup = Math.abs((price - low) / low);
            const distRes = Math.abs((high - price) / price);

            totalDistSupport += distSup;
            totalDistRes += distRes;
            validCount++;

            if (distSup < 0.20) closeToSupport++;
            if (distRes < 0.20) closeToRes++;

            console.log(`${pair.symbol.padEnd(10)} Price:${price.toFixed(4)} DistSup:${(distSup * 100).toFixed(1)}% DistRes:${(distRes * 100).toFixed(1)}%`);
        } catch (e) {
            console.error(`Error analyzing ${pair.symbol}:`, e.message);
        }
    }

    if (validCount > 0) {
        console.log(`\n--- SUMMARY ---`);
        console.log(`Avg Dist to Support: ${(totalDistSupport / validCount * 100).toFixed(2)}%`);
        console.log(`Avg Dist to Resistance: ${(totalDistRes / validCount * 100).toFixed(2)}%`);
        console.log(`Coins < 20% to Support: ${closeToSupport} / ${validCount}`);
        console.log(`Coins < 20% to Resistance: ${closeToRes} / ${validCount}`);
    }
}

analyzeMarketDistances().catch(console.error);
