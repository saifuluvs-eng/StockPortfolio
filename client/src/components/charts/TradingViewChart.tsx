import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Zap,
  RefreshCw 
} from "lucide-react";

interface TradingViewChartProps {
  symbol: string;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  showIndicators?: boolean;
  theme?: "light" | "dark";
  height?: number;
}

// Unified timeframe configuration (matching charts.tsx)
const TIMEFRAMES = [
  { value: "15", label: "15min", display: "15m", backend: "15m" },
  { value: "60", label: "1hr", display: "1h", backend: "1h" },
  { value: "240", label: "4hr", display: "4h", backend: "4h" },
  { value: "D", label: "1Day", display: "1D", backend: "1d" },
  { value: "W", label: "1Week", display: "1W", backend: "1w" },
];

// Map from our internal timeframes to TradingView intervals
const mapTimeframeToInterval = (timeframe: string): string => {
  const mapping: { [key: string]: string } = {
    "15": "15",
    "60": "60", 
    "240": "240",
    "D": "D",
    "W": "W"
  };
  return mapping[timeframe] || timeframe;
};

const TECHNICAL_INDICATORS = [
  { id: "RSI", name: "RSI", color: "#FF6B35" },
  { id: "MACD", name: "MACD", color: "#4ECDC4" },
  { id: "BB", name: "Bollinger Bands", color: "#45B7D1" },
  { id: "EMA", name: "EMA(20)", color: "#96CEB4" },
  { id: "SMA", name: "SMA(50)", color: "#FFEAA7" },
];

export default function TradingViewChart({
  symbol,
  timeframe,
  onTimeframeChange,
  showIndicators = true,
  theme = "dark",
  height = 500
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    setIsLoading(true);
    
    const container = containerRef.current;
    
    // Completely clear container to force fresh widget
    container.innerHTML = '';
    
    // Create official TradingView widget structure
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.id = `tradingview-chart-${symbol}-${timeframe}-${Date.now()}`;
    
    container.appendChild(widgetContainer);

    // Create TradingView script with simplified configuration
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    
    // Handle script loading
    script.onload = () => {
      setTimeout(() => setIsLoading(false), 2000); // Give TradingView time to fully render
    };
    
    // Use supported configuration only
    const config = {
      autosize: false,
      width: "100%",
      height: height,
      symbol: `BINANCE:${symbol}`,
      interval: mapTimeframeToInterval(timeframe),
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: false,
      backgroundColor: "#131722", // Force black background
      gridColor: "#363c4e",
      studies: showIndicators ? [
        "RSI@tv-basicstudies",
        "Volume@tv-basicstudies"
      ] : [],
      container_id: widgetContainer.id
    };
    
    script.innerHTML = JSON.stringify(config);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [symbol, timeframe, theme, showIndicators, height]);

  const currentTimeframe = TIMEFRAMES.find(tf => tf.value === timeframe);

  return (
    <div className="w-full" data-testid="trading-chart">
      {/* All Chart Content in One Card */}
      <Card className="border-border">
        {/* Chart Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                {symbol.replace('USDT', '/USDT')} Chart
              </h2>
              <Badge variant="outline" className="text-xs">
                Live
              </Badge>
            </div>
            
            {/* Price Info */}
            <div className="hidden md:flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-muted-foreground">Live Price Updates</span>
              </div>
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {TIMEFRAMES.map((tf) => (
                <Button
                  key={tf.value}
                  variant={timeframe === tf.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTimeframeChange(tf.value)}
                  className="h-8 px-3"
                  data-testid={`timeframe-${tf.value}`}
                >
                  {tf.display}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Professional Black TradingView Chart */}
        <div className="p-0 bg-[#131722] overflow-hidden relative">
          <div 
            ref={containerRef}
            className="tradingview-widget-container bg-[#131722]"
            style={{ height: `${height}px` }}
            id={`tradingview-chart-${symbol}-${timeframe}`}
          />
          
          {/* Loading State */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/80 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2 text-white">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Loading {symbol} chart...</span>
              </div>
            </div>
          )}
        </div>

        {/* Chart Footer */}
        <div className="flex items-center justify-between p-4 pt-3 border-t border-border/50 text-xs text-muted-foreground bg-background">
          <div className="flex items-center gap-4">
            <span>Powered by TradingView</span>
            <span>•</span>
            <span>Real-time data from Binance</span>
            {showIndicators && (
              <>
                <span>•</span>
                <span className="text-purple-400">RSI & Volume Indicators Active</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Timeframe: {currentTimeframe?.label}</span>
            <span>•</span>
            <span className="text-green-400">● Live</span>
          </div>
        </div>
      </Card>
    </div>
  );
}