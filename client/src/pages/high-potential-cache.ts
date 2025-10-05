import type { HighPotentialResponse, HighPotentialTimeframe } from "@shared/high-potential/types";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export type HighPotentialFiltersSnapshot = {
  tf: HighPotentialTimeframe;
  minVolUSD: number;
  capRange: [number, number];
  excludeLeveraged: boolean;
};

export type CachedHighPotentialEntry = {
  savedAt: number;
  params: HighPotentialFiltersSnapshot;
  payload: HighPotentialResponse;
};

const CACHE_KEY = "hp:last";

function normalizeFilters(filters: HighPotentialFiltersSnapshot): HighPotentialFiltersSnapshot {
  return {
    tf: filters.tf,
    minVolUSD: Math.round(filters.minVolUSD),
    capRange: [Math.round(filters.capRange[0]), Math.round(filters.capRange[1])],
    excludeLeveraged: Boolean(filters.excludeLeveraged),
  };
}

function filtersMatch(a: HighPotentialFiltersSnapshot, b: HighPotentialFiltersSnapshot): boolean {
  const normalizedA = normalizeFilters(a);
  const normalizedB = normalizeFilters(b);
  return (
    normalizedA.tf === normalizedB.tf &&
    normalizedA.excludeLeveraged === normalizedB.excludeLeveraged &&
    normalizedA.minVolUSD === normalizedB.minVolUSD &&
    normalizedA.capRange[0] === normalizedB.capRange[0] &&
    normalizedA.capRange[1] === normalizedB.capRange[1]
  );
}

export function storeCachedResponse(
  storage: StorageLike,
  filters: HighPotentialFiltersSnapshot,
  payload: HighPotentialResponse,
  savedAt: number = Date.now(),
): CachedHighPotentialEntry {
  const params = normalizeFilters(filters);
  const entry: CachedHighPotentialEntry = {
    savedAt,
    params,
    payload,
  };
  storage.setItem(CACHE_KEY, JSON.stringify(entry));
  return entry;
}

export function loadCachedResponse(
  storage: StorageLike | null | undefined,
  filters: HighPotentialFiltersSnapshot,
): CachedHighPotentialEntry | null {
  if (!storage) return null;
  const raw = storage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedHighPotentialEntry>;
    if (!parsed || typeof parsed !== "object" || !parsed.payload || !parsed.params) {
      return null;
    }
    const params = normalizeFilters(parsed.params);
    if (!filtersMatch(params, filters)) {
      return null;
    }
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now();
    return {
      savedAt,
      params,
      payload: parsed.payload as HighPotentialResponse,
    };
  } catch (error) {
    console.warn("Failed to parse cached high potential response", error);
    storage.removeItem?.(CACHE_KEY);
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
  errorBannerMessage: string | null;
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
  const usingCache = Boolean(hasError && cachedPayload);
  const errorBannerMessage = hasError
    ? usingCache
      ? "Showing last scan (data may be stale)."
      : "Scanner unavailable. Please try again later."
    : null;
  const showUnavailableState = Boolean(hasError && !resolvedData);
  return {
    resolvedData,
    usingCache,
    errorBannerMessage,
    showUnavailableState,
  };
}
