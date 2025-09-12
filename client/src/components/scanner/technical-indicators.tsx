import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, HelpCircle } from "lucide-react";

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
        return <Check className="w-4 h-4 text-accent" />;
      case 'bearish':
        return <X className="w-4 h-4 text-destructive" />;
      default:
        return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'bullish':
        return 'bg-accent text-accent-foreground';
      case 'bearish':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_buy':
        return 'bg-accent text-accent-foreground';
      case 'buy':
        return 'bg-accent/80 text-accent-foreground';
      case 'strong_sell':
        return 'bg-destructive text-destructive-foreground';
      case 'sell':
        return 'bg-destructive/80 text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const scorePercentage = Math.max(0, Math.min(100, ((analysis.totalScore + 30) / 60) * 100));

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto" data-testid="technical-indicators">
      {Object.entries(analysis.indicators).map(([key, indicator]) => (
        <div 
          key={key} 
          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
          data-testid={`indicator-${key}`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getSignalColor(indicator.signal)}`}>
              {getSignalIcon(indicator.signal)}
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">
                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
              <p className="text-xs text-muted-foreground">Tier {indicator.tier}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`font-bold text-sm ${
              indicator.score > 0 ? 'text-accent' : 
              indicator.score < 0 ? 'text-destructive' : 
              'text-muted-foreground'
            }`}>
              {indicator.score > 0 ? '+' : ''}{indicator.score}
            </p>
            <p className="text-xs text-muted-foreground">
              {indicator.signal === 'bullish' ? 'Bullish' : 
               indicator.signal === 'bearish' ? 'Bearish' : 'Neutral'}
            </p>
          </div>
        </div>
      ))}

      {/* Total Score */}
      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-foreground">Total Score</p>
          <div className="flex items-center space-x-2">
            <p className={`text-xl font-bold ${
              analysis.totalScore > 0 ? 'text-accent' : 
              analysis.totalScore < 0 ? 'text-destructive' : 
              'text-muted-foreground'
            }`} data-testid="text-total-score">
              {analysis.totalScore > 0 ? '+' : ''}{analysis.totalScore}
            </p>
            <Badge className={getRecommendationColor(analysis.recommendation)} data-testid="badge-recommendation">
              {analysis.recommendation.replace(/_/g, ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
        <Progress value={scorePercentage} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Score Range: -30 to +30
        </p>
      </div>
    </div>
  );
}
