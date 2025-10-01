import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { displayPairFromSymbol } from "@/lib/symbols";
import { toBackendTimeframe } from "@/lib/timeframes";
import type { ScanResult } from "@/types/scanner";

interface Options {
  selectedSymbol: string;
  selectedTimeframe: string;
}

export function useScannerAnalysis({ selectedSymbol, selectedTimeframe }: Options) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, signInWithGoogle } = useAuth();

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const symbolRef = useRef(selectedSymbol);
  const timeframeRef = useRef(selectedTimeframe);

  useEffect(() => {
    symbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  useEffect(() => {
    timeframeRef.current = selectedTimeframe;
  }, [selectedTimeframe]);

  const mutation = useMutation({
    mutationFn: async (overrides?: { symbol?: string; timeframe?: string }) => {
      const symbol = overrides?.symbol ?? symbolRef.current;
      const timeframe = overrides?.timeframe ?? timeframeRef.current;
      const res = await apiRequest("POST", "/api/scanner/scan", {
        symbol,
        timeframe: toBackendTimeframe(timeframe),
      });
      return (await res.json()) as ScanResult;
    },
    onSuccess: (data) => {
      setScanResult(data);
      toast({
        title: "Analysis complete",
        description: `Technical breakdown ready for ${displayPairFromSymbol(data.symbol)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["scan-history"] });
    },
    onError: (error: unknown) => {
      if (error instanceof Error && isUnauthorizedError(error)) {
        toast({
          title: "Sign in required",
          description: "Please sign back in to analyze symbols.",
          variant: "destructive",
        });
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }
      toast({
        title: "Analysis failed",
        description: "Could not analyze the symbol. Please try again.",
        variant: "destructive",
      });
    },
  });

  const runScan = (overrides?: { symbol?: string; timeframe?: string }) => {
    if (!isAuthenticated) {
      toast({
        title: "Feature locked",
        description: "Please sign in to run scans.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(overrides);
  };

  return {
    scanResult,
    setScanResult,
    runScan,
    isScanning: mutation.isPending,
    isAuthenticated,
  };
}
