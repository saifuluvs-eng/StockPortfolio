import type { HighPotentialResponse, HighPotentialTimeframe } from "@shared/high-potential/types";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export type HighPotentialFiltersSnapshot = {
  timeframe: HighPotentialTimeframe;
  minVolUSD: number;
  capMin: number;
  capMax: number;
  excludeLeveraged: boolean;
};

export type CachedHighPotentialEntry = {
  timestamp: number;
  dataStale: boolean;
  payload: HighPotentialResponse;
};

const CACHE_PREFIX = "high-potential:last-success";

export function createCacheKey(filters: HighPotentialFiltersSnapshot): string {
  return [
    CACHE_PREFIX,
    filters.timeframe,
    Math.round(filters.minVolUSD),
    Math.round(filters.capMin),
    Math.round(filters.capMax),
    filters.excludeLeveraged ? "1" : "0",
  ].join(":");
}

export function storeCachedResponse(
  storage: StorageLike,
  filters: HighPotentialFiltersSnapshot,
  payload: HighPotentialResponse,
  timestamp: number = Date.now(),
): CachedHighPotentialEntry {
  const entry: CachedHighPotentialEntry = {
    timestamp,
    dataStale: Boolean(payload.dataStale),
    payload,
  };
  storage.setItem(createCacheKey(filters), JSON.stringify(entry));
  return entry;
}

export function loadCachedResponse(
  storage: StorageLike | null | undefined,
  filters: HighPotentialFiltersSnapshot,
): CachedHighPotentialEntry | null {
  if (!storage) return null;
  const raw = storage.getItem(createCacheKey(filters));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedHighPotentialEntry>;
    if (!parsed || typeof parsed !== "object" || !parsed.payload) {
      return null;
    }
    const timestamp = typeof parsed.timestamp === "number" ? parsed.timestamp : Date.now();
    const dataStale = Boolean(parsed.dataStale);
    return {
      timestamp,
      dataStale,
      payload: parsed.payload as HighPotentialResponse,
    };
  } catch (error) {
    console.warn("Failed to parse cached high potential response", error);
    storage.removeItem?.(createCacheKey(filters));
    return null;
  }
}

export type ScannerStateInput = {
  queryData: HighPotentialResponse | null | undefined;
  queryError: unknown;
  cachedEntry: CachedHighPotentialEntry | null | undefined;
};

export type ScannerState = {
  resolvedData: HighPotentialResponse | null;
  usingCache: boolean;
  showOfflineBanner: boolean;
  showUnavailableState: boolean;
};

export function deriveScannerState({
  queryData,
  queryError,
  cachedEntry,
}: ScannerStateInput): ScannerState {
  const hasError = Boolean(queryError);
  const cachedPayload = cachedEntry?.payload ?? null;
  const resolvedData = queryData ?? cachedPayload ?? null;
  const usingCache = Boolean(hasError && !queryData && cachedPayload);
  const showOfflineBanner = Boolean(hasError && cachedPayload);
  const showUnavailableState = Boolean(hasError && !resolvedData);
  return {
    resolvedData,
    usingCache,
    showOfflineBanner,
    showUnavailableState,
  };
}
