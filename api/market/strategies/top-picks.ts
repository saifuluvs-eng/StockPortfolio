import { createHandler, sendJson, sendError } from '../../lib/serverless';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const MIN_USD_VOL = 5_000_000;

export default createHandler(async (req, res) => {
  try {
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) {
      return sendError(res, 500, 'Failed to fetch market data');
    }

    const tickers = await response.json();
    
    const topPicks = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= MIN_USD_VOL &&
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN')
      )
      .map((t: any) => {
        const changePct = parseFloat(t.priceChangePercent);
        const volume = parseFloat(t.quoteVolume);
        const volumeScore = Math.min(volume / 50_000_000, 1);
        const momentumScore = Math.min(Math.abs(changePct) / 10, 1);
        const totalScore = (volumeScore * 0.4 + momentumScore * 0.6) * 100;
        
        return {
          symbol: t.symbol,
          price: parseFloat(t.lastPrice),
          changePct,
          volume,
          score: Math.round(totalScore),
          recommendation: changePct > 3 ? 'buy' : changePct < -3 ? 'sell' : 'hold',
          category: 'top_pick'
        };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 15);

    sendJson(res, topPicks);
  } catch (error) {
    console.error('[Top Picks] Error:', error);
    sendError(res, 500, 'Failed to fetch top picks');
  }
});
