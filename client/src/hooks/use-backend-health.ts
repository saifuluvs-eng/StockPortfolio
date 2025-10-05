import { useEffect, useState } from "react";
import { apiJSON } from "@/lib/api";

type HealthResponse = {
  ok: boolean;
  ts: number | string;
};

function isValidHealthResponse(data: unknown): data is HealthResponse {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  if (record.ok !== true) return false;
  const { ts } = record;
  if (typeof ts === "number") {
    return Number.isFinite(ts);
  }
  if (typeof ts === "string") {
    if (!ts.trim()) return false;
    const parsed = Date.parse(ts);
    return Number.isFinite(parsed);
  }
  return false;
}

let cachedStatus: boolean | undefined;
let pendingProbe: Promise<boolean> | null = null;

async function probeBackend(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await apiJSON<unknown>("/api/health", { signal: controller.signal });
    return isValidHealthResponse(response);
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function ensureProbe(): Promise<boolean> {
  if (cachedStatus !== undefined) {
    return Promise.resolve(cachedStatus);
  }

  if (!pendingProbe) {
    pendingProbe = probeBackend().then((result) => {
      cachedStatus = result;
      return result;
    }).finally(() => {
      pendingProbe = null;
    });
  }

  return pendingProbe;
}

export function useBackendHealth(): boolean | null {
  const [status, setStatus] = useState<boolean | null>(() => {
    if (cachedStatus === undefined) return null;
    return cachedStatus;
  });

  useEffect(() => {
    let active = true;

    if (cachedStatus !== undefined) {
      setStatus(cachedStatus);
      return () => {
        active = false;
      };
    }

    ensureProbe().then((result) => {
      if (active) {
        setStatus(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return status;
}
