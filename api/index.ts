// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// small helper
const send = (res: VercelResponse, status: number, data: any) => {
  res.status(status).setHeader('content-type', 'application/json');
  res.send(JSON.stringify(data));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = req.method || 'GET';
  // Build a URL so we can reliably read pathname (Vercel gives us a relative URL)
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    // Health
    if (path === '/api' || path === '/api/') {
      return send(res, 200, { ok: true, message: 'API root' });
    }

    // --- Market: Ticker (Binance 24hr) ---
    if (path.startsWith('/api/market/ticker/')) {
      const symbol = path.split('/').pop()!.toUpperCase();
      const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      if (!r.ok) return send(res, r.status, { ok: false, error: `Binance ${r.status}` });
      const d: any = await r.json();

      return send(res, 200, {
        symbol: d.symbol,
        lastPrice: d.lastPrice ?? '0',
        priceChange: d.priceChange ?? '0',
        priceChangePercent: d.priceChangePercent ?? '0',
        highPrice: d.highPrice ?? d.lastPrice ?? '0',
        lowPrice: d.lowPrice ?? d.lastPrice ?? '0',
        volume: d.volume ?? '0',
        quoteVolume: d.quoteVolume ?? '0',
      });
    }

    // --- Market: Top gainers (simple) ---
    if (path === '/api/market/gainers') {
      const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      if (!r.ok) return send(res, r.status, { ok: false, error: `Binance ${r.status}` });
      const list: any[] = await r.json();

      const out = list
        .filter((it) => typeof it.symbol === 'string' && it.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, 10)
        .map((d) => ({
          symbol: d.symbol,
          lastPrice: d.lastPrice,
          priceChangePercent: d.priceChangePercent,
        }));

      return send(res, 200, out);
    }

    // --- Scanner: basic heuristic scan using 24h change ---
    if (path === '/api/scanner/scan' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const sym = String((body.symbol || 'BTCUSDT')).toUpperCase();

      const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`);
      if (!r.ok) return send(res, r.status, { ok: false, error: `Binance ${r.status}` });
      const d: any = await r.json();

      const last = parseFloat(d.lastPrice || '0');
      const changePct = parseFloat(d.priceChangePercent || '0');
      // very simple scoring bounded -30..+30 from % change
      const score = Math.max(-30, Math.min(30, Math.round(changePct)));
      const recommendation =
        score >= 10 ? 'strong_buy' :
        score >= 5  ? 'buy' :
        score <= -10 ? 'strong_sell' :
        score <= -5  ? 'sell' : 'hold';

      return send(res, 200, {
        symbol: sym,
        price: last,
        indicators: {
          '24h Change': {
            value: changePct,
            signal: changePct > 0 ? 'bullish' : changePct < 0 ? 'bearish' : 'neutral',
            score,
            tier: 1,
            description: 'Heuristic based on 24h price change',
          },
        },
        totalScore: score,
        recommendation,
      });
    }

    // --- Scanner: high-potential (stub for now) ---
    if (path === '/api/scanner/high-potential' && method === 'POST') {
      return send(res, 200, { results: [] });
    }

    // --- Minimal stubs to stop 500s (no auth/storage yet) ---
    if (path === '/api/watchlist')   return send(res, 200, []);
    if (path === '/api/portfolio')   return send(res, 200, { totalValue: 0, totalPnl: 0, positions: [] });
    if (path === '/api/ai/market-overview') return send(res, 200, { summary: 'Coming soon.' });

    // Not found
    return send(res, 404, { ok: false, error: 'Not found' });
  } catch (err: any) {
    return send(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
