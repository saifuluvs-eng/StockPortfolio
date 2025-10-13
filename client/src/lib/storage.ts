type Reviver<T> = (value: T) => T;

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, revive?: Reviver<T>): T | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    return revive ? revive(parsed) : parsed;
  } catch (error) {
    console.warn("storage:readJSON", error);
    return null;
  }
}

export function writeJSON<T>(key: string, value: T | null | undefined): void {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    if (value === undefined || value === null) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("storage:writeJSON", error);
  }
}
