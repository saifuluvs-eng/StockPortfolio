// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Import combined signal builder
import { buildTechnicalJSON } from "./combinedSignals";

/**
 * Helper function to call Gemini API with retry logic for rate limiting
 */
async function callGemini(prompt: string, retries = 3): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
        signal: controller.signal,
      });

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`[Gemini] Rate limited (429). Retry ${attempt + 1}/${retries} after ${waitTime}ms`);

        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry
        }
        // If last attempt, fall through to throw error
      }

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `Gemini API error: ${response.status} - ${errorText}`;
        console.error(`[Gemini] ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const json = await response.json();
      const result = json.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!result) {
        throw new Error("No response from Gemini API");
      }

      return result;
    } catch (error) {
      // If this was the last attempt or a non-retryable error, throw
      if (attempt === retries - 1) {
        throw error;
      }
      // Otherwise, continue to next retry
      console.warn(`[Gemini] Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Failed to get response from Gemini API after retries");
}

// Binance API types
interface BinanceTicker {
  symbol: string;
  priceChangePercent: string;
  quoteVolume: string;
  lowPrice: string;
  highPrice: string;
}

export interface MarketSentimentAnalysis {
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  reasoning: string;
  signal: string;
  keyFactors: string[];
  timeframe: string;
}

export interface AIMarketPrediction {
  prediction: "bullish" | "bearish" | "neutral";
  confidence: number;
  priceTarget?: number;
  timeframe: string;
  reasoning: string;
  riskFactors: string[];
  supportLevels?: number[];
  resistanceLevels?: number[];
}

export interface AICryptoInsight {
  symbol: string;
  analysisType: "sentiment" | "pattern" | "prediction" | "recommendation";
  signal: "bullish" | "bearish" | "neutral";
  confidence: number;
  reasoning: string;
  recommendation: string;
  timeframe: string;
  metadata: {
    technicalScore?: number;
    volumeAnalysis?: string;
    marketCondition?: string;
    riskLevel?: "low" | "medium" | "high";
  };
}

export class AIService {

