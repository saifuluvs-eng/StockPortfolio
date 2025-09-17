import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, TrendingUp, Trophy, Medal, BarChart3 } from "lucide-react";

interface GainerData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export default function Gainers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  const { data: gainers = [], isLoading: gainersLoading, refetch } = useQuery<GainerData[]>({
    queryKey: ['/api/market/gainers', isAuthenticated ? '' : '?limit=5'],
    retry: false,
    refetchInterval: isAuthenticated ? 30000 : false, // Refetch every 30 seconds
    enabled: !isLoading,
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Market data updated successfully",
    });
  };

  const formatMarketCap = (volume: string) => {
    const vol = parseFloat(volume);
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const getAnalysisLevel = (changePercent: number) => {
    if (changePercent >= 20) return { label: "Strong", class: "bg-accent/20 text-accent" };
    if (changePercent >= 10) return { label: "Good", class: "bg-primary/20 text-primary" };
    if (changePercent >= 5) return { label: "Fair", class: "bg-secondary/20 text-secondary" };
    return { label: "Weak", class: "bg-muted/20 text-muted-foreground" };
  };

  const topThree = gainers.slice(0, 3);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Top Gainers</h1>
              <p className="text-muted-foreground">Top performing USDT pairs in the last 24 hours</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                Last updated: <span className="text-foreground font-medium" data-testid="text-last-updated">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
              <Button 
                onClick={handleRefresh}
                disabled={gainersLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-refresh-gainers"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${gainersLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Top Gainers Grid */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {topThree.map((gainer, index) => {
                const baseAsset = gainer.symbol.replace('USDT', '');
                const changePercent = parseFloat(gainer.priceChangePercent);
                const gradientClass = index === 0 ? 'from-accent/20 to-accent/5 border-accent/30' :
                                   index === 1 ? 'from-primary/20 to-primary/5 border-primary/30' :
                                   'from-secondary/20 to-secondary/5 border-secondary/30';
                
                return (
                  <Card key={gainer.symbol} className={`bg-gradient-to-br ${gradientClass}`} data-testid={`card-top-gainer-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            index === 0 ? 'bg-accent' : index === 1 ? 'bg-primary' : 'bg-secondary'
                          }`}>
                            <span className="text-sm font-bold text-background">
                              {baseAsset.slice(0, 4)}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{gainer.symbol}</p>
                            <p className="text-sm text-muted-foreground">{baseAsset}</p>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">#{index + 1}</p>
                          <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                            {index === 0 ? <Trophy className="w-3 h-3 text-accent-foreground" /> : 
                             <Medal className="w-3 h-3 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-bold text-foreground" data-testid={`text-featured-price-${index}`}>
                            ${parseFloat(gainer.price).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">24h Change:</span>
                          <span className="font-bold text-accent" data-testid={`text-featured-change-${index}`}>
                            +{changePercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Volume:</span>
                          <span className="font-medium text-foreground">
                            {formatMarketCap(gainer.quoteVolume)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Full Gainers Table */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>All Top Gainers</CardTitle>
            </CardHeader>
            <CardContent>
              {gainersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading market data...</div>
                </div>
              ) : gainers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No market data available</p>
                  <Button onClick={handleRefresh} data-testid="button-reload-data">
                    Reload Data
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 text-muted-foreground font-medium">Rank</th>
                        <th className="text-left p-4 text-muted-foreground font-medium">Symbol</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Price</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">24h Change</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Volume</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">High/Low</th>
                        <th className="text-right p-4 text-muted-foreground font-medium">Quick Analysis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gainers.map((gainer, index) => {
                        const baseAsset = gainer.symbol.replace('USDT', '');
                        const changePercent = parseFloat(gainer.priceChangePercent);
                        const analysis = getAnalysisLevel(changePercent);
                        const rankColor = index < 3 ? 'bg-accent/20 text-accent' : 
                                        index < 10 ? 'bg-primary/20 text-primary' : 
                                        'bg-muted/20 text-muted-foreground';

                        return (
                          <tr 
                            key={gainer.symbol} 
                            className="border-b border-border hover:bg-muted/20 transition-colors"
                            data-testid={`row-gainer-${index}`}
                          >
                            <td className="p-4">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${rankColor}`}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                                  <span className="text-xs font-bold text-accent-foreground">
                                    {baseAsset.slice(0, 3)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{gainer.symbol}</p>
                                  <p className="text-sm text-muted-foreground">{baseAsset}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right text-foreground font-medium" data-testid={`text-price-${index}`}>
                              ${parseFloat(gainer.price).toFixed(4)}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <TrendingUp className="w-3 h-3 text-accent" />
                                <span className="text-accent font-bold" data-testid={`text-change-${index}`}>
                                  +{changePercent.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-right text-foreground">
                              {formatMarketCap(gainer.quoteVolume)}
                            </td>
                            <td className="p-4 text-right text-foreground text-sm">
                              <div>
                                <div>H: ${parseFloat(gainer.highPrice).toFixed(4)}</div>
                                <div>L: ${parseFloat(gainer.lowPrice).toFixed(4)}</div>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <Badge className={analysis.class} data-testid={`badge-analysis-${index}`}>
                                  {analysis.label}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-primary hover:text-primary/80"
                                  data-testid={`button-view-analysis-${index}`}
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!isAuthenticated && (
                    <div className="text-center py-4">
                      <Button onClick={() => window.location.href = "/api/auth/google"}>
                        Login to see full list
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
