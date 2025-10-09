import { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView?: any;
    _tvScriptLoading?: boolean;
  }
}

const TV_SCRIPT_SRC = "https://s3.tradingview.com/tv.js";

function ensureTradingViewScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TradingView) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${TV_SCRIPT_SRC}"]`,
    );

    const waitForWidget = () => {
      if (window.TradingView) {
        resolve();
      } else {
        setTimeout(waitForWidget, 50);
      }
    };

    if (existingScript) {
      waitForWidget();
      return;
    }

    if (window._tvScriptLoading) {
      waitForWidget();
      return;
    }

    window._tvScriptLoading = true;
    const script = document.createElement("script");
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      window._tvScriptLoading = false;
      if (window.TradingView) {
        resolve();
      } else {
        reject(new Error("TradingView library failed to initialize"));
      }
    };
    script.onerror = (event) => {
      window._tvScriptLoading = false;
      reject(event);
    };
    document.body.appendChild(script);
  });
}

export default function TVChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const createWidget = () => {
      if (cancelled || !containerRef.current || !window.TradingView) {
        return;
      }

      const setupWidget = () => {
        if (cancelled || !containerRef.current || !window.TradingView) {
          return;
        }

        containerRef.current.innerHTML = "";
        widgetRef.current = new window.TradingView.widget({
          container_id: "tv-chart",
          symbol: "BINANCE:BTCUSDT",
          interval: "240",
          timezone: "Etc/UTC",
          theme: "dark",
          autosize: true,
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          studies: ["RSI@tv-basicstudies"],
        });
      };

      if (typeof window.TradingView.onready === "function") {
        window.TradingView.onready(setupWidget);
      } else {
        setupWidget();
      }
    };

    ensureTradingViewScript()
      .then(() => {
        if (!cancelled) {
          createWidget();
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load TradingView chart", error);
        }
      });

      return () => {
        cancelled = true;
        if (widgetRef.current) {
          if (typeof widgetRef.current.remove === "function") {
            widgetRef.current.remove();
          } else if (typeof widgetRef.current.destroy === "function") {
            widgetRef.current.destroy();
          }
          widgetRef.current = null;
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
      };
  }, []);

  return <div id="tv-chart" ref={containerRef} className="h-full w-full" />;
}
