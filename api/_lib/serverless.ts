import type { VercelRequest } from "@vercel/node";
import type { IStorage } from "../../server/storage";
import type {
  InsertScanHistory,
  ScanHistory,
  InsertWatchlistItem,
  WatchlistItem,
} from "@shared/schema";
import { randomUUID } from "node:crypto";

const DEMO_USER_ID = "demo-user";

export type StorageLike = Pick<
  IStorage,
  "createScanHistory" | "getScanHistory" | "getWatchlist" | "addToWatchlist" | "removeFromWatchlist"
>;

type VerifyIdTokenFn = (token: string) => Promise<{ uid?: string; user_id?: string }>;

type FallbackState = {
  watchlist: Map<string, WatchlistItem[]>;
  scanHistory: Map<string, ScanHistory[]>;
};

type GlobalWithFallback = typeof globalThis & {
  __STOCK_PORTFOLIO_FALLBACK__?: FallbackState;
  __STOCK_PORTFOLIO_STORAGE__?: StorageLike;
};

const globalAny = globalThis as GlobalWithFallback;

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function getFallbackState(): FallbackState {
  if (!globalAny.__STOCK_PORTFOLIO_FALLBACK__) {
    globalAny.__STOCK_PORTFOLIO_FALLBACK__ = {
      watchlist: new Map<string, WatchlistItem[]>(),
      scanHistory: new Map<string, ScanHistory[]>(),
    };
  }
  return globalAny.__STOCK_PORTFOLIO_FALLBACK__;
}

function createFallbackStorage(): StorageLike {
  return {
    async createScanHistory(entry: InsertScanHistory): Promise<ScanHistory> {
      const state = getFallbackState();
      const record: ScanHistory = {
        id: randomUUID(),
        userId: entry.userId,
        scanType: entry.scanType,
        filters: entry.filters ? cloneValue(entry.filters) : null,
        results: entry.results ? cloneValue(entry.results) : null,
        createdAt: Date.now(),
      };
      const existing = state.scanHistory.get(entry.userId) ?? [];
      state.scanHistory.set(entry.userId, [record, ...existing].slice(0, 100));
      return record;
    },
    async getScanHistory(userId: string, scanType?: string): Promise<ScanHistory[]> {
      const state = getFallbackState();
      const history = state.scanHistory.get(userId) ?? [];
      const filtered = scanType
        ? history.filter((item) => item.scanType === scanType)
        : history;
      return filtered.map((item) => cloneValue(item));
    },
    async getWatchlist(userId: string): Promise<WatchlistItem[]> {
      const state = getFallbackState();
      const items = state.watchlist.get(userId) ?? [];
      return items.map((item) => cloneValue(item));
    },
    async addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem> {
      const state = getFallbackState();
      const symbol = item.symbol.trim().toUpperCase();
      const existing = state.watchlist.get(item.userId) ?? [];
      const found = existing.find((entry) => entry.symbol === symbol);
      if (found) {
        return cloneValue(found);
      }
      const record: WatchlistItem = {
        id: randomUUID(),
        userId: item.userId,
        symbol,
        createdAt: Date.now(),
      };
      state.watchlist.set(item.userId, [record, ...existing]);
      return cloneValue(record);
    },
    async removeFromWatchlist(userId: string, symbol: string): Promise<boolean> {
      const state = getFallbackState();
      const items = state.watchlist.get(userId) ?? [];
      const normalized = symbol.trim().toUpperCase();
      const next = items.filter((item) => item.symbol !== normalized);
      const removed = next.length !== items.length;
      state.watchlist.set(userId, next);
      return removed;
    },
  };
}

const fallbackStorage: StorageLike = globalAny.__STOCK_PORTFOLIO_STORAGE__ || createFallbackStorage();
if (!globalAny.__STOCK_PORTFOLIO_STORAGE__) {
  globalAny.__STOCK_PORTFOLIO_STORAGE__ = fallbackStorage;
}

let storageFallbackLogged = false;
function logStorageFallback(error: unknown) {
  if (storageFallbackLogged) {
    return;
  }
  storageFallbackLogged = true;
  console.warn("[api] Using in-memory storage fallback", error);
}

const storagePromise: Promise<StorageLike | undefined> = import("../../server/storage")
  .then((mod) => mod.storage as StorageLike)
  .catch((error) => {
    logStorageFallback(error);
    return undefined;
  });

function withFallback(primary: StorageLike | undefined): StorageLike {
  if (!primary) {
    return fallbackStorage;
  }
  return {
    async createScanHistory(entry) {
      try {
        return await primary.createScanHistory(entry);
      } catch (error) {
        logStorageFallback(error);
        return fallbackStorage.createScanHistory(entry);
      }
    },
    async getScanHistory(userId, scanType) {
      try {
        return await primary.getScanHistory(userId, scanType);
      } catch (error) {
        logStorageFallback(error);
        return fallbackStorage.getScanHistory(userId, scanType);
      }
    },
    async getWatchlist(userId) {
      try {
        return await primary.getWatchlist(userId);
      } catch (error) {
        logStorageFallback(error);
        return fallbackStorage.getWatchlist(userId);
      }
    },
    async addToWatchlist(item) {
      try {
        return await primary.addToWatchlist(item);
      } catch (error) {
        logStorageFallback(error);
        return fallbackStorage.addToWatchlist(item);
      }
    },
    async removeFromWatchlist(userId, symbol) {
      try {
        return await primary.removeFromWatchlist(userId, symbol);
      } catch (error) {
        logStorageFallback(error);
        return fallbackStorage.removeFromWatchlist(userId, symbol);
      }
    },
  };
}

let authWarningLogged = false;
function logAuthFallback(error?: unknown) {
  if (authWarningLogged) {
    return;
  }
  authWarningLogged = true;
  if (error) {
    console.warn("[api] Falling back to demo user due to auth error", error);
  } else {
    console.warn("[api] Falling back to demo user: Firebase Admin not configured");
  }
}

const verifyIdTokenPromise: Promise<VerifyIdTokenFn | undefined> = import("../../server/firebaseAdmin")
  .then((mod) => mod.verifyIdToken as VerifyIdTokenFn)
  .catch((error) => {
    logAuthFallback(error);
    return undefined;
  });

export async function getStorage(): Promise<StorageLike> {
  const primary = await storagePromise;
  return withFallback(primary);
}

export async function getUserId(req: VercelRequest): Promise<string> {
  const headerValue = req.headers.authorization;
  const authorization = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    return DEMO_USER_ID;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return DEMO_USER_ID;
  }

  try {
    const verify = await verifyIdTokenPromise;
    if (!verify) {
      logAuthFallback();
      return DEMO_USER_ID;
    }

    const decoded = await verify(token);
    const userId =
      (decoded && typeof decoded.uid === "string" && decoded.uid.length > 0 && decoded.uid) ||
      (decoded && typeof decoded.user_id === "string" && decoded.user_id.length > 0 && decoded.user_id) ||
      null;

    if (!userId) {
      logAuthFallback();
      return DEMO_USER_ID;
    }

    return userId;
  } catch (error) {
    logAuthFallback(error);
    return DEMO_USER_ID;
  }
}

export async function readJsonBody<T = any>(req: VercelRequest): Promise<T | undefined> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body) as T;
      } catch {
        return undefined;
      }
    }
    return req.body as T;
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }

  if (chunks.length === 0) {
    return undefined;
  }

  try {
    const buffer = Buffer.concat(chunks);
    return JSON.parse(buffer.toString("utf8")) as T;
  } catch {
    return undefined;
  }
}

export { DEMO_USER_ID };
