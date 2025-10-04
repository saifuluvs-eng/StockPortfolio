const rawBase = import.meta.env.VITE_API_BASE?.trim();
// If VITE_API_BASE is set (e.g. during local dev), use it; otherwise use relative paths (Vercel rewrite).
const base = rawBase ? rawBase.replace(/\/$/, "") : "";

export function api(path: string, init?: RequestInit) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, init);
}

export async function apiJSON<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await api(path, init);
  // never throw on non-200; let callers decide, but try to parse JSON
  try {
    return await r.json();
  } catch {
    return undefined as unknown as T;
  }
}
