import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import {
  highPotentialScanner,
  HighPotentialScanner,
  InvalidHighPotentialFiltersError,
  normalizeHighPotentialFilters,
} from "./scanner";

test("formatFiltersFromRequest uses the tf query parameter when present", () => {
  const req = { query: { tf: "4h" } } as unknown as Request;
  const filters = highPotentialScanner.formatFiltersFromRequest(req);
  assert.equal(filters.timeframe, "4h");
});

test("formatFiltersFromRequest defaults timeframe to 1d when not provided", () => {
  const req = { query: {} } as unknown as Request;
  const filters = highPotentialScanner.formatFiltersFromRequest(req);
  assert.equal(filters.timeframe, "1d");
});

test("formatFiltersFromRequest rejects the legacy timeframe query parameter", () => {
  const req = { query: { timeframe: "4h" } } as unknown as Request;
  assert.throws(
    () => highPotentialScanner.formatFiltersFromRequest(req),
    InvalidHighPotentialFiltersError,
  );
});

test("formatFiltersFromRequest rejects invalid timeframe values", () => {
  const req = { query: { tf: "12h" } } as unknown as Request;
  assert.throws(
    () => highPotentialScanner.formatFiltersFromRequest(req),
    (error: unknown) => {
      assert.ok(error instanceof InvalidHighPotentialFiltersError);
      assert.equal(error.message, "Invalid timeframe");
      return true;
    },
  );
});

test("performScan applies market cap filtering before enforcing the analysis limit", async () => {
  const scanner = new HighPotentialScanner();
  const totalSymbols = 240;
  const overCap = 15;
  const exchangeSymbols: Array<Record<string, unknown>> = [];
  const tickers: Array<Record<string, string>> = [];
  const marketMap = new Map<string, Record<string, unknown>>();

  for (let i = 0; i < totalSymbols; i++) {
    const base = `SYM${i}`;
    const symbol = `${base}USDT`;
    exchangeSymbols.push({
      symbol,
      baseAsset: base,
      quoteAsset: "USDT",
      status: "TRADING",
    });
    tickers.push({
      symbol,
      lastPrice: "1",
      priceChangePercent: "5",
      quoteVolume: String(10_000_000 - i * 1000),
    });
    marketMap.set(base, {
      id: base.toLowerCase(),
      symbol: base.toLowerCase(),
      name: base,
      market_cap: i < overCap ? 3_000_000_000 : 1_000_000_000,
      market_cap_rank: i + 1,
    });
  }

  const filters = normalizeHighPotentialFilters({});
  const analysedSymbols: string[] = [];
  let analysisCalls = 0;

  (scanner as any).getTicker24h = async () => tickers;
  (scanner as any).getExchangeSymbols = async () => exchangeSymbols;
  (scanner as any).getMarketMap = async () => marketMap;
  (scanner as any).sleep = async () => {};
  (scanner as any).analyseCoin = async (
    symbol: { symbol: string; baseAsset: string },
    ticker: { lastPrice: string; priceChangePercent: string; quoteVolume: string },
    map: Map<string, { market_cap?: number; market_cap_rank?: number | null }>,
  ) => {
    analysisCalls++;
    analysedSymbols.push(symbol.symbol);
    const base = symbol.baseAsset.toUpperCase();
    const market = map.get(base) ?? map.get(base.toLowerCase()) ?? null;
    const marketCap = Number(market?.market_cap ?? 0);
    const marketCapKnown = Number.isFinite(marketCap) && marketCap > 0;
    const volume = Number(ticker.quoteVolume);
    return {
      coin: {
        symbol: symbol.symbol,
        baseAsset: symbol.baseAsset,
        name: symbol.baseAsset,
        price: Number(ticker.lastPrice),
        change24hPct: Number(ticker.priceChangePercent),
        vol24h: volume,
        vol7dAvg: volume,
        intraTFVolRatio: 1,
        rsi: 50,
        macd: { crossBullishRecent: false, histogram: 0 },
        adx: { adx: 20, plusDI: 25, minusDI: 15 },
        ema: { ema20: 1, ema50: 1, ema200: 1 },
        resistance20: 1,
        breakoutDistancePct: 1,
        marketCap,
        marketCapRank: market?.market_cap_rank ?? null,
        social: { pos: 0, neg: 0, neu: 0, avgVoteDelta: 0 },
        score: volume,
        confidence: "High",
        bucket: null,
        sparkline: [1],
        updatedAt: Date.now(),
      },
      marketCap,
      marketCapKnown,
      socialStale: false,
    };
  };

  const result = await scanner.getScan(filters, { debug: true });
  const debug = result.debug;
  assert.ok(debug);
  assert.ok(debug!.afterCapRange > 100);
  assert.equal(debug!.afterCapRange, totalSymbols - overCap);
  assert.equal(debug!.afterIndicators, analysisCalls);
  assert.equal(analysisCalls, analysedSymbols.length);
  assert.ok(analysisCalls < debug!.afterCapRange);
  assert.equal(result.top.length, 10);
  assert.equal(debug!.topCount, 10);

  const capFiltered = debug!.examples.excluded.filter((item) => item.reason === "cap-out-of-range");
  assert.equal(capFiltered.length, overCap);

  assert.ok(!analysedSymbols.includes("SYM0USDT"));
  assert.ok(!analysedSymbols.includes(`SYM${overCap - 1}USDT`));
  assert.ok(analysedSymbols.includes(`SYM${overCap}USDT`));
  const analysedCount = analysedSymbols.length;
  const expectedLastAnalysedIndex = overCap + analysedCount - 1;
  assert.ok(analysedSymbols.includes(`SYM${expectedLastAnalysedIndex}USDT`));
  assert.ok(!analysedSymbols.includes(`SYM${expectedLastAnalysedIndex + 1}USDT`));
  assert.ok(analysedCount < totalSymbols - overCap);
});
