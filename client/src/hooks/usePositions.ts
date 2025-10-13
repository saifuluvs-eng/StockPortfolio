import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import {
  getPositions,
  readCachedPositions,
  writeCachedPositions,
  type PortfolioPosition,
} from "@/lib/api/portfolio";
import { portfolioPositionsQueryKey } from "@/lib/api/portfolio-keys";

export type UsePositionsOptions = {
  enabled?: boolean;
};

function hasUpdatedRows(next: PortfolioPosition[], previous: PortfolioPosition[] | null): boolean {
  if (!Array.isArray(next)) {
    return false;
  }

  const prevArray = Array.isArray(previous) ? previous : [];
  if (prevArray.length !== next.length) {
    return true;
  }

  if (next.length === 0) {
    return false;
  }

  for (let index = 0; index < next.length; index += 1) {
    const current = next[index];
    const prev = prevArray[index];
    if (!prev) return true;
    if (current.id !== prev.id || current.updatedAt !== prev.updatedAt) {
      return true;
    }
  }

  return false;
}

function shouldPersistPositions(next: PortfolioPosition[], previous: PortfolioPosition[] | null) {
  const prevLength = Array.isArray(previous) ? previous.length : 0;
  if (!Array.isArray(next)) return false;
  if (next.length > 0) return true;
  if (prevLength === 0) return true;
  return hasUpdatedRows(next, previous);
}

export function usePositions(options: UsePositionsOptions = {}) {
  const { enabled = true } = options;
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => portfolioPositionsQueryKey(userId), [userId]);
  const cachedSnapshot = useMemo(
    () => (userId ? readCachedPositions(userId) : null),
    [userId],
  );
  const initialData = cachedSnapshot ?? undefined;

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) return [];
      const res = await getPositions(userId);
      const arr = Array.isArray(res?.data) ? res.data : [];
      const responseUserId =
        typeof res?.userId === "string" && res.userId.trim() ? res.userId.trim() : null;
      if (responseUserId && responseUserId !== userId) {
        const previous = queryClient.getQueryData<PortfolioPosition[]>(queryKey);
        if (Array.isArray(previous) && previous.length > 0) {
          return previous;
        }
        const cached = readCachedPositions(userId);
        if (Array.isArray(cached) && cached.length > 0) {
          return cached;
        }
      }
      return arr;
    },
    initialData,
    placeholderData: (previousData) => previousData ?? initialData,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    enabled: enabled && !!userId,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    retry: 2,
    onSuccess: (positions) => {
      if (!userId) return;
      const previous = readCachedPositions(userId);
      if (shouldPersistPositions(positions, previous)) {
        writeCachedPositions(userId, positions);
      }
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = (event: StorageEvent) => {
      if (event.key === "portfolio.refresh") {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    window.addEventListener("storage", handleRefresh);
    return () => window.removeEventListener("storage", handleRefresh);
  }, [queryClient, queryKey]);

  const data = queryResult.data ?? (userId ? cachedSnapshot ?? [] : []);

  return {
    ...queryResult,
    data,
  };
}
