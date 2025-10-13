import { api } from "@/lib/api";
import { getFirebaseIdToken } from "@/lib/firebase";
import { readJSON, writeJSON } from "@/lib/storage";

export type PortfolioPosition = {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertPayload = {
  symbol: string;
  quantity: number;
  entryPrice: number;
  notes?: string | null;
};

export type UpdatePayload = Partial<UpsertPayload>;

const CACHE_PREFIX = "portfolio.positions";

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}.${userId}`;
}

function normalizeUserId(userId: string | undefined | null): string {
  return userId && userId.trim() ? userId : "demo-user";
}

async function buildHeaders(userId: string, hasBody: boolean): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const token = await getFirebaseIdToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  headers["x-demo-user-id"] = userId;
  return headers;
}

export function readCachedPositions(userId: string): PortfolioPosition[] | null {
  return readJSON<PortfolioPosition[]>(cacheKey(userId));
}

export function writeCachedPositions(userId: string, data: PortfolioPosition[] | null) {
  writeJSON(cacheKey(userId), data);
}

async function parseResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json as { data?: any };
}

export async function getPositions(userIdInput?: string | null): Promise<PortfolioPosition[]> {
  const userId = normalizeUserId(userIdInput);
  const res = await api("/api/portfolio/positions", {
    method: "GET",
    headers: await buildHeaders(userId, false),
  });

  const json = await parseResponse(res);
  const positions = Array.isArray(json.data) ? (json.data as PortfolioPosition[]) : [];
  writeCachedPositions(userId, positions);
  return positions;
}

export async function upsertPosition(
  userIdInput: string | null | undefined,
  payload: UpsertPayload,
): Promise<PortfolioPosition> {
  const userId = normalizeUserId(userIdInput);
  const body = {
    symbol: payload.symbol.trim().toUpperCase(),
    quantity: payload.quantity,
    entryPrice: payload.entryPrice,
    notes: payload.notes ?? null,
  };

  const res = await api("/api/portfolio/positions", {
    method: "POST",
    headers: await buildHeaders(userId, true),
    body: JSON.stringify(body),
  });

  const json = await parseResponse(res);
  return json.data as PortfolioPosition;
}

export async function updatePosition(
  userIdInput: string | null | undefined,
  id: string,
  payload: UpdatePayload,
): Promise<PortfolioPosition> {
  const userId = normalizeUserId(userIdInput);
  const body: Record<string, unknown> = {};

  if (payload.symbol !== undefined) {
    body.symbol = payload.symbol.trim().toUpperCase();
  }
  if (payload.quantity !== undefined) {
    body.quantity = payload.quantity;
  }
  if (payload.entryPrice !== undefined) {
    body.entryPrice = payload.entryPrice;
  }
  if (payload.notes !== undefined) {
    body.notes = payload.notes ?? null;
  }

  const res = await api(`/api/portfolio/positions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await buildHeaders(userId, true),
    body: JSON.stringify(body),
  });

  const json = await parseResponse(res);
  return json.data as PortfolioPosition;
}

export async function deletePosition(
  userIdInput: string | null | undefined,
  id: string,
): Promise<void> {
  const userId = normalizeUserId(userIdInput);
  const res = await api(`/api/portfolio/positions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await buildHeaders(userId, false),
  });

  await parseResponse(res);
}
