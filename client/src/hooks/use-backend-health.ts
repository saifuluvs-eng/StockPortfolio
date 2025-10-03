import { useEffect, useState } from "react";

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, "") || "";
const HEALTH_URL = `${API_BASE || ""}/api/health`;

let cachedStatus: boolean | undefined;
let pendingProbe: Promise<boolean> | null = null;

async function probeBackend(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(HEALTH_URL, { signal: controller.signal });
    return response.ok;
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
