import { memo, useEffect, useRef } from "react";

type TradingViewWidgetProps = {
  symbol: string;
  interval: string;
  theme?: "light" | "dark";
  studies?: string[];
  hideSideToolbar?: boolean;
  hideTopToolbar?: boolean;
  backgroundColor?: string;
  gridColor?: string;
  onError?: (error?: Error) => void;
};

const DEFAULT_STUDIES: string[] = [];

function normalizeSymbol(raw: string) {
  const trimmed = (raw || "").trim().toUpperCase();
  if (!trimmed) return "BINANCE:BTCUSDT";
  return trimmed.includes(":") ? trimmed : `BINANCE:${trimmed}`;
}

function TradingViewWidgetComponent({
  symbol,
  interval,
  theme = "dark",
  studies = DEFAULT_STUDIES,
  hideSideToolbar = true,
  hideTopToolbar = false,
  backgroundColor = "#0F0F0F",
  gridColor = "rgba(242, 242, 242, 0.06)",
  onError,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const widgetIdRef = useRef<string>(
    `tradingview-widget-${Math.random().toString(36).slice(2)}`,
  );
  const normalizedSymbol = normalizeSymbol(symbol);
  const [exchange, pair] = normalizedSymbol.split(":");
  const linkSymbol = (pair ?? exchange ?? "BTCUSDT").toUpperCase();
  const linkExchange = (pair ? exchange : "BINANCE") ?? "BINANCE";

  useEffect(() => {
    const containerEl = containerRef.current;
    const widgetEl = widgetRef.current;
    if (!containerEl || !widgetEl) return;

    widgetEl.innerHTML = "";
    widgetEl.id = widgetIdRef.current;
    scriptRef.current?.remove();
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.setAttribute("data-tradingview-config", "advanced-chart");

    const config = {
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: hideSideToolbar,
      hide_top_toolbar: hideTopToolbar,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval,
      locale: "en",
      save_image: true,
      style: "1",
      symbol: normalizedSymbol,
      theme,
      timezone: "Etc/UTC",
      backgroundColor,
      gridColor,
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies,
      autosize: true,
      container_id: widgetIdRef.current,
    };

    script.innerHTML = JSON.stringify(config, null, 2);

    const handleError = () => {
      const error = new Error("TradingView widget script failed to load");
      onError?.(error);
    };

    script.addEventListener("error", handleError, { once: true });
    containerEl.appendChild(script);
    scriptRef.current = script;

    return () => {
      script.removeEventListener("error", handleError);
      script.remove();
      scriptRef.current = null;
      widgetEl.innerHTML = "";
    };
  }, [
    normalizedSymbol,
    interval,
    theme,
    studies,
    hideSideToolbar,
    hideTopToolbar,
    backgroundColor,
    gridColor,
    onError,
  ]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: "100%", height: "100%" }}
    >
      <div
        ref={widgetRef}
        className="tradingview-widget-container__widget"
        style={{ width: "100%", height: "calc(100% - 32px)" }}
      />
      <div className="tradingview-widget-copyright">
        <a
          href={`https://www.tradingview.com/symbols/${linkSymbol}/?exchange=${linkExchange}`}
          rel="noopener nofollow"
          target="_blank"
        >
          <span className="blue-text">{linkSymbol} chart</span>
        </a>
        <span className="trademark"> by TradingView</span>
      </div>
    </div>
  );
}

export const TradingViewWidget = memo(TradingViewWidgetComponent);
export default TradingViewWidget;
