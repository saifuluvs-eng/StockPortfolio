import { useAiSummary } from "@/hooks/useAiSummary";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CopyIcon, Wand2, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useMemo, forwardRef, useImperativeHandle } from "react";
import { Link } from "wouter";

type AiSummaryPanelProps = {
  symbol: string;
  tf: string;
  technicals?: unknown;
  candles?: unknown[];
};

export interface AiSummaryPanelRef {
  generate: () => void;
}

const AiSummaryPanel = forwardRef<AiSummaryPanelRef, AiSummaryPanelProps>(
  ({ symbol, tf, technicals, candles }, ref) => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { data, isLoading, isError, isFetching } = useAiSummary({ symbol, tf, technicals, candles });
    const [isGenerating, setIsGenerating] = useState(false);

    const COOLDOWN_MS = 60 * 1000; // 1 minute global cap
    const PERSISTENCE_MS = 60 * 60 * 1000; // 1 hour
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    useEffect(() => {
      const globalGenKey = "ai_global_last_gen";
      const contentKey = `ai_summary_content_${symbol}_${tf}`;

      // Load persisted content & timestamp for THIS coin
      const savedContent = localStorage.getItem(contentKey);
      if (savedContent) {
        try {
          const parsed = JSON.parse(savedContent);
          const age = Date.now() - parsed.timestamp;
          if (age < PERSISTENCE_MS) {
            queryClient.setQueryData(["aiSummary", symbol, tf], parsed.content);
            setLastUpdated(new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        } catch (e) {
          console.error("Failed to parse saved summary", e);
        }
      } else {
        setLastUpdated(null);
      }

      // Load GLOBAL cooldown
      const savedGlobalGen = localStorage.getItem(globalGenKey);
      if (savedGlobalGen) {
        const lastTime = parseInt(savedGlobalGen, 10);
        const now = Date.now();
        const diff = now - lastTime;
        if (diff < COOLDOWN_MS) {
          setCooldownRemaining(Math.ceil((COOLDOWN_MS - diff) / 1000));
        } else {
          setCooldownRemaining(0);
        }
      } else {
        setCooldownRemaining(0);
      }
    }, [symbol, tf, queryClient]);

    useEffect(() => {
      if (cooldownRemaining <= 0) return;
      const interval = setInterval(() => {
        setCooldownRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }, [cooldownRemaining]);

    const handleGenerate = async () => {
      if (cooldownRemaining > 0) return;

      console.log("[DEBUG] Generate button clicked!");
      console.log("[DEBUG] Props - symbol:", symbol, "tf:", tf, "hasUser:", !!user);
      console.log("[DEBUG] Candles prop:", candles ? `Present (Length: ${candles.length})` : "Missing");

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
          body: JSON.stringify({ symbol, tf, technicals, candles }),
        });

        console.log("[DEBUG] API response received:", !!response?.data);

        if (response?.data) {
          // Set the data in cache
          queryClient.setQueryData(["aiSummary", symbol, tf], response.data);
          console.log("[DEBUG] Data set in cache successfully");

          const now = Date.now();
          // Set GLOBAL cooldown
          localStorage.setItem("ai_global_last_gen", now.toString());

          // Save content for THIS coin
          localStorage.setItem(`ai_summary_content_${symbol}_${tf}`, JSON.stringify({
            content: response.data,
            timestamp: now
          }));

          setCooldownRemaining(COOLDOWN_MS / 1000);
          setLastUpdated(new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (error) {
        console.error("[DEBUG] Generation error:", error);
      } finally {
        setIsGenerating(false);
      }
    };

    useImperativeHandle(ref, () => ({
      generate: handleGenerate
    }));

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

    const formatCooldown = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
      <div className="flex flex-col rounded-2xl border border-border bg-card backdrop-blur overflow-hidden mb-8">
        <div className="sticky top-0 z-10 bg-muted/60 backdrop-blur px-4 md:px-5 py-3 border-b border-border flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">AI Summary</h3>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              {user ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isFetching || isLoading || isGenerating || cooldownRemaining > 0}
                  className={cn(cooldownRemaining > 0 && "opacity-80")}
                >
                  {cooldownRemaining > 0 ? (
                    <>
                      <Clock3 className="mr-2 h-4 w-4 animate-pulse" />
                      Generate ({formatCooldown(cooldownRemaining)})
                    </>
                  ) : (
                    <>
                      <Wand2
                        className={cn(
                          "mr-2 h-4 w-4",
                          (isFetching || isLoading || isGenerating) && "animate-spin",
                        )}
                      />
                      Generate
                    </>
                  )}
                </Button>
              ) : (
                <Button asChild variant="default" size="sm">
                  <Link to="/account">Sign In</Link>
                </Button>
              )}
            </div>
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground font-medium">
                Last updated: {lastUpdated}
              </span>
            )}
          </div>
        </div>

        <div
          className="relative flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-6 px-4 md:px-5 py-4 min-h-[400px] md:min-h-[520px] lg:min-h-[620px]"
          style={{ maxHeight: "70vh" }}
        >
          {data && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="absolute top-2 right-2 h-8 w-8 bg-background/50 hover:bg-background/80 backdrop-blur"
              aria-label="Copy summary"
            >
              <CopyIcon className="h-4 w-4" />
            </Button>
          )}
          {content}
          <div className="mt-4 text-xs text-muted-foreground border-t border-border/50 pt-2">
            Powered by Gemini • Context: {symbol} {tf}
          </div>
        </div>
      </div>
    );
  }
);

AiSummaryPanel.displayName = "AiSummaryPanel";

export default AiSummaryPanel;

