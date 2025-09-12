import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import TradingViewChart from "@/components/charts/TradingViewChart";
import { TechnicalIndicators } from "@/components/scanner/technical-indicators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart3,
  TrendingUp, 
  TrendingDown,
  Activity,
  DollarSign,
  Volume,
  Target,
  Zap,
  Search,
  Scan
} from "lucide-react";

interface PriceData {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  high: string;
  low: string;
}

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

const POPULAR_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "ADAUSDT", "SOLUSDT", "DOTUSDT", 
  "MATICUSDT", "LINKUSDT", "AVAXUSDT", "ATOMUSDT", "NEARUSDT"
];

const DEFAULT_TIMEFRAME = "240"; // 4 hours

export default function Charts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [showTechnicals, setShowTechnicals] = useState(true);
  const [searchInput, setSearchInput] = useState("BTC");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Show sign-in UI if not authenticated
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <BarChart3 className="w-6 h-6" />
                Advanced Charts Access
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Please sign in to access advanced charts and technical analysis.
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

  // Fetch current price data for the selected symbol
  const { data: priceData, isLoading: isPriceLoading } = useQuery<PriceData>({
    queryKey: ['/api/market/ticker', selectedSymbol],
    refetchInterval: 5000, // Update every 5 seconds
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/scanner/scan', {
        symbol: selectedSymbol,
        timeframe: selectedTimeframe === "240" ? "4h" : selectedTimeframe,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setScanResult(data);
      toast({
        title: "Technical Analysis Complete",
        description: `Analysis for ${selectedSymbol} completed`,
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
        title: "Analysis Failed",
        description: "Failed to analyze symbol. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!searchInput.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a coin symbol (e.g., BTC, ETH, SOL)",
        variant: "destructive",
      });
      return;
    }

    const coinSymbol = searchInput.trim().toUpperCase();
    const fullSymbol = coinSymbol + "USDT";
    setSelectedSymbol(fullSymbol);
    
    toast({
      title: "Symbol Updated",
      description: `Loading ${coinSymbol}/USDT chart`,
    });
  };

  const handleScan = () => {
    if (!selectedSymbol.trim()) {
      toast({
        title: "Invalid Symbol",
        description: "Please select a valid symbol",
        variant: "destructive",
      });
      return;
    }
    scanMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num >= 1000) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (num >= 1) return `$${num.toFixed(4)}`;
    return `$${num.toFixed(8)}`;
  };

  const formatVolume = (volume: string) => {
    const num = parseFloat(volume);
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const priceChange = priceData ? parseFloat(priceData.priceChangePercent) : 0;
  const isPositive = priceChange > 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-primary" />
                SCAN
              </h1>
              <p className="text-muted-foreground">Professional trading charts with technical analysis</p>
            </div>
          </div>

          {/* Chart Settings - REPLACED CONTENT WITH SCANNER CONTROLS */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Chart Settings
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showTechnicals ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowTechnicals(!showTechnicals)}
                    data-testid="toggle-indicators"
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    Technical Indicators
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* SCANNER CONTROLS REPLACING ORIGINAL CONTENT */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Input
                      placeholder="Search symbol (e.g. BTCUSDT)"
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
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
                      <SelectItem value="60">1hr</SelectItem>
                      <SelectItem value="240">4hr</SelectItem>
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
              
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Active features:</span>
                <Badge variant="secondary">Real-time Updates</Badge>
                <Badge variant="secondary">Professional Charts</Badge>
                {showTechnicals && <Badge variant="secondary">Technical Analysis</Badge>}
                <Badge variant="secondary">Multi-timeframes</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Current Symbol Display */}
          <div className="flex items-center justify-center mb-4">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              <Activity className="w-4 h-4 mr-2" />
              Currently Viewing: {selectedSymbol.replace('USDT', '/USDT')}
            </Badge>
          </div>

          {/* Price Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Price</p>
                    <p className="text-lg font-bold text-foreground" data-testid="current-price">
                      {isPriceLoading ? "..." : formatPrice(priceData?.price || "0")}
                    </p>
                  </div>
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">24h Change</p>
                    <div className="flex items-center gap-1">
                      <p className={`text-lg font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPriceLoading ? "..." : `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`}
                      </p>
                    </div>
                  </div>
                  {isPositive ? (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">24h Volume</p>
                    <p className="text-lg font-bold text-foreground">
                      {isPriceLoading ? "..." : formatVolume(priceData?.volume || "0")}
                    </p>
                  </div>
                  <Volume className="w-5 h-5 text-secondary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">24h Range</p>
                    <p className="text-sm font-medium text-foreground">
                      {isPriceLoading ? "..." : (
                        <>
                          {formatPrice(priceData?.low || "0")} - {formatPrice(priceData?.high || "0")}
                        </>
                      )}
                    </p>
                  </div>
                  <Target className="w-5 h-5 text-accent" />
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Main Layout: Technical Indicators (Left) + Chart (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Technical Indicators - Left Side (1/3 width) */}
            {showTechnicals && (
              <div className="lg:col-span-1">
                <Card className="border-border" style={{height: '600px'}}>
                  <CardHeader className="flex-shrink-0">
                    <CardTitle className="text-lg font-bold">Breakdown Technicals</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 overflow-y-auto" style={{height: 'calc(600px - 80px)'}}>
                    {scanResult ? (
                      <TechnicalIndicators analysis={scanResult} />
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No Analysis Available</h3>
                        <p>Click "Scan" to analyze technical indicators and get detailed insights</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Main Chart - Right Side (2/3 width) */}
            <div className={`${showTechnicals ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <TradingViewChart
                symbol={selectedSymbol}
                timeframe={selectedTimeframe}
                onTimeframeChange={handleTimeframeChange}
                showIndicators={showTechnicals}
                theme="dark"
                height={600}
              />
            </div>
          </div>

          {/* Chart Analysis Footer */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Current Analysis</h4>
                  <p className="text-muted-foreground">
                    {isPositive ? "Bullish momentum" : "Bearish pressure"} detected on {selectedSymbol.replace('USDT', '/USDT')}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Technical Indicators</h4>
                  <p className="text-muted-foreground">
                    RSI, MACD, and Bollinger Bands are {showTechnicals ? "active" : "disabled"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Data Source</h4>
                  <p className="text-muted-foreground">
                    Live data from Binance via TradingView
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}