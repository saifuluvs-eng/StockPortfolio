import { technicalIndicators } from './server/services/technicalIndicators';

async function verify() {
    console.log("Running verifier...");
    const results = await technicalIndicators.scanSupportResistance(8);

    // Find TRX
    const trx = results.find(r => r.symbol === 'TRX');
    if (trx) {
        console.log("TRX Found:", trx);
        console.log("TRX Badges:", trx.badges);
    } else {
        console.log("TRX not found in scan results");
    }

    // Check for ANY 'Risky' badge
    const riskyItems = results.filter(r => r.badges.includes('Risky'));
    console.log("Items with 'Risky' badge:", riskyItems.length);
    if (riskyItems.length > 0) {
        console.log("First risky item:", riskyItems[0]);
    }

    // Check for 'Weak Level' badge
    const weakItems = results.filter(r => r.badges.includes('Weak Level'));
    console.log("Items with 'Weak Level' badge:", weakItems.length);
}

verify();
