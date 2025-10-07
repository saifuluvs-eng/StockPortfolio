// client/src/pages/ai-insights.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, Brain, Zap, TrendingUp, Flame } from "lucide-react";
import { api } from "@/lib/api";

type Insight = {
  title: string;
  detail: string;
  tags: string[];
};

type Binance24hr = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
};

function safeNum(x: unknown, d = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : d;
}

type InsightSource = "api" | "fallback";

type InsightPayload = {
  insights: Insight[];
  table: Binance24hr[];
  source: InsightSource;
  primaryErrorCode?: string;
};

class InsightError extends Error {
  code?: string;
  source?: InsightSource;

  constructor(message: string, code?: string, source?: InsightSource) {
    super(message);
    this.name = "InsightError";
    this.code = code;
    this.source = source;
  }
}

async function fetchInsightsFallback(): Promise<{ insights: Insight[]; table: Binance24hr[] }> {
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    if (res.status === 429) {
      throw new InsightError("Binance rate limited", "BINANCE_RATE_LIMIT", "fallback");
    }
    if (res.status === 401 || res.status === 403) {
      throw new InsightError("Binance auth required", "BINANCE_AUTH", "fallback");
    }
    if (!res.ok) {
      throw new InsightError("Binance request failed", "BINANCE_ERROR", "fallback");
    }
    const all = (await res.json()) as Binance24hr[];
    const usdt = all.filter((r) => r.symbol.endsWith("USDT"));

    // Compute simple features
    const enriched = usdt.map((r) => {
      const last = safeNum(r.lastPrice);
      const high = safeNum(r.highPrice);
      const low = safeNum(r.lowPrice);
      const change = safeNum(r.priceChangePercent);
      const range = Math.max(1e-8, high - low);
      const pos = Math.max(0, Math.min(1, (last - low) / range)); // 0..1 (near high)
      return { ...r, _pos: pos, _chg: change, _qv: safeNum(r.quoteVolume) };
    });

    const byChange = [...enriched].sort((a, b) => b._chg - a._chg);
    const byRangePos = [...enriched].sort((a, b) => b._pos - a._pos);
    const byVolume = [...enriched].sort((a, b) => b._qv - a._qv);

    const topBreakouts = byRangePos
      .filter((x) => x._chg > 3 && x._pos > 0.7)
      .slice(0, 5)
      .map((x) => x.symbol.replace("USDT", ""));
    const momentumLeaders = byChange.slice(0, 5).map((x) => x.symbol.replace("USDT", ""));
    const liquidityLeaders = byVolume.slice(0, 5).map((x) => x.symbol.replace("USDT", ""));
    const overheated = enriched
      .filter((x) => x._chg > 15 && x._pos > 0.9)
      .slice(0, 5)
      .map((x) => x.symbol.replace("USDT", ""));

    const insights: Insight[] = [
      {
        title: "Breakout candidates near 24h highs",
        detail: topBreakouts.length ? topBreakouts.join(", ") : "No clear breakouts right now.",
        tags: ["breakout", "price-action"],
      },
      {
        title: "Top momentum leaders (24h %)",
        detail: momentumLeaders.length ? momentumLeaders.join(", ") : "No strong momentum standouts.",
        tags: ["momentum"],
      },
      {
        title: "Highest liquidity (quote volume)",
        detail: liquidityLeaders.length ? liquidityLeaders.join(", ") : "Low liquidity market.",
        tags: ["liquidity"],
      },
      {
        title: "Potentially overheated (extended move)",
        detail: overheated.length ? overheated.join(", ") : "No overheated clusters.",
        tags: ["risk", "overextension"],
      },
    ];

    return { insights, table: byChange.slice(0, 50) }; // keep table light
  } catch (err) {
    if (err instanceof InsightError) {
      throw err;
    }
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: string }).code : undefined;
    throw new InsightError("Binance request failed", (code as string | undefined) ?? "BINANCE_ERROR", "fallback");
  }
}

