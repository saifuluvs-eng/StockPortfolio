// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/**
 * Helper function to call Gemini API
 */
async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

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
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const json = await response.json();
  const result = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  if (!result) {
    throw new Error("No response from Gemini API");
  }

  return result;
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
   * Generate comprehensive crypto insights combining multiple analysis types
   */
  async generateCryptoInsight(
    symbol: string,
    technicalAnalysis: any,
    marketData: any
  ): Promise<AICryptoInsight> {
    try {
      const prompt = `You are an advanced crypto market analyst. 
You will receive structured technical indicator data in JSON format.

Your job is to produce a clean AI Summary based ONLY on the *meaning* of the indicators, not the raw values.

=========================
INSTRUCTIONS (FOLLOW STRICTLY)
=========================

1. DO NOT repeat any indicator numbers.
2. DO NOT explain what indicators mean (e.g., don't say "RSI measures momentum").
3. Focus ONLY on what the indicators collectively imply.
4. Summarise in short, clear points — avoid long paragraphs.
5. Format output EXACTLY like this (plain text, NOT JSON):

### AI Summary — ${symbol} ${marketData.timeframe || '4h'}

**Overall Bias:** (Bullish / Bearish / Neutral)

**Why:**
- 3–5 short bullet points combining all major signals
- Focus on trend direction, momentum, volatility, and volume strength

**What to expect next:**
- Expected short-term move (bounce, continuation, rejection, consolidation)

**Levels to watch:**
- Support zones
- Resistance zones

**Risk:**
- Short risk note based on trend strength, volatility, or extreme readings

=========================
HERE IS THE DATA:
=========================

${JSON.stringify(technicalAnalysis)}`;

      const responseText = await callGemini(prompt);
      
      // Extract signal from response text
      const signal = responseText.toLowerCase().includes("bullish") ? "bullish" :
                    responseText.toLowerCase().includes("bearish") ? "bearish" : "neutral";
      
      return {
        symbol,
        analysisType: "recommendation",
        signal: signal as "bullish" | "bearish" | "neutral",
        confidence: 0.8,
        reasoning: responseText,
        recommendation: responseText,
        timeframe: marketData.timeframe || "4h",
        metadata: {
          technicalScore: 50,
          volumeAnalysis: "analysis based on indicators",
          marketCondition: signal,
          riskLevel: responseText.toLowerCase().includes("high volatility") ? "high" : "medium"
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
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
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
}

export const aiService = new AIService();