// api/scanner/scan.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
};

function recFromScore(score: number): ScanResponse['recommendation'] {
  if (score >= 12) return 'strong_buy';
  if (score >= 6)  return 'buy';
  if (score <= -12) return 'strong_sell';
  if (score <= -6)  return 'sell';
  return 'hold';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Use POST' });
    }

    const { symbol, timeframe } = (req.body || {}) as { symbol?: string; timeframe?: string };
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'symbol is required (e.g. BTCUSDT)' });
    }

    // 24h stats (weight: 1) – very safe on Binance rate limits for occasional scans
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'Binance error', detail: text });
    }
    const t = await r.json() as any;

    // Pull key fields and coerce to numbers
    const last = Number(t.lastPrice ?? t.weightedAvgPrice ?? 0);
    const changePct = Number(t.priceChangePercent ?? 0);
    const high = Number(t.highPrice ?? last);
    const low  = Number(t.lowPrice ?? last);
    const volQuote = Number(t.quoteVolume ?? 0);
    const volBase  = Number(t.volume ?? 0);

    // Very small sanity guard
    if (!Number.isFinite(last) || last <= 0) {
      return res.status(502).json({ error: 'Invalid price data from upstream' });
    }

    // -------- Simple rule-based signals (deterministic, launch-ready) --------
    let score = 0;

    // Momentum (24h % change)
    const momentumScore =
      changePct > 3 ? 6 :
      changePct > 1 ? 3 :
      changePct < -3 ? -6 :
      changePct < -1 ? -3 : 0;

    // Range position (where last sits between low–high)
    let rangePos = 0.5;
    if (Number.isFinite(high) && Number.isFinite(low) && high > low) {
      rangePos = (last - low) / (high - low); // 0..1
    }
    const rangeScore =
      rangePos >= 0.8 ? 4 :
      rangePos >= 0.6 ? 2 :
      rangePos <= 0.2 ? -4 :
      rangePos <= 0.4 ? -2 : 0;

    // Liquidity proxy (quote volume)
    const liqScore =
      volQuote > 50_000_000 ? 2 :   // very liquid
      volQuote > 10_000_000 ? 1 :
      volQuote < 1_000_000  ? -1 : 0;

    score += momentumScore + rangeScore + liqScore;

    const indicators: ScanResponse['indicators'] = {
      momentum_24h: {
        value: changePct,
        signal: momentumScore > 0 ? 'bullish' : momentumScore < 0 ? 'bearish' : 'neutral',
        score: momentumScore,
        tier: 1,
        description: '24h price change percentage'
      },
      range_position: {
        value: Number((rangePos * 100).toFixed(1)) + '%',
        signal: rangeScore > 0 ? 'bullish' : rangeScore < 0 ? 'bearish' : 'neutral',
        score: rangeScore,
        tier: 2,
        description: 'Position within today’s low–high range'
      },
      liquidity: {
        value: volQuote,
        signal: liqScore > 0 ? 'bullish' : liqScore < 0 ? 'bearish' : 'neutral',
        score: liqScore,
        tier: 3,
        description: 'Quote volume (24h) as liquidity proxy'
      }
    };

    const payload: ScanResponse = {
      symbol,
      price: last,
      indicators,
      totalScore: score,
      recommendation: recFromScore(score)
    };

    // Small cache to ease repeat clicks
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('scanner/scan error', err);
    return res.status(500).json({ error: 'Internal scanner error' });
  }
}
// api/scanner/scan.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
};

function recFromScore(score: number): ScanResponse['recommendation'] {
  if (score >= 12) return 'strong_buy';
  if (score >= 6)  return 'buy';
  if (score <= -12) return 'strong_sell';
  if (score <= -6)  return 'sell';
  return 'hold';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Use POST' });
    }

    const { symbol, timeframe } = (req.body || {}) as { symbol?: string; timeframe?: string };
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'symbol is required (e.g. BTCUSDT)' });
    }

    // 24h stats (weight: 1) – very safe on Binance rate limits for occasional scans
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'Binance error', detail: text });
    }
    const t = await r.json() as any;

    // Pull key fields and coerce to numbers
    const last = Number(t.lastPrice ?? t.weightedAvgPrice ?? 0);
    const changePct = Number(t.priceChangePercent ?? 0);
    const high = Number(t.highPrice ?? last);
    const low  = Number(t.lowPrice ?? last);
    const volQuote = Number(t.quoteVolume ?? 0);
    const volBase  = Number(t.volume ?? 0);

    // Very small sanity guard
    if (!Number.isFinite(last) || last <= 0) {
      return res.status(502).json({ error: 'Invalid price data from upstream' });
    }

    // -------- Simple rule-based signals (deterministic, launch-ready) --------
    let score = 0;

    // Momentum (24h % change)
    const momentumScore =
      changePct > 3 ? 6 :
      changePct > 1 ? 3 :
      changePct < -3 ? -6 :
      changePct < -1 ? -3 : 0;

    // Range position (where last sits between low–high)
    let rangePos = 0.5;
    if (Number.isFinite(high) && Number.isFinite(low) && high > low) {
      rangePos = (last - low) / (high - low); // 0..1
    }
    const rangeScore =
      rangePos >= 0.8 ? 4 :
      rangePos >= 0.6 ? 2 :
      rangePos <= 0.2 ? -4 :
      rangePos <= 0.4 ? -2 : 0;

    // Liquidity proxy (quote volume)
    const liqScore =
      volQuote > 50_000_000 ? 2 :   // very liquid
      volQuote > 10_000_000 ? 1 :
      volQuote < 1_000_000  ? -1 : 0;

    score += momentumScore + rangeScore + liqScore;

    const indicators: ScanResponse['indicators'] = {
      momentum_24h: {
        value: changePct,
        signal: momentumScore > 0 ? 'bullish' : momentumScore < 0 ? 'bearish' : 'neutral',
        score: momentumScore,
        tier: 1,
        description: '24h price change percentage'
      },
      range_position: {
        value: Number((rangePos * 100).toFixed(1)) + '%',
        signal: rangeScore > 0 ? 'bullish' : rangeScore < 0 ? 'bearish' : 'neutral',
        score: rangeScore,
        tier: 2,
        description: 'Position within today’s low–high range'
      },
      liquidity: {
        value: volQuote,
        signal: liqScore > 0 ? 'bullish' : liqScore < 0 ? 'bearish' : 'neutral',
        score: liqScore,
        tier: 3,
        description: 'Quote volume (24h) as liquidity proxy'
      }
    };

    const payload: ScanResponse = {
      symbol,
      price: last,
      indicators,
      totalScore: score,
      recommendation: recFromScore(score)
    };

    // Small cache to ease repeat clicks
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('scanner/scan error', err);
    return res.status(500).json({ error: 'Internal scanner error' });
  }
}
