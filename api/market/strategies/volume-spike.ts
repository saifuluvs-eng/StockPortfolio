import { createHandler, sendJson, sendError } from '../../lib/serverless';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const MIN_USD_VOL = 2_000_000;

export default createHandler(async (req, res) => {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) {
      return sendError(res, 500, 'Failed to fetch market data');
    }

    const tickers = await response.json();
    
    const volumeSpikes = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= MIN_USD_VOL &&
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN')
      )
      .map((t: any) => {
        const volume = parseFloat(t.quoteVolume);
        const avgVolume = MIN_USD_VOL * 2;
        const volumeRatio = volume / avgVolume;
        
        return {
          symbol: t.symbol,
          price: parseFloat(t.lastPrice),
          changePct: parseFloat(t.priceChangePercent),
          volume,
          volumeRatio: Math.round(volumeRatio * 100) / 100,
          isSpike: volumeRatio > 2,
          spikeLevel: volumeRatio > 5 ? 'extreme' : volumeRatio > 3 ? 'high' : volumeRatio > 2 ? 'moderate' : 'normal'
        };
      })
      .filter((t: any) => t.volumeRatio > 1.5)
      .sort((a: any, b: any) => b.volumeRatio - a.volumeRatio)
      .slice(0, 20);

    sendJson(res, volumeSpikes);
  } catch (error) {
    console.error('[Volume Spike] Error:', error);
    sendError(res, 500, 'Failed to fetch volume spike data');
  }
});
