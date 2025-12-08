import { createHandler, sendJson, sendError } from './lib/serverless';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const MIN_USD_VOL = 5_000_000;

export default createHandler(async (req, res) => {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) {
      return sendError(res, 500, 'Failed to fetch market data');
    }

    const tickers = await response.json();
    
    const potentialCoins = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= MIN_USD_VOL &&
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN') &&
        parseFloat(t.priceChangePercent) > 0
      )
      .sort((a: any, b: any) => {
        const scoreA = parseFloat(a.priceChangePercent) * Math.log10(parseFloat(a.quoteVolume) / 1000000);
        const scoreB = parseFloat(b.priceChangePercent) * Math.log10(parseFloat(b.quoteVolume) / 1000000);
        return scoreB - scoreA;
      })
      .slice(0, 20)
      .map((t: any) => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        changePct: parseFloat(t.priceChangePercent),
        volume: parseFloat(t.quoteVolume),
        score: Math.round(parseFloat(t.priceChangePercent) * 10),
        recommendation: parseFloat(t.priceChangePercent) > 5 ? 'buy' : 'hold'
      }));

    sendJson(res, { data: potentialCoins });
  } catch (error) {
    console.error('[High Potential] Error:', error);
    sendError(res, 500, 'Failed to fetch high potential coins');
  }
});
