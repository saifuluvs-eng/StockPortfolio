import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readJSON, writeJSON } from "./storage";

const store = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
};

let warnSpy: ReturnType<typeof vi.spyOn>;

describe("storage helpers", () => {
  beforeEach(() => {
    store.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    (globalThis as any).window = { localStorage: localStorageMock };
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("writes and reads JSON values", () => {
    const payload = { foo: "bar", n: 3 };
    writeJSON("test:key", payload);
    const result = readJSON<typeof payload>("test:key");
    expect(result).toEqual(payload);
  });

  test("removes value when null is provided", () => {
    writeJSON("test:remove", { a: 1 });
    writeJSON("test:remove", null);
    expect(readJSON("test:remove")).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    store.set("test:invalid", "{not-json}");
    const value = readJSON("test:invalid");
    expect(value).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
