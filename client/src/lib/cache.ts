const TTL = 10 * 60 * 1000;

type CacheRecord<T> = {
  at: number;
  data: T;
};

export function getCached<T>(key: string): T | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    const sessionStorage = window.sessionStorage;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as CacheRecord<T>;
    return Date.now() - at < TTL ? (data as T) : null;
  } catch (error) {
    console.warn("cache:getCached", error);
    return null;
  }
}

export function setCached<T>(key: string, data: T) {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    const sessionStorage = window.sessionStorage;
    const record: CacheRecord<T> = { at: Date.now(), data };
    sessionStorage.setItem(key, JSON.stringify(record));
  } catch (error) {
    console.warn("cache:setCached", error);
  }
}

export const kTech = (sym: string, tf: string) => `tech:${sym}:${tf}`;
export const kAI = (sym: string, tf: string) => `ai:${sym}:${tf}`;
