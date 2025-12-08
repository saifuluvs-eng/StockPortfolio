import { createHandler, sendJson, sendError } from '../../lib/serverless';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

export default createHandler(async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol || typeof symbol !== 'string') {
      return sendError(res, 400, 'Symbol parameter required');
    }

    const response = await fetch(`${BINANCE_BASE}/ticker/24hr?symbol=${symbol}`);
    
    if (!response.ok) {
      return sendError(res, 404, `Ticker not found for ${symbol}`);
    }

    const data = await response.json();

    sendJson(res, {
      symbol: data.symbol,
      lastPrice: data.lastPrice,
      priceChange: data.priceChange,
      priceChangePercent: data.priceChangePercent,
      highPrice: data.highPrice,
      lowPrice: data.lowPrice,
      volume: data.volume,
      quoteVolume: data.quoteVolume,
    });
  } catch (error) {
    console.error('[Ticker] Error:', error);
    sendError(res, 500, 'Failed to fetch ticker data');
  }
});
