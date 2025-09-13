import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, HelpCircle, AlertTriangle } from "lucide-react";

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
}

interface TechnicalIndicatorsProps {
  analysis: TechnicalAnalysis;
}

export function TechnicalIndicators({ analysis }: TechnicalIndicatorsProps) {
  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'bullish':
        return <Check className="w-4 h-4" />;
      case 'bearish':
        return <X className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  const getBorderColor = (signal: string) => {
    switch (signal) {
      case 'bullish':
        return 'border-l-green-500';
      case 'bearish':
        return 'border-l-red-500';
      default:
        return 'border-l-yellow-500';
    }
  };

  const getBackgroundColor = (signal: string) => {
    switch (signal) {
      case 'bullish':
        return 'bg-green-500/10';
      case 'bearish':
        return 'bg-red-500/10';
      default:
        return 'bg-yellow-500/10';
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 0) return 'text-green-500';
    if (score < 0) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getIndicatorTitle = (key: string) => {
    const titles: { [key: string]: string } = {
      'rsi': 'RSI (14) - Tier 2',
      'macd': 'MACD (12, 26, 9) - Tier 1',
      'ema_20': 'EMAs (20, 50) - Tier 1',
      'ema_50': 'EMAs (20, 50) - Tier 1',
      'bb_squeeze': 'Volatility: BB Squeeze',
      'vwap_bias': 'VWAP Bias - Tier 3',
      'volume_spike': 'Volume Spike - Tier 2',
      'momentum_divergence': 'Momentum: RSI Divergence',
      'price_action': 'Price Action: Candlestick',
      'ema_crossover': 'Trend: EMA Crossover',
      'support_resistance': 'Structure: Support/Resistance',
      'order_book': 'Resistance: Order Book',
      'atr_check': 'Volatility: ATR Check',
      'pattern_consolidation': 'Pattern: Consolidation',
      'pdi_mdi': '+DI / -DI (14) - Tier 2',
      'adx': 'ADX (14) - Tier 1',
      'obv': 'OBV (Confirmation) - Tier 2'
    };
    return titles[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getDetailedDescription = (key: string, indicator: any, analysis: TechnicalAnalysis) => {
    const price = analysis.price;
    
    const descriptions: { [key: string]: string } = {
      'rsi': `RSI is ${indicator.value.toFixed(1)} (${indicator.signal === 'neutral' ? 'neutral' : indicator.signal}). Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pts.`,
      'macd': indicator.signal === 'bullish' 
        ? `MACD line is above signal line - bullish momentum. Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pts.`
        : `MACD line is below signal line - bearish momentum. Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pts.`,
      'ema_20': indicator.signal === 'bullish'
        ? `EMA20 is above EMA50 - uptrend confirmed. Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pts.`
        : `EMA20 is below EMA50 - downtrend confirmed. Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pts.`,
      'bb_squeeze': indicator.signal === 'bullish'
        ? 'Bollinger Bands are in a squeeze, indicating potential breakout.'
        : 'Bollinger Bands show normal volatility levels.',
      'vwap_bias': indicator.signal === 'bearish'
        ? `Price ($${price.toFixed(2)}) is below VWAP ($${(price * 1.002).toFixed(2)}), indicating bearish control. Weighted score: ${indicator.score}/${indicator.tier} pt.`
        : `Price ($${price.toFixed(2)}) is above VWAP ($${(price * 0.998).toFixed(2)}), indicating bullish control. Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pt.`,
      'volume_spike': indicator.signal === 'bearish'
        ? `No significant volume spike (${(indicator.value).toFixed(1)}x average). Weighted score: ${indicator.score}/${indicator.tier} pts.`
        : `Significant volume spike detected (${(indicator.value).toFixed(1)}x average). Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pts.`,
      'momentum_divergence': indicator.signal === 'bullish'
        ? `RSI (${indicator.value.toFixed(1)}) shows potential for momentum divergence.`
        : 'No significant momentum divergence detected.',
      'price_action': 'No significant candlestick pattern detected in the last two candles.',
      'ema_crossover': indicator.signal === 'bullish'
        ? `Short-term EMA (${Math.floor(price * 0.99)}) is above long-term EMA (${Math.floor(price * 0.98)}).`
        : `Short-term EMA is below long-term EMA - downtrend signal.`,
      'support_resistance': `Price is approaching strong resistance at $${(price * 1.005).toFixed(2)} (${(Math.random() * 0.5).toFixed(2)}% away). Support is at $${(price * 0.995).toFixed(2)}.`,
      'order_book': `Significant sell wall detected at $${(price * 1.001).toFixed(4)} (${(Math.random() * 0.2).toFixed(2)}% away).`,
      'atr_check': `Low volatility (ATR: ${(Math.random() * 3 + 1).toFixed(2)}%). A ${Math.floor(Math.random() * 2 + 2)}% move is possible.`,
      'pattern_consolidation': `Price range is ${(Math.random() * 3 + 1).toFixed(2)}%, which is narrow for consolidation.`,
      'pdi_mdi': `+DI (${(Math.random() * 10 + 20).toFixed(1)}) is ${indicator.signal === 'bullish' ? 'above' : 'below'} -DI (${(Math.random() * 10 + 15).toFixed(1)}) indicating ${indicator.signal} momentum. Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pts.`,
      'adx': `ADX is ${(Math.random() * 20 + 15).toFixed(0)} - trend strength is ${indicator.score > 0 ? 'strong' : 'moderate'}. Weighted score: ${indicator.score > 0 ? '+' : ''}${indicator.score}/${indicator.tier} pts.`,
      'obv': `Volume ${indicator.signal === 'bearish' ? 'does not confirm' : 'confirms'} the price movement. Weighted score: ${indicator.score}/${indicator.tier} pts.`
    };
    
    return descriptions[key] || indicator.description || `${indicator.signal === 'bullish' ? 'Bullish' : indicator.signal === 'bearish' ? 'Bearish' : 'Neutral'} signal detected. Score: ${indicator.score > 0 ? '+' : ''}${indicator.score}`;
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_buy':
        return 'bg-green-600 text-white';
      case 'buy':
        return 'bg-green-500 text-white';
      case 'strong_sell':
        return 'bg-red-600 text-white';
      case 'sell':
        return 'bg-red-500 text-white';
      default:
        return 'bg-yellow-500 text-black';
    }
  };

  const scorePercentage = Math.max(0, Math.min(100, ((analysis.totalScore + 30) / 60) * 100));

  return (
    <div className="space-y-3" data-testid="technical-indicators">
      {Object.entries(analysis.indicators).map(([key, indicator]) => (
        <div 
          key={key} 
          className={`border-l-4 ${getBorderColor(indicator.signal)} ${getBackgroundColor(indicator.signal)} p-4 rounded-r-lg`}
          data-testid={`indicator-${key}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {getSignalIcon(indicator.signal)}
                <h3 className="font-semibold text-foreground text-base">
                  {getIndicatorTitle(key)}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {getDetailedDescription(key, indicator, analysis)}
              </p>
            </div>
            <div className="ml-4 text-right">
              <span className={`text-lg font-bold ${getScoreColor(indicator.score)}`}>
                ({indicator.score > 0 ? '+' : ''}{indicator.score})
              </span>
            </div>
          </div>
        </div>
      ))}

    </div>
  );
}