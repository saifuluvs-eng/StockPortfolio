import { useAiSummary } from "@/hooks/useAiSummary";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CopyIcon, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type AiSummaryPanelProps = {
  symbol: string;
  tf: string;
  technicals?: unknown;
};

export default function AiSummaryPanel({ symbol, tf, technicals }: AiSummaryPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, isError, isFetching } = useAiSummary({ symbol, tf, technicals });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    console.log("[DEBUG] Generate button clicked!");
    console.log("[DEBUG] Props - symbol:", symbol, "tf:", tf, "hasUser:", !!user);
    
    if (!symbol || !tf) {
      console.error("[DEBUG] Cannot generate: missing symbol or tf", { symbol, tf });
      return;
    }

    setIsGenerating(true);
    try {
      // First, invalidate to mark as stale
      await queryClient.invalidateQueries({ queryKey: ["aiSummary", symbol, tf] });
      
      const response = await (await import("@/lib/api")).apiFetch("/api/ai/summary", {
        method: "POST",
        body: JSON.stringify({ symbol, tf, technicals }),
      });
      
      console.log("[DEBUG] API response received:", !!response?.data);
      
      if (response?.data) {
        // Set the data in cache
        queryClient.setQueryData(["aiSummary", symbol, tf], response.data);
        console.log("[DEBUG] Data set in cache successfully");
      }
    } catch (error) {
      console.error("[DEBUG] Generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(data || "");
    } catch (error) {
      console.warn("Failed to copy AI summary", error);
    }
  };

  const content = useMemo(() => {
    if (!user) return "Sign in to use AI Summary.";
    if (isLoading) return "Generating…";
    if (isError) return "Failed to generate. Try again.";
    if (!data) return "Click Generate to start analysis.";
    return data;
  }, [data, isError, isLoading, user]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/70 bg-card/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">AI Summary</h3>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleGenerate}
                disabled={isFetching || isLoading || isGenerating}
              >
                <Wand2
                  className={cn(
                    "mr-2 h-4 w-4",
                    (isFetching || isLoading || isGenerating) && "animate-spin",
                  )}
                />
                Generate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!data}
                aria-label="Copy summary"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link to="/account">Sign In</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex-1 overflow-auto whitespace-pre-wrap text-sm leading-6">
        {content}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Powered by Gemini • Context: {symbol} {tf}
      </div>
    </div>
  );
}

