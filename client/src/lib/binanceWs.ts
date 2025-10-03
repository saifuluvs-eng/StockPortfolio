// client/src/lib/binanceWs.ts
export type Ticker = {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
};

export type SpotTickerStreamOptions = {
  onMessage?: (ticker: Ticker) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event | Error) => void;
  maxReconnects?: number;
};

type SpotTickerHandler = (ticker: Ticker) => void;

function normaliseSymbols(input: string | string[]): string[] {
  if (Array.isArray(input)) return input;
  if (!input) return [];
  return [input];
}

export function openSpotTickerStream(
  symbolsInput: string | string[],
  optionsOrHandler: SpotTickerStreamOptions | SpotTickerHandler = {},
) {
  const symbols = normaliseSymbols(symbolsInput).filter(Boolean);
  if (symbols.length === 0) {
    throw new Error("openSpotTickerStream requires at least one symbol");
  }

  const options: SpotTickerStreamOptions =
    typeof optionsOrHandler === "function" ? { onMessage: optionsOrHandler } : optionsOrHandler;

  const onTicker = options.onMessage;
  const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let disposed = false;

  const maxReconnects = options.maxReconnects ?? Infinity;

  const cleanup = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    if (disposed) return;
    cleanup();
    ws = new WebSocket(url);

    ws.onopen = (event) => {
      reconnectAttempts = 0;
      options.onOpen?.(event);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        const data = (msg && (msg as any).data) || msg;
        if (!data) return;
        onTicker?.({
          symbol: data.s,
          lastPrice: data.c,
          priceChange: data.p,
          priceChangePercent: data.P,
          highPrice: data.h,
          lowPrice: data.l,
          volume: data.v,
          quoteVolume: data.q,
        });
      } catch (err) {
        // swallow parse errors but allow consumer to know via error handler
        options.onError?.(err instanceof Error ? err : new Error("Failed to parse ticker message"));
      }
    };

    ws.onerror = (event) => {
      options.onError?.(event);
    };

    ws.onclose = (event) => {
      options.onClose?.(event);
      if (disposed) return;
      if (reconnectAttempts >= maxReconnects) return;

      const attempt = reconnectAttempts + 1;
      const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 5)));

      reconnectTimer = setTimeout(() => {
        reconnectAttempts = attempt;
        connect();
      }, delay);
    };
  };

  connect();

  return () => {
    disposed = true;
    cleanup();
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close(1000, "normal");
      } catch {
        // ignore
      }
    }
    ws = null;
  };
}
