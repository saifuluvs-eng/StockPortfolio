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

interface HighPotentialCoin {
  symbol: string;
  score: number;
  passes: boolean;
  passesDetail: {
    trend: boolean;
    rsi: boolean;
    macd: boolean;
    volume: boolean;
    obv: boolean;
    volatility: boolean;
  };
  price: number;
  rsi: number;
  volume: number;
  avgVolume: number;
  volatilityState: "low" | "normal" | "high";
  likely10PercentUpside?: boolean;
  upsideConditions?: {
    volatilityExpanding: boolean;
    momentumRising: boolean;
    trendRecovering: boolean;
    volumeImproved: boolean;
    resistanceRoom: boolean;
  };
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
    // console.log(`[TRACE] analyzeSymbol called for ${symbol} ${timeframe}`); // Reduce spam
    try {
      // Convert timeframe to Binance format
      const binanceInterval = this.convertTimeframeToBinance(timeframe);

      let closes: number[], highs: number[], lows: number[], volumes: number[], currentPrice: number;
      let klines: any[] = [];

      try {
        // Get candlestick data (increased to 500 for better EMA200 accuracy)
        klines = await binanceService.getKlineData(symbol, binanceInterval, 500);

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

        // Construct mock klines
        klines = closes.map((c, i) => ({
          openTime: Date.now() - (closes.length - 1 - i) * 3600000,
          open: c,
          high: highs[i],
          low: lows[i],
          close: c,
          volume: volumes[i]
        }));
      }

      // ... (rest of function)

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

      const result = {
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

      console.log(`[TechnicalIndicators] analyzeSymbol ${symbol} returning. Candles: ${result.candles?.length}`);
      return result;

    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      throw error;
    }
  }

