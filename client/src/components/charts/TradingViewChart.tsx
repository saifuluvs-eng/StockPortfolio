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

const TIMEFRAMES = [
  { value: "15", label: "15min", display: "15m" },
  { value: "60", label: "1 hour", display: "1h" },
  { value: "240", label: "4 hours", display: "4h" },
  { value: "D", label: "1 day", display: "1D" },
  { value: "W", label: "1 week", display: "1W" },
];

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

    // Clear previous widget
    if (widgetRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Create TradingView widget
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    
    // Handle script loading
    script.onload = () => {
      setTimeout(() => setIsLoading(false), 2000); // Give TradingView time to fully render
    };
    
    script.innerHTML = JSON.stringify({
      autosize: false,
      width: "100%",
      height: height,
      symbol: `BINANCE:${symbol}`,
      interval: timeframe,
      timezone: "Etc/UTC",
      theme: theme === "dark" ? "dark" : "light",
      style: "1", // Candles
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: false,
      container_id: `tradingview-chart-${symbol}-${timeframe}`,
      // Professional features
      studies: showIndicators ? [
        "RSI@tv-basicstudies",
        "MACD@tv-basicstudies", 
        "BB@tv-basicstudies"
      ] : [],
      // Chart settings for professional look
      details: true,
      hotlist: false,
      calendar: false,
      studies_overrides: {
        "volume.volume.color.0": "rgba(255, 107, 53, 0.7)",
        "volume.volume.color.1": "rgba(78, 205, 196, 0.7)",
      },
      overrides: {
        "paneProperties.background": theme === "dark" ? "#1a1a1a" : "#ffffff",
        "paneProperties.vertGridProperties.color": theme === "dark" ? "#2a2a2a" : "#e1e1e1",
        "paneProperties.horzGridProperties.color": theme === "dark" ? "#2a2a2a" : "#e1e1e1",
        "symbolWatermarkProperties.transparency": 90,
        "scalesProperties.textColor": theme === "dark" ? "#ffffff" : "#131722",
        "mainSeriesProperties.candleStyle.upColor": "#4ECDC4",
        "mainSeriesProperties.candleStyle.downColor": "#FF6B35",
        "mainSeriesProperties.candleStyle.drawWick": true,
        "mainSeriesProperties.candleStyle.drawBorder": true,
        "mainSeriesProperties.candleStyle.borderUpColor": "#4ECDC4",
        "mainSeriesProperties.candleStyle.borderDownColor": "#FF6B35",
        "mainSeriesProperties.candleStyle.wickUpColor": "#4ECDC4",
        "mainSeriesProperties.candleStyle.wickDownColor": "#FF6B35",
      }
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, timeframe, theme, showIndicators, height]);

  const currentTimeframe = TIMEFRAMES.find(tf => tf.value === timeframe);

  return (
    <div className="w-full" data-testid="trading-chart">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4">
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
          
          {/* Price Info Placeholder */}
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


      {/* TradingView Chart Container */}
      <Card className="p-0 border-border overflow-hidden">
        <div 
          ref={containerRef}
          className="tradingview-widget-container"
          style={{ height: `${height}px` }}
          id={`tradingview-chart-${symbol}-${timeframe}`}
        />
        
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading {symbol} chart...</span>
            </div>
          </div>
        )}
      </Card>

      {/* Chart Footer */}
      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Powered by TradingView</span>
          <span>•</span>
          <span>Real-time data from Binance</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Timeframe: {currentTimeframe?.label}</span>
          <span>•</span>
          <span className="text-green-400">● Live</span>
        </div>
      </div>
    </div>
  );
}