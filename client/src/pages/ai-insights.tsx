import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles,
  BarChart3,
  Activity,
  Zap
} from "lucide-react";

interface AIMarketOverview {
  overallSentiment: string;
  keyInsights: string[];
  tradingRecommendations: string[];
  riskAssessment: string;
}

interface AIPrediction {
  symbol: string;
  prediction: string;
  confidence: number;
  priceTarget?: number;
  timeframe: string;
  reasoning: string;
  riskFactors: string[];
  supportLevels?: number[];
  resistanceLevels?: number[];
}

interface AISentiment {
  sentiment: string;
  confidence: number;
  reasoning: string;
  signal: string;
  keyFactors: string[];
  timeframe: string;
}

export default function AIInsights() {
  const { toast } = useToast();
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState("4h");

  const { data: marketOverview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<AIMarketOverview>({
    queryKey: ['/api/ai/market-overview'],
    retry: false,
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const { data: sentiment, isLoading: sentimentLoading, refetch: refetchSentiment } = useQuery<AISentiment>({
    queryKey: ['/api/ai/sentiment', selectedSymbol, selectedTimeframe],
    retry: false,
    enabled: !!selectedSymbol,
  });

  const handleRefreshAll = () => {
    refetchOverview();
    refetchSentiment();
    toast({
      title: "Refreshed",
      description: "AI insights updated successfully",
    });
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment.toLowerCase().includes('bullish')) return 'text-green-500';
    if (sentiment.toLowerCase().includes('bearish')) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500/20 text-green-400';
    if (confidence >= 0.6) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  const popularSymbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT", "SOLUSDT", "DOTUSDT"];
  const timeframes = ["1h", "4h", "1d", "1w"];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Brain className="w-6 h-6 text-accent" />
                AI Market Insights
              </h1>
              <p className="text-muted-foreground">AI-powered market analysis and predictions</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                Last updated: <span className="text-foreground font-medium" data-testid="text-last-updated">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
              <Button 
                onClick={handleRefreshAll}
                disabled={overviewLoading || sentimentLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-refresh-insights"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${overviewLoading || sentimentLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Market Overview */}
          <Card className="mb-6 border-border bg-gradient-to-br from-accent/10 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                AI Market Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Analyzing market conditions...</div>
                </div>
              ) : marketOverview ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Overall Sentiment</h3>
                    <p className={`text-lg font-medium ${getSentimentColor(marketOverview.overallSentiment)}`}>
                      {marketOverview.overallSentiment}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Key Insights</h3>
                    <ul className="space-y-1">
                      {marketOverview.keyInsights.map((insight, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-accent mt-0.5" />
                          <span className="text-foreground">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Trading Recommendations</h3>
                    <ul className="space-y-1">
                      {marketOverview.tradingRecommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Target className="w-4 h-4 text-primary mt-0.5" />
                          <span className="text-foreground">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Risk Assessment</h3>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-foreground flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                        {marketOverview.riskAssessment}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Unable to generate market overview</p>
                  <Button onClick={() => refetchOverview()} data-testid="button-retry-overview">
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Symbol Selection for Sentiment Analysis */}
          <Card className="mb-6 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Sentiment Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Symbol:</span>
                  {popularSymbols.map((symbol) => (
                    <Button
                      key={symbol}
                      variant={selectedSymbol === symbol ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSymbol(symbol)}
                      data-testid={`button-symbol-${symbol}`}
                    >
                      {symbol.replace('USDT', '')}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Timeframe:</span>
                  {timeframes.map((tf) => (
                    <Button
                      key={tf}
                      variant={selectedTimeframe === tf ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTimeframe(tf)}
                      data-testid={`button-timeframe-${tf}`}
                    >
                      {tf}
                    </Button>
                  ))}
                </div>
              </div>

              {sentimentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Analyzing {selectedSymbol} sentiment...</div>
                </div>
              ) : sentiment ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Sentiment Analysis</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Sentiment:</span>
                        <Badge className={getSentimentColor(sentiment.sentiment)}>
                          {sentiment.sentiment.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Confidence:</span>
                        <Badge className={getConfidenceColor(sentiment.confidence)}>
                          {(sentiment.confidence * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Signal:</span>
                        <span className="font-medium text-foreground">{sentiment.signal}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Timeframe:</span>
                        <span className="text-foreground">{sentiment.timeframe}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-3">Key Factors</h3>
                    <ul className="space-y-2">
                      {sentiment.keyFactors.map((factor, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Zap className="w-3 h-3 text-accent mt-1" />
                          <span className="text-sm text-foreground">{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="md:col-span-2">
                    <h3 className="font-semibold text-foreground mb-3">AI Reasoning</h3>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-foreground">{sentiment.reasoning}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Unable to analyze sentiment for {selectedSymbol}</p>
                  <Button onClick={() => refetchSentiment()} data-testid="button-retry-sentiment">
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}