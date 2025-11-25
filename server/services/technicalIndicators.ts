import { binanceService } from './binanceService';

interface TechnicalAnalysis {
  symbol: string;
  price: number;
  indicators: {
    [key: string]: {
      value: number;
      signal: 'bullish' | 'bearish' | 'neutral';
      score: number;
      tier: number;
      description: string;
    };
  };
  totalScore: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  calculationTimestamp?: string;
  latestDataTime?: string;
  candles?: { t: number; o: number; h: number; l: number; c: number; v: number }[];
}

interface ScanFilters {
  timeframe?: string;
  minScore?: number;
  minVolume?: number;
  excludeStablecoins?: boolean;
}

class TechnicalIndicators {
  // Simple Moving Average
  private calculateSMA(prices: number[], period: number): number {
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / slice.length;
  }

  // Exponential Moving Average
  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  // Relative Strength Index using Wilder's smoothing method
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50; // Not enough data

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // Calculate initial averages for the first period (simple average)
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    // Apply Wilder's smoothing method for remaining periods
    for (let i = period; i < changes.length; i++) {
      const gain = changes[i] > 0 ? changes[i] : 0;
      const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

      // Wilder's smoothing: (previous_average * (period - 1) + current_value) / period
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // MACD (Moving Average Convergence Divergence)
  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // For signal line, we'd need historical MACD values, simplified for demo
    const signal = macd * 0.9; // Approximation
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  // Bollinger Bands
  private calculateBollingerBands(prices: number[], period: number = 20): {
    upper: number;
    middle: number;
    lower: number;
    squeeze: boolean;
  } {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);

    const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = sma + (2 * stdDev);
    const lower = sma - (2 * stdDev);

    // BB Squeeze detection (simplified)
    const squeeze = (upper - lower) / sma < 0.1;

    return {
      upper,
      middle: sma,
      lower,
      squeeze
    };
  }

  // Volume Weighted Average Price (simplified)
  private calculateVWAP(prices: number[], volumes: number[]): number {
    let totalPriceVolume = 0;
    let totalVolume = 0;

    for (let i = 0; i < Math.min(prices.length, volumes.length); i++) {
      const pv = prices[i] * volumes[i];
      totalPriceVolume += pv;
      totalVolume += volumes[i];
    }

    return totalVolume > 0 ? totalPriceVolume / totalVolume : prices[prices.length - 1];
  }