async function fetchInsights(): Promise<InsightPayload> {
  let primaryError: InsightError | undefined;

  try {
    const r = await api("/api/ai/insights");
    if (r.status === 429) {
      throw new InsightError("Primary insights service rate limited", "RATE_LIMITED", "api");
    }
    if (r.status === 401 || r.status === 403) {
      throw new InsightError("Authentication required for AI insights", "AUTH_REQUIRED", "api");
    }
    if (!r.ok) {
      throw new InsightError("Primary insights request failed", "API_ERROR", "api");
    }
    const payload = (await r.json()) as { insights: Insight[]; table?: Binance24hr[] };
    return {
      insights: payload.insights || [],
      table: payload.table || [],
      source: "api",
    };
  } catch (err) {
    if (err instanceof InsightError) {
      primaryError = err;
    } else {
      primaryError = new InsightError("Primary insights request failed", "API_ERROR", "api");
    }
  }

  try {
    const fallback = await fetchInsightsFallback();
    return {
      ...fallback,
      source: "fallback",
      primaryErrorCode: primaryError?.code,
    };
  } catch (err) {
    if (err instanceof InsightError) {
      throw err;
    }
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: string }).code : undefined;
    throw new InsightError("Fallback insights request failed", code ?? "FALLBACK_ERROR", "fallback");
  }
}

