// client/src/lib/binanceWs.ts
export type Ticker = {
  symbol: string; lastPrice: string; priceChange: string; priceChangePercent: string;
  highPrice: string; lowPrice: string; volume: string; quoteVolume: string;
};

export function openSpotTickerStream(symbols: string[], onTicker: (t: Ticker)=>void) {
  const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
  let ws: WebSocket | null = null, tries = 0;

  const connect = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { tries = 0; };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as any);
        const d = (msg && (msg as any).data) || msg;
        onTicker({
          symbol: d.s, lastPrice: d.c, priceChange: d.p, priceChangePercent: d.P,
          highPrice: d.h, lowPrice: d.l, volume: d.v, quoteVolume: d.q
        });
      } catch {}
    };
    ws.onclose = () => {
      const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(++tries, 5)));
      setTimeout(connect, delay);
    };
  };

  connect();
  return () => ws?.close();
}
