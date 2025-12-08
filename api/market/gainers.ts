import { createHandler, sendJson, sendError } from '../lib/serverless';

const MIN_USD_VOL = 1_000_000;
const BINANCE_BASE = 'https://api.binance.com/api/v3';

export default createHandler(async (req, res) => {
  try {
    const limit = Number(req.query?.limit) || 20;
    
    const response = await fetch(`${BINANCE_BASE}/ticker/24hr`);
    if (!response.ok) {
      return sendError(res, 500, 'Failed to fetch market data from Binance');
    }

    const tickers = await response.json();
    
    const usdtPairs = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        parseFloat(t.quoteVolume) >= MIN_USD_VOL &&
        !t.symbol.includes('UP') && 
        !t.symbol.includes('DOWN')
      )
      .sort((a: any, b: any) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, limit);

    const toNumber = (val: string) => parseFloat(val) || 0;

    const rows = usdtPairs.map((item: any) => ({
      symbol: item.symbol,
      price: toNumber(item.lastPrice),
      changePct: toNumber(item.priceChangePercent),
      volume: toNumber(item.quoteVolume),
      high: toNumber(item.highPrice),
      low: toNumber(item.lowPrice),
    }));

    sendJson(res, { rows });
  } catch (error) {
    console.error('[Gainers] Error:', error);
    sendError(res, 500, 'Failed to fetch market gainers');
  }
});
