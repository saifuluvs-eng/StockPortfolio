import { useAiSummary } from "@/hooks/useAiSummary";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CopyIcon, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
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

  const handleGenerate = async () => {
    // Invalidate cache first to ensure fresh data
    await queryClient.invalidateQueries({ queryKey: ["aiSummary"] });
    await queryClient.fetchQuery({
      queryKey: ["aiSummary", symbol, tf, technicals],
      queryFn: async () => {
        const { apiFetch } = await import("@/lib/api");
        const response = (await apiFetch("/api/ai/summary", {
          method: "POST",
          body: JSON.stringify({ symbol, tf, technicals }),
        })) as { data?: string } | null;
        return typeof response?.data === "string" ? response.data : "";
      },
    });
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
                disabled={isFetching || isLoading}
              >
                <Wand2
                  className={cn(
                    "mr-2 h-4 w-4",
                    (isFetching || isLoading) && "animate-spin",
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

