import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import TradingViewChart from "@/components/charts/TradingViewChart";
import { TechnicalIndicators } from "@/components/scanner/technical-indicators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
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
  lastPrice: string; // Binance uses 'lastPrice' not 'price'
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
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

// Unified timeframe configuration for all components
const TIMEFRAMES = [
  { value: "15", label: "15min", display: "15m", backend: "15m" },
  { value: "60", label: "1hr", display: "1h", backend: "1h" },
  { value: "240", label: "4hr", display: "4h", backend: "4h" },
  { value: "D", label: "1Day", display: "1D", backend: "1d" },
  { value: "W", label: "1Week", display: "1W", backend: "1w" },
];

export default function Charts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT"); // Default to BTC
  const [selectedTimeframe, setSelectedTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [showTechnicals, setShowTechnicals] = useState(true);
  const [searchInput, setSearchInput] = useState("BTC"); // Default search to BTC
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
  const { data: priceData, isLoading: isPriceLoading, refetch } = useQuery<PriceData>({
    queryKey: ['/api/market/ticker', selectedSymbol],
    refetchInterval: 5000, // Update every 5 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Consider data immediately stale
  });

  // Force refetch when symbol changes
  useEffect(() => {
    refetch();
  }, [selectedSymbol, refetch]);

  const scanMutation = useMutation({
    mutationFn: async () => {
      // Find the backend timeframe value using our unified configuration
      const timeframeConfig = TIMEFRAMES.find(tf => tf.value === selectedTimeframe);
      const backendTimeframe = timeframeConfig?.backend || selectedTimeframe;
      
      const response = await apiRequest('POST', '/api/scanner/scan', {
        symbol: selectedSymbol,
        timeframe: backendTimeframe,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setScanResult(data);
      // Temporarily disable notification to stop spam
      // toast({
      //   title: "Technical Analysis Complete", 
      //   description: `Analysis for ${selectedSymbol} completed`,
      // });
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

  // Auto-scan on page load with default BTC symbol
  useEffect(() => {
    if (isAuthenticated && selectedSymbol === "BTCUSDT" && !scanResult && !scanMutation.isPending) {
      // Auto-scan after a short delay to allow price data to load
      const timer = setTimeout(() => {
        scanMutation.mutate();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, selectedSymbol, scanResult]);

  // Auto-scan when timeframe changes (but only after initial scan)
  const hasScannedRef = useRef(false);
  
  // Track if we've ever scanned
  useEffect(() => {
    if (scanResult) {
      hasScannedRef.current = true;
    }
  }, [scanResult]);

  // Re-scan when timeframe changes
  useEffect(() => {
    if (isAuthenticated && hasScannedRef.current && !scanMutation.isPending) {
      scanMutation.mutate();
    }
  }, [selectedTimeframe, isAuthenticated]);

  const handleSearch = () => {
    console.log('🔍 Search clicked, input:', searchInput, 'current symbol:', selectedSymbol);
    
    if (!searchInput.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a coin symbol (e.g., BTC, ETH, SOL)",
        variant: "destructive",
      });
      return;
    }

    let coinSymbol = searchInput.trim().toUpperCase();
    
    // If user already entered USDT pair, use as is, otherwise append USDT
    const fullSymbol = coinSymbol.endsWith('USDT') ? coinSymbol : coinSymbol + 'USDT';
    
    console.log('🚀 Updating symbol from', selectedSymbol, 'to', fullSymbol);
    setSelectedSymbol(fullSymbol);
    
    // Clear the search input after successful search
    setSearchInput('');
    
    toast({
      title: "Symbol Updated",
      description: `Loading ${coinSymbol.replace('USDT', '')}/USDT chart`,
    });
  };

  const handleScan = () => {
    console.log('💥 Scan clicked, input:', searchInput, 'current symbol:', selectedSymbol);
    
    // If user typed something in search but didn't search, update the symbol first
    if (searchInput.trim() && searchInput.trim().toUpperCase() !== selectedSymbol.replace('USDT', '')) {
      const coinSymbol = searchInput.trim().toUpperCase();
      const fullSymbol = coinSymbol.endsWith('USDT') ? coinSymbol : coinSymbol + 'USDT';
      
      console.log('🔄 Auto-updating symbol from', selectedSymbol, 'to', fullSymbol, 'before scan');
      setSelectedSymbol(fullSymbol);
      
      // Clear search input
      setSearchInput('');
      
      toast({
        title: "Symbol Updated & Scanning",
        description: `Analyzing ${coinSymbol.replace('USDT', '')}/USDT`,
      });
      
      // Let React update the state first, then scan on next render
      setTimeout(() => scanMutation.mutate(), 100);
      return;
    }
    
    if (!selectedSymbol.trim()) {
      toast({
        title: "Invalid Symbol", 
        description: "Please select a valid symbol",
        variant: "destructive",
      });
      return;
    }
    
    console.log('🎯 Scanning current symbol:', selectedSymbol);
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

  // Helper functions for Overall Analysis card
  const getScoreColor = (score: number) => {
    if (score >= 10) return 'text-green-600';
    if (score >= 5) return 'text-green-500';
    if (score <= -10) return 'text-red-600';
    if (score <= -5) return 'text-red-500';
    return 'text-yellow-500';
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

          {/* Scanner Controls */}
          <Card>
            <CardContent className="pt-6">
              {/* SCANNER CONTROLS REPLACING ORIGINAL CONTENT */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex-1 min-w-64 flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Enter coin (BTC, ETH, SOL...)"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="pl-10"
                      data-testid="input-search-symbol"
                    />
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  </div>
                  <Button 
                    onClick={handleSearch}
                    variant="outline"
                    className="px-4"
                    data-testid="button-search-coin"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-foreground">Timeframe:</label>
                  <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                    <SelectTrigger className="w-32" data-testid="select-timeframe">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEFRAMES.map((tf) => (
                        <SelectItem key={tf.value} value={tf.value}>
                          {tf.label}
                        </SelectItem>
                      ))}
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

          {/* Current Symbol Display */}
          <div className="flex items-center justify-center mb-4">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              <Activity className="w-4 h-4 mr-2" />
              Currently Viewing: {selectedSymbol.replace('USDT', '/USDT')}
            </Badge>
          </div>

          {/* Price Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Price</p>
                    <p className="text-lg font-bold text-foreground" data-testid="current-price">
                      {isPriceLoading ? "..." : formatPrice(priceData?.lastPrice || "0")}
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
                      {isPriceLoading ? "..." : formatVolume(priceData?.quoteVolume || "0")}
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
                    <p className="text-sm text-muted-foreground">Today's High/Low</p>
                    <p className="text-sm font-medium text-foreground">
                      {isPriceLoading ? "..." : (
                        <>
                          {formatPrice(priceData?.lowPrice || "0")} - {formatPrice(priceData?.highPrice || "0")}
                        </>
                      )}
                    </p>
                  </div>
                  <Target className="w-5 h-5 text-accent" />
                </div>
              </CardContent>
            </Card>

            {/* Overall Analysis Card */}
            {scanResult && (
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Overall Analysis</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-lg font-bold ${getScoreColor(scanResult.totalScore)}`} data-testid="text-total-score">
                          {scanResult.totalScore > 0 ? '+' : ''}{scanResult.totalScore}
                        </span>
                        <Badge className={`${getRecommendationColor(scanResult.recommendation)} px-2 py-1 text-xs`} data-testid="badge-recommendation">
                          {scanResult.recommendation.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Progress value={Math.max(0, Math.min(100, ((scanResult.totalScore + 30) / 60) * 100))} className="h-2 mb-1" />
                      <p className="text-xs text-muted-foreground">
                        Range: -30 to +30
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>


          {/* Main Layout: Technical Indicators (Left) + Chart (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Technical Indicators - Left Side (1/3 width) */}
            {showTechnicals && (
              <div className="lg:col-span-1">
                <Card className="border-border" style={{height: '560px'}}>
                  <CardHeader className="flex-shrink-0">
                    <CardTitle className="text-lg font-bold">Breakdown Technicals</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 overflow-y-auto" style={{height: 'calc(560px - 64px)'}}>
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
                key={`${selectedSymbol}-${selectedTimeframe}-${showTechnicals}-dark-v2`}
                symbol={selectedSymbol}
                timeframe={selectedTimeframe}
                onTimeframeChange={handleTimeframeChange}
                showIndicators={showTechnicals}
                theme="dark"
                height={560}
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