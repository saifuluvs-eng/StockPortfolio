import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, TrendingUp, TrendingDown } from "lucide-react";

interface PerformanceComparisonCardProps {
    btcChange: number; // BTC 24h change %
    totalPnlPct: number; // Portfolio All-Time P&L %
}

export function PerformanceComparisonCard({ btcChange, totalPnlPct }: PerformanceComparisonCardProps) {
    const isBeatingBtc = totalPnlPct > btcChange;
    const diff = totalPnlPct - btcChange;

    return (
        <Card className="dashboard-card h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Award className="w-4 h-4 text-primary" />
                    Performance vs Market
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* BTC Row */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 font-bold text-xs">
                            ₿
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">Bitcoin (24h)</p>
                            <p className="text-xs text-muted-foreground">Benchmark</p>
                        </div>
                    </div>
                    <div className={`text-sm font-bold ${btcChange >= 0 ? "text-accent" : "text-destructive"}`}>
                        {btcChange >= 0 ? "+" : ""}{btcChange.toFixed(2)}%
                    </div>
                </div>

                {/* Portfolio Row */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            P
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">Your Portfolio</p>
                            <p className="text-xs text-muted-foreground">All Time P&L</p>
                        </div>
                    </div>
                    <div className={`text-sm font-bold ${totalPnlPct >= 0 ? "text-accent" : "text-destructive"}`}>
                        {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
                    </div>
                </div>

                {/* Verdict */}
                <div className="pt-2 text-center">
                    <p className="text-sm text-muted-foreground">
                        You are {isBeatingBtc ? "beating" : "trailing"} BTC by{" "}
                        <span className={isBeatingBtc ? "text-accent font-bold" : "text-destructive font-bold"}>
                            {Math.abs(diff).toFixed(2)}%
                        </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 opacity-70">
                        *Comparing All-Time P&L vs BTC 24h Change
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
