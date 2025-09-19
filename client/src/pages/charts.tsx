import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  const { isAuthenticated, signInWithGoogle } = useAuth();
  
  // Parse URL parameters for automatic symbol setting and scanning
  const urlParams = new URLSearchParams(window.location.search);
  const symbolFromUrl = urlParams.get('symbol');
  const shouldAutoScan = urlParams.get('scan') === 'true';
  
  // Debug logging
  console.log('Charts page - URL params:', window.location.search);
  console.log('Charts page - symbolFromUrl:', symbolFromUrl);
  console.log('Charts page - shouldAutoScan:', shouldAutoScan);
  
  // All state hooks MUST be declared before any conditional returns
  const [selectedSymbol, setSelectedSymbol] = useState(symbolFromUrl || "BTCUSDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [showTechnicals, setShowTechnicals] = useState(true);
  const [searchInput, setSearchInput] = useState(symbolFromUrl ? symbolFromUrl.replace('USDT', '') : "BTC");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [hasAutoScanned, setHasAutoScanned] = useState(false);

  // Real-time price data via WebSocket with REST API fallback
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [usingRestFallback, setUsingRestFallback] = useState(false);
  
  // WebSocket refs for proper reconnection handling
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const restFallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSymbolRef = useRef<string>(selectedSymbol);
  const reconnectAttemptsRef = useRef(0);
  const priceDataRef = useRef<PriceData | null>(null);
  const usingRestFallbackRef = useRef(false);


  // Update symbol ref when selectedSymbol changes
  useEffect(() => {
    currentSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

 useEffect(() => {
    priceDataRef.current = priceData;
  }, [priceData]);

  useEffect(() => {
    usingRestFallbackRef.current = usingRestFallback;
  }, [usingRestFallback]);

  useEffect(() => {
    reconnectAttemptsRef.current = reconnectAttempts;
  }, [reconnectAttempts]);

  // REST API fallback function
  const fetchRestPriceData = useRef(async (symbol: string) => {
    try {
      console.log(`🔄 Fetching price data via REST API for ${symbol}`);
      const response = await apiRequest('GET', `/api/market/ticker/${symbol}`);
      
      const data = await response.json();
      
      // Transform REST data to match WebSocket data structure
      setPriceData({
        symbol: data.symbol,
        lastPrice: data.price || data.lastPrice,
        priceChange: data.priceChange || '0',
        priceChangePercent: data.priceChangePercent || '0',
        highPrice: data.highPrice || data.price || data.lastPrice,
        lowPrice: data.lowPrice || data.price || data.lastPrice,
        volume: data.volume || '0',
        quoteVolume: data.quoteVolume || '0'
      });
      
      console.log(`📊 Updated ${symbol} price via REST API:`, data.price || data.lastPrice);
      
    } catch (error) {
      console.error(`❌ REST API fallback failed for ${symbol}:`, error);
    }
  });

  // Start REST fallback polling
  const startRestFallback = useRef((symbol: string) => {
    if (restFallbackIntervalRef.current) {
      clearInterval(restFallbackIntervalRef.current);
    }
    
    console.log(`🏥 Starting REST API fallback for ${symbol}`);
    setUsingRestFallback(true);
    
    // Initial fetch
    fetchRestPriceData.current(symbol);
    
    // Poll every 5 seconds
    restFallbackIntervalRef.current = setInterval(() => {
      fetchRestPriceData.current(currentSymbolRef.current);
    }, 5000);
  });

  // Stop REST fallback polling
  const stopRestFallback = useRef(() => {
    if (restFallbackIntervalRef.current) {
      clearInterval(restFallbackIntervalRef.current);
      restFallbackIntervalRef.current = null;
    }
    setUsingRestFallback(false);
    console.log('✅ Stopped REST API fallback, WebSocket resumed');
  });
  
  // Show loading state when neither WebSocket nor REST fallback has data
  const showLoadingState = !wsConnected && !usingRestFallback && !priceData;
  
  // Fallback data loading message
  const getLoadingMessage = () => {
    if (usingRestFallback) return "Using REST fallback...";
    if (wsError) return reconnectAttempts > 3 ? "Connection failed..." : "Reconnecting...";
    if (!wsConnected) return "Connecting...";
    if (!priceData) return "Loading data...";
    return "...";
  };

  // Function to create WebSocket connection
  const createWebSocketConnection = useRef((symbol: string) => {
    console.log(`🔌 Creating WebSocket connection for ${symbol}`);
    
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('🟢 WebSocket connected for charts');
      setWsConnected(true);
      setWsError(false);
      setReconnectAttempts(0);

      reconnectAttemptsRef.current = 0;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Stop REST fallback if it was running
      stopRestFallback.current();
      
      // Subscribe to the currently selected symbol
      ws.send(JSON.stringify({ type: 'subscribe', symbol: symbol }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'price_update' && data.symbol === currentSymbolRef.current) {
          // Update price data with WebSocket ticker data (fixed data mapping)
          setPriceData({
            symbol: data.symbol,
            lastPrice: data.data.lastPrice,
            priceChange: data.data.priceChange || data.data.priceChangePercent, // Use priceChange if available
            priceChangePercent: data.data.priceChangePercent,
            highPrice: data.data.highPrice,
            lowPrice: data.data.lowPrice,
            volume: data.data.volume,
            quoteVolume: data.data.quoteVolume
          });
          
          console.log(`📈 Updated ${data.symbol} price via WebSocket:`, data.data.lastPrice);
        }
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('🔴 WebSocket error:', error);
      setWsError(true);
    };

    ws.onclose = (event) => {
      console.log(`🔴 WebSocket disconnected from charts: ${event.code} - ${event.reason}`);
      setWsConnected(false);
      
            if (event.code === 1000) {
        return;
      }

      const attempts = reconnectAttemptsRef.current;

      // Only attempt reconnection if we haven't exceeded max attempts
      if (attempts < 5) {
        setWsError(true);
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Calculate exponential backoff delay (1s, 2s, 4s, 8s, 16s)
        const delay = Math.min(1000 * Math.pow(2, attempts), 16000);
        reconnectTimeoutRef.current = setTimeout(() => {
          const nextAttempt = Math.min(reconnectAttemptsRef.current + 1, 5);
          console.log(`🔄 Attempting to reconnect WebSocket (attempt ${nextAttempt}/5)...`);
          reconnectTimeoutRef.current = null;
          setReconnectAttempts(prev => {
            const updated = Math.min(prev + 1, 5);
            reconnectAttemptsRef.current = updated;
            return updated;
          });
          createWebSocketConnection.current(currentSymbolRef.current);
        }, delay);
      } else {
        console.error('❌ Max reconnection attempts reached, switching to REST fallback');
        setWsError(true);
        
        // Start REST fallback when WebSocket fails completely
        startRestFallback.current(currentSymbolRef.current);
      }
    };

    return ws;
  });

  // WebSocket connection effect
  useEffect(() => {
    createWebSocketConnection.current(selectedSymbol);

    const fallbackTimer = setTimeout(() => {
      if (!priceDataRef.current && !usingRestFallbackRef.current) {
        console.warn('WebSocket did not deliver data within 10 seconds, switching to REST fallback.');
        setWsError(true);
        startRestFallback.current(currentSymbolRef.current);
      }
    }, 10000); // 10 second timeout

    return () => {
      clearTimeout(fallbackTimer);
      // Cleanup on unmount or symbol change
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (restFallbackIntervalRef.current) {
        clearInterval(restFallbackIntervalRef.current);
        restFallbackIntervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setUsingRestFallback(false);
    };
  }, [selectedSymbol]); // Re-connect when symbol changes

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
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze symbol. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-scan on page load with default BTC symbol or when coming from Portfolio
  useEffect(() => {
    console.log('Auto-scan useEffect triggered:', {
      isAuthenticated,
      isPending: scanMutation.isPending,
      hasAutoScanned,
      selectedSymbol,
      shouldAutoScan,
      symbolFromUrl,
      scanResult: !!scanResult
    });
    
    if (isAuthenticated && !scanMutation.isPending && !hasAutoScanned) {
      // Auto-scan if it's the default symbol or if explicitly requested via URL
      if ((selectedSymbol === "BTCUSDT" && !scanResult) || (shouldAutoScan && symbolFromUrl)) {
        console.log('Triggering auto-scan for symbol:', selectedSymbol);
        // Auto-scan after a short delay to allow price data to load
        const timer = setTimeout(() => {
          scanMutation.mutate();
          setHasAutoScanned(true);
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, selectedSymbol, scanResult, scanMutation, shouldAutoScan, symbolFromUrl, hasAutoScanned]);

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
    if (!isAuthenticated) {
      toast({
        title: "Feature Locked",
        description: "Please log in to search for other coins.",
        variant: "destructive",
      });
      return;
    }
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

  const priceChange = showLoadingState ? 0 : (priceData ? parseFloat(priceData.priceChangePercent) : 0);
  const isPositive = priceChange > 0;

  return (
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
              <div className="flex flex-wrap items-center gap-4 mb-3">
                <div className="flex-1 min-w-64 flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Enter coin (BTC, ETH, SOL...)"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="pl-10"
                      data-testid="input-search-symbol"
                      disabled={!isAuthenticated}
                    />
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  </div>
                  <Button 
                    onClick={handleSearch}
                    variant="outline"
                    className="px-4"
                    data-testid="button-search-coin"
                    disabled={!isAuthenticated}
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
                  disabled={scanMutation.isPending || !isAuthenticated}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-scan"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {scanMutation.isPending ? "Scanning..." : "Scan"}
                </Button>
              </div>
              
              {/* Current Symbol Display - Compact */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="w-3 h-3" />
                Currently Viewing: <span className="font-medium text-foreground">{selectedSymbol.replace('USDT', '/USDT')}</span>
              </div>
            </CardContent>
          </Card>


          {/* Price Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Price</p>
                    <p className="text-lg font-bold text-foreground" data-testid="current-price">
                      {showLoadingState ? getLoadingMessage() : formatPrice(priceData?.lastPrice || "0")}
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
                        {showLoadingState ? getLoadingMessage() : `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`}
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
                      {showLoadingState ? getLoadingMessage() : formatVolume(priceData?.quoteVolume || "0")}
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
                      {showLoadingState ? getLoadingMessage() : (
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
                <Card className="border-border h-[560px] flex flex-col overflow-hidden">
                  <CardHeader className="shrink-0">
                    <CardTitle className="text-lg font-bold">Breakdown Technicals</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 overflow-y-auto p-4">
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
  );
}
