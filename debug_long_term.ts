

import { technicalIndicators } from './server/services/technicalIndicators';

async function testLongTerm() {
    console.log("Testing 180 Days...");
    const res180 = await technicalIndicators.scanSupportResistance(20, 180, 'bounce');
    console.log(`180 Days Results: ${res180.length}`);

    console.log("\nTesting 365 Days...");
    console.log("Note: Many top volume coins (e.g. meme coins) are new and wont have 365d history.");
    const res365 = await technicalIndicators.scanSupportResistance(75, 365, 'bounce'); // Increase limit to 75 to scan all top pairs
    console.log(`365 Days Results: ${res365.length}`);
    if (res365.length > 0) console.log("Sample:", res365[0].symbol);
}

testLongTerm().catch(console.error);

