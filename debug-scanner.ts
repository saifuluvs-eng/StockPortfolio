
import { technicalIndicators } from './server/services/technicalIndicators';

async function main() {
    console.log("Starting Debug Scan...");
    try {
        console.log("--- TREND + DIP ---");
        const results = await technicalIndicators.scanTrendDip();
        console.log(`Trend+Dip Results found: ${results.length}`);
        if (results.length > 0) {
            console.log("First result:", JSON.stringify(results[0], null, 2));
        } else {
            // If 0, why?
            console.log("No results. Analyzing top pair manually...");
            // This might require exposing analyzeSymbol or importing binanceService to test connectivity.
        }

        console.log("\n--- SUPPORT & RESISTANCE ---");
        const sr = await technicalIndicators.scanSupportResistance();
        console.log(`S/R Results found: ${sr.length}`);
        if (sr.length > 0) {
            const stables = sr.filter(r => ['USDC', 'FDUSD', 'TUSD'].some(s => r.symbol.startsWith(s)));
            if (stables.length > 0) {
                console.error("FAIL: Stablecoins detected in results:", stables.map(s => s.symbol));
            } else {
                console.log("PASS: No Stablecoins detected.");
            }
            console.log("First S/R:", JSON.stringify(sr[0], null, 2));
        }

    } catch (e) {
        console.error("Scan failed:", e);
    }
}
main();