export default function AIInsights() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<{ insights: Insight[]; table: Binance24hr[] }>({ insights: [], table: [] });
  const [lastSuccessfulData, setLastSuccessfulData] = useState<
    { insights: Insight[]; table: Binance24hr[]; source: InsightSource }
  | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [activeSource, setActiveSource] = useState<InsightSource | null>(null);

  const query = useQuery<InsightPayload, InsightError>({
    queryKey: ["ai-insights"],
    queryFn: fetchInsights,
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    refetchInterval: () =>
      typeof document !== "undefined" && document.visibilityState === "visible" ? 5 * 60 * 1000 : false,
    onSuccess: (payload) => {
      setData({ insights: payload.insights, table: payload.table });
      setLastSuccessfulData({ insights: payload.insights, table: payload.table, source: payload.source });
      setLastUpdated(new Date());
      setIsUsingCache(false);
      setActiveSource(payload.source);

      if (payload.source === "fallback" && payload.primaryErrorCode === "RATE_LIMITED") {
        toast({ title: "Using Binance fallback", description: "Primary insights are rate limited. Showing market-based estimates." });
      } else if (payload.source === "fallback" && payload.primaryErrorCode === "AUTH_REQUIRED") {
        toast({
          title: "Sign in required",
          description: "Authenticate with the AI service to access premium insights. Showing Binance fallback instead.",
        });
      } else {
        toast({ title: "Insights updated" });
      }
    },
    onError: (error) => {
      let message = "Failed to load insights";
      let description: string | undefined;
      if (error instanceof InsightError) {
        if (error.code === "RATE_LIMITED" || error.code === "BINANCE_RATE_LIMIT") {
          message = "Rate limited";
          description = "Too many requests. Please retry in a moment.";
        } else if (error.code === "AUTH_REQUIRED" || error.code === "BINANCE_AUTH") {
          message = "Authentication required";
          description = "Sign in to refresh your insights.";
        }
      }

      if (lastSuccessfulData) {
        setData({ insights: lastSuccessfulData.insights, table: lastSuccessfulData.table });
        setIsUsingCache(true);
        setActiveSource(lastSuccessfulData.source);
        toast({
          title: message,
          description: description ?? "Showing your last saved insights instead.",
          variant: "destructive",
        });
      } else {
        setData({ insights: [], table: [] });
        setIsUsingCache(false);
        setActiveSource(null);
        toast({
          title: message,
          description,
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setData({ insights: [], table: [] });
      setLastSuccessfulData(null);
      setLastUpdated(null);
      setActiveSource(null);
      setIsUsingCache(false);
    }
  }, [isAuthenticated]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return null;
    const diffMs = Date.now() - lastUpdated.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin <= 1) return "Last updated just now";
    if (diffMin < 60) return `Last updated ${diffMin} min ago`;
    const diffHr = Math.round(diffMin / 60);
    return `Last updated ${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  }, [lastUpdated]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex min-w-0 items-center gap-2 break-keep whitespace-normal text-2xl font-bold text-foreground">
              <Brain className="w-6 h-6" />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">AI Insights</span>
            </h1>
            <p className="text-muted-foreground">Market themes & signals, refreshed on demand.</p>
          </div>
          <Button
            onClick={() => query.refetch()}
            disabled={!isAuthenticated || query.isFetching}
            className="bg-primary text-primary-foreground"
            data-testid="button-refresh-insights"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${query.isFetching ? "animate-spin" : ""}`} />
            {query.isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {(query.isFetching || isUsingCache || activeSource === "fallback" || lastUpdatedLabel) && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {query.isFetching && <span className="text-muted-foreground">Refreshing insights…</span>}
            {lastUpdatedLabel && <span className="text-muted-foreground">{lastUpdatedLabel}</span>}
            {isUsingCache && (
              <span className="rounded-md bg-amber-100 px-3 py-1 text-amber-800">
                Showing cached insights.
                <button type="button" className="ml-2 underline" onClick={() => query.refetch()}>
                  Retry?
                </button>
              </span>
            )}
            {!isUsingCache && activeSource === "fallback" && (
              <span className="rounded-md bg-blue-100 px-3 py-1 text-blue-800">
                Powered by Binance fallback while primary service recovers.
              </span>
            )}
          </div>
        )}

        {/* Insight cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.insights.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-muted-foreground">Click Refresh to generate insights.</CardContent>
            </Card>
          ) : (
            data.insights.map((ins, i) => (
              <Card key={i} className="border-border">
                <CardHeader>
                  <CardTitle className="flex min-w-0 items-center gap-2">
                    {ins.tags.includes("breakout") ? <Zap className="w-5 h-5 text-accent" /> :
                     ins.tags.includes("momentum") ? <TrendingUp className="w-5 h-5 text-accent" /> :
                     ins.tags.includes("risk") ? <Flame className="w-5 h-5 text-destructive" /> :
                     <Brain className="w-5 h-5" />}
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{ins.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-foreground">{ins.detail}</div>
                  <div className="flex gap-2 flex-wrap">
                    {ins.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Top movers table (optional) */}
        {data.table.length > 0 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Top Movers (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 text-muted-foreground">Symbol</th>
                      <th className="text-right p-3 text-muted-foreground">Last Price</th>
                      <th className="text-right p-3 text-muted-foreground">24h %</th>
                      <th className="text-right p-3 text-muted-foreground">High</th>
                      <th className="text-right p-3 text-muted-foreground">Low</th>
                      <th className="text-right p-3 text-muted-foreground">Quote Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.table.map((r) => {
                      const base = r.symbol.replace("USDT", "");
                      const chg = safeNum(r.priceChangePercent);
                      return (
                        <tr key={r.symbol} className="border-b border-border hover:bg-muted/20">
                          <td className="p-3 font-medium">{base}</td>
                          <td className="p-3 text-right">${safeNum(r.lastPrice).toFixed(6)}</td>
                          <td className={`p-3 text-right ${chg >= 0 ? "text-accent" : "text-destructive"}`}>
                            {(chg >= 0 ? "+" : "") + chg.toFixed(2)}%
                          </td>
                          <td className="p-3 text-right">${safeNum(r.highPrice).toFixed(6)}</td>
                          <td className="p-3 text-right">${safeNum(r.lowPrice).toFixed(6)}</td>
                          <td className="p-3 text-right">{safeNum(r.quoteVolume).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
