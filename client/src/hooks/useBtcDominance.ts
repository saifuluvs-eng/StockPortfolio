import { useQuery } from "@tanstack/react-query";
import { fetchBtcDominance } from "@/lib/api/metrics";

export function useBtcDominance() {
  return useQuery({
    queryKey: ["btcDominance"],
    queryFn: fetchBtcDominance,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
