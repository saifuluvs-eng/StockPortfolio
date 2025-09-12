import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TradingViewChart } from "@/components/scanner/trading-view-chart";
import { TechnicalIndicators } from "@/components/scanner/technical-indicators";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { Search } from "lucide-react";

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

interface TickerData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export default function Scanner() {
  const [searchSymbol, setSearchSymbol] = useState("BTCUSDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1h");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Show sign-in UI if not authenticated (no auto-redirect)
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Search className="w-6 h-6" />
                Technical Scanner Access
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Please sign in to access the technical scanner and analyze cryptocurrency opportunities.
              </p>
              <Button 
                onClick={() => window.location.href = "/api/login"}
                className="w-full"
                data-testid="button-sign-in"
              >
                Sign In with Replit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fetch ticker data when symbol changes
  useEffect(() => {
    if (searchSymbol && searchSymbol.length > 0) {
      fetchTickerData();
    }
  }, [searchSymbol]);

  const fetchTickerData = async () => {
    try {
      const response = await fetch(`/api/market/ticker/${searchSymbol}`);
      if (response.ok) {
        const data = await response.json();
        setTickerData(data);
      }
    } catch (error) {
      console.error("Error fetching ticker data:", error);
    }
  };

  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/scanner/scan', {
        symbol: searchSymbol,
        timeframe: selectedTimeframe,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setScanResult(data);
      toast({
        title: "Scan Complete",
        description: `Analysis for ${searchSymbol} completed`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Scan Failed",
        description: "Failed to analyze symbol. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  const handleScan = () => {
    if (!searchSymbol.trim()) {
      toast({
        title: "Invalid Symbol",
        description: "Please enter a valid symbol",
        variant: "destructive",
      });
      return;
    }
    scanMutation.mutate();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">Custom Scanner</h1>
          </div>

          {/* Search and Controls */}
          <Card className="border-border mb-6">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Input
                      placeholder="Search symbol (e.g. BTCUSDT)"
                      value={searchSymbol}
                      onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                      className="pl-10"
                      data-testid="input-search-symbol"
                    />
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-foreground">Timeframe:</label>
                  <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                    <SelectTrigger className="w-32" data-testid="select-timeframe">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15m">15min</SelectItem>
                      <SelectItem value="1h">1hr</SelectItem>
                      <SelectItem value="4h">4hr</SelectItem>
                      <SelectItem value="1d">1Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={handleScan}
                  disabled={scanMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-scan"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {scanMutation.isPending ? "Scanning..." : "Scan"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Price Info Bar */}
          {tickerData && (
            <Card className="border-border mb-6">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Rate</p>
                    <p className="text-lg font-bold text-foreground" data-testid="text-current-price">
                      ${parseFloat(tickerData.price).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">24h Change</p>
                    <p className={`text-lg font-bold ${parseFloat(tickerData.priceChangePercent) >= 0 ? 'text-accent' : 'text-destructive'}`} data-testid="text-price-change">
                      {parseFloat(tickerData.priceChangePercent) >= 0 ? '+' : ''}{parseFloat(tickerData.priceChangePercent).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">24h High</p>
                    <p className="text-lg font-bold text-foreground" data-testid="text-high-price">
                      ${parseFloat(tickerData.highPrice).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">24h Low</p>
                    <p className="text-lg font-bold text-foreground" data-testid="text-low-price">
                      ${parseFloat(tickerData.lowPrice).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* TradingView Chart */}
            <div className="lg:col-span-2">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Chart</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <TradingViewChart symbol={searchSymbol} interval={selectedTimeframe} />
                </CardContent>
              </Card>
            </div>

            {/* Technical Indicators */}
            <div>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Technical Indicators</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {scanResult ? (
                    <TechnicalIndicators analysis={scanResult} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Click "Scan" to analyze technical indicators
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
