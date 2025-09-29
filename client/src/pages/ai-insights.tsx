import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, Brain, Zap, TrendingUp, Flame } from "lucide-react";

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

async function fetchInsightsFallback(): Promise<{ insights: Insight[]; table: Binance24hr[] }> {
  const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
  if (!res.ok) return { insights: [], table: [] };
  const all = (await res.json()) as Binance24hr[];
  const usdt = all.filter((r) => r.symbol.endsWith("USDT"));

  // Compute some simple features
  const enriched = usdt.map((r) => {
    const last = safeNum(r.lastPrice);
    const high = safeNum(r.highPrice);
    const low = safeNum(r.lowPrice);
    const change = safeNum(r.priceChangePercent);
    const range = Math.max(1e-8, high - low);
    const pos = Math.max(0, Math.min(1, (last - low) / range)); // 0..1
    return { ...r, _pos: pos, _chg: change, _qv: safeNum(r.quoteVolume) };
  });

  const byChange = [...enriched].sort((a, b) => b._chg - a._chg);
  const byRangePos = [...enriched].sort((a, b) => b._pos - a._pos);
  const byVolume = [...enriched].sort((a, b) => b._qv - a._qv);

  const topBreakouts = byRangePos.filter((x) => x._chg > 3 && x._pos > 0.7).slice(0, 5).map((x) => x.symbol.replace("USDT", ""));
  const momentumLeaders = byChange.slice(0, 5).map((x) => x.symbol.replace("USDT", ""));
  const liquidityLeaders = byVolume.slice(0, 5).map((x) => x.symbol.replace("USDT", ""));
  const overheated = enriched.filter((x) => x._chg > 15 && x._pos > 0.9).slice(0, 5).map((x) => x.symbol.replace("USDT", ""));

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
}

export default function AIInsights() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<{ insights: Insight[]; table: Binance24hr[] }>({ insights: [], table: [] });

  const runMutation = useMutation({
    mutationFn: async () => {
      // 1) Try your API if it exists
      try {
        const r = await fetch("/api/ai/insights");
        if (r.ok) {
          return (await r.json()) as { insights: Insight[]; table?: Binance24hr[] };
        }
      } catch {
        /* fall back below */
      }
      // 2) Fallback: local “AI-style” insights from Binance data
      return await fetchInsightsFallback();
    },
    onSuccess: (payload) => {
      setData({ insights: payload.insights || [], table: payload.table || [] });
      toast({ title: "Insights updated" });
    },
    onError: () => {
      toast({ title: "Failed to load insights", variant: "destructive" });
    },
  });

  return (
    <div className="flex-1 overflow-hidden">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-6 h-6" /> AI Insights
            </h1>
            <p className="text-muted-foreground">Market themes & signals, refreshed on demand.</p>
          </div>
          <Button onClick={() => runMutation.mutate()} disabled={!isAuthenticated || runMutation.isPending} className="bg-primary text-primary-foreground">
            <RefreshCw className={`w-4 h-4 mr-2 ${runMutation.isPending ? "animate-spin" : ""}`} />
            {runMutation.isPending ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

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
                  <CardTitle className="flex items-center gap-2">
                    {ins.tags.includes("breakout") ? <Zap className="w-5 h-5 text-accent" /> :
                     ins.tags.includes("momentum") ? <TrendingUp className="w-5 h-5 text-accent" /> :
                     ins.tags.includes("risk") ? <Flame className="w-5 h-5 text-destructive" /> :
                     <Brain className="w-5 h-5" />}
                    {ins.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-foreground">{ins.detail}</div>
                  <div className="flex gap-2 flex-wrap">
                    {ins.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
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
                          <td className={`p-3 text-right ${chg >= 0 ? "text-accent" : "text-destructive"}`}>{(chg >= 0 ? "+" : "") + chg.toFixed(2)}%</td>
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
