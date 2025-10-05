import assert from "node:assert/strict";
import { test } from "node:test";
import type { HighPotentialResponse } from "@shared/high-potential/types";
import {
  deriveScannerState,
  loadCachedResponse,
  storeCachedResponse,
  type CachedHighPotentialEntry,
  type HighPotentialFiltersSnapshot,
  type StorageLike,
} from "./high-potential-cache";

class MemoryStorage implements StorageLike {
  #map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#map.has(key) ? this.#map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.#map.set(key, value);
  }

  removeItem(key: string): void {
    this.#map.delete(key);
  }
}

const filters: HighPotentialFiltersSnapshot = {
  tf: "1h",
  minVolUSD: 1_000_000,
  capRange: [0, 5_000_000_000],
  excludeLeveraged: true,
};

function createResponse(overrides: Partial<HighPotentialResponse> = {}): HighPotentialResponse {
  return {
    dataStale: false,
    timeframe: "1h",
    filters: {
      timeframe: "1h",
      minVolUSD: 1_000_000,
      excludeLeveraged: true,
      capRange: [0, 5_000_000_000],
    },
    top: [],
    buckets: {
      breakoutZone: [],
      oversoldRecovery: [],
      strongMomentum: [],
    },
    ...overrides,
  };
}

test("storeCachedResponse persists payload metadata", () => {
  const storage = new MemoryStorage();
  const payload = createResponse({ dataStale: true });
  const timestamp = 1_700_000_000_000;

  const entry = storeCachedResponse(storage, filters, payload, timestamp);
  assert.equal(entry.savedAt, timestamp);
  assert.deepEqual(entry.params, {
    tf: "1h",
    minVolUSD: 1_000_000,
    capRange: [0, 5_000_000_000],
    excludeLeveraged: true,
  });
  assert.deepEqual(entry.payload, payload);

  const loaded = loadCachedResponse(storage, filters);
  assert.deepEqual(loaded, entry);
});

test("deriveScannerState uses cached payload when query errors", () => {
  const cachedPayload = createResponse({
    top: [{
      symbol: "BTCUSDT",
      baseAsset: "BTC",
      name: "Bitcoin",
      price: 50000,
      change24hPct: 2,
      vol24h: 1000000000,
      vol7dAvg: 800000000,
      intraTFVolRatio: 1.2,
      rsi: 55,
      macd: { crossBullishRecent: true, histogram: 1.5 },
      adx: { adx: 25, plusDI: 30, minusDI: 15 },
      ema: { ema20: 48000, ema50: 47000, ema200: 45000 },
      resistance20: 51000,
      breakoutDistancePct: 2.1,
      marketCap: 900_000_000_000,
      marketCapRank: 1,
      social: { pos: 60, neg: 10, neu: 30, avgVoteDelta: 0.5 },
      score: 24,
      confidence: "High",
      bucket: "Breakout Zone",
      sparkline: [48000, 48500, 49000, 50000],
      updatedAt: 1_700_000_000,
      dataStale: false,
    }],
    buckets: {
      breakoutZone: [],
      oversoldRecovery: [],
      strongMomentum: [],
    },
  });
  const cachedEntry: CachedHighPotentialEntry = {
    savedAt: Date.now(),
    params: filters,
    payload: cachedPayload,
  };

  const state = deriveScannerState({ queryData: null, queryError: new Error("boom"), cachedEntry });
  assert.equal(state.resolvedData, cachedPayload);
  assert.equal(state.usingCache, true);
  assert.equal(state.errorBannerMessage, "Showing last scan (data may be stale).");
  assert.equal(state.showUnavailableState, false);
});

test("deriveScannerState surfaces unavailable state when cache is empty", () => {
  const state = deriveScannerState({ queryData: null, queryError: new Error("network"), cachedEntry: null });
  assert.equal(state.resolvedData, null);
  assert.equal(state.usingCache, false);
  assert.equal(state.errorBannerMessage, "Scanner unavailable. Please try again later.");
  assert.equal(state.showUnavailableState, true);
});