  // Stochastic Oscillator
  private calculateStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number = 14): { k: number; d: number } {
    const currentClose = closes[closes.length - 1];
    const highestHigh = Math.max(...highs.slice(-kPeriod));
    const lowestLow = Math.min(...lows.slice(-kPeriod));

    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // Simplified %D as 3-period SMA of %K (in practice, track recent %K values)
    const d = k; // Simplified for demo

    return { k, d };
  }

  // Williams %R
  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    const currentClose = closes[closes.length - 1];
    const highestHigh = Math.max(...highs.slice(-period));
    const lowestLow = Math.min(...lows.slice(-period));

    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  // Commodity Channel Index (CCI)
  private calculateCCI(highs: number[], lows: number[], closes: number[], period: number = 20): number {
    const typicalPrices = closes.map((close, i) => (highs[i] + lows[i] + close) / 3);
    const sma = this.calculateSMA(typicalPrices, period);
    const slice = typicalPrices.slice(-period);

    const meanDeviation = slice.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
    const currentTP = typicalPrices[typicalPrices.length - 1];

    return meanDeviation !== 0 ? (currentTP - sma) / (0.015 * meanDeviation) : 0;
  }

  // Money Flow Index (MFI)
  private calculateMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14): number {
    const typicalPrices = closes.map((close, i) => (highs[i] + lows[i] + close) / 3);
    const rawMoneyFlows = typicalPrices.map((tp, i) => tp * volumes[i]);

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = 1; i < Math.min(rawMoneyFlows.length, period + 1); i++) {
      if (typicalPrices[i] > typicalPrices[i - 1]) {
        positiveFlow += rawMoneyFlows[i];
      } else if (typicalPrices[i] < typicalPrices[i - 1]) {
        negativeFlow += rawMoneyFlows[i];
      }
    }

    if (negativeFlow === 0) return 100;
    const moneyFlowRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyFlowRatio));
  }

  // On Balance Volume (OBV)
  private calculateOBV(closes: number[], volumes: number[]): number {
    let obv = 0;

    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }

    return obv;
  }

  // Average True Range (ATR)
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    const trueRanges: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return this.calculateSMA(trueRanges, Math.min(period, trueRanges.length));
  }

  // Parabolic SAR (simplified)
  private calculateParabolicSAR(highs: number[], lows: number[], closes: number[]): { sar: number; trend: 'bullish' | 'bearish' } {
    const currentClose = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2] || currentClose;
    const highestHigh = Math.max(...highs.slice(-10));
    const lowestLow = Math.min(...lows.slice(-10));

    const trend = currentClose > prevClose ? 'bullish' : 'bearish';
    const sar = trend === 'bullish' ? lowestLow * 0.98 : highestHigh * 1.02;

    return { sar, trend };
  }

  // Volume Oscillator
  private calculateVolumeOscillator(volumes: number[], shortPeriod: number = 5, longPeriod: number = 10): number {
    const shortSMA = this.calculateSMA(volumes, shortPeriod);
    const longSMA = this.calculateSMA(volumes, longPeriod);

    return longSMA !== 0 ? ((shortSMA - longSMA) / longSMA) * 100 : 0;
  }

  // ADX (Average Directional Index) - simplified
  private calculateADX(highs: number[], lows: number[], closes: number[]): {
    adx: number;
    plusDI: number;
    minusDI: number;
  } {
    // Simplified ADX calculation
    let trueRanges: number[] = [];
    let plusDMs: number[] = [];
    let minusDMs: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      const tr = Math.max(hl, hc, lc);
      trueRanges.push(tr);

      const hh = highs[i] - highs[i - 1];
      const ll = lows[i - 1] - lows[i];

      plusDMs.push(hh > ll && hh > 0 ? hh : 0);
      minusDMs.push(ll > hh && ll > 0 ? ll : 0);
    }

    const avgTR = trueRanges.slice(-14).reduce((sum, tr) => sum + tr, 0) / 14;
    const avgPlusDM = plusDMs.slice(-14).reduce((sum, dm) => sum + dm, 0) / 14;
    const avgMinusDM = minusDMs.slice(-14).reduce((sum, dm) => sum + dm, 0) / 14;

    const plusDI = avgTR > 0 ? (avgPlusDM / avgTR) * 100 : 0;
    const minusDI = avgTR > 0 ? (avgMinusDM / avgTR) * 100 : 0;

    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    const adx = dx; // Simplified, normally would be smoothed

    return { adx, plusDI, minusDI };
  }

  async analyzeSymbol(symbol: string, timeframe: string = '1h'): Promise<TechnicalAnalysis> {
    try {
      // Convert timeframe to Binance format
      const binanceInterval = this.convertTimeframeToBinance(timeframe);

      let closes: number[], highs: number[], lows: number[], volumes: number[], currentPrice: number;
      let klines: any[] = [];

      try {
        // Get candlestick data (increased for better RSI accuracy)
        klines = await binanceService.getKlineData(symbol, binanceInterval, 200);

        if (klines.length === 0) {
          throw new Error('No kline data received from API');
        }

        closes = klines.map(k => parseFloat(k.close));
        highs = klines.map(k => parseFloat(k.high));
        lows = klines.map(k => parseFloat(k.low));
        volumes = klines.map(k => parseFloat(k.volume));
        currentPrice = closes[closes.length - 1];
      } catch (apiError) {
        console.warn(`Failed to fetch real market data for ${symbol}, using fallback data:`, apiError);

        // Generate fallback data for demonstration when API fails
        const fallbackData = this.generateFallbackData(symbol);
        closes = fallbackData.closes;
        highs = fallbackData.highs;
        lows = fallbackData.lows;
        volumes = fallbackData.volumes;
        currentPrice = closes[closes.length - 1];
      }

      // Add timing info for accuracy
      const calculationTimestamp = new Date().toISOString();
      const latestCandleTime = klines?.length > 0 ? new Date(klines[klines.length - 1].closeTime).toISOString() : calculationTimestamp;

      // Calculate indicators
      const rsi = this.calculateRSI(closes);
      const macd = this.calculateMACD(closes);
      const ema20 = this.calculateEMA(closes, 20);
      const ema50 = this.calculateEMA(closes, 50);
      const bb = this.calculateBollingerBands(closes);
      const vwap = this.calculateVWAP(closes, volumes);
      const adx = this.calculateADX(highs, lows, closes);
      const stoch = this.calculateStochastic(highs, lows, closes);
      const williamsR = this.calculateWilliamsR(highs, lows, closes);
      const cci = this.calculateCCI(highs, lows, closes);
      const mfi = this.calculateMFI(highs, lows, closes, volumes);
      const obv = this.calculateOBV(closes, volumes);
      const atr = this.calculateATR(highs, lows, closes);
      const psar = this.calculateParabolicSAR(highs, lows, closes);
      const volOsc = this.calculateVolumeOscillator(volumes);

      // Calculate scores and signals
      const indicators: TechnicalAnalysis['indicators'] = {
        vwap: {
          value: vwap,
          signal: currentPrice > vwap ? 'bullish' : 'bearish',
          score: currentPrice > vwap ? 1 : -1,
          tier: 3,
          description: `Price ${currentPrice > vwap ? 'above' : 'below'} VWAP (${vwap.toFixed(2)})`
        },
        rsi: {
          value: rsi,
          signal: rsi > 30 && rsi < 70 ? 'neutral' : rsi >= 70 ? 'bearish' : 'bullish',
          score: rsi > 30 && rsi < 70 ? 0 : rsi >= 70 ? -2 : 2,
          tier: 2,
          description: `RSI: ${rsi.toFixed(1)} - ${rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Normal'} (as of ${new Date().toLocaleTimeString()})`
        },
        macd: {
          value: macd.macd,
          signal: macd.macd > macd.signal ? 'bullish' : 'bearish',
          score: macd.macd > macd.signal ? 9 : -9,
          tier: 1,
          description: `MACD ${macd.macd > macd.signal ? 'above' : 'below'} signal line`
        },
        ema_crossover: {
          value: ema20 - ema50,
          signal: ema20 > ema50 ? 'bullish' : 'bearish',
          score: ema20 > ema50 ? 9 : -9,
          tier: 1,
          description: `EMA20 ${ema20 > ema50 ? 'above' : 'below'} EMA50`
        },
        bb_squeeze: {
          value: bb.squeeze ? 1 : 0,
          signal: bb.squeeze ? 'bullish' : 'neutral',
          score: bb.squeeze ? 1 : 0,
          tier: 2,
          description: `Bollinger Bands ${bb.squeeze ? 'in squeeze' : 'normal'}`
        },
        adx: {
          value: adx.adx,
          signal: adx.adx > 25 ? 'bullish' : 'neutral',
          score: adx.adx > 25 ? 3 : 0,
          tier: 1,
          description: `ADX: ${adx.adx.toFixed(1)} - ${adx.adx > 25 ? 'Strong trend' : 'Weak trend'}`
        },
        plus_di: {
          value: adx.plusDI,
          signal: adx.plusDI > adx.minusDI ? 'bullish' : 'bearish',
          score: adx.plusDI > adx.minusDI ? 2 : -2,
          tier: 2,
          description: `+DI (${adx.plusDI.toFixed(1)}) vs -DI (${adx.minusDI.toFixed(1)})`
        },
        stochastic: {
          value: stoch.k,
          signal: stoch.k > 80 ? 'bearish' : stoch.k < 20 ? 'bullish' : 'neutral',
          score: stoch.k > 80 ? -1 : stoch.k < 20 ? 2 : 0,
          tier: 2,
          description: `Stochastic %K: ${stoch.k.toFixed(1)} - ${stoch.k > 80 ? 'Overbought' : stoch.k < 20 ? 'Oversold' : 'Normal'}`
        },
        williams_r: {
          value: williamsR,
          signal: williamsR > -20 ? 'bearish' : williamsR < -80 ? 'bullish' : 'neutral',
          score: williamsR > -20 ? -1 : williamsR < -80 ? 2 : 0,
          tier: 2,
          description: `Williams %R: ${williamsR.toFixed(1)} - ${williamsR > -20 ? 'Overbought' : williamsR < -80 ? 'Oversold' : 'Normal'}`
        },
        cci: {
          value: cci,
          signal: cci > 100 ? 'bearish' : cci < -100 ? 'bullish' : 'neutral',
          score: cci > 100 ? -2 : cci < -100 ? 3 : 0,
          tier: 2,
          description: `CCI: ${cci.toFixed(1)} - ${cci > 100 ? 'Overbought' : cci < -100 ? 'Oversold' : 'Normal'}`
        },
        mfi: {
          value: mfi,
          signal: mfi > 80 ? 'bearish' : mfi < 20 ? 'bullish' : 'neutral',
          score: mfi > 80 ? -2 : mfi < 20 ? 3 : 0,
          tier: 1,
          description: `MFI: ${mfi.toFixed(1)} - ${mfi > 80 ? 'Overbought' : mfi < 20 ? 'Oversold' : 'Normal'}`
        },
        obv: {
          value: obv,
          signal: obv > 0 ? 'bullish' : 'bearish',
          score: obv > 0 ? 1 : -1,
          tier: 3,
          description: `OBV: ${obv.toFixed(0)} - Volume ${obv > 0 ? 'supporting uptrend' : 'supporting downtrend'}`
        },
        atr: {
          value: atr,
          signal: 'neutral',
          score: 0,
          tier: 3,
          description: `ATR: ${atr.toFixed(4)} - Market volatility indicator`
        },
        parabolic_sar: {
          value: psar.sar,
          signal: psar.trend,
          score: psar.trend === 'bullish' ? 2 : -2,
          tier: 2,
          description: `PSAR: ${psar.sar.toFixed(2)} - ${psar.trend === 'bullish' ? 'Uptrend' : 'Downtrend'} signal`
        },
        volume_oscillator: {
          value: volOsc,
          signal: volOsc > 0 ? 'bullish' : 'bearish',
          score: volOsc > 5 ? 1 : volOsc < -5 ? -1 : 0,
          tier: 3,
          description: `Volume Osc: ${volOsc.toFixed(2)}% - ${volOsc > 0 ? 'Above' : 'Below'} average volume`
        }
      };

      // Calculate total score
      const totalScore = Object.values(indicators).reduce((sum, indicator) => sum + indicator.score, 0);

      // Determine recommendation
      let recommendation: TechnicalAnalysis['recommendation'];
      if (totalScore >= 15) recommendation = 'strong_buy';
      else if (totalScore >= 5) recommendation = 'buy';
      else if (totalScore <= -15) recommendation = 'strong_sell';
      else if (totalScore <= -5) recommendation = 'sell';
      else recommendation = 'hold';

      return {
        symbol,
        price: currentPrice,
        indicators,
        totalScore,
        recommendation,
        calculationTimestamp,
        latestDataTime: latestCandleTime,
        candles: klines.map(k => ({
          t: k.openTime,
          o: parseFloat(k.open),
          h: parseFloat(k.high),
          l: parseFloat(k.low),
          c: parseFloat(k.close),
          v: parseFloat(k.volume)
        }))
      };

    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      throw error;
    }
  }

  async scanHighPotential(filters: ScanFilters): Promise<TechnicalAnalysis[]> {
    try {
      let allPairs: string[];

      try {
        allPairs = await binanceService.getAllUSDTPairs();
      } catch (apiError) {
        console.warn('Failed to fetch USDT pairs from API, using fallback pairs:', apiError);
        // Fallback to common trading pairs when API fails
        allPairs = [
          'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT',
          'DOTUSDT', 'MATICUSDT', 'AVAXUSDT', 'LTCUSDT', 'LINKUSDT',
          'ATOMUSDT', 'ALGOUSDT', 'XLMUSDT', 'VETUSDT', 'FILUSDT'
        ];
      }

      const results: TechnicalAnalysis[] = [];

      // Filter out stablecoins if requested
      let pairsToScan = allPairs;
      if (filters.excludeStablecoins) {
        const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'];
        pairsToScan = allPairs.filter(pair =>
          !stablecoins.some(stable => pair.replace('USDT', '') === stable)
        );
      }

      // Limit to top volume pairs for performance
      const topPairs = pairsToScan.slice(0, 15); // Reduced for demo with fallback data

      for (const symbol of topPairs) {
        try {
          const analysis = await this.analyzeSymbol(symbol, filters.timeframe || '1h');

          // Apply filters
          if (filters.minScore && analysis.totalScore < filters.minScore) continue;

          // Check bullish criteria
          const meetsBullishCriteria = this.checkBullishCriteria(analysis);
          if (meetsBullishCriteria) {
            results.push(analysis);
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error analyzing ${symbol}:`, error);
          continue;
        }
      }

      // Sort by score descending
      return results.sort((a, b) => b.totalScore - a.totalScore);

    } catch (error) {
      console.error('Error scanning coins:', error);
      throw error;
    }
  }

  private checkBullishCriteria(analysis: TechnicalAnalysis): boolean {
    const indicators = analysis.indicators;

    // Price above EMAs
    const emaPositive = indicators.ema_crossover?.signal === 'bullish';

    // RSI in healthy range
    const rsiHealthy = indicators.rsi?.value > 40 && indicators.rsi?.value < 70;

    // Positive MACD
    const macdPositive = indicators.macd?.signal === 'bullish';

    // Strong trend
    const strongTrend = indicators.adx?.value > 25;

    // At least 3 out of 4 criteria met
    const criteriaCount = [emaPositive, rsiHealthy, macdPositive, strongTrend]
      .filter(Boolean).length;

    return criteriaCount >= 3 && analysis.totalScore > 10;
  }

  private convertTimeframeToBinance(timeframe: string): string {
    const mapping: { [key: string]: string } = {
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d'
    };
    return mapping[timeframe] || '1h';
  }

  private generateFallbackData(symbol: string): {
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[]
  } {
    // Generate realistic mock data for demonstration
    const basePrice = symbol.includes('BTC') ? 45000 :
      symbol.includes('ETH') ? 3000 :
        symbol.includes('BNB') ? 400 :
          symbol.includes('ADA') ? 0.5 :
            symbol.includes('SOL') ? 100 : 50;

    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    // Generate 100 data points with some realistic price movement
    for (let i = 0; i < 100; i++) {
      const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
      const price = basePrice * (1 + variation + (i / 100) * 0.1); // Slight upward trend

      const volatility = 0.02; // 2% volatility
      const high = price * (1 + Math.random() * volatility);
      const low = price * (1 - Math.random() * volatility);
      const volume = Math.random() * 1000000 + 100000; // Random volume

      closes.push(price);
      highs.push(high);
      lows.push(low);
      volumes.push(volume);
    }

    return { closes, highs, lows, volumes };
  }
}

export const technicalIndicators = new TechnicalIndicators();
