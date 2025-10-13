import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  deletePosition as deleteRemotePosition,
  type UpsertPayload,
  upsertPosition as upsertRemotePosition,
} from "@/lib/api/portfolio";
import { portfolioPositionsQueryKey } from "@/lib/api/portfolio-keys";
import { readDemoUserId } from "@/lib/demo-user";
import { useAuth } from "@/hooks/useAuth";

function dispatchPortfolioRefreshEvent() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: "portfolio.refresh" }));
  } catch {
    // Swallow errors from synthetic storage events (Safari private mode, etc.)
  }
}

export function useUpsertPosition() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const demoUserId = readDemoUserId();
  const effectiveUserId = userId ?? demoUserId;
  const qc = useQueryClient();
  const queryKey = portfolioPositionsQueryKey(effectiveUserId);

  return useMutation({
    mutationFn: async (payload: UpsertPayload) => {
      if (!effectiveUserId) {
        throw new Error("You need to be signed in to manage portfolio positions.");
      }
      return await upsertRemotePosition(effectiveUserId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      dispatchPortfolioRefreshEvent();
    },
  });
}

export function useDeletePosition() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const demoUserId = readDemoUserId();
  const effectiveUserId = userId ?? demoUserId;
  const qc = useQueryClient();
  const queryKey = portfolioPositionsQueryKey(effectiveUserId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!effectiveUserId) {
        throw new Error("You need to be signed in to manage portfolio positions.");
      }
      await deleteRemotePosition(id, effectiveUserId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      dispatchPortfolioRefreshEvent();
    },
  });
}
