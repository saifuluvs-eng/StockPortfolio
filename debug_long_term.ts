
import { technicalIndicators } from './server/services/technicalIndicators';

async function testLongTerm() {
    console.log("Testing 90 Days (should use 1d)...");
    const res90 = await technicalIndicators.scanSupportResistance(20, 90, 'bounce');
    console.log(`90 Days Results: ${res90.length}`);
    if (res90.length > 0) console.log(res90[0]);

    console.log("\nTesting 365 Days (should use 1d)...");
    const res365 = await technicalIndicators.scanSupportResistance(20, 365, 'bounce');
    console.log(`365 Days Results: ${res365.length}`);
    if (res365.length > 0) console.log(res365[0]);
}

testLongTerm();