  /**
   * Analyze market sentiment based on price data and technical indicators
   */
  async analyzeMarketSentiment(
    symbol: string,
    priceData: number[],
    technicalData: any
  ): Promise<MarketSentimentAnalysis> {
    try {
      const prompt = `You are a professional cryptocurrency market analyst with expertise in technical analysis and market sentiment. Always respond with valid JSON format only, no other text.

Analyze the market sentiment for ${symbol} based on the following data:

Recent Price Data: ${priceData.slice(-10).join(", ")}
Current Price: ${priceData[priceData.length - 1]}
Technical Indicators: ${JSON.stringify(technicalData, null, 2)}

Provide a comprehensive market sentiment analysis. Do NOT repeat indicator numbers, summarize meaning only.

Respond with ONLY valid JSON in this exact format:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.85,
  "reasoning": "detailed explanation here",
  "signal": "BUY|SELL|HOLD with specific entry/exit levels",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "timeframe": "1h|4h|1d|1w"
}`;

      const responseText = await callGemini(prompt);
      const result = JSON.parse(responseText);

      return {
        sentiment: result.sentiment,
        confidence: Math.max(0, Math.min(1, result.confidence)),
        reasoning: result.reasoning,
        signal: result.signal,
        keyFactors: result.keyFactors || [],
        timeframe: result.timeframe || "4h"
      };
    } catch (error) {
      console.error("Error analyzing market sentiment:", error);

      // Fallback analysis based on technical data
      const rsi = technicalData.rsi?.value || 50;
      const macdSignal = technicalData.macd?.signal || "neutral";

      // Enhanced technical analysis fallback
      const ema = technicalData.ema20?.value || 0;
      const vwap = technicalData.vwap?.value || 0;
      const currentPrice = priceData[priceData.length - 1];
      const bollinger = technicalData.bollingerBands || {};
      const adx = technicalData.adx?.value || 25;

      const signals: string[] = [];
      let bullishCount = 0;
      let bearishCount = 0;

      // RSI Analysis
      if (rsi > 70) { signals.push("RSI overbought"); bearishCount++; }
      else if (rsi > 60) { signals.push("RSI bullish momentum"); bullishCount++; }
      else if (rsi < 30) { signals.push("RSI oversold opportunity"); bullishCount++; }
      else if (rsi < 40) { signals.push("RSI bearish pressure"); bearishCount++; }

      // Price vs VWAP
      if (currentPrice > vwap * 1.02) { signals.push("Trading above VWAP with strength"); bullishCount++; }
      else if (currentPrice < vwap * 0.98) { signals.push("Trading below VWAP - weak"); bearishCount++; }

      // EMA Trend
      if (ema && currentPrice > ema * 1.01) { signals.push("Above 20-period EMA"); bullishCount++; }
      else if (ema && currentPrice < ema * 0.99) { signals.push("Below 20-period EMA"); bearishCount++; }

      // MACD Analysis
      if (macdSignal === "bullish") { signals.push("MACD bullish crossover"); bullishCount++; }
      else if (macdSignal === "bearish") { signals.push("MACD bearish crossover"); bearishCount++; }

      // ADX Trend Strength
      if (adx > 25) { signals.push(`Strong trend (ADX: ${adx.toFixed(1)})`); }
      else { signals.push("Weak trend - range-bound market"); }

      const netSignal = bullishCount - bearishCount;
      const sentiment = netSignal > 1 ? "bullish" : netSignal < -1 ? "bearish" : "neutral";
      const confidence = Math.min(0.85, 0.5 + Math.abs(netSignal) * 0.1 + (adx > 25 ? 0.1 : 0));

      const signalAction = sentiment === "bullish" ?
        `BUY above ${(currentPrice * 1.002).toFixed(4)} with target ${(currentPrice * 1.02).toFixed(4)}` :
        sentiment === "bearish" ?
          `SELL below ${(currentPrice * 0.998).toFixed(4)} with target ${(currentPrice * 0.98).toFixed(4)}` :
          `HOLD - range ${(currentPrice * 0.995).toFixed(4)} - ${(currentPrice * 1.005).toFixed(4)}`;

      return {
        sentiment,
        confidence,
        reasoning: `Multi-factor technical analysis: ${signals.join(', ')}. Net bias: ${netSignal > 0 ? '+' : ''}${netSignal} (${bullishCount} bullish, ${bearishCount} bearish signals)`,
        signal: signalAction,
        keyFactors: signals.slice(0, 5),
        timeframe: "4h"
      };
    }
  }

