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
    
    const trendDips = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= MIN_USD_VOL &&
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN') &&
        parseFloat(t.priceChangePercent) < -2 &&
        parseFloat(t.priceChangePercent) > -15
      )
      .map((t: any) => {
        const changePct = parseFloat(t.priceChangePercent);
        const price = parseFloat(t.lastPrice);
        const high = parseFloat(t.highPrice);
        const dipFromHigh = ((high - price) / high) * 100;
        
        return {
          symbol: t.symbol,
          price,
          changePct,
          volume: parseFloat(t.quoteVolume),
          dipFromHigh: Math.round(dipFromHigh * 100) / 100,
          dipLevel: dipFromHigh > 10 ? 'deep' : dipFromHigh > 5 ? 'moderate' : 'shallow',
          buyScore: Math.min(Math.abs(changePct) * 10, 100)
        };
      })
      .sort((a: any, b: any) => a.changePct - b.changePct)
      .slice(0, 20);

    sendJson(res, trendDips);
  } catch (error) {
    console.error('[Trend Dip] Error:', error);
    sendError(res, 500, 'Failed to fetch trend dip data');
  }
});
