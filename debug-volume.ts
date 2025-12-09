
import fetch from 'node-fetch';

async function debugVolume() {
    const symbol = 'BTCUSDT';
    const BINANCE_BASE = 'https://api.binance.com/api/v3';

    console.log(`Fetching klines for ${symbol}...`);
    const klineResponse = await fetch(`${BINANCE_BASE}/klines?symbol=${symbol}&interval=1h&limit=168`);

    if (!klineResponse.ok) {
        console.error('Failed to fetch klines');
        return;
    }

    const klines = await klineResponse.json();
    console.log(`Fetched ${klines.length} klines`);

    const volumes = klines.map((k: any[]) => parseFloat(k[7])); // quote volume
    const baseVolumes = klines.map((k: any[]) => parseFloat(k[5])); // base volume

    // Last 24h
    const todayVolumes = volumes.slice(-24);
    const todayVolume = todayVolumes.reduce((a: number, b: number) => a + b, 0);
    console.log(`Today Volume (Quote): ${todayVolume.toLocaleString()}`);

    // Previous days
    const previousDaysVolumes = volumes.slice(0, -24);
    const daysCount = Math.floor(previousDaysVolumes.length / 24);

    console.log(`Days count: ${daysCount}`);

    let totalPreviousDaysVolume = 0;
    for (let day = 0; day < daysCount; day++) {
        const dayStart = day * 24;
        const dayEnd = dayStart + 24;
        const slice = previousDaysVolumes.slice(dayStart, dayEnd);
        const dayVolume = slice.reduce((a: number, b: number) => a + b, 0);
        console.log(`Day -${daysCount - day} Volume: ${dayVolume.toLocaleString()}`);
        totalPreviousDaysVolume += dayVolume;
    }

    const avgDailyVolume = totalPreviousDaysVolume / daysCount;
    console.log(`Avg Daily Volume: ${avgDailyVolume.toLocaleString()}`);
    console.log(`Avg Daily Volume (Formatted): $${(avgDailyVolume / 1_000_000).toFixed(1)}M`);

    // Check if we are accidentally using base volume?
    const todayBaseVolume = baseVolumes.slice(-24).reduce((a: number, b: number) => a + b, 0);
    console.log(`Today Base Volume (Coins): ${todayBaseVolume.toLocaleString()}`);
}

debugVolume();
