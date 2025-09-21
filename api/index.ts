// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const send = (res: VercelResponse, status: number, data: any) => {
  res.status(status).setHeader('content-type', 'application/json');
  res.send(JSON.stringify(data));
};

// Try binance.com, and on 451/403 (geo/legal blocks) retry binance.us
async function fetchBinanceJson(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json?: any; from: 'com' | 'us' }> {
  const endpoints: Array<{ base: string; tag: 'com' | 'us' }> = [
    { base: 'https://api.binance.com', tag: 'com' },
    { base: 'https://api.binance.us', tag: 'us' },
  ];

  // If we’re in a US Vercel region, prefer .us first
  const region = (process.env.VERCEL_REGION || '').toLowerCase();
  const isUS = /\b(iad|sfo|pdx|ewr|dfw|iah|lax|mia|ord|phx|sea|sjc)\d*\b/.test(region);
  if (isUS) endpoints.reverse();

  // Do up to two tries
  for (let i = 0; i < endpoints.length; i++) {
    const { base, tag } = endpoints[i];
    const r = await fetch(`${base}${path}`, init);
    if (r.ok) {
      const j = await r.json();
      return { ok: true, status: r.status, json: j, from: tag };
    }
    // Geo/legal blocks; try the other endpoint
    if (r.status === 451 || r.status === 403) continue;

    // Hard failure (404, 429, 5xx, etc.) -> return as-is
    return { ok: false, status: r.status, from: tag };
  }

  // If we got here, both were 451/403
  return { ok: false, status: 451, from: 'com' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    // Health
    if (path === '/api' || path === '/api/') {
      return send(res, 200, { ok: true, message: 'API root' });
    }

    // --- Market: Ticker (24h) ---
    if (path.startsWith('/api/market/ticker/')) {
      const symbol = path.split('/').pop()!.toUpperCase();
      const out = await fetchBinanceJson(`/api/v3/ticker/24hr?symbol=${symbol}`);
      if (!out.ok) {
        // Friendly message for common cases
        const msg =
          out.status === 451
            ? 'Market data unavailable from this region (451).'
            : out.status === 404
            ? `Symbol ${symbol} is not available on the current market source.`
            : `Upstream error ${out.status}`;
        return send(res, out.status, { ok: false, error: msg });
      }
      const d = out.json as any;
      return send(res, 200, {
        symbol: d.symbol,
        lastPrice: d.lastPrice ?? '0',
        priceChange: d.priceChange ?? '0',
        priceChangePercent: d.priceChangePercent ?? '0',
        highPrice: d.highPrice ?? d.lastPrice ?? '0',
        lowPrice: d.lowPrice ?? d.lastPrice ?? '0',
        volume: d.volume ?? '0',
        quoteVolume: d.quoteVolume ?? '0',
        source: out.from, // com | us (for debugging/telemetry)
      });
    }

    // --- Market: Top gainers (simple) ---
    if (path === '/api/market/gainers') {
      const out = await fetchBinanceJson('/api/v3/ticker/24hr');
      if (!out.ok) {
        const msg =
          out.status === 451
            ? 'Market data unavailable from this region (451).'
            : `Upstream error ${out.status}`;
        return send(res, out.status, { ok: false, error: msg });
      }
      const list: any[] = out.json;
      const top = list
        .filter((it) => typeof it.symbol === 'string' && it.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, 10)
        .map((d) => ({
          symbol: d.symbol,
          lastPrice: d.lastPrice,
          priceChangePercent: d.priceChangePercent,
        }));

      return send(res, 200, { source: out.from, items: top });
    }

    // --- Scanner: simple heuristic using 24h change ---
    if (path === '/api/scanner/scan' && method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const sym = String((body.symbol || 'BTCUSDT')).toUpperCase();

      const out = await fetchBinanceJson(`/api/v3/ticker/24hr?symbol=${sym}`);
      if (!out.ok) {
        const msg =
          out.status === 451
            ? 'Market data unavailable from this region (451).'
            : out.status === 404
            ? `Symbol ${sym} is not available on the current market source.`
            : `Upstream error ${out.status}`;
        return send(res, out.status, { ok: false, error: msg });
      }

      const d: any = out.json;
      const last = parseFloat(d.lastPrice || '0');
      const changePct = parseFloat(d.priceChangePercent || '0');
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
            description: `Heuristic based on 24h price change (source: binance.${out.from})`,
          },
        },
        totalScore: score,
        recommendation,
        source: out.from,
      });
    }

    // --- High-potential stub ---
    if (path === '/api/scanner/high-potential' && method === 'POST') {
      return send(res, 200, { results: [] });
    }

    // --- Stubs to avoid 500s while we build the real ones ---
    if (path === '/api/watchlist') return send(res, 200, []);
    if (path === '/api/portfolio') return send(res, 200, { totalValue: 0, totalPnl: 0, positions: [] });
    if (path === '/api/ai/market-overview') return send(res, 200, { summary: 'Coming soon.' });

    return send(res, 404, { ok: false, error: 'Not found' });
  } catch (err: any) {
    return send(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
