import { apiFetch } from "@/lib/api";
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

export type PortfolioPositionsResponse = {
  data: PortfolioPosition[];
  userId?: string | null;
};

export async function getPositions(_userIdInput?: string | null): Promise<PortfolioPositionsResponse> {
  const json = await apiFetch("/api/portfolio/positions", {
    method: "GET",
  });

  const raw = Array.isArray(json?.data) ? json.data : [];
  const positions = raw.map((pos) => normalizePosition(pos));
  const responseUserId =
    typeof json?.userId === "string" && json.userId.trim() ? json.userId.trim() : null;

  return { data: positions, userId: responseUserId };
}

export async function upsertPosition(
  _userIdInput: string | null | undefined,
  payload: UpsertPayload,
): Promise<PortfolioPosition> {
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
    body: JSON.stringify(body),
  });

  return normalizePosition(json?.data);
}

export async function updatePosition(
  _userIdInput: string | null | undefined,
  id: string,
  payload: UpdatePayload,
): Promise<PortfolioPosition> {
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
    body: JSON.stringify(body),
  });

  return normalizePosition(json?.data);
}

export async function deletePosition(id: string, _userIdInput?: string | null | undefined): Promise<void> {
  const trimmedId = typeof id === "string" ? id.trim() : "";
  if (!trimmedId) {
    throw new Error("Missing position id");
  }
  await apiFetch(`/api/portfolio/positions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
