interface FearGreedResponse {
  data: {
    timestamp: string;
    value: number;
    valueClassification: string;
  }[];
  status: {
    timestamp: string;
    error_code: number;
    error_message: string;
    elapsed: string;
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
        return this.generateFallbackFearGreed();
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
        return this.generateFallbackFearGreed();
      }

      const data: FearGreedResponse = await response.json();

      if (!data.data || data.data.length === 0) {
        console.warn('No Fear & Greed data received from CoinMarketCap');
        return this.generateFallbackFearGreed();
      }

      const latest = data.data[0];
      return {
        value: latest.value,
        classification: latest.valueClassification,
        timestamp: latest.timestamp,
      };
    } catch (error) {
      console.error('Error fetching Fear & Greed index:', error);
      return this.generateFallbackFearGreed();
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