  async scanTrendDip(limit: number = 20): Promise<any[]> {
    try {
      // 1. Get top volume pairs to ensure liquidity
      const topPairs = await binanceService.getTopVolumePairs(50);
      console.log(`[TrendDip] Scanning ${topPairs.length} pairs for Uptrend > EMA200`);
      const results: any[] = [];

      const safeGetKline = async (sym: string, interval: string) => {
        try {
          return await binanceService.getKlineData(sym, interval, 30);
        } catch (e) {
          // console.warn(`[TrendDip] Failed to fetch ${interval} for ${sym}`);
          return [];
        }
      };

      // Use efficient batching
      const batchSize = 5;
      for (let i = 0; i < topPairs.length; i += batchSize) {
        const batch = topPairs.slice(i, i + batchSize);

        const promises = batch.map(async (pair) => {
          try {
            // Filter Stablecoins
            if (['USDC', 'FDUSD', 'TUSD', 'USDP', 'USDE', 'DAI', 'BUSD', 'EUR', 'XUSD'].some(s => pair.symbol.startsWith(s))) return null;

            // 2. Primary Trend Check (using 4h for robust long-term trend)
            // Fetch 4h candles
            const analysis = await this.analyzeSymbol(pair.symbol, '4h');
            const closes = analysis.candles?.map(c => c.c) || [];

            if (closes.length < 200) {
              // console.log(`[TrendDip] Not enough data for ${pair.symbol} (len=${closes.length})`);
              return null;
            }

            const currentPrice = analysis.price;
            const ema200 = this.calculateEMA(closes, 200);

            // CHECK: Long Term Uptrend
            if (currentPrice > ema200) {
              // console.log(`[TrendDip] FOUND UPTREND: ${pair.symbol} ($${currentPrice} > $${ema200})`);

              // 3. Fetch Multi-Timeframe Data (Only if uptrend)
              const rsi4h = analysis.indicators.rsi.value;

              // Fetch others in parallel (Result is never null now)
              const [k15m, k1h, k1d, k1w] = await Promise.all([
                safeGetKline(pair.symbol, '15m'),
                safeGetKline(pair.symbol, '1h'),
                safeGetKline(pair.symbol, '1d'),
                safeGetKline(pair.symbol, '1w')
              ]);

              const extractRSI = (k: any[]) => {
                if (!k || k.length < 15) return 50; // Default Neutral if missing
                return this.calculateRSI(k.map(x => parseFloat(x.close)), 14);
              };

              const rsiObj = {
                m15: extractRSI(k15m),
                h1: extractRSI(k1h),
                h4: rsi4h,
                d1: extractRSI(k1d),
                w1: extractRSI(k1w)
              };

              return {
                symbol: pair.symbol,
                price: currentPrice,
                rsi: rsiObj,
                ema200: ema200,
                volume: parseFloat(pair.quoteVolume),
                priceChangePercent: parseFloat(pair.priceChangePercent),
                timestamp: new Date().toISOString()
              };
            } else {
              // console.log(`[TrendDip] Skip ${pair.symbol}: Downtrend`);
            }
          } catch (err) {
            console.error(`[TrendDip] Error processing ${pair.symbol}:`, err);
          }
          return null;
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults.filter(Boolean));

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`[TrendDip] Found ${results.length} uptrending coins.`);
      // Sort by 1h RSI ascending (Standard "Dip" metric)
      return results.sort((a, b) => a.rsi.h1 - b.rsi.h1);
    } catch (error) {
      console.error('Error scanning for Trend+Dip:', error);
      return [];
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

    // Generate 500 data points (Increased from 100 to support EMA200 calculation)
    for (let i = 0; i < 500; i++) {
      const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
      const price = basePrice * (1 + variation + (i / 100) * 0.1); // Slight upward trend

      const volatility = 0.02; // 2% volatility
      const high = price * (1 + Math.random() * volatility);
      const low = price * (1 - Math.random() * volatility);
      let volume = Math.random() * 1000000 + 100000; // Random volume

      // Inject fake spikes in the last candle for demo purposes (30% chance)
      if (i === 499 && Math.random() > 0.7) {
        volume *= (2 + Math.random() * 3); // 2x-5x spike
      }

      closes.push(price);
      highs.push(high);
      lows.push(low);
      volumes.push(volume);
    }

    return { closes, highs, lows, volumes };
  }
  // --- User's High Potential Logic ---

  private calculateOBVSlope(obvValues: number[]): number {
    if (obvValues.length < 5) return 0;
    const recent = obvValues.slice(-5);
    // Simple slope: (last - first) / length
    return (recent[recent.length - 1] - recent[0]) / recent.length;
  }

  private getVolatilityState(bb: { upper: number; lower: number; middle: number }): "low" | "normal" | "high" {
    const width = (bb.upper - bb.lower) / bb.middle;
    if (width < 0.05) return "low"; // Compressed
    if (width > 0.15) return "high"; // Expanded
    return "normal";
  }

  private findNearestResistance(highs: number[], currentPrice: number): number | null {
    // Simple local maxima logic over last 50 periods
    const lookback = 50;
    if (highs.length < lookback) return null;

    const recentHighs = highs.slice(-lookback);
    // Filter for peaks (higher than neighbors)
    const peaks: number[] = [];
    for (let i = 2; i < recentHighs.length - 2; i++) {
      if (recentHighs[i] > recentHighs[i - 1] &&
        recentHighs[i] > recentHighs[i - 2] &&
        recentHighs[i] > recentHighs[i + 1] &&
        recentHighs[i] > recentHighs[i + 2]) {
        peaks.push(recentHighs[i]);
      }
    }

    // Find lowest peak that is above current price
    const resistanceLevels = peaks.filter(p => p > currentPrice).sort((a, b) => a - b);
    return resistanceLevels.length > 0 ? resistanceLevels[0] : null;
  }

  public evaluateLikely10PercentUpside(analysis: TechnicalAnalysis, avgVolume: number): { likely: boolean; conditions: any } {
    const indicators = analysis.indicators;
    const price = analysis.price;
    const closes = analysis.candles?.map(c => c.c) || [];
    const highs = analysis.candles?.map(c => c.h) || [];
    const lows = analysis.candles?.map(c => c.l) || [];
    const volumes = analysis.candles?.map(c => c.v) || [];

    if (closes.length < 50) return { likely: false, conditions: {} };

    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const bb = this.calculateBollingerBands(closes);
    const volatilityState = this.getVolatilityState(bb);
    const atr = this.calculateATR(highs, lows, closes); // Current ATR
    // Calculate previous ATRs for rising check (simplified: compare current to 3 periods ago)
    const prevAtr = this.calculateATR(highs.slice(0, -3), lows.slice(0, -3), closes.slice(0, -3));

    const macd = this.calculateMACD(closes);
    // Need previous MACD histogram for "rising" check
    const prevMacd = this.calculateMACD(closes.slice(0, -1));

    const rsi = indicators.rsi.value;
    const stoch = this.calculateStochastic(highs, lows, closes);
    const adx = this.calculateADX(highs, lows, closes);

    const volume = volumes[volumes.length - 1];
    const prevVolume = volumes[volumes.length - 2];
    const obvSlope = this.calculateOBVSlope(closes.map((c, i) => {
      // Reconstruct OBV array locally or use existing method if refactored. 
      // For now, re-calculate simple OBV slope on last few candles
      return 0; // Placeholder, using simplified logic below
    }));
    // Re-calc OBV slope properly
    let localObv = 0;
    const localObvValues = [0];
    const last6Closes = closes.slice(-6);
    const last6Vols = volumes.slice(-6);
    for (let i = 1; i < last6Closes.length; i++) {
      if (last6Closes[i] > last6Closes[i - 1]) localObv += last6Vols[i];
      else if (last6Closes[i] < last6Closes[i - 1]) localObv -= last6Vols[i];
      localObvValues.push(localObv);
    }
    const calculatedObvSlope = this.calculateOBVSlope(localObvValues);


    // Condition A: Volatility Expanding
    // volatility_state == "high" OR ATR rising OR BB squeeze released (squeeze was true recently, now false - simplified to just current state check or ATR)
    const condA = volatilityState === "high" || atr > prevAtr || (bb.squeeze === false && (bb.upper - bb.lower) / bb.middle < 0.15); // Loose interpretation

    // Condition B: Momentum Rising
    // MACD hist > prev hist OR RSI 45-80 OR Stoch %K > %D (<90)
    const condB = (macd.histogram > prevMacd.histogram) || (rsi >= 45 && rsi <= 80) || (stoch.k > stoch.d && stoch.k < 90);

    // Condition C: Trend Bullish or Recovering
    // price > EMA20 OR EMA20 > EMA50 OR ADX >= 20 and +DI > -DI
    const condC = (price > ema20) || (ema20 > ema50) || (adx.adx >= 20 && adx.plusDI > adx.minusDI);

    // Condition D: Volume Improved
    // volume > avgVolume OR OBV slope positive OR Green > Red (last candle close > open and vol > prev vol)
    const isGreen = closes[closes.length - 1] > closes[closes.length - 1 - 1]; // simplified open check
    const condD = (volume > avgVolume) || (calculatedObvSlope > 0) || (isGreen && volume > prevVolume);

    // Condition E: Room to Rise
    const resistance = this.findNearestResistance(highs, price);
    const condE = resistance !== null && resistance >= price * 1.10;

    const conditions = {
      volatilityExpanding: condA,
      momentumRising: condB,
      trendRecovering: condC,
      volumeImproved: condD,
      resistanceRoom: condE
    };

    const trueCount = Object.values(conditions).filter(Boolean).length;

    return { likely: trueCount >= 4, conditions };
  }

  public evaluateHighPotentialUserLogic(analysis: TechnicalAnalysis, avgVolume: number): { score: number; passes: boolean; details: any; passesDetail: any } {
    let score = 0;
    const indicators = analysis.indicators;
    const price = analysis.price;

    // Extract values
    const closes = analysis.candles?.map(c => c.c) || [];
    const volumes = analysis.candles?.map(c => c.v) || [];

    if (closes.length < 50) return { score: 0, passes: false, details: {}, passesDetail: {} };

    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const rsi = indicators.rsi.value;
    const macdData = this.calculateMACD(closes);

    // OBV Slope
    const last5Closes = closes.slice(-6);
    const last5Vols = volumes.slice(-6);
    let localObv = 0;
    const localObvValues = [0];
    for (let i = 1; i < last5Closes.length; i++) {
      if (last5Closes[i] > last5Closes[i - 1]) localObv += last5Vols[i];
      else if (last5Closes[i] < last5Closes[i - 1]) localObv -= last5Vols[i];
      localObvValues.push(localObv);
    }
    const obvSlope = this.calculateOBVSlope(localObvValues);

    const volume = volumes[volumes.length - 1];
    // const avgVolume = this.calculateSMA(volumes, 20); // Already passed as argument

    const bb = this.calculateBollingerBands(closes);
    const volatility = this.getVolatilityState(bb);

    // --- Scoring & Detailed Pass/Fail ---
    const passesDetail = {
      trend: false,
      rsi: false,
      macd: false,
      volume: false,
      obv: false,
      volatility: false
    };

    // 1. Trend
    if (price > ema20) {
      passesDetail.trend = true;
      score += 1;
    }
    if (ema20 > ema50) {
      passesDetail.trend = true;
      score += 1;
    }

    // 2. RSI Optimal Range (Widened to capture momentum)
    if (rsi >= 45 && rsi <= 80) {
      passesDetail.rsi = true;
      score += 2;
    }

    // 3. MACD Histogram rising
    if (macdData.histogram > 0) {
      passesDetail.macd = true;
      score += 1;
    }

    // 4. Volume expansion (Relaxed: current > 80% avg OR prev > avg)
    const prevVolume = volumes[volumes.length - 2] || 0;
    if (volume > avgVolume * 0.8 || prevVolume > avgVolume) {
      passesDetail.volume = true;
      score += 2;
    }

    // 5. OBV rising
    if (obvSlope > 0) {
      passesDetail.obv = true;
      score += 1;
    }

    // 6. Volatility healthy
    if (volatility === "normal" || volatility === "high") {
      passesDetail.volatility = true;
      score += 1;
    }

    // 7. Super Momentum Bonus (New)
    // If RSI is high (>70) AND Volume is very high (>1.5x avg), give extra points
    if (rsi > 70 && volume > avgVolume * 1.5) {
      score += 2;
    }

    const passes = score >= 5;

    return {
      score,
      passes,
      passesDetail,
      details: {
        price, ema20, ema50, rsi, macdHist: macdData.histogram, obvSlope, volume, avgVolume, volatility
      }
    };
  }

  async getMarketRSI(limit: number = 50): Promise<any[]> {
    try {
      console.log(`[getMarketRSI] Starting scan for top ${limit} pairs...`);
      // 1. Get top pairs by volume
      const allPairs = await binanceService.getAllUSDTPairs();
      console.log(`[getMarketRSI] Found ${allPairs.length} total USDT pairs.`);

      // In a real app, we would sort by 24h volume here. 
      // For now, we take the top N from the list which is usually sorted by importance/volume by Binance
      const pairs = allPairs.slice(0, limit);
      console.log(`[getMarketRSI] Processing top ${pairs.length} pairs: ${pairs.slice(0, 5).join(', ')}...`);

      const results: any[] = [];

      // 2. Fetch data and calc RSI for each (in parallel batches to be nice to API)
      const batchSize = 10;
      for (let i = 0; i < pairs.length; i += batchSize) {
        const batch = pairs.slice(i, i + batchSize);
        // console.log(`[getMarketRSI] Processing batch ${i / batchSize + 1}/${Math.ceil(pairs.length / batchSize)}`);

        const promises = batch.map(async (symbol) => {
          try {
            // Fetch just enough candles for RSI (14 + buffer)
            const klines = await binanceService.getKlineData(symbol, '4h', 30);
            if (!klines || klines.length < 20) {
              // console.warn(`[getMarketRSI] Insufficient klines for ${symbol}`);
              return null;
            }

            const closes = klines.map(k => parseFloat(k.close));
            const currentPrice = closes[closes.length - 1];
            const rsi = this.calculateRSI(closes, 14);

            // Calculate 24h change (approximate from these candles or fetch ticker)
            // Using last candle vs first candle of the set as a proxy for recent trend
            const openPrice = parseFloat(klines[0].open);
            const change = ((currentPrice - openPrice) / openPrice) * 100;

            return {
              symbol: symbol.replace('USDT', ''),
              rsi: parseFloat(rsi.toFixed(2)),
              price: currentPrice,
              change: parseFloat(change.toFixed(2))
            };
          } catch (e) {
            console.error(`[getMarketRSI] Error processing ${symbol}:`, e);
            return null;
          }
        });

        const batchResults = await Promise.all(promises);
        const validResults = batchResults.filter(r => r !== null);
        results.push(...validResults);

        // Small delay between batches
        await new Promise(r => setTimeout(r, 50));
      }

      console.log(`[getMarketRSI] Completed. Returning ${results.length} results.`);
      // Sort by RSI descending
      return results.sort((a, b) => b.rsi - a.rsi);
    } catch (error) {
      console.error("Error getting market RSI:", error);
      return [];
    }
  }



  async scanHighPotentialUser(): Promise<HighPotentialCoin[]> {
    // 1. Get top 50 gainers from Binance
    let pairs: string[] = [];
    try {
      const topGainers = await binanceService.getTopGainers(50);
      pairs = topGainers.map(t => t.symbol);
    } catch (error) {
      console.error("Error fetching top gainers, falling back to default list", error);
      pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT', 'NEARUSDT', 'FILUSDT', 'INJUSDT', 'OPUSDT', 'ARBUSDT'];
    }

    const results: HighPotentialCoin[] = [];

    // 2. Analyze each symbol
    for (const symbol of pairs) {
      try {
        const analysis = await this.analyzeSymbol(symbol, '4h');

        if (!analysis.candles || analysis.candles.length < 50) continue;

        const volumes = analysis.candles.map(c => c.v);
        const avgVolume = this.calculateSMA(volumes, 20);

        const { score, passes, details, passesDetail } = this.evaluateHighPotentialUserLogic(analysis, avgVolume);

        if (score > 0) {
          results.push({
            symbol,
            score,
            passes,
            passesDetail,
            price: analysis.price,
            rsi: details.rsi,
            volume: details.volume,
            avgVolume: details.avgVolume,
            volatilityState: details.volatility,
            likely10PercentUpside: false, // Default
            upsideConditions: undefined
          });

          // Calculate Likely +10% Upside
          const upsideAnalysis = this.evaluateLikely10PercentUpside(analysis, avgVolume);
          results[results.length - 1].likely10PercentUpside = upsideAnalysis.likely;
          results[results.length - 1].upsideConditions = upsideAnalysis.conditions;
        }
        // Rate limit
        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        console.error(`Error scanning ${symbol}:`, err);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  getDebugHighPotentialCoins(): HighPotentialCoin[] {
    return [
      {
        symbol: "TEST-BTC",
        score: 10,
        passes: true,
        passesDetail: { trend: true, rsi: true, macd: true, volume: true, obv: true, volatility: true },
        price: 95000,
        rsi: 75,
        volume: 5000000,
        avgVolume: 1000000,
        volatilityState: "high",
        likely10PercentUpside: true,
        upsideConditions: { volatilityExpanding: true, momentumRising: true, trendRecovering: true, volumeImproved: true, resistanceRoom: true }
      },
      {
        symbol: "TEST-ETH",
        score: 8,
        passes: true,
        passesDetail: { trend: true, rsi: true, macd: true, volume: true, obv: false, volatility: true },
        price: 4500,
        rsi: 60,
        volume: 2000000,
        avgVolume: 1500000,
        volatilityState: "normal",
        likely10PercentUpside: true,
        upsideConditions: { volatilityExpanding: false, momentumRising: true, trendRecovering: true, volumeImproved: true, resistanceRoom: true }
      }
    ];
  }



  async scanVolumeSpike(limit: number = 20): Promise<any[]> {
    try {
      // Increased scan limit to find more opportunities
      const topPairs = await binanceService.getTopVolumePairs(75);
      const results: any[] = [];
      const batchSize = 5;

      for (let i = 0; i < topPairs.length; i += batchSize) {
        const batch = topPairs.slice(i, i + batchSize);
        const promises = batch.map(async (pair) => {
          try {
            const analysis = await this.analyzeSymbol(pair.symbol, '1h');
            const candles = analysis.candles || [];
            if (candles.length < 25) return null;

            const currentVol = candles[candles.length - 1].v;
            const prevVols = candles.slice(candles.length - 21, candles.length - 1).map(c => c.v);
            const avgVol = prevVols.reduce((a, b) => a + b, 0) / prevVols.length;

            const isSpike = currentVol > (avgVol * 1.5);
            const isGreen = candles[candles.length - 1].c > candles[candles.length - 1].o;

            if (isSpike && isGreen) {
              return {
                symbol: pair.symbol,
                price: analysis.price,
                volume: currentVol,
                avgVolume: avgVol,
                volumeMultiple: currentVol / avgVol,
                priceChangePercent: parseFloat(pair.priceChangePercent),
                timestamp: new Date().toISOString()
              };
            }
          } catch (err) { }
          return null;
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults.filter(Boolean));
      }

      return results.sort((a, b) => b.volumeMultiple - a.volumeMultiple);
    } catch (error) {
      console.error('Error scanning for VolumeSpike:', error);
      return [];
    }
  }

  async scanSupportResistance(limit: number = 20, lookbackDays: number = 8): Promise<any[]> {
    console.log(`[TechnicalIndicators] scanSupportResistance called. Lookback: ${lookbackDays}`);
    try {
      const topPairs = await binanceService.getTopVolumePairs(75);
      const results: any[] = [];
      const batchSize = 10; // slightly increased batch size

      // Calculate candles needed: (Days * 24h) / 4h timeframe = 6 candles per day
      const candlesNeeded = Math.ceil(lookbackDays * 6);

      for (let i = 0; i < topPairs.length; i += batchSize) {
        const batch = topPairs.slice(i, i + batchSize);
        const promises = batch.map(async (pair) => {
          try {
            // Filter Stablecoins
            if (['USDC', 'FDUSD', 'TUSD', 'USDP', 'USDE', 'DAI', 'BUSD', 'EUR', 'XUSD', 'BFUSD'].some(s => pair.symbol.startsWith(s))) return null;

            const analysis = await this.analyzeSymbol(pair.symbol, '4h');
            const candles = analysis.candles || [];
            if (candles.length < candlesNeeded) return null;

            const currentPrice = analysis.price;
            // Analyze requested lookback period
            const recent = candles.slice(-candlesNeeded);

            // For Breakout: Look at Highs/Lows excluding the very last closed candle to see if we just broke it? 
            // Or just generic High/Low of the period.
            // Let's use the standard period High/Low.

            const recentLows = recent.map(c => c.l);
            const recentHighs = recent.map(c => c.h);
            const minLow = Math.min(...recentLows);
            const maxHigh = Math.max(...recentHighs);

            let type = '';
            let level = 0;
            let distance = 0;
            let tests = 0;
            let riskReward: number | null = null;

            const rsiVal = analysis.indicators.rsi.value;
            const badges: string[] = [];

            // Define Previous Candles for Breakout Calculations
            const previousCandles = recent.slice(0, -1);
            if (previousCandles.length > 5) {
              const prevHigh = Math.max(...previousCandles.map(c => c.h));
              const prevLow = Math.min(...previousCandles.map(c => c.l));

              // Distance to levels (Positive = Past the level, Negative = Approaching)
              const distAboveRes = (currentPrice - prevHigh) / prevHigh;
              const distBelowSup = (prevLow - currentPrice) / prevLow;

              // UNIFIED LOGIC: Check for both Bounce and Breakout
              // Priority: Breakout/Breakdown > Support/Resistance

              // 1. Breakout/Breakdown Checks (Active Moves)
              if (distAboveRes > -0.02 && distAboveRes < 0.15) {
                type = 'Breakout';
                level = prevHigh;
                distance = distAboveRes;
                tests = previousCandles.filter(c => Math.abs((c.h - prevHigh) / prevHigh) < 0.01).length;
                if (distAboveRes < 0) badges.push('Approaching'); else badges.push('Confirmed');
                if (rsiVal > 50) badges.push('High Momentum');
                if (rsiVal > 75) badges.push('Overextended');
              }
              else if (distBelowSup > -0.02 && distBelowSup < 0.15) {
                type = 'Breakdown';
                level = prevLow;
                distance = distBelowSup;
                tests = previousCandles.filter(c => Math.abs((c.l - prevLow) / prevLow) < 0.01).length;
                if (distBelowSup < 0) badges.push('Approaching'); else badges.push('Confirmed');
                if (rsiVal < 50) badges.push('Bearish Momentum');
                if (rsiVal < 25) badges.push('Oversold Dump');
              }

              // 2. Bounce Checks (Support/Resistance Tests) - Only if not already a Breakout
              if (!type) {
                const distToSupport = Math.abs((currentPrice - minLow) / minLow);
                const distToResistance = Math.abs((maxHigh - currentPrice) / currentPrice);

                if (distToSupport < 0.05) {
                  type = 'Support';
                  level = minLow;
                  distance = distToSupport;
                  tests = recent.filter(c => Math.abs((c.l - minLow) / minLow) < 0.01).length;

                  // R:R Calculation
                  const risk = distance;
                  const reward = (maxHigh - currentPrice) / currentPrice;
                  if (risk > 0.001) riskReward = parseFloat((reward / risk).toFixed(2));
                  else riskReward = 10;

                  if (rsiVal < 40 && distance < 0.03) badges.push('Golden Setup');
                  if (rsiVal < 30) badges.push('Oversold');
                  if (tests >= 3) badges.push('Strong Support');
                  if (tests < 2) badges.push('Weak Level');
                }
                else if (distToResistance < 0.05) {
                  type = 'Resistance';
                  level = maxHigh;
                  distance = distToResistance;
                  tests = recent.filter(c => Math.abs((c.h - maxHigh) / maxHigh) < 0.01).length;
                  if (rsiVal > 70) badges.push('Overbought');
                  if (tests >= 3) badges.push('Strong Res');
                }
              }

              // debug log
              // console.log(`[DEBUG] ${pair.symbol} Mode:${strategy} Type:${type} Price:${currentPrice} Level:${level}`);

              if (type) {
                return {
                  symbol: pair.symbol,
                  price: currentPrice,
                  type,
                  level,
                  target: (type === 'Support' ? maxHigh : type === 'Resistance' ? minLow : type === 'Breakout' ? level * 1.2 : level * 0.8),
                  distancePercent: distance * 100,
                  tests,
                  riskReward,
                  rsi: rsiVal,
                  badges,
                  volume: parseFloat(pair.quoteVolume),
                  timestamp: new Date().toISOString(),
                  _version: 'v2'
                };
              }
            }
          } catch (err) { }
          return null;
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults.filter(Boolean));

        // Rate limit
        await new Promise(r => setTimeout(r, 100));
      }

      // Sort by Closeness (Primary) but allow filtering by R:R on frontend
      return results.sort((a, b) => a.distancePercent - b.distancePercent);
    } catch (error) {
      console.error('Error scanning for SR:', error);
      return [];
    }
  }

}

export const technicalIndicators = new TechnicalIndicators();
