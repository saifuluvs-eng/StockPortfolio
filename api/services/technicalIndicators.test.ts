import { technicalIndicators } from './technicalIndicators';
import assert from 'assert';

function testCalculateMFICorrectness() {
    const highs: number[] = [];
    const lows: number[] = [];
    const closes: number[] = [];
    const volumes: number[] = [];

    // First 15 data points (period=14, so 15 prices to have 14 changes)
    // Down-trend for the first 15 days
    for (let i = 0; i < 15; i++) {
        highs.push(100 - i);
        lows.push(98 - i);
        closes.push(99 - i);
        volumes.push(1000);
    }

    // Up-trend for the next 15 days
    for (let i = 0; i < 15; i++) {
        highs.push(100 + i);
        lows.push(98 + i);
        closes.push(99 + i);
        volumes.push(1000);
    }

    // The fixed implementation will calculate on the last 14 changes, which are mostly positive.
    // This will result in an MFI of 100.
    const mfi = technicalIndicators.calculateMFI(highs, lows, closes, volumes, 14);

    // This assertion will pass with the fixed code.
    assert(mfi === 100, `Test failed: Expected MFI to be 100, but got ${mfi}`);
}

try {
    testCalculateMFICorrectness();
    console.log('All tests passed!');
} catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
}
