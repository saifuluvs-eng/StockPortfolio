
import { technicalIndicators } from "./server/services/technicalIndicators";

async function run() {
    console.log("Running Support & Resistance Scanner...");
    try {
        const results = await technicalIndicators.scanSupportResistance(50);
        console.log(`Found ${results.length} results.`);
        if (results.length > 0) {
            console.log("Top 5 results:");
            console.log(JSON.stringify(results.slice(0, 5), null, 2));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

run();
