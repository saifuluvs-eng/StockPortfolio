// client/src/pages/ai-insights.tsx
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, Brain, Zap, TrendingUp, Flame, Sparkles, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";

type MarketOverview = {
  overallSentiment: string;
  keyInsights: string[];
  tradingRecommendations: string[];
  riskAssessment: string;
};

type SymbolInsight = {
  symbol: string;
  analysisType?: string;
  signal?: string;
  confidence?: number;
  reasoning?: string;
  recommendation?: string;
  timeframe?: string;
  metadata?: {
    technicalScore?: number;
    volumeAnalysis?: string;
    marketCondition?: string;
    riskLevel?: string;
    [key: string]: string | number | undefined;
  } | null;
};

type HeuristicMetric = {
  label: string;
  value: string;
};

type HeuristicHighlight = {
  title: string;
  detail: string;
  tags: string[];
  metrics?: HeuristicMetric[];
};

type InsightsPayload = {
  lastUpdated: string | null;
  marketOverview: MarketOverview | null;
  symbolInsights: SymbolInsight[];
  heuristicHighlights: HeuristicHighlight[];
};

type ApiResponse = Partial<InsightsPayload> & {
  lastUpdated?: string | null;
  heuristicHighlights?: HeuristicHighlight[] | null;
  symbolInsights?: SymbolInsight[] | null;
  marketOverview?: MarketOverview | null;
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

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

async function fetchInsightsFallback(): Promise<InsightsPayload> {
  const emptyPayload: InsightsPayload = {
    lastUpdated: new Date().toISOString(),
    marketOverview: null,
    symbolInsights: [],
    heuristicHighlights: [],
  };

  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    if (!res.ok) return emptyPayload;
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

    const breakoutRows = byRangePos
      .filter((x) => x._chg > 3 && x._pos > 0.7)
      .slice(0, 5);
    const momentumRows = byChange.slice(0, 5);
    const liquidityRows = byVolume.slice(0, 5);
    const overheatedRows = enriched
      .filter((x) => x._chg > 15 && x._pos > 0.9)
      .slice(0, 5);

    const breakoutSymbols = breakoutRows.map((x) => x.symbol.replace("USDT", ""));
    const momentumSymbols = momentumRows.map((x) => x.symbol.replace("USDT", ""));
    const liquiditySymbols = liquidityRows.map((x) => x.symbol.replace("USDT", ""));
    const overheatedSymbols = overheatedRows.map((x) => x.symbol.replace("USDT", ""));

    const breakoutMetrics = breakoutRows.length
      ? [
          {
            label: "Avg 24h %",
            value: `${(
              breakoutRows.reduce((sum, row) => sum + row._chg, 0) / breakoutRows.length
            ).toFixed(1)}%`,
          },
          {
            label: "Avg range pos",
            value: `${(
              (breakoutRows.reduce((sum, row) => sum + row._pos, 0) / breakoutRows.length) * 100
            ).toFixed(0)}%`,
          },
        ]
      : undefined;

    const momentumMetrics = momentumRows.length
      ? [
          {
            label: "Top change",
            value: `${momentumRows[0]._chg.toFixed(1)}%`,
          },
          {
            label: "Median change",
            value: `${(
              momentumRows[Math.min(momentumRows.length - 1, Math.floor(momentumRows.length / 2))]._chg
            ).toFixed(1)}%`,
          },
        ]
      : undefined;

    const liquidityMetrics = liquidityRows.length
      ? [
          {
            label: "Top volume",
            value: `${numberFormatter.format(liquidityRows[0]._qv)} USDT`,
          },
          {
            label: "Avg volume",
            value: `${numberFormatter.format(
              liquidityRows.reduce((sum, row) => sum + row._qv, 0) / liquidityRows.length
            )} USDT`,
          },
        ]
      : undefined;

    const overheatedMetrics = overheatedRows.length
      ? [
          {
            label: "Max 24h %",
            value: `${Math.max(...overheatedRows.map((row) => row._chg)).toFixed(1)}%`,
          },
          {
            label: "Count",
            value: `${overheatedRows.length}`,
          },
        ]
      : undefined;

    const heuristicHighlights: HeuristicHighlight[] = [
      {
        title: "Breakout candidates near 24h highs",
        detail: breakoutSymbols.length ? breakoutSymbols.join(", ") : "No clear breakouts right now.",
        tags: ["breakout", "price-action"],
        metrics: breakoutMetrics,
      },
      {
        title: "Top momentum leaders (24h %)",
        detail: momentumSymbols.length ? momentumSymbols.join(", ") : "No strong momentum standouts.",
        tags: ["momentum"],
        metrics: momentumMetrics,
      },
      {
        title: "Highest liquidity (quote volume)",
        detail: liquiditySymbols.length ? liquiditySymbols.join(", ") : "Low liquidity market.",
        tags: ["liquidity"],
        metrics: liquidityMetrics,
      },
      {
        title: "Potentially overheated (extended move)",
        detail: overheatedSymbols.length ? overheatedSymbols.join(", ") : "No overheated clusters.",
        tags: ["risk", "overextension"],
        metrics: overheatedMetrics,
      },
    ];

    const averageChange =
      enriched.length === 0 ? 0 : enriched.reduce((sum, row) => sum + row._chg, 0) / enriched.length;
    const positiveCount = enriched.filter((row) => row._chg > 0).length;
    const totalQuoteVolume = enriched.reduce((sum, row) => sum + row._qv, 0);

    const marketOverview: MarketOverview = {
      overallSentiment:
        averageChange > 2
          ? "bullish - broad upside momentum"
          : averageChange < -2
            ? "bearish - downside pressure dominating"
            : "neutral - mixed 24h performance",
      keyInsights: heuristicHighlights.slice(0, 3).map((highlight) => highlight.detail),
      tradingRecommendations:
        averageChange > 2
          ? ["Consider momentum continuation setups", "Use trailing stops to protect gains"]
          : averageChange < -2
            ? ["Prioritize downside protection", "Size positions conservatively"]
            : ["Wait for confirmation before new entries", "Monitor liquidity leaders for breakouts"],
      riskAssessment:
        totalQuoteVolume > 0
          ? `Market breadth: ${positiveCount}/${enriched.length} advancers. Quote volume ${numberFormatter.format(
              totalQuoteVolume
            )} USDT indicates ${totalQuoteVolume > 5e9 ? "healthy" : "muted"} participation.`
          : "Limited data available for risk assessment.",
    };

    const symbolInsights: SymbolInsight[] = momentumRows.slice(0, 4).map((row) => {
      const signal = row._chg > 0 ? "bullish" : row._chg < 0 ? "bearish" : "neutral";
      const volumeDescriptor = row._qv > 1e9 ? "institutional" : row._qv > 2e8 ? "elevated" : "steady";
      const recommendation =
        signal === "bullish"
          ? "Monitor for continuation if volume stays elevated."
          : signal === "bearish"
            ? "Consider defensive positioning or wait for stabilization."
            : "Wait for confirmation before taking action.";
      return {
        symbol: row.symbol.replace("USDT", ""),
        analysisType: "quant-screen",
        signal,
        confidence: clamp((Math.abs(row._chg) / 12 + row._pos) / 2),
        recommendation,
        reasoning: `24h change ${row._chg.toFixed(2)}%, range position ${(row._pos * 100).toFixed(0)}%, quote volume ${numberFormatter.format(
          row._qv
        )} USDT.`,
        timeframe: "24h",
        metadata: {
          technicalScore: Math.round(clamp(50 + row._chg, 0, 100)),
          volumeAnalysis: `${volumeDescriptor} volume`,
          marketCondition: row._pos > 0.7 ? "pressing highs" : row._pos < 0.3 ? "near lows" : "mid-range",
          riskLevel: Math.abs(row._chg) > 10 ? "high" : Math.abs(row._chg) > 6 ? "medium" : "balanced",
        },
      };
    });

    return {
      lastUpdated: new Date().toISOString(),
      marketOverview,
      symbolInsights,
      heuristicHighlights,
    };
  } catch {
    return emptyPayload;
  }
}

