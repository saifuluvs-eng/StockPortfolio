// client/src/components/TVChart.tsx
import React, { useCallback, useEffect, useRef } from "react";

type TVChartProps = {
  // Defaults from parent are fine (BTCUSDT / 4h). Component will
  // also auto-update when it sees /api/scan fetches and tv:update events.
  symbol?: string; // e.g. "BTCUSDT"
  timeframe?: string; // e.g. "4h"
};

declare global {
  interface Window {
    TradingView?: any;
    _tvScriptLoading?: boolean;
    __tvSet?: (sym: string, tf: string) => void;
  }
}

const TV_SRC = "https://s3.tradingview.com/tv.js";

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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<{ s: string; i: string } | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const restoreFetchRef = useRef<(() => void) | null>(null);
  const latestSymbolRef = useRef(normalizeSymbol(symbol));
  const latestTfRef = useRef(timeframe);

  const setSymbolAndTf = (sym: string, tf: string) => {
    const s = `BINANCE:${normalizeSymbol(sym)}`;
    const i = mapInterval(tf);
    const widget = widgetRef.current;
    if (!widget || typeof widget.activeChart !== "function") {
      pendingRef.current = { s, i };
      return;
    }
    if (!readyRef.current) {
      pendingRef.current = { s, i };
      return;
    }
    try {
      widget.activeChart().setSymbol(s, i);
      pendingRef.current = null;
    } catch {
      setTimeout(() => {
        try {
          widgetRef.current?.activeChart().setSymbol(s, i);
          pendingRef.current = null;
        } catch {}
      }, 200);
    }
  };

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
      setSymbolAndTf(resolvedSymbol, resolvedTf);
    },
    [symbol, timeframe],
  );

  useEffect(() => {
    latestSymbolRef.current = normalizeSymbol(symbol);
    latestTfRef.current = timeframe;
    queueSymbolAndTf(symbol, timeframe);
  }, [symbol, timeframe, queueSymbolAndTf]);

  useEffect(() => {
    let cancelled = false;

    window.__tvSet = (sym: string, tf: string) => {
      try {
        const normalized = normalizeSymbol(sym);
        if (!normalized) return;
        const tfValue =
          tf && `${tf}`.trim()
            ? tf
            : latestTfRef.current || timeframe || "4h";
        latestSymbolRef.current = normalized;
        latestTfRef.current = tfValue;
        setSymbolAndTf(normalized, tfValue);
      } catch {}
    };

    const ensureScript = () =>
      new Promise<void>((resolve, reject) => {
        if (window.TradingView) return resolve();
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${TV_SRC}"]`);
        const poll = () => (window.TradingView ? resolve() : setTimeout(poll, 50));
        if (existing || window._tvScriptLoading) return poll();
        window._tvScriptLoading = true;
        const script = document.createElement("script");
        script.src = TV_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(e);
        document.body.appendChild(script);
      });

    const init = () => {
      if (cancelled || !hostRef.current || !window.TradingView) return;

      const host = hostRef.current;
      const currentHeight = host.getBoundingClientRect().height;
      if (currentHeight < 300) {
        host.style.minHeight = "60vh";
        host.style.height = "100%";
      }

      host.innerHTML = "";
      const div = document.createElement("div");
      div.id = "tv-chart";
      div.style.width = "100%";
      div.style.height = "100%";
      host.appendChild(div);

      readyRef.current = false;

      const initialSymbol = normalizeSymbol(latestSymbolRef.current || symbol || "BTCUSDT") || "BTCUSDT";
      const initialTf = latestTfRef.current || timeframe || "4h";
      latestSymbolRef.current = initialSymbol;
      latestTfRef.current = initialTf;

      const widget = new window.TradingView.widget({
        container_id: "tv-chart",
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
      });

      widgetRef.current = widget;

      widget.onChartReady?.(() => {
        if (cancelled) return;
        readyRef.current = true;
        const pending = pendingRef.current;
        if (pending) {
          try {
            widget.activeChart().setSymbol(pending.s, pending.i);
          } catch {}
          pendingRef.current = null;
        }
      });

      if ("ResizeObserver" in window) {
        roRef.current = new ResizeObserver(() => {
          try {
            widgetRef.current?.resize?.();
          } catch {}
        });
        roRef.current.observe(host);
      }
    };

    ensureScript().then(init).catch((e) => console.error("[TVChart] load error", e));

    return () => {
      cancelled = true;
      window.__tvSet = undefined;
      try {
        roRef.current?.disconnect();
        roRef.current = null;
        if (hostRef.current) {
          hostRef.current.innerHTML = "";
        }
      } catch {}
      widgetRef.current = null;
      readyRef.current = false;
      pendingRef.current = null;
    };
  }, []);

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
        } catch {}

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
          } catch {}

          try {
            const params = new URLSearchParams(text);
            symbol = symbol ?? params.get("symbol") ?? params.get("pair") ?? undefined;
            timeframeValue =
              timeframeValue ?? params.get("tf") ?? params.get("timeframe") ?? undefined;
          } catch {}
        };

        if (methodUpper !== "GET") {
          if (requestClone) {
            try {
              const bodyText = await requestClone.text();
              await parseTextPayload(bodyText);
            } catch {}
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
        .catch(() => {});

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
      } catch {}
      restoreFetchRef.current = null;
    };
  }, [queueSymbolAndTf]);

  return <div ref={hostRef} className="w-full h-full" />;
}
