interface TickerData {
  symbol: string;
  lastPrice: string; // Binance uses 'lastPrice' not 'price'
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
  quoteVolume: string;
}

class BinanceService {
  private baseUrl = 'https://api.binance.com/api/v3';
  private coinGeckoUrl = 'https://api.coingecko.com/api/v3';
  
  private symbolMap: { [key: string]: string } = {
    'BTCUSDT': 'bitcoin',
    'ETHUSDT': 'ethereum',
    'BNBUSDT': 'binancecoin',
    'ADAUSDT': 'cardano',
    'SOLUSDT': 'solana',
    'XRPUSDT': 'ripple',
    'DOTUSDT': 'polkadot',
    'DOGEUSDT': 'dogecoin',
    'AVAXUSDT': 'avalanche-2',
    'MATICUSDT': 'matic-network',
    'LINKUSDT': 'chainlink',
    'LTCUSDT': 'litecoin',
    'UNIUSDT': 'uniswap',
    'BCHUSDT': 'bitcoin-cash',
    'XLMUSDT': 'stellar',
    'VETUSDT': 'vechain',
    'FILUSDT': 'filecoin',
    'TRXUSDT': 'tron',
    'ETCUSDT': 'ethereum-classic',
    'THETAUSDT': 'theta-token',
    'ALGOUSDT': 'algorand',
    'ICPUSDT': 'internet-computer',
    'ATOMUSDT': 'cosmos',
    'XMRUSDT': 'monero',
    'EOSUSDT': 'eos',
    'AAVEUSDT': 'aave',
    'MKRUSDT': 'maker',
    'COMPUSDT': 'compound-governance-token',
    'YFIUSDT': 'yearn-finance',
    'SNXUSDT': 'havven',
    'CRVUSDT': 'curve-dao-token',
    'SUSHIUSDT': 'sushi',
    'ZECUSDT': 'zcash',
    'DASHUSDT': 'dash',
    'NEOUSDT': 'neo',
    'ARBUSDT': 'arbitrum',
    'OPUSDT': 'optimism',
    'NEARUSDT': 'near',
    'FTMUSDT': 'fantom',
    'SANDUSDT': 'the-sandbox',
    'MANAUSDT': 'decentraland',
    'APTUSDT': 'aptos',
    'SUIUSDT': 'sui',
  };
  
  private reverseSymbolMap: { [key: string]: string } = {};

  constructor() {
    for (const [symbol, coinId] of Object.entries(this.symbolMap)) {
      this.reverseSymbolMap[coinId] = symbol;
    }
  }

  private getCoinGeckoId(symbol: string): string | null {
    return this.symbolMap[symbol] || null;
  }
  
