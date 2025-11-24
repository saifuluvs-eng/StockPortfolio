import { auth } from "@/lib/firebase";
import { readDemoUserId } from "@/lib/demo-user";

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

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const user = auth?.currentUser;
    const token = await user?.getIdToken?.();
    if (typeof token === "string" && token.trim()) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch (error) {
    console.warn("Failed to resolve Firebase ID token", error);
  }

  const demoUserId = readDemoUserId();
  if (demoUserId) {
    return { "x-demo-user-id": demoUserId };
  }

  return {};
}

function toHeaderRecord(init?: HeadersInit): Record<string, string> {
  if (!init) return {};
  if (init instanceof Headers) {
    const record: Record<string, string> = {};
    init.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(init)) {
    return init.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[String(key)] = String(value);
      return acc;
    }, {});
  }
  return { ...(init as Record<string, string>) };
}

export function api(path: string, init: RequestInit = {}) {
  const url = resolveUrl(path);
  return fetch(url, { mode: "cors", credentials: "include", ...init });
}

export async function apiFetch(path: string, init: RequestInit = {}, retries = 3) {
  const baseHeaders = toHeaderRecord(init.headers);
  const hasContentType = Object.keys(baseHeaders).some(
    (key) => key.toLowerCase() === "content-type",
  );
  if (!hasContentType) {
    baseHeaders["Content-Type"] = "application/json";
  }

  const authHeaders = await getAuthHeaders();
  const headers = { ...baseHeaders, ...authHeaders };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await api(path, { ...init, headers });
      
      // Retry on 502 (Bad Gateway - usually means backend is rate limited/busy)
      if (response.status === 502 && attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`[API] Got 502, retrying after ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
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
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      console.warn(`[API] Attempt ${attempt + 1} failed, retrying...`, error instanceof Error ? error.message : error);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw new Error("API request failed after retries");
}

export async function apiFetchLocal(path: string, init: RequestInit = {}) {
  const baseHeaders = toHeaderRecord(init.headers);
  const hasContentType = Object.keys(baseHeaders).some(
    (key) => key.toLowerCase() === "content-type",
  );
  if (!hasContentType) {
    baseHeaders["Content-Type"] = "application/json";
  }

  const authHeaders = await getAuthHeaders();
  const headers = { ...baseHeaders, ...authHeaders };

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(cleanPath, { mode: "cors", credentials: "include", ...init, headers });
  
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
