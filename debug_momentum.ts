
import { technicalIndicators } from './server/services/technicalIndicators';
import { binanceService } from './server/services/binanceService';

async function testMomentumScanner() {
    console.log("--- TESTING MOMENTUM SCANNER ---");
    try {
        const results = await technicalIndicators.scanMomentum();
        console.log(`Found ${results.length} momentum coins.`);

        if (results.length > 0) {
            console.table(results.map(r => ({
                Symbol: r.symbol,
                Price: r.price,
                Change24h: r.change24h + '%',
                VolFactor: r.volumeFactor + 'x',
                RSI: r.rsi,
                Signal: r.signal
            })));
        } else {
            console.log("No results found. Tuning thresholds might be needed.");
        }
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testMomentumScanner().catch(console.error);