  /**
   * Generate AI-powered price predictions
   */
  async generatePricePrediction(
    symbol: string,
    historicalData: any,
    marketContext: any
  ): Promise<AIMarketPrediction> {
    try {
      const prompt = `You are a professional cryptocurrency price analyst with expertise in market predictions and risk assessment. Always respond with valid JSON format only, no other text.

Provide a price prediction for ${symbol} based on:

Historical Data: ${JSON.stringify(historicalData)}
Market Context: ${JSON.stringify(marketContext)}
Current Price: ${historicalData.currentPrice}

Analyze and predict the following. Do NOT repeat data values, summarize analysis only.

Respond with ONLY valid JSON in this exact format:
{
  "prediction": "bullish|bearish|neutral",
  "confidence": 0.75,
  "priceTarget": 45000,
  "timeframe": "24h|7d|30d",
  "reasoning": "detailed prediction reasoning",
  "riskFactors": ["risk1", "risk2"],
  "supportLevels": [40000, 38000],
  "resistanceLevels": [46000, 48000]
}`;

      const responseText = await callGemini(prompt);
      const result = JSON.parse(responseText);

      return {
        prediction: result.prediction,
        confidence: Math.max(0, Math.min(1, result.confidence)),
        priceTarget: result.priceTarget,
        timeframe: result.timeframe || "24h",
        reasoning: result.reasoning,
        riskFactors: result.riskFactors || [],
        supportLevels: result.supportLevels || [],
        resistanceLevels: result.resistanceLevels || []
      };
    } catch (error) {
      console.error("Error generating price prediction:", error);

      // Enhanced technical prediction fallback
      const priceHistory = historicalData.priceHistory || [];
      const volumeHistory = historicalData.volumeHistory || [];
      const currentPrice = historicalData.currentPrice || 0;

      if (priceHistory.length < 10) {
        return {
          prediction: "neutral",
          confidence: 0.4,
          timeframe: "24h",
          reasoning: "Insufficient data for technical prediction",
          riskFactors: ["Limited historical data"]
        };
      }

      // Calculate technical metrics
      const recentPrices = priceHistory.slice(-10);
      const priceChange = ((currentPrice - recentPrices[0]) / recentPrices[0]) * 100;
      const volatility = this.calculateVolatility(recentPrices);
      const momentum = this.calculateMomentum(recentPrices);
      const volumeTrend = volumeHistory.length > 5 ? this.calculateVolumeTrend(volumeHistory.slice(-5)) : 0;

      // Support and resistance levels
      const highs = recentPrices.filter((p: number) => p > currentPrice * 0.99);
      const lows = recentPrices.filter((p: number) => p < currentPrice * 1.01);
      const resistance = highs.length > 0 ? Math.max(...highs) : currentPrice * 1.05;
      const support = lows.length > 0 ? Math.min(...lows) : currentPrice * 0.95;

      // Prediction logic
      let prediction = "neutral";
      let confidence = 0.6;
      let priceTarget = currentPrice;

      if (momentum > 0.02 && volumeTrend > 0.1 && priceChange > 5) {
        prediction = "bullish";
        confidence = Math.min(0.85, 0.6 + momentum * 10);
        priceTarget = currentPrice * (1 + momentum * 2);
      } else if (momentum < -0.02 && priceChange < -5) {
        prediction = "bearish";
        confidence = Math.min(0.85, 0.6 + Math.abs(momentum) * 10);
        priceTarget = currentPrice * (1 + momentum * 2);
      }

      const riskFactors: string[] = [];
      if (volatility > 0.1) riskFactors.push("High volatility environment");
      if (Math.abs(priceChange) > 15) riskFactors.push("Extreme price movement");
      if (volumeTrend < -0.2) riskFactors.push("Declining volume trend");
      if (riskFactors.length === 0) riskFactors.push("Standard market risks");

      return {
        prediction: prediction as "bullish" | "bearish" | "neutral",
        confidence,
        priceTarget: Math.round(priceTarget * 100) / 100,
        timeframe: "24h",
        reasoning: `Technical analysis: ${momentum > 0 ? 'positive' : momentum < 0 ? 'negative' : 'neutral'} momentum (${(momentum * 100).toFixed(2)}%), volatility ${(volatility * 100).toFixed(1)}%, price change ${priceChange.toFixed(1)}%`,
        riskFactors,
        supportLevels: [support * 0.98, support],
        resistanceLevels: [resistance, resistance * 1.02]
      };
    }
  }


  /**
   * Convert 4 summary states into natural language for Gemini
   * This ensures Gemini NEVER sees raw indicator names
   */
  private convertSummaryToNarrative(states: any): string {
    const { trend_bias, momentum_state, volume_context, volatility_state } = states;

    // Translate trend_bias
    const trendDescriptions: Record<string, string> = {
      bullish: "Price is strengthening with buyers in control. Key levels are being tested upward.",
      bearish: "Price is weakening with sellers in control. Key levels are being tested downward.",
      neutral: "Price is consolidating without clear directional bias. Buyers and sellers are balanced."
    };

    // Translate momentum_state
    const momentumDescriptions: Record<string, string> = {
      strong: "Momentum is accelerating in the direction of the trend.",
      weak: "Momentum is fading and directional moves are losing strength.",
      oversold: "Extreme selling pressure exists - potential capitulation conditions.",
      overbought: "Extreme buying pressure exists - potential exhaustion conditions.",
      neutral: "Momentum is neutral without strong directional bias."
    };

    // Translate volume_context
    const volumeDescriptions: Record<string, string> = {
      increasing: "Trading activity is elevated with strong institutional participation.",
      decreasing: "Trading activity is subdued with weak participation.",
      neutral: "Trading activity is normal and average."
    };

    // Translate volatility_state
    const volatilityDescriptions: Record<string, string> = {
      high: "Price ranges are wide and volatility is expanding significantly.",
      low: "Price ranges are compressed and volatility is contracting.",
      normal: "Price ranges are typical and volatility is normal."
    };

    return `
Market State Summary:
- Trend: ${trendDescriptions[trend_bias] || "Neutral"}
- Momentum: ${momentumDescriptions[momentum_state] || "Neutral"}
- Volume: ${volumeDescriptions[volume_context] || "Neutral"}
- Volatility: ${volatilityDescriptions[volatility_state] || "Normal"}

Based on these four combined factors, provide trader-style analysis.`;
  }

