

import { technicalIndicators } from './server/services/technicalIndicators';

async function testLongTerm() {
    console.log("Testing 90 Days (should use 1d)...");
    // Pass strategy 'bounce' explicitly
    const res90 = await technicalIndicators.scanSupportResistance(20, 90, 'bounce');
    console.log(`90 Days Results: ${res90.length}`);
    if (res90.length > 0) {
        console.log("Sample Result:", JSON.stringify(res90[0], null, 2));
    } else {
        console.log("No results found for 90 days. Checking logic will require internal logging in technicalIndicators.ts or here.");
    }

}

testLongTerm().catch(console.error);

