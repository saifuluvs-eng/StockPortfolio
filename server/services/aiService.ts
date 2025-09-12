import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      const prompt = `
        As an expert crypto trader and market analyst, analyze the market sentiment for ${symbol} based on the following data:
        
        Recent Price Data: ${priceData.slice(-10).join(", ")}
        Current Price: ${priceData[priceData.length - 1]}
        Technical Indicators: ${JSON.stringify(technicalData, null, 2)}
        
        Provide a comprehensive market sentiment analysis including:
        1. Overall sentiment (bullish/bearish/neutral)
        2. Confidence level (0.0 to 1.0)
        3. Detailed reasoning for your assessment
        4. Clear trading signal
        5. Key factors influencing the sentiment
        6. Suggested timeframe for this analysis
        
        Respond with JSON in this exact format:
        {
          "sentiment": "bullish|bearish|neutral",
          "confidence": 0.85,
          "reasoning": "detailed explanation here",
          "signal": "BUY|SELL|HOLD with specific entry/exit levels",
          "keyFactors": ["factor1", "factor2", "factor3"],
          "timeframe": "1h|4h|1d|1w"
        }
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a professional cryptocurrency market analyst with expertise in technical analysis and market sentiment. Always respond with valid JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
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
      
      const signals = [];
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
      const prompt = `
        As an expert cryptocurrency analyst, provide a price prediction for ${symbol} based on:
        
        Historical Data: ${JSON.stringify(historicalData)}
        Market Context: ${JSON.stringify(marketContext)}
        Current Price: ${historicalData.currentPrice}
        
        Analyze and predict:
        1. Price direction (bullish/bearish/neutral)
        2. Confidence in prediction (0.0 to 1.0)
        3. Potential price target (if applicable)
        4. Timeframe for prediction
        5. Key reasoning behind prediction
        6. Risk factors to consider
        7. Support and resistance levels
        
        Respond with JSON in this exact format:
        {
          "prediction": "bullish|bearish|neutral",
          "confidence": 0.75,
          "priceTarget": 45000,
          "timeframe": "24h|7d|30d",
          "reasoning": "detailed prediction reasoning",
          "riskFactors": ["risk1", "risk2"],
          "supportLevels": [40000, 38000],
          "resistanceLevels": [46000, 48000]
        }
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a professional cryptocurrency price analyst with expertise in market predictions and risk assessment. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
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
      const highs = recentPrices.filter(p => p > currentPrice * 0.99);
      const lows = recentPrices.filter(p => p < currentPrice * 1.01);
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
      
      const riskFactors = [];
      if (volatility > 0.1) riskFactors.push("High volatility environment");
      if (Math.abs(priceChange) > 15) riskFactors.push("Extreme price movement");
      if (volumeTrend < -0.2) riskFactors.push("Declining volume trend");
      if (riskFactors.length === 0) riskFactors.push("Standard market risks");
      
      return {
        prediction,
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
      const prompt = `
        Provide a comprehensive trading insight for ${symbol} cryptocurrency:
        
        Technical Analysis: ${JSON.stringify(technicalAnalysis)}
        Market Data: ${JSON.stringify(marketData)}
        
        Generate insights covering:
        1. Analysis type (sentiment/pattern/prediction/recommendation)
        2. Trading signal (bullish/bearish/neutral)
        3. Confidence level (0.0 to 1.0)
        4. Detailed reasoning
        5. Specific trading recommendation
        6. Optimal timeframe
        7. Additional metadata (risk level, market condition, etc.)
        
        Respond with JSON in this exact format:
        {
          "analysisType": "sentiment|pattern|prediction|recommendation",
          "signal": "bullish|bearish|neutral",
          "confidence": 0.8,
          "reasoning": "comprehensive analysis explanation",
          "recommendation": "specific trading advice",
          "timeframe": "1h|4h|1d|1w",
          "metadata": {
            "technicalScore": 85,
            "volumeAnalysis": "high volume breakout",
            "marketCondition": "trending upward",
            "riskLevel": "medium"
          }
        }
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert cryptocurrency trading advisor providing actionable insights for traders. Focus on practical, risk-aware recommendations. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        symbol,
        analysisType: result.analysisType || "recommendation",
        signal: result.signal,
        confidence: Math.max(0, Math.min(1, result.confidence)),
        reasoning: result.reasoning,
        recommendation: result.recommendation,
        timeframe: result.timeframe || "4h",
        metadata: {
          technicalScore: result.metadata?.technicalScore || 50,
          volumeAnalysis: result.metadata?.volumeAnalysis || "normal volume",
          marketCondition: result.metadata?.marketCondition || "neutral",
          riskLevel: result.metadata?.riskLevel || "medium"
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
      const prompt = `
        Analyze the overall cryptocurrency market based on this summary:
        ${JSON.stringify(marketSummary)}
        
        Provide a comprehensive market overview including:
        1. Overall market sentiment
        2. Key insights (3-5 bullet points)
        3. General trading recommendations
        4. Risk assessment for current market conditions
        
        Respond with JSON in this exact format:
        {
          "overallSentiment": "bullish|bearish|neutral with brief explanation",
          "keyInsights": ["insight1", "insight2", "insight3"],
          "tradingRecommendations": ["recommendation1", "recommendation2"],
          "riskAssessment": "detailed risk analysis"
        }
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a senior cryptocurrency market analyst providing daily market overviews for professional traders. Focus on actionable insights."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
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
      
      const insights = [
        `${topGainerAnalysis.length} cryptocurrencies analyzed with ${avgGain.toFixed(1)}% average gain`,
        `${highVolumeCount} assets showing high volume breakouts (>$10M)`,
        avgGain > 8 ? "Strong bull market signals across major pairs" : 
        avgGain < -3 ? "Risk-off sentiment with defensive positioning" :
        "Market in equilibrium - waiting for directional catalyst",
        `Volume profile suggests ${highVolumeCount > 15 ? 'institutional' : 'retail'} dominated trading`,
        topGainerAnalysis.length > 30 ? "Broad market participation indicates healthy uptrend" :
        "Selective strength in limited sectors - exercise caution"
      ];
      
      const recommendations = [
        avgGain > 6 ? "Consider momentum plays on established breakouts" :
        avgGain < -2 ? "Focus on defensive assets and DCA strategies" :
        "Range trading opportunities in sideways market",
        highVolumeCount > 20 ? "Follow volume leaders for continuation patterns" :
        "Wait for volume confirmation before major positions",
        "Monitor key support/resistance levels for trend validation"
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
}

export const aiService = new AIService();