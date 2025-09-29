// src/services/binanceWebSocketService.ts
// Single-stream Binance WS: wss://stream.binance.com:9443/ws/<symbol>@ticker

export type TickerHandler = (payload: any) => void;

function toStream(symbol: string) {
  // btcusdt@ticker
  return `${String(symbol || "").toLowerCase().replace(/[^a-z0-9]/g, "")}@ticker`;
}

export function connectTicker(symbol: string, onMessage: TickerHandler) {
  const stream = toStream(symbol);
  const url = `wss://stream.binance.com:9443/ws/${stream}`;

  const ws = new WebSocket(url);

  ws.onopen = () => {
    // no subscribe message needed for single-stream /ws endpoint
    // console.debug("[binance-ws] open", stream);
  };

  ws.onmessage = (evt) => {
    try {
      // For /ws single stream, payload is already the event (no wrapper)
      const msg = JSON.parse(evt.data as string);
      const payload = msg?.data ?? msg; // support /stream wrapper just in case
      onMessage(payload);
    } catch {
      // ignore JSON errors
    }
  };

  ws.onerror = () => {
    // console.warn("[binance-ws] error", stream);
  };

  ws.onclose = () => {
    // console.debug("[binance-ws] close", stream);
  };

  // return a disposer
  return () => {
    try { ws.close(1000, "normal"); } catch {}
  };
}