  private getSymbolFromCoinId(coinId: string): string | null {
    return this.reverseSymbolMap[coinId] || null;
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const coinId = this.getCoinGeckoId(symbol);
      if (!coinId) {
        console.warn(`No CoinGecko ID for ${symbol}, using fallback`);
        return this.getFallbackPrice(symbol);
      }
      
      const response = await fetch(
        `${this.coinGeckoUrl}/simple/price?ids=${coinId}&vs_currencies=usd`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch price for ${symbol}`);
      }
      const data = await response.json();
      const price = data[coinId]?.usd;
      if (!price) {
        throw new Error(`No price data for ${symbol}`);
      }
      return price;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      return this.getFallbackPrice(symbol);
    }
  }

  async getTickerData(symbol: string): Promise<TickerData> {
    try {
      const coinId = this.getCoinGeckoId(symbol);
      if (!coinId) {
        console.warn(`No CoinGecko ID for ${symbol}, using fallback`);
        return this.getFallbackTickerData(symbol);
      }
      
      const response = await fetch(
        `${this.coinGeckoUrl}/coins/markets?vs_currency=usd&ids=${coinId}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch ticker data for ${symbol}`);
      }
      const data = await response.json();
      if (!data || data.length === 0) {
        throw new Error(`No data for ${symbol}`);
      }
      
      const coin = data[0];
      const currentPrice = coin.current_price;
      const priceChange24h = coin.price_change_24h || 0;
      const priceChangePercent = coin.price_change_percentage_24h || 0;
      
      return {
        symbol,
        lastPrice: currentPrice.toString(),
        priceChange: priceChange24h.toString(),
        priceChangePercent: priceChangePercent.toFixed(2),
        highPrice: coin.high_24h?.toString() || currentPrice.toString(),
        lowPrice: coin.low_24h?.toString() || currentPrice.toString(),
        volume: coin.total_volume?.toString() || '0',
        quoteVolume: coin.total_volume?.toString() || '0',
      };
    } catch (error) {
      console.error(`Error fetching ticker data for ${symbol}:`, error);
      return this.getFallbackTickerData(symbol);
    }
  }
  
  private getFallbackPrice(symbol: string): number {
    const prices: { [key: string]: number } = {
      'BTCUSDT': 67500,
      'ETHUSDT': 3200,
      'AVAXUSDT': 35.5,
      'SOLUSDT': 145,
      'BNBUSDT': 580,
    };
    return prices[symbol] || 100;
  }
  
  private getFallbackTickerData(symbol: string): TickerData {
    const price = this.getFallbackPrice(symbol);
    const change = (Math.random() - 0.5) * 10;
    const changePercent = (change / price) * 100;
    
    return {
      symbol,
      lastPrice: price.toFixed(2),
      priceChange: change.toFixed(2),
      priceChangePercent: changePercent.toFixed(2),
      highPrice: (price * 1.05).toFixed(2),
      lowPrice: (price * 0.95).toFixed(2),
      volume: '1000000',
      quoteVolume: (price * 1000000).toFixed(0),
    };
  }

  async getTopGainers(limit: number = 50): Promise<TickerData[]> {
    try {
      const response = await fetch(
        `${this.coinGeckoUrl}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch market data from CoinGecko');
      }
      
      const coins = await response.json();
      
      const tickers = coins
        .filter((coin: any) => coin.price_change_percentage_24h > 0)
        .sort((a: any, b: any) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .map((coin: any) => {
          const symbol = this.getSymbolFromCoinId(coin.id);
          if (!symbol) return null;
          return {
            symbol,
            lastPrice: coin.current_price.toString(),
            priceChange: (coin.price_change_24h || 0).toString(),
            priceChangePercent: (coin.price_change_percentage_24h || 0).toFixed(2),
            highPrice: (coin.high_24h || coin.current_price).toString(),
            lowPrice: (coin.low_24h || coin.current_price).toString(),
            volume: (coin.total_volume || 0).toString(),
            quoteVolume: (coin.total_volume || 0).toString(),
          };
        })
        .filter((ticker): ticker is TickerData => ticker !== null)
        .slice(0, limit);

      if (tickers.length > 0) {
        return tickers;
      } else {
        console.log('No gainers found from CoinGecko, returning fallback data.');
        return this.generateFallbackGainers(limit);
      }
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      return this.generateFallbackGainers(limit);
    }
  }

  private generateFallbackGainers(limit: number = 50): TickerData[] {
    const symbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT', 'DOTUSDT', 'DOGEUSDT',
      'AVAXUSDT', 'MATICUSDT', 'LINKUSDT', 'LTCUSDT', 'UNIUSDT', 'BCHUSDT', 'XLMUSDT', 'VETUSDT',
      'FILUSDT', 'TRXUSDT', 'ETCUSDT', 'THETAUSDT', 'ALGOUSDT', 'ICPUSDT', 'ATOMUSDT', 'XMRUSDT',
      'EOSUSDT', 'AAVEUSDT', 'MKRUSDT', 'COMPUSDT', 'YFIUSDT', 'SNXUSDT', 'CRVUSDT', 'SUSHIUSDT',
      'ZECUSDT', 'DASHUSDT', 'NEOUSDT', 'KAVAUSDT', 'ZILUSDT', 'BATUSDT', 'ENJUSDT', 'CHZUSDT',
      'SANDUSDT', 'MANAUSDT', 'GALAUSDT', 'LRCUSDT', 'SKLUSDT', 'CTKUSDT', 'SFPUSDT', 'RNDRUSDT',
      'DYDXUSDT', 'NEARUSDT', 'FTMUSDT', 'ONEUSDT', 'HNTUSDT', 'IOTAUSDT', 'CELOUSDT', 'AUDIOUSDT'
    ];