async function fetchInsights(): Promise<ApiResponse | InsightsPayload> {
  try {
    const r = await api("/api/ai/insights");
    if (r.ok) {
      return (await r.json()) as ApiResponse;
    }
  } catch {
    /* swallow so we can fall back below */
  }

  return await fetchInsightsFallback();
}

export default function AIInsights() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<InsightsPayload>({
    lastUpdated: null,
    marketOverview: null,
    symbolInsights: [],
    heuristicHighlights: [],
  });

  const normalisePayload = (payload: ApiResponse | InsightsPayload): InsightsPayload => {
    const isoTimestamp =
      payload.lastUpdated && typeof payload.lastUpdated === "string"
        ? payload.lastUpdated
        : new Date().toISOString();

    return {
      lastUpdated: isoTimestamp,
      marketOverview:
        payload.marketOverview && typeof payload.marketOverview === "object"
          ? payload.marketOverview
          : null,
      symbolInsights: Array.isArray(payload.symbolInsights) ? payload.symbolInsights : [],
      heuristicHighlights: Array.isArray(payload.heuristicHighlights) ? payload.heuristicHighlights : [],
    };
  };

  const query = useQuery({
    queryKey: ["ai-insights"],
    queryFn: fetchInsights,
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
    onSuccess: (payload) => {
      setData(normalisePayload(payload));
      toast({ title: "Insights updated" });
    },
    onError: () => {
      toast({ title: "Failed to load insights", variant: "destructive" });
    },
  });

  // Auto-refresh once on mount when authenticated, so the page never looks empty
  useEffect(() => {
    if (
      isAuthenticated &&
      !data.marketOverview &&
      data.symbolInsights.length === 0 &&
      data.heuristicHighlights.length === 0 &&
      !query.isFetching
    ) {
      void query.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="flex min-w-0 items-center gap-2 break-keep whitespace-normal text-2xl font-bold text-foreground">
              <Brain className="w-6 h-6" />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">AI Insights</span>
            </h1>
            <p className="text-muted-foreground">Market themes &amp; signals, refreshed on demand.</p>
            {data.lastUpdated && (() => {
              const parsed = new Date(data.lastUpdated!);
              if (Number.isNaN(parsed.getTime())) return null;
              return (
                <p className="text-sm text-muted-foreground">
                  Last updated {formatDistanceToNowStrict(parsed, { addSuffix: true })}
                </p>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="link" asChild className="whitespace-nowrap">
              <Link href="/gainers">View full gainers table</Link>
            </Button>
            <Button
              onClick={() => void query.refetch()}
              disabled={!isAuthenticated || query.isFetching}
              className="bg-primary text-primary-foreground"
              data-testid="button-refresh-insights"
            >
              <RefreshCw className={`w-4 h-4 ${query.isFetching ? "animate-spin" : ""}`} />
              <span className="ml-2">{query.isFetching ? "Refreshing..." : "Refresh"}</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="border-border">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-accent" />
                <span>Market Overview</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Sentiment snapshot, key narratives, and risk context for the broader market.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {data.marketOverview ? (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Overall sentiment</div>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {data.marketOverview.overallSentiment}
                    </p>
                  </div>

                  {data.marketOverview.keyInsights?.length ? (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Key insights</div>
                      <ul className="mt-2 space-y-2 text-sm text-foreground/90 list-disc list-inside">
                        {data.marketOverview.keyInsights.map((insight, idx) => (
                          <li key={idx}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {data.marketOverview.tradingRecommendations?.length ? (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Trading notes</div>
                      <ul className="mt-2 space-y-2 text-sm text-foreground/90 list-disc list-inside">
                        {data.marketOverview.tradingRecommendations.map((recommendation, idx) => (
                          <li key={idx}>{recommendation}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {data.marketOverview.riskAssessment ? (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Risk assessment</div>
                      <p className="mt-2 text-sm text-foreground/90">{data.marketOverview.riskAssessment}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No market overview available yet. Refresh to generate the latest summary.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border">
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <span>Featured Signals</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  AI-ranked opportunities with confidence scores and supporting context.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.symbolInsights.length ? (
                  data.symbolInsights.slice(0, 4).map((signal) => {
                    const confidencePercent = signal.confidence
                      ? Math.round(clamp(signal.confidence) * 100)
                      : null;
                    const metaEntries = [
                      signal.metadata?.technicalScore !== undefined
                        ? { label: "Tech score", value: `${signal.metadata.technicalScore}` }
                        : null,
                      signal.metadata?.volumeAnalysis
                        ? { label: "Volume", value: signal.metadata.volumeAnalysis }
                        : null,
                      signal.metadata?.marketCondition
                        ? { label: "Market", value: signal.metadata.marketCondition }
                        : null,
                      signal.metadata?.riskLevel
                        ? { label: "Risk", value: signal.metadata.riskLevel }
                        : null,
                    ].filter(Boolean) as HeuristicMetric[];

                    const signalBadgeClass =
                      signal.signal === "bullish"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : signal.signal === "bearish"
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-muted text-muted-foreground border-border";

                    return (
                      <div
                        key={`${signal.symbol}-${signal.timeframe ?? ""}`}
                        className="rounded-xl border border-border/80 bg-background/40 p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-lg font-semibold tracking-tight text-foreground">
                                {signal.symbol}
                              </span>
                              {signal.signal ? (
                                <Badge variant="outline" className={signalBadgeClass}>
                                  {signal.signal}
                                </Badge>
                              ) : null}
                              {signal.timeframe ? (
                                <Badge variant="default" className="bg-muted text-muted-foreground">
                                  {signal.timeframe}
                                </Badge>
                              ) : null}
                            </div>
                            {signal.recommendation ? (
                              <p className="mt-1 text-sm text-foreground/90">{signal.recommendation}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {confidencePercent !== null ? (
                              <Badge variant="default" className="bg-accent/10 text-accent">
                                Confidence {confidencePercent}%
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        {metaEntries.length ? (
                          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                            {metaEntries.map((entry) => (
                              <div key={`${signal.symbol}-${entry.label}`} className="flex items-center justify-between gap-2">
                                <dt className="capitalize">{entry.label}</dt>
                                <dd className="font-medium text-foreground">{entry.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}

                        {signal.reasoning ? (
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {signal.reasoning}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No featured signals right now. Refresh to pull the latest AI rankings.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-accent" />
                  <span>Quant Highlights</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Breakout, momentum, and liquidity heuristics with supporting stats.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4">
                {data.heuristicHighlights.length ? (
                  data.heuristicHighlights.map((highlight, idx) => {
                    const icon = highlight.tags.includes("breakout")
                      ? <Zap className="w-5 h-5 text-accent" />
                      : highlight.tags.includes("momentum")
                        ? <TrendingUp className="w-5 h-5 text-accent" />
                        : highlight.tags.includes("risk")
                          ? <Flame className="w-5 h-5 text-destructive" />
                          : <Brain className="w-5 h-5 text-foreground" />;

                    return (
                      <div
                        key={`${highlight.title}-${idx}`}
                        className="rounded-xl border border-border/80 bg-background/40 p-4"
                      >
                        <div className="flex items-start gap-3">
                          {icon}
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-foreground">{highlight.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{highlight.detail}</p>
                          </div>
                        </div>

                        {highlight.metrics?.length ? (
                          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                            {highlight.metrics.map((metric) => (
                              <div key={`${highlight.title}-${metric.label}`} className="flex items-center justify-between gap-2">
                                <dt>{metric.label}</dt>
                                <dd className="font-medium text-foreground">{metric.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {highlight.tags.map((tag) => (
                            <Badge key={tag} variant="default" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Quant heuristics are unavailable. Refresh to regenerate the analytics snapshot.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