  /**
   * Generate comprehensive crypto insights combining multiple analysis types
   * Uses new gemini_tech_summary module for clean technical analysis
   */
  async generateCryptoInsight(
    symbol: string,
    technicalAnalysis: any,
    marketData: any,
    focus: 'institutional' | 'chart' = 'institutional'
  ): Promise<AICryptoInsight> {
    try {
      const timeframe = marketData.timeframe || "4h";

      // Extract indicators - they can be at root level or nested under .indicators
      const rawIndicators = technicalAnalysis.indicators || technicalAnalysis;
      console.log("[AI Summary] Raw indicators keys:", Object.keys(rawIndicators).slice(0, 10));

      // Extract precomputed indicators from the analysis
      const indicatorsOverride = {
        price: rawIndicators.price || 0,
        ema20: rawIndicators.ema20 || null,
        ema50: rawIndicators.ema50 || null,
        vwap: rawIndicators.vwap || null,
        rsi: rawIndicators.rsi || null,
        macd: rawIndicators.macd || null,
        obvSeries: rawIndicators.obvSeries || [],
        avgVol: rawIndicators.avgVol || null,
        prevAvgVol: rawIndicators.prevAvgVol || null,
        atr: rawIndicators.atr || null,
        bbSqueeze: rawIndicators.bbSqueeze || false,
      };

      console.log("[AI Summary] Indicators Override:", JSON.stringify(indicatorsOverride).slice(0, 200));

      // Dynamically import gemini_tech_summary module
      // Append timestamp to force cache busting (Node.js ESM cache)
      const gemimiModule = await import(`../gemini_tech_summary.js?t=${Date.now()}`);
      const { runSummaryWithIndicators } = gemimiModule;

      // Call new gemini_tech_summary module
      const result = await runSummaryWithIndicators({
        symbol,
        timeframe,
        indicatorsOverride,
        candles: [],
        focus
      });

      console.log("GEMINI RESPONSE:");
      console.log(result.geminiText);

      // Extract signal from response text
      const signal = result.geminiText.toLowerCase().includes("bullish") ? "bullish" :
        result.geminiText.toLowerCase().includes("bearish") ? "bearish" : "neutral";

      return {
        symbol,
        analysisType: "recommendation",
        signal: signal as "bullish" | "bearish" | "neutral",
        confidence: 0.8,
        reasoning: result.geminiText,
        recommendation: result.geminiText,
        timeframe,
        metadata: {
          technicalScore: 50,
          volumeAnalysis: "analysis based on combined signals",
          marketCondition: signal,
          riskLevel: result.geminiText.toLowerCase().includes("high volatility") || result.geminiText.toLowerCase().includes("extreme") ? "high" : "medium"
        }
      };
    } catch (error) {
      console.error("Error generating crypto insight:", error);

      const fallbackSignal = technicalAnalysis.recommendation === "BUY" ? "bullish" :
        technicalAnalysis.recommendation === "SELL" ? "bearish" : "neutral";

      return {
        symbol,
        analysisType: "recommendation",
        signal: fallbackSignal,
        confidence: 0.6,
        reasoning: "Fallback analysis based on technical indicators only. AI analysis unavailable.",
        recommendation: `Based on technical analysis: ${technicalAnalysis.recommendation || "HOLD"}`,
        timeframe: "4h",
        metadata: {
          technicalScore: technicalAnalysis.totalScore || 50,
          volumeAnalysis: "normal volume",
          marketCondition: "neutral",
          riskLevel: "medium"
        }
      };
    }
  }

