import { createHandler, sendJson, sendError } from '../../lib/serverless';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const MIN_USD_VOL = 3_000_000;

export default createHandler(async (req, res) => {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) {
      return sendError(res, 500, 'Failed to fetch market data');
    }

    const tickers = await response.json();
    
    const momentumCoins = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= MIN_USD_VOL &&
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN') &&
        Math.abs(parseFloat(t.priceChangePercent)) > 3
      )
      .map((t: any) => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        changePct: parseFloat(t.priceChangePercent),
        volume: parseFloat(t.quoteVolume),
        momentum: parseFloat(t.priceChangePercent) > 0 ? 'bullish' : 'bearish',
        strength: Math.min(Math.abs(parseFloat(t.priceChangePercent)) / 10, 1)
      }))
      .sort((a: any, b: any) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 20);

    sendJson(res, momentumCoins);
  } catch (error) {
    console.error('[Momentum] Error:', error);
    sendError(res, 500, 'Failed to fetch momentum data');
  }
});
