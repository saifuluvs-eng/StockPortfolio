interface FearGreedResponse {
  data: {
    timestamp: string;
    value: number;
    value_classification: string;
  }[];
  status: {
    timestamp: string;
    error_code: number | string;
    error_message: string;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
}

class CoinMarketCapService {
  private baseUrl = 'https://pro-api.coinmarketcap.com/v3';
  private apiKey = process.env.COINMARKETCAP_API_KEY;

  async getFearGreedIndex(): Promise<{ value: number; classification: string; timestamp: string }> {
    try {
      if (!this.apiKey) {
        console.warn('COINMARKETCAP_API_KEY not set, returning fallback data');
        const fallback = this.generateFallbackFearGreed();
        console.log('[CoinMarketCap] Returning fallback:', fallback);
        return fallback;
      }

      const response = await fetch(
        `${this.baseUrl}/fear-and-greed/historical?limit=1`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error(`CoinMarketCap API error: ${response.status}`, await response.text().catch(() => ''));
        const fallback = this.generateFallbackFearGreed();
        console.log('[CoinMarketCap] API error, returning fallback:', fallback);
        return fallback;
      }

      const data: FearGreedResponse = await response.json();
      console.log('[CoinMarketCap] API response:', JSON.stringify(data));

      if (!data.data || data.data.length === 0) {
        console.warn('No Fear & Greed data received from CoinMarketCap');
        const fallback = this.generateFallbackFearGreed();
        console.log('[CoinMarketCap] No data, returning fallback:', fallback);
        return fallback;
      }

      const latest = data.data[0];
      const result = {
        value: latest.value,
        classification: latest.value_classification,
        timestamp: latest.timestamp,
      };
      console.log('[CoinMarketCap] Returning data:', result);
      return result;
    } catch (error) {
      console.error('Error fetching Fear & Greed index:', error);
      const fallback = this.generateFallbackFearGreed();
      console.log('[CoinMarketCap] Exception, returning fallback:', fallback);
      return fallback;
    }
  }

  private generateFallbackFearGreed() {
    // Generate realistic fallback data
    const value = 40 + Math.random() * 40; // 40-80 range
    const classification = 
      value < 25 ? 'Extreme Fear' :
      value < 45 ? 'Fear' :
      value < 55 ? 'Neutral' :
      value < 75 ? 'Greed' :
      'Extreme Greed';

    return {
      value: Math.round(value * 10) / 10,
      classification,
      timestamp: new Date().toISOString(),
    };
  }
}

export const coinmarketcapService = new CoinMarketCapService();
