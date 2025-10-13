const STORAGE_KEY = "demo.userId" as const;

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readDemoUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeDemoUserId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  const normalized = normalize(userId);
  if (!normalized) return null;
  try {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    return normalized;
  }
  return normalized;
}

export function clearDemoUserId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export function ensureDemoUserId(defaultValue: string): string | null {
  const existing = readDemoUserId();
  if (existing) return existing;
  return writeDemoUserId(defaultValue);
}

export const DEMO_USER_ID_KEY = STORAGE_KEY;
