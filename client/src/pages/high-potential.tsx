import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, SlidersHorizontal, Check, Eye } from "lucide-react";

interface ScanResult {
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

export default function HighPotential() {
  const [timeframe, setTimeframe] = useState("1h");
  const [minScore, setMinScore] = useState("20");
  const [minVolume, setMinVolume] = useState("1M");
  const [excludeStablecoins, setExcludeStablecoins] = useState(true);
  const [results, setResults] = useState<ScanResult[]>([]);
  const { toast } = useToast();
  const { isAuthenticated, signInWithGoogle } = useAuth();

  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/scanner/high-potential', {
        timeframe,
        minScore: parseInt(minScore) || 0,
        minVolume,
        excludeStablecoins,
      });
      return response.json();
    },
    onSuccess: (data: ScanResult[]) => {
      setResults(data);
      toast({
        title: "Scan Complete",
        description: `Found ${data.length} high potential coins`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }
      toast({
        title: "Scan Failed",
        description: "Failed to scan for high potential coins",
        variant: "destructive",
      });
    },
  });

  const handleScan = () => {
    scanMutation.mutate();
  };

  const bullishCriteria = [
    "Price above EMA 20 & 50",
    "Volume above 24h average", 
    "RSI between 40-70 (healthy)",
    "Positive MACD signal",
    "Strong ADX trend (25+)"
  ];

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">High Potential Coins</h1>
              <p className="text-muted-foreground">Coins with strong bullish momentum and confirmed uptrends</p>
            </div>
            <Button 
              onClick={handleScan}
              disabled={scanMutation.isPending || !isAuthenticated}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
              {scanMutation.isPending ? "Scanning..." : "Refresh"}
            </Button>
          </div>

          {/* Scan Filters */}
          <Card className="border-border mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <SlidersHorizontal className="w-5 h-5" />
                <span>Scan Filters</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Timeframe</label>
                  <Select value={timeframe} onValueChange={setTimeframe} disabled={!isAuthenticated}>
                    <SelectTrigger data-testid="select-timeframe">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15m">15 minutes</SelectItem>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="4h">4 hours</SelectItem>
                      <SelectItem value="1d">1 day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Min Score</label>
                  <Input
                    type="number"
                    placeholder="20"
                    min="0"
                    max="100"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    data-testid="input-min-score"
                    disabled={!isAuthenticated}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Min Volume</label>
                  <Input
                    placeholder="1M USDT"
                    value={minVolume}
                    onChange={(e) => setMinVolume(e.target.value)}
                    data-testid="input-min-volume"
                    disabled={!isAuthenticated}
                  />
                </div>
                
                <div className="flex items-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="exclude-stablecoins"
                      checked={excludeStablecoins}
                      onCheckedChange={(checked) => setExcludeStablecoins(checked === true)}
                      data-testid="checkbox-exclude-stablecoins"
                      disabled={!isAuthenticated}
                    />
                    <label htmlFor="exclude-stablecoins" className="text-sm text-foreground">
                      Exclude stablecoins
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bullish Criteria */}
          <Card className="border-border mb-6">
            <CardHeader>
              <CardTitle>Bullish Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bullishCriteria.map((criteria, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-foreground text-sm">{criteria}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Scan Results</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {results.length > 0 ? `Found ${results.length} coins matching criteria` : "Click Refresh to start scanning"}
              </p>
            </CardHeader>
            <CardContent>
              {scanMutation.isPending ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Scanning high potential coins...</div>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    {isAuthenticated ? "No results yet" : "Please log in to use the scanner"}
                  </p>
                  {isAuthenticated && (
                    <Button onClick={handleScan} data-testid="button-start-scan">
                      Start Scanning
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 text-muted-foreground font-medium">Symbol</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Price</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Score</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Recommendation</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result, index) => {
                        const baseAsset = result.symbol.replace('USDT', '');
                        
                        return (
                          <tr 
                            key={result.symbol} 
                            className="border-b border-border hover:bg-muted/20 transition-colors"
                            data-testid={`row-result-${index}`}
                          >
                            <td className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary-foreground">
                                    {baseAsset.slice(0, 3)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{result.symbol}</p>
                                  <p className="text-sm text-muted-foreground">{baseAsset}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right text-foreground" data-testid={`text-price-${index}`}>
                              ${result.price.toFixed(4)}
                            </td>
                            <td className="p-4 text-right">
                              <Badge 
                                className="bg-accent/20 text-accent font-bold"
                                data-testid={`badge-score-${index}`}
                              >
                                {result.totalScore}
                              </Badge>
                            </td>
                            <td className="p-4 text-right">
                              <Badge 
                                variant={result.recommendation === 'strong_buy' ? 'default' : 'secondary'}
                                data-testid={`badge-recommendation-${index}`}
                              >
                                {result.recommendation.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </td>
                            <td className="p-4 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-primary hover:text-primary/80"
                                data-testid={`button-view-details-${index}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
