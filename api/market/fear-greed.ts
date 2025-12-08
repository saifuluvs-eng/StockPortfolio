import { createHandler, sendJson, sendError } from '../lib/serverless';

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;

function generateFallbackFearGreed() {
  const value = Math.floor(Math.random() * 40) + 20;
  let classification = 'Fear';
  if (value >= 40) classification = 'Neutral';
  if (value >= 60) classification = 'Greed';
  return { value, classification, timestamp: String(Math.floor(Date.now() / 1000)) };
}

export default createHandler(async (req, res) => {
  try {
    if (!COINMARKETCAP_API_KEY) {
      console.warn('[CoinMarketCap] API key not set, using fallback');
      return sendJson(res, generateFallbackFearGreed());
    }

    const response = await fetch('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
      headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY }
    });

    if (!response.ok) {
      console.warn('[CoinMarketCap] API error:', response.status);
      return sendJson(res, generateFallbackFearGreed());
    }

    const json = await response.json();
    const data = json.data?.[0];
    
    if (!data) {
      return sendJson(res, generateFallbackFearGreed());
    }

    sendJson(res, {
      value: data.value,
      classification: data.value_classification,
      timestamp: data.timestamp
    });
  } catch (error) {
    console.error('[CoinMarketCap] Error:', error);
    sendJson(res, generateFallbackFearGreed());
  }
});
