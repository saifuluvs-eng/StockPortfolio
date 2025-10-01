import { randomUUID } from "crypto";

export type Recommendation =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell";

export interface IndicatorBreakdown {
  value?: number;
  signal?: "bullish" | "bearish" | "neutral";
  score?: number;
  tier?: number;
  description?: string;
}

export interface ScanResultLike {
  symbol: string;
  price: number;
  indicators: Record<string, IndicatorBreakdown>;
  totalScore: number;
  recommendation: Recommendation;
  meta?: Record<string, unknown> | null;
}

export interface ScanHistoryEntry {
  id: string;
  userId: string;
  scanType: string;
  filters?: Record<string, unknown> | null;
  results?: ScanResultLike | ScanResultLike[] | null;
  createdAt: string;
}

export interface WatchlistItemEntry {
  id: string;
  userId: string;
  symbol: string;
  createdAt: string;
}

const DEFAULT_USER_ID = "demo-user";

const watchlists = new Map<string, Map<string, WatchlistItemEntry>>();
const historyMap = new Map<string, ScanHistoryEntry[]>();

function nowISO() {
  return new Date().toISOString();
}

function ensureSeedWatchlist(userId: string) {
  if (watchlists.has(userId)) return;
  const items = new Map<string, WatchlistItemEntry>();
  ["BTCUSDT", "ETHUSDT", "SOLUSDT"].forEach((symbol, index) => {
    items.set(symbol.toUpperCase(), {
      id: randomUUID(),
      userId,
      symbol,
      createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    });
  });
  watchlists.set(userId, items);
}

export function listWatchlist(userId: string = DEFAULT_USER_ID): WatchlistItemEntry[] {
  ensureSeedWatchlist(userId);
  return Array.from(watchlists.get(userId)!.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function upsertWatchlistSymbol(
  symbol: string,
  userId: string = DEFAULT_USER_ID,
): WatchlistItemEntry {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error("invalid_symbol");
  }
  ensureSeedWatchlist(userId);
  const list = watchlists.get(userId)!;
  let entry = list.get(normalized);
  if (!entry) {
    entry = { id: randomUUID(), userId, symbol: normalized, createdAt: nowISO() };
    list.set(normalized, entry);
  }
  return entry;
}

export function removeWatchlistSymbol(
  symbol: string,
  userId: string = DEFAULT_USER_ID,
): boolean {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return false;
  ensureSeedWatchlist(userId);
  const list = watchlists.get(userId)!;
  const existed = list.delete(normalized);
  return existed;
}

export function recordScanHistory(
  entry: Omit<ScanHistoryEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): ScanHistoryEntry {
  const userId = entry.userId || DEFAULT_USER_ID;
  const payload: ScanHistoryEntry = {
    id: entry.id ?? randomUUID(),
    userId,
    scanType: entry.scanType,
    filters: entry.filters ?? null,
    results: entry.results ?? null,
    createdAt: entry.createdAt ?? nowISO(),
  };
  const list = historyMap.get(userId) ?? [];
  const next = [payload, ...list].slice(0, 25);
  historyMap.set(userId, next);
  return payload;
}

export function listScanHistory(
  userId: string = DEFAULT_USER_ID,
  scanType?: string,
): ScanHistoryEntry[] {
  const list = historyMap.get(userId) ?? [];
  if (!scanType) return list;
  return list.filter((entry) => entry.scanType === scanType);
}

export function getDefaultUserId() {
  return DEFAULT_USER_ID;
}
