// client/src/components/TVChart.tsx
import { useCallback, useEffect, useRef, useState } from "react";

type TVChartProps = {
  // Defaults from parent are fine (BTCUSDT / 4h). Component will
  // also auto-update when it sees /api/scan fetches and tv:update events.
  symbol?: string; // e.g. "BTCUSDT"
  timeframe?: string; // e.g. "4h"
};

declare global {
  interface Window {
    TradingView?: any;
    __tvSet?: (sym: string, tf: string) => void;
  }
}

const TV_SRC = "https://s3.tradingview.com/tv.js";

let tradingViewLoader: Promise<any> | null = null;

const loadTradingViewScript = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("TradingView requires a browser environment"));
  }

  if (window.TradingView) {
    return Promise.resolve(window.TradingView);
  }

  if (!tradingViewLoader) {
    tradingViewLoader = new Promise((resolve, reject) => {
      const cleanup = (script: HTMLScriptElement, onLoad: () => void, onError: (e: Event) => void) => {
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
      };

      const handleLoad = () => {
        if (window.TradingView) {
          resolve(window.TradingView);
        } else {
          tradingViewLoader = null;
          reject(new Error("TradingView script loaded but API is unavailable"));
        }
      };

      const handleError = (event: Event) => {
        tradingViewLoader = null;
        reject(event);
      };

      const existing = document.querySelector<HTMLScriptElement>(`script[src="${TV_SRC}"]`);

      if (existing) {
        existing.addEventListener("load", handleLoad, { once: true });
        existing.addEventListener("error", handleError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = TV_SRC;
      script.async = true;

      const onLoad = () => {
        cleanup(script, onLoad, onError);
        handleLoad();
      };

      const onError = (event: Event) => {
        cleanup(script, onLoad, onError);
        handleError(event);
      };

      script.addEventListener("load", onLoad);
      script.addEventListener("error", onError);

      document.head.appendChild(script);
    });
  }

  return tradingViewLoader;
};

const normalizeSymbol = (raw: string) =>
  (raw || "")
    .toString()
    .trim()
    .toUpperCase()
    .split(":")
    .pop()!
    .replace(/\s+/g, "");

const mapInterval = (tf: string) => {
  const t = (tf || "").toLowerCase();
  const m: Record<string, string> = {
    "15m": "15",
    "30m": "30",
    "45m": "45",
    "1h": "60",
    "2h": "120",
    "3h": "180",
    "4h": "240",
    "6h": "360",
    "8h": "480",
    "12h": "720",
    "1d": "D",
    "1day": "D",
    "1w": "W",
    "1m": "M",
  };
  if (t === "1day") return "D";
  if (t === "1w") return "W";
  if (t === "1m") return "M";
  return m[t] ?? "240";
};

export default function TVChart({
  symbol = "BTCUSDT",
  timeframe = "4h",
}: TVChartProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<{ symbol: string; timeframe: string } | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const restoreFetchRef = useRef<(() => void) | null>(null);
  const latestSymbolRef = useRef(normalizeSymbol(symbol));
  const latestTfRef = useRef(timeframe);
  const containerIdRef = useRef(`tv-chart-${Math.random().toString(36).slice(2)}`);
  const [isReady, setIsReady] = useState(false);

  const applySymbolToChart = useCallback((resolvedSymbol: string, resolvedTf: string) => {
    const widget = widgetRef.current;
    if (!widget || typeof widget.activeChart !== "function") {
      return false;
    }

    try {
      widget.activeChart().setSymbol(
        `BINANCE:${resolvedSymbol}`,
        mapInterval(resolvedTf),
        () => { },
      );
      return true;
    } catch (error) {
      console.error("[TVChart] failed to set symbol", error);
      return false;
    }
  }, []);

  const applySymbolRef = useRef(applySymbolToChart);
  useEffect(() => {
    applySymbolRef.current = applySymbolToChart;
  }, [applySymbolToChart]);

  const queueSymbolAndTf = useCallback(
    (nextSymbol?: string, nextTf?: string) => {
      const resolvedSymbol = normalizeSymbol(
        nextSymbol || latestSymbolRef.current || symbol || "BTCUSDT",
      );
      if (!resolvedSymbol) return;

      const resolvedTfRaw = nextTf ?? latestTfRef.current ?? timeframe ?? "4h";
      const resolvedTfString = `${resolvedTfRaw}`.trim();
      const resolvedTf = resolvedTfString || "4h";

      latestSymbolRef.current = resolvedSymbol;
      latestTfRef.current = resolvedTf;

      if (!readyRef.current) {
        pendingRef.current = { symbol: resolvedSymbol, timeframe: resolvedTf };
        return;
      }

      if (!applySymbolToChart(resolvedSymbol, resolvedTf)) {
        pendingRef.current = { symbol: resolvedSymbol, timeframe: resolvedTf };
      } else {
        pendingRef.current = null;
      }
    },
    [applySymbolToChart, symbol, timeframe],
  );

  useEffect(() => {
    latestSymbolRef.current = normalizeSymbol(symbol);
    latestTfRef.current = timeframe;
    queueSymbolAndTf(symbol, timeframe);
  }, [symbol, timeframe, queueSymbolAndTf]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let disposed = false;

    loadTradingViewScript()
      .then(() => {
        if (disposed || !containerRef.current || !window.TradingView) {
          return;
        }

        const host = containerRef.current;
        host.innerHTML = "";

        readyRef.current = false;

        const initialSymbol =
          normalizeSymbol(latestSymbolRef.current || symbol || "BTCUSDT") || "BTCUSDT";
        const initialTf = latestTfRef.current || timeframe || "4h";
        latestSymbolRef.current = initialSymbol;
        latestTfRef.current = initialTf;

        try {
          widgetRef.current?.remove?.();
        } catch { }

        const widget = new window.TradingView.widget({
          container_id: containerIdRef.current,
          symbol: `BINANCE:${initialSymbol}`,
          interval: mapInterval(initialTf),
          theme: "dark",
          autosize: true,
          timezone: "Etc/UTC",
          hide_side_toolbar: false,
          hide_top_toolbar: false,
          withdateranges: true,
          details: false,
          allow_symbol_change: true,
          studies: ["RSI@tv-basicstudies"],
          loading_screen: { backgroundColor: "#111113" },
        });

        widgetRef.current = widget;

        widget.onChartReady?.(() => {
          if (disposed) return;
          readyRef.current = true;
          setIsReady(true);
          const pending = pendingRef.current;
          const symbolToUse = pending?.symbol ?? latestSymbolRef.current;
          const timeframeToUse = pending?.timeframe ?? latestTfRef.current;
          if (symbolToUse && timeframeToUse) {
            if (applySymbolRef.current(symbolToUse, timeframeToUse)) {
              pendingRef.current = null;
            }
          }
        });

        if (typeof ResizeObserver !== "undefined") {
          try {
            roRef.current?.disconnect();
          } catch { }
          const observer = new ResizeObserver(() => {
            try {
              widgetRef.current?.resize?.();
            } catch { }
          });
          roRef.current = observer;
          const target = wrapperRef.current ?? containerRef.current;
          if (target) {
            observer.observe(target);
          }
        }
      })
      .catch((e) => console.error("[TVChart] load error", e));

    return () => {
      disposed = true;
      try {
        roRef.current?.disconnect();
      } catch { }
      roRef.current = null;
      try {
        widgetRef.current?.remove?.();
      } catch { }
      widgetRef.current = null;
      readyRef.current = false;
      pendingRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const setter = (sym: string, tf: string) => {
      try {
        const normalized = normalizeSymbol(sym);
        if (!normalized) return;
        const tfValue = tf && `${tf}`.trim() ? tf : latestTfRef.current || timeframe || "4h";
        queueSymbolAndTf(normalized, tfValue);
      } catch { }
    };

    window.__tvSet = setter;

    return () => {
      if (window.__tvSet === setter) {
        window.__tvSet = undefined;
      }
    };
  }, [queueSymbolAndTf, timeframe]);

  useEffect(() => {
    const listener = (e: Event) => {
      const { symbol: nextSymbol, timeframe: nextTf } =
        (e as CustomEvent<{ symbol?: string; timeframe?: string }>).detail || {};
      if (nextSymbol && nextTf) {
        queueSymbolAndTf(nextSymbol, nextTf);
      }
    };

    window.addEventListener("tv:update", listener as EventListener);
    return () => {
      window.removeEventListener("tv:update", listener as EventListener);
    };
  }, [queueSymbolAndTf]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fetch !== "function") return;
    if (restoreFetchRef.current) return;

    let disposed = false;
    const originalFetch = window.fetch.bind(window);

    const extractScanParams = async (
      args: Parameters<typeof fetch>,
    ): Promise<{ matched: boolean; symbol?: string; timeframe?: string }> => {
      try {
        const [input, init] = args;
        let urlString: string | undefined;
        let method: string | undefined = init?.method;
        let requestClone: Request | null = null;
        let initBody: BodyInit | null | undefined = init?.body ?? null;

        if (input instanceof Request) {
          urlString = input.url;
          method = input.method || method;
          requestClone = input.clone();
          initBody = initBody ?? null;
        } else if (typeof input === "string" || input instanceof URL) {
          urlString = input.toString();
        } else if (input && typeof input === "object" && "url" in input) {
          const maybeUrl = (input as { url?: string }).url;
          if (typeof maybeUrl === "string") {
            urlString = maybeUrl;
          }
        }

        if (!urlString || !urlString.includes("/api/scan")) {
          return { matched: false };
        }

        let symbol: string | undefined;
        let timeframeValue: string | undefined;

        try {
          const parsed = new URL(urlString, window.location.origin);
          symbol =
            parsed.searchParams.get("symbol") ??
            parsed.searchParams.get("pair") ??
            undefined;
          timeframeValue =
            parsed.searchParams.get("tf") ??
            parsed.searchParams.get("timeframe") ??
            undefined;
        } catch { }

        const methodUpper = (method || (initBody ? "POST" : "GET")).toUpperCase();

        const parseTextPayload = async (text: string | null | undefined) => {
          if (!text) return;
          try {
            const parsedJson = JSON.parse(text);
            if (parsedJson && typeof parsedJson === "object") {
              const candidate = parsedJson as Record<string, unknown>;
              symbol = (candidate.symbol ?? candidate.pair ?? symbol) as string | undefined;
              timeframeValue =
                (candidate.tf ?? candidate.timeframe ?? candidate.interval ?? timeframeValue) as
                | string
                | undefined;
            }
            return;
          } catch { }

          try {
            const params = new URLSearchParams(text);
            symbol = symbol ?? params.get("symbol") ?? params.get("pair") ?? undefined;
            timeframeValue =
              timeframeValue ?? params.get("tf") ?? params.get("timeframe") ?? undefined;
          } catch { }
        };

        if (methodUpper !== "GET") {
          if (requestClone) {
            try {
              const bodyText = await requestClone.text();
              await parseTextPayload(bodyText);
            } catch { }
          } else if (initBody) {
            if (typeof initBody === "string") {
              await parseTextPayload(initBody);
            } else if (
              typeof URLSearchParams !== "undefined" &&
              initBody instanceof URLSearchParams
            ) {
              await parseTextPayload(initBody.toString());
            } else if (typeof FormData !== "undefined" && initBody instanceof FormData) {
              const pairs: string[] = [];
              initBody.forEach((value, key) => {
                if (typeof value === "string") {
                  pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                }
              });
              if (pairs.length > 0) {
                await parseTextPayload(pairs.join("&"));
              }
            }
          }
        }

        return { matched: true, symbol, timeframe: timeframeValue };
      } catch {
        return { matched: false };
      }
    };

    const wrappedFetch: typeof window.fetch = (...args) => {
      const paramsPromise = extractScanParams(args as Parameters<typeof fetch>);
      paramsPromise
        .then(({ matched, symbol: rawSymbol, timeframe: rawTf }) => {
          if (!matched || disposed) return;
          if (!rawSymbol) return;
          const cleanedSymbol = normalizeSymbol(rawSymbol);
          if (!cleanedSymbol) return;
          const tfValueRaw =
            rawTf !== undefined && rawTf !== null ? `${rawTf}` : undefined;
          const tfValue = tfValueRaw && tfValueRaw.trim() ? tfValueRaw.trim() : undefined;
          queueSymbolAndTf(cleanedSymbol, tfValue);
          window.dispatchEvent(
            new CustomEvent("tv:update", {
              detail: { symbol: cleanedSymbol, timeframe: tfValue },
            }),
          );
        })
        .catch(() => { });

      return originalFetch(...(args as Parameters<typeof fetch>));
    };

    window.fetch = wrappedFetch;
    restoreFetchRef.current = () => {
      window.fetch = originalFetch;
    };

    return () => {
      disposed = true;
      try {
        restoreFetchRef.current?.();
      } catch { }
      restoreFetchRef.current = null;
    };
  }, [queueSymbolAndTf]);

  return (
    <div ref={wrapperRef} className="h-[560px] w-full md:h-[620px] relative">
      {!isReady && (
        <div className="absolute inset-0 bg-card/50 z-50 animate-pulse flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-muted-foreground">Loading chart...</p>
          </div>
        </div>
      )}
      <div
        id={containerIdRef.current}
        ref={containerRef}
        className="h-full w-full bg-card"
      />
    </div>
  );
}
