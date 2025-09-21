// api/scanner/scan.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Be explicit about runtime
export const config = { runtime: 'nodejs18.x' };

type Indicator = {
  value: number | string;
  signal: 'bullish' | 'bearish' | 'neutral';
  score: number;
  tier: number;
  description: string;
};
type ScanResponse = {
  symbol: string;
  price: number;
  indicators: Record<string, Indicator>;
  totalScore: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  warning?: string;
  detail?: string;
};

function recFromScore(score: number): ScanResponse['recommendation'] {
  if (score >= 12) return 'strong_buy';
  if (score >= 6)  return 'buy';
  if (score <= -12) return 'strong_sell';
  if (score <= -6)  return 'sell';
  return 'hold';
}

function safeJsonParse(s: string | undefined): any {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Use GET or POST' });
    }

    // --- read params from query or body (both supported) ---
    let symbol: string | undefined;
    let timeframe: string | undefined;

    if (req.method === 'GET') {
      symbol = (req.query.symbol as string) || undefined;
      timeframe = (req.query.timeframe as string) || undefined;
    } else {
      // Vercel may or may not parse JSON depending on headers; handle all cases
      let body: any = req.body;
      if (typeof body === 'string') body = safeJsonParse(body);
      if (!body || typeof body !== 'object') {
        // try manual read if needed
        const raw = await new Promise<string>((resolve) => {
          let buf = '';
          req.on('data', (c) => (buf += c));
          req.on('end', () => resolve(buf));
          req.on('error', () => resolve(''));
        });
        body = safeJsonParse(raw);
      }
      symbol = body?.symbol;
      timeframe = body?.timeframe;
    }

    // default so the UI still works if the client omitted it
    symbol = (symbol || 'BTCUSDT').toUpperCase();

    // --- upstream fetch (Binance 24h stats) ---
    const resp = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
    );

    if (!resp.ok) {
      const text = await resp.text();
      // graceful degrade: return neutral result instead of 500
      return res.status(200).json({
        symbol,
        price: 0,
        indicators: {},
        totalScore: 0,
        recommendation: 'hold',
        warning: 'upstream_error',
        detail: text.slice(0, 300),
      } satisfies ScanResponse);
    }

    const t: any = await resp.json();
    const last = Number(t.lastPrice ?? t.weightedAvgPrice ?? 0);
    const changePct = Number(t.priceChangePercent ?? 0);
    const high = Number(t.highPrice ?? last);
    const low  = Number(t.lowPrice ?? last);
    const volQuote = Number(t.quoteVolume ?? 0);

    if (!Number.isFinite(last) || last <= 0) {
      return res.status(200).json({
        symbol,
        price: 0,
        indicators: {},
        totalScore: 0,
        recommendation: 'hold',
        warning: 'invalid_upstream_data',
      } satisfies ScanResponse);
    }

    // --- simple, deterministic scoring ---
    const momentumScore =
      changePct > 3 ? 6 : changePct > 1 ? 3 : changePct < -3 ? -6 : changePct < -1 ? -3 : 0;

    let rangePos = 0.5;
    if (Number.isFinite(high) && Number.isFinite(low) && high > low) {
      rangePos = (last - low) / (high - low); // 0..1
    }
    const rangeScore =
      rangePos >= 0.8 ? 4 : rangePos >= 0.6 ? 2 : rangePos <= 0.2 ? -4 : rangePos <= 0.4 ? -2 : 0;

    const liqScore =
      volQuote > 50_000_000 ? 2 : volQuote > 10_000_000 ? 1 : volQuote < 1_000_000 ? -1 : 0;

    const total = momentumScore + rangeScore + liqScore;

    const indicators: ScanResponse['indicators'] = {
      momentum_24h: {
        value: changePct,
        signal: momentumScore > 0 ? 'bullish' : momentumScore < 0 ? 'bearish' : 'neutral',
        score: momentumScore,
        tier: 1,
        description: '24h price change percentage',
      },
      range_position: {
        value: Number((rangePos * 100).toFixed(1)) + '%',
        signal: rangeScore > 0 ? 'bullish' : rangeScore < 0 ? 'bearish' : 'neutral',
        score: rangeScore,
        tier: 2,
        description: 'Position within today’s low–high range',
      },
      liquidity: {
        value: volQuote,
        signal: liqScore > 0 ? 'bullish' : liqScore < 0 ? 'bearish' : 'neutral',
        score: liqScore,
        tier: 3,
        description: 'Quote volume (24h) as liquidity proxy',
      },
    };

    const payload: ScanResponse = {
      symbol,
      price: last,
      indicators,
      totalScore: total,
      recommendation: recFromScore(total),
    };

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json(payload);
  } catch (e) {
    console.error('scanner/scan fatal', e);
    // still respond 200 to avoid breaking the UI
    return res.status
