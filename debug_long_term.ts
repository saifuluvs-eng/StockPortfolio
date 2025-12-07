

import { technicalIndicators } from './server/services/technicalIndicators';

async function testLongTerm() {
    console.log("Testing 180 Days...");
    const res180 = await technicalIndicators.scanSupportResistance(20, 180, 'bounce');
    console.log(`180 Days Results: ${res180.length}`);

    console.log("\nTesting 365 Days...");
    const res365 = await technicalIndicators.scanSupportResistance(20, 365, 'bounce');
    console.log(`365 Days Results: ${res365.length}`);
}

testLongTerm().catch(console.error);