  /**
   * Analyze multiple cryptocurrencies and rank them by AI insights
   */
  async analyzeMultipleCryptos(cryptoData: any[]): Promise<AICryptoInsight[]> {
    const insights: AICryptoInsight[] = [];

    for (const crypto of cryptoData.slice(0, 10)) { // Limit to 10 to avoid API limits
      try {
        const insight = await this.generateCryptoInsight(
          crypto.symbol,
          crypto.technicalAnalysis,
          crypto.marketData
        );
        insights.push(insight);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error analyzing ${crypto.symbol}:`, error);
      }
    }

    // Sort by confidence and signal strength
    return insights.sort((a, b) => {
      const scoreA = a.confidence * (a.signal === "bullish" ? 1.2 : a.signal === "bearish" ? 0.8 : 1);
      const scoreB = b.confidence * (b.signal === "bullish" ? 1.2 : b.signal === "bearish" ? 0.8 : 1);
      return scoreB - scoreA;
    });
  }

  /**
   * Generate market overview and general trading insights
   */
  async generateMarketOverview(marketSummary: any): Promise<{
    overallSentiment: string;
    keyInsights: string[];
    tradingRecommendations: string[];
    riskAssessment: string;
  }> {
    try {
      const prompt = `You are a senior cryptocurrency market analyst providing daily market overviews for professional traders. Focus on actionable insights. Always respond with valid JSON format only, no other text.

Analyze the overall cryptocurrency market based on this summary:
${JSON.stringify(marketSummary)}

Provide a comprehensive market overview including sentiment, key insights, trading recommendations, and risk assessment. Do NOT repeat data values, summarize analysis only.

Respond with ONLY valid JSON in this exact format:
{
  "overallSentiment": "bullish|bearish|neutral with brief explanation",
  "keyInsights": ["insight1", "insight2", "insight3"],
  "tradingRecommendations": ["recommendation1", "recommendation2"],
  "riskAssessment": "detailed risk analysis"
}`;

      const responseText = await callGemini(prompt);
      const result = JSON.parse(responseText);

      return {
        overallSentiment: result.overallSentiment || "neutral - mixed signals",
        keyInsights: result.keyInsights || ["Market analysis pending"],
        tradingRecommendations: result.tradingRecommendations || ["Monitor key levels"],
        riskAssessment: result.riskAssessment || "Standard market risks apply"
      };
    } catch (error) {
      console.error("Error generating market overview:", error);

      // Enhanced fallback with sophisticated technical analysis
      const topGainerAnalysis = marketSummary.topGainers || [];
      const avgGain = marketSummary.averageGain || 0;
      const highVolumeCount = marketSummary.highVolumeCount || 0;

      const sentiment = avgGain > 5 ? "bullish - strong momentum detected" :
        avgGain < -2 ? "bearish - market correction in progress" :
          "neutral - consolidation phase";

      // Generate specific token insights with actual names and performance
      const topPerformers = topGainerAnalysis.slice(0, 5).map((coin: BinanceTicker) =>
        `${coin.symbol.replace('USDT', '')}: ${parseFloat(coin.priceChangePercent) > 0 ? '+' : ''}${parseFloat(coin.priceChangePercent).toFixed(1)}%`
      ).join(', ');

      const highVolumeTokens = topGainerAnalysis.filter((g: BinanceTicker) => parseFloat(g.quoteVolume) > 10000000)
        .slice(0, 3).map((coin: BinanceTicker) => coin.symbol.replace('USDT', '')).join(', ');

      const insights = [
        topPerformers ? `Top movers: ${topPerformers}` : "No significant price movements detected",
        highVolumeTokens ? `High volume leaders: ${highVolumeTokens} (>$10M volume)` : "Low volume across major pairs",
        avgGain > 8 ? `Market surge: ${topGainerAnalysis.slice(0, 3).map((c: BinanceTicker) => c.symbol.replace('USDT', '')).join(', ')} leading rally` :
          avgGain < -3 ? `Market decline: Major assets showing weakness` :
            `Sideways action: Most tokens trading within ranges`,
        `Volume analysis: ${highVolumeCount} tokens with institutional-level activity`,
        topGainerAnalysis.length > 30 ? `Broad rally: ${Math.round(topGainerAnalysis.length * 0.7)} tokens participating` :
          `Selective moves: Only ${topGainerAnalysis.length} tokens showing momentum`
      ];

      const recommendations = [
        avgGain > 6 ? `Long ${topGainerAnalysis.slice(0, 2).map((c: BinanceTicker) => c.symbol.replace('USDT', '')).join('/')} on momentum continuation` :
          avgGain < -2 ? `Short positions or DCA into ${topGainerAnalysis.slice(-2).map((c: BinanceTicker) => c.symbol.replace('USDT', '')).join('/')}` :
            `Range trade ${topGainerAnalysis.slice(0, 2).map((c: BinanceTicker) => c.symbol.replace('USDT', '')).join('/')} within current levels`,
        highVolumeTokens ? `Focus on volume leaders: ${highVolumeTokens} for breakout plays` :
          "Wait for volume spike before entering positions",
        topGainerAnalysis.length > 0 ? `Watch ${topGainerAnalysis[0].symbol.replace('USDT', '')} key levels: support near ${(parseFloat(topGainerAnalysis[0].lowPrice) * 1.02).toFixed(2)}` :
          "Monitor major support/resistance levels for trend validation"
      ];

      const riskLevel = avgGain > 10 ? "high" : avgGain < -5 ? "high" : "moderate";

      return {
        overallSentiment: sentiment,
        keyInsights: insights,
        tradingRecommendations: recommendations,
        riskAssessment: `Current risk level: ${riskLevel}. Market volatility ${avgGain > 15 || avgGain < -10 ? 'elevated' : 'normal'}. ${riskLevel === 'high' ? 'Reduce position sizes and use tight stops.' : 'Standard risk management applies.'}`
      };
    }
  }

  // Helper methods for technical calculations
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateMomentum(prices: number[]): number {
    if (prices.length < 3) return 0;
    const early = prices.slice(0, Math.floor(prices.length / 2));
    const recent = prices.slice(Math.floor(prices.length / 2));
    const earlyAvg = early.reduce((sum, p) => sum + p, 0) / early.length;
    const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    return (recentAvg - earlyAvg) / earlyAvg;
  }

  private calculateVolumeTrend(volumes: number[]): number {
    if (volumes.length < 2) return 0;
    const early = volumes.slice(0, Math.floor(volumes.length / 2));
    const recent = volumes.slice(Math.floor(volumes.length / 2));
    const earlyAvg = early.reduce((sum, v) => sum + v, 0) / early.length;
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    return (recentAvg - earlyAvg) / earlyAvg;
  }

  /**
   * Generate comprehensive portfolio strategy and health check
   */
  async generatePortfolioStrategy(positions: any[]): Promise<{
    healthScore: number;
    topInsight: string;
    actionableMove: string;
    detailedAnalysis: string;
  }> {
    try {
      const prompt = `You are a ruthless hedge fund portfolio manager. Analyze this portfolio snapshot and provide strategic advice. Always respond with valid JSON format only.

Portfolio Snapshot:
${JSON.stringify(positions.map(p => ({
        symbol: p.symbol,
        weight: p.weight, // % of portfolio
        pnlPercent: p.pnlPercent, // % gain/loss
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        value: p.value
      })), null, 2)}

Analyze for:
1. Concentration Risk (Overexposed to one asset?)
2. Profit Taking (Assets up >20% with signs of exhaustion?)
3. Cut Losers (Assets down >10% lagging the market?)
4. Opportunity Cost (Dead money?)

Respond with ONLY valid JSON in this exact format:
{
  "healthScore": 75, // 0-100 integer
  "topInsight": "One sentence summary of the biggest risk or opportunity.",
  "actionableMove": "Specific instruction (e.g., 'Trim SOL by 10% and rotate into ETH').",
  "detailedAnalysis": "Markdown formatted detailed explanation of the strategy, risks, and recommended moves."
}`;

      const responseText = await callGemini(prompt);
      const result = JSON.parse(responseText);

      return {
        healthScore: Math.max(0, Math.min(100, result.healthScore || 50)),
        topInsight: result.topInsight || "Portfolio analysis unavailable.",
        actionableMove: result.actionableMove || "Hold current positions.",
        detailedAnalysis: result.detailedAnalysis || "No detailed analysis available."
      };
    } catch (error) {
      console.error("Error generating portfolio strategy:", error);
      return {
        healthScore: 50,
        topInsight: "AI Strategy Unavailable",
        actionableMove: "Check back later.",
        detailedAnalysis: "Failed to generate analysis due to an error."
      };
    }
  }
}

export const aiService = new AIService();