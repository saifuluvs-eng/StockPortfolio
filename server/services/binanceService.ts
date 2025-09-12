interface TickerData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

interface CandlestickData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

class BinanceService {
  private baseUrl = 'https://api.binance.com/api/v3';

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/price?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch price for ${symbol}`);
      }
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      throw error;
    }
  }

  async getTickerData(symbol: string): Promise<TickerData> {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/24hr?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ticker data for ${symbol}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ticker data for ${symbol}:`, error);
      throw error;
    }
  }

  async getTopGainers(limit: number = 50): Promise<TickerData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/24hr`);
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }
      
      const allTickers: TickerData[] = await response.json();
      
      // Filter for USDT pairs and sort by price change percentage
      const usdtPairs = allTickers
        .filter(ticker => 
          ticker.symbol.endsWith('USDT') && 
          !ticker.symbol.includes('DOWN') && 
          !ticker.symbol.includes('UP') &&
          parseFloat(ticker.quoteVolume) > 1000000 // Minimum volume threshold
        )
        .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, limit);

      return usdtPairs;
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      throw error;
    }
  }

  async getKlineData(symbol: string, interval: string, limit: number = 100): Promise<CandlestickData[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch kline data for ${symbol}`);
      }
      
      const rawData = await response.json();
      
      return rawData.map((kline: any[]) => ({
        openTime: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        closeTime: kline[6],
      }));
    } catch (error) {
      console.error(`Error fetching kline data for ${symbol}:`, error);
      throw error;
    }
  }

  async getExchangeInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/exchangeInfo`);
      if (!response.ok) {
        throw new Error('Failed to fetch exchange info');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching exchange info:', error);
      throw error;
    }
  }

  async getAllUSDTPairs(): Promise<string[]> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      return exchangeInfo.symbols
        .filter((symbol: any) => 
          symbol.quoteAsset === 'USDT' && 
          symbol.status === 'TRADING' &&
          !symbol.symbol.includes('DOWN') &&
          !symbol.symbol.includes('UP')
        )
        .map((symbol: any) => symbol.symbol);
    } catch (error) {
      console.error('Error fetching USDT pairs:', error);
      throw error;
    }
  }
}

export const binanceService = new BinanceService();
