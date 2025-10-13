import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { getPositions, readCachedPositions, writeCachedPositions } from "@/lib/api/portfolio";
import { portfolioPositionsQueryKey } from "@/lib/api/portfolio-keys";

export type UsePositionsOptions = {
  enabled?: boolean;
};

export function usePositions(options: UsePositionsOptions = {}) {
  const { enabled = true } = options;
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => portfolioPositionsQueryKey(userId), [userId]);
  const initialData = useMemo(
    () => (userId ? readCachedPositions(userId) ?? undefined : undefined),
    [userId],
  );

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) return [];
      return await getPositions(userId);
    },
    initialData,
    placeholderData: initialData,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    enabled: enabled && !!userId,
    refetchOnWindowFocus: false,
    retry: false,
    onSuccess: (positions) => {
      if (userId) {
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

  const data = queryResult.data ?? (userId ? initialData ?? [] : []);

  return {
    ...queryResult,
    data,
  };
}
