import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import TradingViewChart from "@/components/charts/TradingViewChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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

const POPULAR_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "ADAUSDT", "SOLUSDT", "DOTUSDT", 
  "MATICUSDT", "LINKUSDT", "AVAXUSDT", "ATOMUSDT", "NEARUSDT"
];

const DEFAULT_TIMEFRAME = "240"; // 4 hours

export default function Charts() {
  const { toast } = useToast();
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState(DEFAULT_TIMEFRAME);
  const [showTechnicals, setShowTechnicals] = useState(true);
  const [searchInput, setSearchInput] = useState("BTC");

  // Fetch current price data for the selected symbol
  const { data: priceData, isLoading } = useQuery<PriceData>({
    queryKey: ['/api/market/ticker', selectedSymbol],
    refetchInterval: 5000, // Update every 5 seconds
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
    toast({
      title: "Market Scanner",
      description: "Advanced scanning features coming soon!",
    });
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
                Advanced Charts
              </h1>
              <p className="text-muted-foreground">Professional trading charts with technical analysis</p>
            </div>
            
            {/* Symbol Search */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter coin (BTC, ETH, SOL...)"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 w-64"
                  data-testid="symbol-search"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                size="default"
                data-testid="search-button"
              >
                <Search className="w-4 h-4 mr-1" />
                Search
              </Button>
              <Button 
                onClick={handleScan} 
                variant="outline"
                size="default"
                data-testid="scan-button"
              >
                <Scan className="w-4 h-4 mr-1" />
                SCAN
              </Button>
            </div>
          </div>

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
                      {isLoading ? "..." : formatPrice(priceData?.price || "0")}
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
                        {isLoading ? "..." : `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`}
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
                      {isLoading ? "..." : formatVolume(priceData?.volume || "0")}
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
                      {isLoading ? "..." : (
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

          {/* Chart Options */}
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Active features:</span>
                <Badge variant="secondary">Real-time Updates</Badge>
                <Badge variant="secondary">Professional Charts</Badge>
                {showTechnicals && <Badge variant="secondary">Technical Analysis</Badge>}
                <Badge variant="secondary">Multi-timeframes</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Main Chart */}
          <TradingViewChart
            symbol={selectedSymbol}
            timeframe={selectedTimeframe}
            onTimeframeChange={handleTimeframeChange}
            showIndicators={showTechnicals}
            theme="dark"
            height={600}
          />

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