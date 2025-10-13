import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  deletePosition as deleteRemotePosition,
  type UpsertPayload,
  upsertPosition as upsertRemotePosition,
} from "@/lib/api/portfolio";
import { portfolioPositionsQueryKey } from "@/lib/api/portfolio-keys";
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
  const qc = useQueryClient();
  const queryKey = portfolioPositionsQueryKey(userId);

  return useMutation({
    mutationFn: async (payload: UpsertPayload) => {
      if (!userId) {
        throw new Error("You need to be signed in to manage portfolio positions.");
      }
      return await upsertRemotePosition(userId, payload);
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
  const qc = useQueryClient();
  const queryKey = portfolioPositionsQueryKey(userId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) {
        throw new Error("You need to be signed in to manage portfolio positions.");
      }
      await deleteRemotePosition(id, userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      dispatchPortfolioRefreshEvent();
    },
  });
}
