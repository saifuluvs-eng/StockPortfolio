import { useEffect, useState } from "react";
import { api } from "@/lib/api";

let cachedStatus: boolean | undefined;
let pendingProbe: Promise<boolean> | null = null;

async function probeBackend(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await api("/api/health", { signal: controller.signal });
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
