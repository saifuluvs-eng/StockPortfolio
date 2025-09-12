import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval: string;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

export function TradingViewChart({ symbol, interval }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load TradingView script if not already loaded
    if (!window.TradingView) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => createWidget();
      document.head.appendChild(script);
    } else {
      createWidget();
    }

    return () => {
      // Cleanup widget if needed
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, interval]);

  const createWidget = () => {
    if (window.TradingView && containerRef.current) {
      containerRef.current.innerHTML = '';
      
      new window.TradingView.widget({
        autosize: true,
        symbol: `BINANCE:${symbol}`,
        interval: interval,
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: containerRef.current.id,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        backgroundColor: "rgba(0, 0, 0, 0)",
        gridColor: "rgba(255, 255, 255, 0.1)",
        hide_volume: false,
        studies: [
          "MASimple@tv-basicstudies",
          "RSI@tv-basicstudies",
          "MACD@tv-basicstudies"
        ]
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      id={`tradingview-chart-${Date.now()}`}
      className="h-[400px] w-full rounded-b-xl"
      data-testid="tradingview-chart"
    />
  );
}
