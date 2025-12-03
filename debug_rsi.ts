
import { technicalIndicators } from './server/services/technicalIndicators';

async function run() {
    console.log("Running getMarketRSI...");
    try {
        const data = await technicalIndicators.getMarketRSI(5);
        console.log("Result count:", data.length);
        console.log("First result:", JSON.stringify(data[0], null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
