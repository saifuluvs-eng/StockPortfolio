const envBase =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE) ||
  "";

const API_BASE = typeof envBase === "string" ? envBase.trim().replace(/\/+$/, "") : "";

function resolveUrl(path: string): string {
  if (/^https?:/i.test(path)) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE) return cleanPath;
  return `${API_BASE}${cleanPath}`;
}

export function api(path: string, init: RequestInit = {}) {
  const url = resolveUrl(path);
  return fetch(url, { mode: "cors", credentials: "include", ...init });
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (!headers["x-demo-user-id"]) {
    let fallback = "demo-saif";
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("demo.userId");
        if (stored && stored.trim()) {
          fallback = stored.trim();
        }
      }
    } catch {
      // ignore storage errors
    }
    headers["x-demo-user-id"] = fallback;
  }

  const response = await api(path, { ...init, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${text || response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiJSON<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  try {
    return await res.json();
  } catch {
    return undefined as unknown as T;
  }
}
