import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface AssetAllocationChartProps {
    positions: any[];
    prices: Record<string, number>;
}

interface StrategyResponse {
    healthScore: number;
    topInsight: string;
    actionableMove: string;
    detailedAnalysis: string;
}

export function AssetAllocationChart({ positions, prices }: AssetAllocationChartProps) {
    // Prepare data for AI
    const portfolioSnapshot = useMemo(() => {
        if (!positions || positions.length === 0) return [];

        let totalValue = 0;
        const items = positions.map((p) => {
            const sym = p.symbol.toUpperCase();
            const price = prices[sym] || p.avgPrice || 0;
            const value = (Number(p.qty) || 0) * price;
            const entryValue = (Number(p.qty) || 0) * (p.avgPrice || 0);
            const pnl = value - entryValue;
            const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

            totalValue += value;

            return {
                symbol: sym,
                qty: Number(p.qty),
                entryPrice: p.avgPrice,
                currentPrice: price,
                value,
                pnlPercent
            };
        });

        return items.map(item => ({
            ...item,
            weight: totalValue > 0 ? (item.value / totalValue) * 100 : 0
        }));
    }, [positions, prices]);

    const { data: strategy, isLoading, refetch, isRefetching } = useQuery<StrategyResponse>({
        queryKey: ["portfolio-strategy", portfolioSnapshot.length],
        queryFn: async () => {
            if (portfolioSnapshot.length === 0) return null;
            const res = await fetch("/api/ai/portfolio-strategy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ positions: portfolioSnapshot }),
            });
            if (!res.ok) throw new Error("Failed to fetch strategy");
            return res.json();
        },
        enabled: false, // Manual trigger only
        staleTime: 60 * 60 * 1000, // 1 hour
        gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    });

    if (portfolioSnapshot.length === 0) {
        return (
            <Card className="dashboard-card h-full flex flex-col justify-center items-center p-6 text-center">
                <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <Brain className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">AI Portfolio Strategist</h3>
                <p className="text-sm text-muted-foreground">
                    Add positions to unlock AI-powered insights.
                </p>
            </Card>
        );
    }

    return (
        <Card className="dashboard-card h-full flex flex-col overflow-hidden border-primary/20">
            <CardHeader className="pb-2 border-b border-border/50 bg-muted/20 shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        AI Portfolio Strategist
                    </CardTitle>
                    {strategy && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => refetch()}
                            disabled={isLoading || isRefetching}
                            title="Refresh Analysis"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading || isRefetching ? "animate-spin" : ""}`} />
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative flex flex-col min-h-0">
                {/* Loading / Empty State */}
                {isLoading || isRefetching ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-20">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                        <p className="text-sm text-muted-foreground animate-pulse">
                            Generating strategic analysis...
                        </p>
                    </div>
                ) : null}

                {!strategy && !isLoading && !isRefetching ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
                        <div className="bg-primary/10 p-4 rounded-full">
                            <Brain className="w-12 h-12 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Ready to Analyze</h3>
                            <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                                Get a comprehensive 7-step analysis of your portfolio's health, risks, and opportunities.
                            </p>
                        </div>
                        <Button onClick={() => refetch()} className="gap-2">
                            <Sparkles className="w-4 h-4" />
                            Analyze Portfolio
                        </Button>
                    </div>
                ) : strategy ? (
                    <div className="flex flex-col h-full min-h-0">
                        {/* Top Section: Score & Key Insight - Fixed Height */}
                        <div className="shrink-0 p-4 grid grid-cols-12 gap-4 bg-gradient-to-b from-background to-muted/10 border-b border-border/50">
                            {/* Health Score */}
                            <div className="col-span-3 flex flex-col items-center justify-center text-center border-r border-border/50 pr-2">
                                <div className="relative flex items-center justify-center w-14 h-14 rounded-full border-4 border-muted mb-1">
                                    <span className={`text-lg font-bold ${strategy.healthScore >= 70 ? "text-emerald-500" :
                                        strategy.healthScore >= 40 ? "text-amber-500" : "text-red-500"
                                        }`}>
                                        {strategy.healthScore}
                                    </span>
                                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                                        <path
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeDasharray={`${strategy.healthScore}, 100`}
                                            className={
                                                strategy.healthScore >= 70 ? "text-emerald-500" :
                                                    strategy.healthScore >= 40 ? "text-amber-500" : "text-red-500"
                                            }
                                        />
                                    </svg>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Health</span>
                            </div>

                            {/* Top Insight */}
                            <div className="col-span-9 flex flex-col justify-center pl-2">
                                <div className="flex items-start gap-2 mb-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-sm font-medium leading-tight text-foreground line-clamp-2">
                                        {strategy.topInsight}
                                    </p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground leading-tight line-clamp-1">
                                        <span className="text-foreground font-medium">Move: </span>
                                        {strategy.actionableMove}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Detailed Analysis - Flex Grow */}
                        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                            <div className="prose prose-invert prose-sm max-w-none text-xs text-muted-foreground space-y-4">
                                <ReactMarkdown>{strategy.detailedAnalysis}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
