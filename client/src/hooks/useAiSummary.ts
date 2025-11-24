import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type UseAiSummaryParams = {
  symbol: string;
  tf: string;
  technicals?: unknown;
};

export function useAiSummary({ symbol, tf, technicals }: UseAiSummaryParams) {
  return useQuery({
    queryKey: ["aiSummary", symbol, tf],
    queryFn: async () => {
      const response = (await apiFetch("/api/ai/summary", {
        method: "POST",
        body: JSON.stringify({ symbol, tf, technicals }),
      })) as { data?: string } | null;
      const text = typeof response?.data === "string" ? response.data : "";
      return text;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    enabled: false,
  });
}

