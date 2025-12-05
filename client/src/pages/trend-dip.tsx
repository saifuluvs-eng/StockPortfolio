import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiFetchLocal } from "@/lib/api";

interface TrendDipResult {
    symbol: string;
    price: number;
    rsi: {
        m15: number;
        h1: number;
        h4: number;
        d1: number;
        w1: number;
    };
    ema200: number;
    volume: number;
    priceChangePercent: number;
    timestamp: string;
}

const RsiDot = ({ val }: { val: number }) => {
    let colorClass = "bg-zinc-500";
    if (val >= 70) colorClass = "bg-rose-500"; // Overbought
    else if (val <= 30) colorClass = "bg-emerald-500"; // Oversold
    else if (val <= 45) colorClass = "bg-emerald-500/50"; // Mildly Oversold
    else if (val >= 60) colorClass = "bg-rose-500/50"; // Mildly Overbought

    return (
        <div className="flex items-center gap-2 justify-end">
            <span className={`w-2 h-2 rounded-full ${colorClass}`} />
            <span className={`font-mono ${val <= 30 || val >= 70 ? "font-bold text-white" : "text-zinc-400"}`}>
                {val === undefined ? '-' : val.toFixed(0)}
            </span>
        </div>
    );
};

export default function TrendDipPage() {
    const { data: trendDipData, isLoading, refetch, isRefetching } = useQuery<TrendDipResult[]>({
        queryKey: ["trend-dip"],
        queryFn: async () => apiFetchLocal("/api/market/strategies/trend-dip"),
        refetchInterval: 60000,
    });

    const formatPrice = (price: number) => {
        if (price < 0.00001) return price.toFixed(8);
        if (price < 0.001) return price.toFixed(7);
        if (price < 1) return price.toFixed(4);
        return price.toFixed(2);
    };

    return (
        <Page>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <TrendingUp className="text-emerald-400" />
                            Trend + Dip Strategy
                        </h1>
                        <p className="text-zinc-400 mt-1">
                            Coins in a long-term uptrend (Price &gt; EMA200) with potential entry signals.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isLoading || isRefetching}
                        className="gap-2 min-w-[140px]"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
                        {isRefetching ? "Scanning..." : "Refresh"}
                    </Button>
                </div>

                <div className="space-y-6">
                    <Card>
                        <div className="p-6 bg-zinc-900/50 border-b border-zinc-800">
                            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                                Strategy Logic
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Identifies coins in a <strong>long-term uptrend</strong> (Price &gt; EMA200).
                                <br />
                                <strong>Multi-Timeframe RSI</strong> helps pinpoint entry timing (Look for Green Dots / Low RSI).
                            </p>
                        </div>
                        <div className="h-[65vh] overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-zinc-900">
                                    <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                        <th className="p-4 font-medium">Asset</th>
                                        <th className="p-4 font-medium text-right">Price</th>
                                        <th className="p-4 font-medium text-right">24h Change</th>
                                        <th className="p-4 font-medium text-right">RSI 15m</th>
                                        <th className="p-4 font-medium text-right">RSI 1H</th>
                                        <th className="p-4 font-medium text-right">RSI 4H</th>
                                        <th className="p-4 font-medium text-right">RSI 1D</th>
                                        <th className="p-4 font-medium text-right">RSI 1W</th>
                                        <th className="p-4 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {isLoading ? (
                                        <tr><td colSpan={9} className="p-8 text-center text-zinc-500">Scanning multi-timeframe data... this may take a moment.</td></tr>
                                    ) : !trendDipData?.length ? (
                                        <tr><td colSpan={9} className="p-8 text-center text-zinc-500">No uptrending coins found.</td></tr>
                                    ) : (
                                        trendDipData.map((coin) => {
                                            return (
                                                <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                                    <td className="p-4 font-bold text-white">
                                                        <div>{coin.symbol}</div>
                                                        <div className="text-xs text-emerald-500/80 font-normal mt-0.5" title="Above EMA 200">
                                                            EMA200: ${formatPrice(coin.ema200)}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                    <td className={`p-4 text-right font-mono ${coin.priceChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                        {coin.priceChangePercent > 0 ? "+" : ""}{coin.priceChangePercent.toFixed(2)}%
                                                    </td>
                                                    <td className="p-4 text-right"><RsiDot val={coin.rsi && coin.rsi.m15} /></td>
                                                    <td className="p-4 text-right"><RsiDot val={coin.rsi && coin.rsi.h1} /></td>
                                                    <td className="p-4 text-right"><RsiDot val={coin.rsi && coin.rsi.h4} /></td>
                                                    <td className="p-4 text-right"><RsiDot val={coin.rsi && coin.rsi.d1} /></td>
                                                    <td className="p-4 text-right"><RsiDot val={coin.rsi && coin.rsi.w1} /></td>
                                                    <td className="p-4 text-right">
                                                        <Link href={`/analyse/${coin.symbol}`}>
                                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 h-8">Analyze</Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </Page>
    );
}
