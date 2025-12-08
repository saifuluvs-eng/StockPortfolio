import { createHandler, sendJson, sendError } from '../../lib/serverless';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const MIN_USD_VOL = 2_000_000;

export default createHandler(async (req, res) => {
  try {
    const limit = Number(req.query?.limit) || 20;
    const strategy = req.query?.strategy || 'bounce';
    
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) {
      return sendError(res, 500, 'Failed to fetch market data');
    }

    const tickers = await response.json();
    
    const filtered = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= MIN_USD_VOL &&
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN')
      )
      .map((t: any) => {
        const price = parseFloat(t.lastPrice);
        const high = parseFloat(t.highPrice);
        const low = parseFloat(t.lowPrice);
        const range = high - low;
        const positionInRange = range > 0 ? (price - low) / range : 0.5;
        
        return {
          symbol: t.symbol,
          price,
          high,
          low,
          changePct: parseFloat(t.priceChangePercent),
          volume: parseFloat(t.quoteVolume),
          positionInRange,
          nearSupport: positionInRange < 0.2,
          nearResistance: positionInRange > 0.8,
          strategy: strategy === 'breakout' 
            ? (positionInRange > 0.9 ? 'breakout_candidate' : 'neutral')
            : (positionInRange < 0.15 ? 'bounce_candidate' : 'neutral')
        };
      })
      .filter((t: any) => 
        strategy === 'breakout' 
          ? t.positionInRange > 0.85 
          : t.positionInRange < 0.2
      )
      .sort((a: any, b: any) => 
        strategy === 'breakout' 
          ? b.positionInRange - a.positionInRange 
          : a.positionInRange - b.positionInRange
      )
      .slice(0, limit);

    sendJson(res, filtered);
  } catch (error) {
    console.error('[Support-Resistance] Error:', error);
    sendError(res, 500, 'Failed to fetch support/resistance data');
  }
});
