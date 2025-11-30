import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type UseAiSummaryParams = {
  symbol: string;
  tf: string;
  technicals?: unknown;
  candles?: unknown[];
  focus?: 'institutional' | 'chart';
};

export function useAiSummary({ symbol, tf, technicals, candles, focus }: UseAiSummaryParams) {
  return useQuery({
    queryKey: ["aiSummary", symbol, tf, focus], // Add focus to queryKey to differentiate cache
    queryFn: async () => {
      const response = (await apiFetch("/api/ai/summary", {
        method: "POST",
        body: JSON.stringify({ symbol, tf, technicals, candles, focus }),
      })) as { data?: string } | null;
      const text = typeof response?.data === "string" ? response.data : "";
      return text;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    enabled: false,
  });
}

