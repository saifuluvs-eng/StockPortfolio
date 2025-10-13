import { apiFetch } from "@/lib/api";
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

async function buildHeaders(userId: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "x-demo-user-id": userId };
  const token = await getFirebaseIdToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function normalizePosition(input: any): PortfolioPosition {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid position payload");
  }
  const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : "";
  if (!id) {
    throw new Error("Position is missing an id");
  }
  const symbol = typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
  const quantity = Number(input.quantity ?? input.qty ?? 0);
  const entryPrice = Number(input.entryPrice ?? input.avgPrice ?? 0);
  if (!Number.isFinite(quantity) || !Number.isFinite(entryPrice)) {
    throw new Error("Invalid position data");
  }
  const notes = typeof input.notes === "string" && input.notes.trim().length > 0 ? input.notes.trim() : null;
  const createdAt = typeof input.createdAt === "string" ? input.createdAt : new Date().toISOString();
  const updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : createdAt;
  return {
    id,
    symbol,
    quantity,
    entryPrice,
    notes,
    createdAt,
    updatedAt,
  };
}

export function readCachedPositions(userId: string): PortfolioPosition[] | null {
  return readJSON<PortfolioPosition[]>(cacheKey(userId));
}

export function writeCachedPositions(userId: string, data: PortfolioPosition[] | null) {
  writeJSON(cacheKey(userId), data);
}

export async function getPositions(userIdInput?: string | null): Promise<PortfolioPosition[]> {
  const userId = normalizeUserId(userIdInput);
  const json = await apiFetch("/api/portfolio/positions", {
    method: "GET",
    headers: await buildHeaders(userId),
  });

  const raw = Array.isArray(json?.data) ? json.data : [];
  const positions = raw.map((pos) => normalizePosition(pos));
  writeCachedPositions(userId, positions);
  return positions;
}

export async function upsertPosition(
  userIdInput: string | null | undefined,
  payload: UpsertPayload,
): Promise<PortfolioPosition> {
  const userId = normalizeUserId(userIdInput);
  const symbol = typeof payload.symbol === "string" ? payload.symbol.toUpperCase().trim() : "";
  const body = {
    symbol,
    quantity: Number(payload.quantity),
    entryPrice: Number(payload.entryPrice),
    notes: payload.notes ?? null,
  };

  if (!body.symbol || Number.isNaN(body.quantity) || Number.isNaN(body.entryPrice)) {
    throw new Error("Invalid form values.");
  }

  const json = await apiFetch("/api/portfolio/positions", {
    method: "POST",
    headers: await buildHeaders(userId),
    body: JSON.stringify(body),
  });

  return normalizePosition(json?.data);
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

  const json = await apiFetch(`/api/portfolio/positions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await buildHeaders(userId),
    body: JSON.stringify(body),
  });

  return normalizePosition(json?.data);
}

export async function deletePosition(
  userIdInput: string | null | undefined,
  id: string,
): Promise<void> {
  const userId = normalizeUserId(userIdInput);
  await apiFetch(`/api/portfolio/positions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await buildHeaders(userId),
  });
}
