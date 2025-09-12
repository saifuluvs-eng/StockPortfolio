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
      
      return {
        sentiment: rsi > 60 ? "bullish" : rsi < 40 ? "bearish" : "neutral",
        confidence: 0.6,
        reasoning: `Fallback analysis: RSI at ${rsi.toFixed(2)}, MACD signal: ${macdSignal}`,
        signal: rsi > 60 ? "BUY" : rsi < 40 ? "SELL" : "HOLD",
        keyFactors: ["Technical indicators", "RSI analysis", "MACD trend"],
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
      
      return {
        prediction: "neutral",
        confidence: 0.5,
        timeframe: "24h",
        reasoning: "Unable to generate prediction due to AI service error. Please try again later.",
        riskFactors: ["AI service unavailable", "Limited data analysis"]
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
      
      return {
        overallSentiment: "neutral - unable to analyze",
        keyInsights: ["AI analysis temporarily unavailable"],
        tradingRecommendations: ["Use technical analysis for trading decisions"],
        riskAssessment: "Exercise standard caution due to limited AI insights"
      };
    }
  }
}

export const aiService = new AIService();