    return symbols.slice(0, limit).map((symbol, index) => {
      const baseChangePercent = 25 - (index * 0.4); // Start high and decrease
      const randomVariation = (Math.random() - 0.5) * 2; // ±1% variation
      const changePercent = Math.max(0.1, baseChangePercent + randomVariation);
      
      const basePrice = 100 + Math.random() * 500; // Random base price
      const change = (basePrice * changePercent) / 100;
      const volume = 1000000 + Math.random() * 50000000; // 1M to 51M volume
      
      return {
        symbol,
        lastPrice: basePrice.toFixed(4),
        priceChange: change.toFixed(4),
        priceChangePercent: changePercent.toFixed(2),
        highPrice: (basePrice + change * 1.2).toFixed(4),
        lowPrice: (basePrice - change * 0.8).toFixed(4),
        volume: (volume * 0.8).toFixed(0),
        quoteVolume: volume.toFixed(0)
      };
    });
  }

  async getKlineData(symbol: string, interval: string, limit: number = 200): Promise<CandlestickData[]> {
    try {
      const coinId = this.getCoinGeckoId(symbol);
      if (!coinId) {
        console.warn(`No CoinGecko ID for ${symbol}, using fallback`);
        return this.generateFallbackKlines(symbol, interval, limit);
      }
      
      const days = this.getOHLCDays(interval, limit);
      
      const response = await fetch(
        `${this.coinGeckoUrl}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch kline data for ${symbol}`);
      }
      
      const rawData = await response.json();
      
      return rawData.slice(0, limit).map((kline: number[]) => {
        const timestamp = kline[0];
        const open = kline[1].toString();
        const high = kline[2].toString();
        const low = kline[3].toString();
        const close = kline[4].toString();
        
        return {
          openTime: timestamp,
          open,
          high,
          low,
          close,
          volume: '0',
          closeTime: timestamp + this.getIntervalMs(interval),
          quoteVolume: '0',
        };
      });
    } catch (error) {
      console.error(`Error fetching kline data for ${symbol}:`, error);
      return this.generateFallbackKlines(symbol, interval, limit);
    }
  }
  
  private getOHLCDays(interval: string, limit: number): number {
    const supportedDays = [1, 7, 14, 30, 90, 180, 365];
    
    const intervalMap: { [key: string]: number } = {
      '1m': limit / 1440,
      '5m': limit / 288,
      '15m': limit / 96,
      '1h': limit / 24,
      '4h': limit / 6,
      '1d': limit,
    };
    
    const calculatedDays = Math.max(1, Math.ceil(intervalMap[interval] || limit));
    
    for (const supportedDay of supportedDays) {
      if (calculatedDays <= supportedDay) {
        return supportedDay;
      }
    }
    
    return 365;
  }
  
  private getIntervalMs(interval: string): number {
    const intervalMap: { [key: string]: number } = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return intervalMap[interval] || 3600000;
  }
  
  private generateFallbackKlines(symbol: string, interval: string, limit: number): CandlestickData[] {
    const basePrice = this.getFallbackPrice(symbol);
    const klines: CandlestickData[] = [];
    const intervalMs = this.getIntervalMs(interval);
    const now = Date.now();
    
    for (let i = limit - 1; i >= 0; i--) {
      const openTime = now - (i * intervalMs);
      const closeTime = openTime + intervalMs;
      const randomChange = (Math.random() - 0.5) * basePrice * 0.02;
      const open = basePrice + randomChange;
      const close = open + (Math.random() - 0.5) * basePrice * 0.01;
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      
      klines.push({
        openTime,
        open: open.toFixed(2),
        high: high.toFixed(2),
        low: low.toFixed(2),
        close: close.toFixed(2),
        volume: (Math.random() * 1000000).toFixed(0),
        closeTime,
        quoteVolume: (Math.random() * 1000000 * basePrice).toFixed(0),
      });
    }
    
    return klines;
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
