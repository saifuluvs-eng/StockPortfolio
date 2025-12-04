import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { ArrowUpRight, RefreshCw, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { api } from "@/lib/api";

interface TrendDipResult {
    symbol: string;
    price: number;
    rsi: number;
    ema200: number;
    volume: number;
    priceChangePercent: number;
    timestamp: string;
}

export default function StrategiesPage() {
    const { data, isLoading, error, refetch, isRefetching } = useQuery<TrendDipResult[]>({
        queryKey: ["trend-dip"],
        queryFn: async () => {
            const res = await api("/api/market/strategies/trend-dip");
            if (!res.ok) throw new Error("Failed to fetch strategy data");
            return res.json();
        },
        refetchInterval: 60000,
    });

    return (
        <Page>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <TrendingUp className="text-emerald-400" />
                            Trend + Dip Strategy
                        </h1>
                        <p className="text-zinc-400 mt-1">
                            High-probability setups: <span className="text-emerald-400">Uptrend (Price &gt; EMA200)</span> + <span className="text-rose-400">Dip (RSI &lt; 35)</span>.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isLoading || isRefetching}
                        className="gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
                        Refresh Scanner
                    </Button>
                </div>

                {/* Strategy Explanation Card */}
                <Card>
                    <div className="p-6 bg-zinc-900/50">
                        <h3 className="text-lg font-semibold text-white mb-2">Why this works?</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            This scanner identifies coins that are in a long-term bull market (above the 200 EMA) but are currently oversold (RSI below 35).
                            Instead of catching a falling knife in a bear market, you are buying a temporary pullback in a strong asset.
                            These setups often lead to quick <strong>5-10% bounces</strong> as the trend resumes.
                        </p>
                    </div>
                </Card>

                {/* Results Table */}
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                    <th className="p-4 font-medium">Asset</th>
                                    <th className="p-4 font-medium text-right">Price</th>
                                    <th className="p-4 font-medium text-right">24h Change</th>
                                    <th className="p-4 font-medium text-right">RSI (1h)</th>
                                    <th className="p-4 font-medium text-right">EMA 200</th>
                                    <th className="p-4 font-medium text-right">Distance to EMA</th>
                                    <th className="p-4 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-zinc-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <RefreshCw className="w-6 h-6 animate-spin" />
                                                Scanning market for opportunities...
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-rose-500">
                                            Failed to load data. Please try again.
                                        </td>
                                    </tr>
                                ) : !data || data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <AlertCircle className="w-8 h-8 text-zinc-600" />
                                                <p className="text-zinc-400 font-medium">No opportunities found right now.</p>
                                                <p className="text-zinc-500 text-xs max-w-md">
                                                    The market might be either too bullish (no dips) or bearish (price below EMA200).
                                                    Check back later!
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((coin) => {
                                        const distanceToEma = ((coin.price - coin.ema200) / coin.ema200) * 100;
                                        return (
                                            <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group">
                                                <td className="p-4">
                                                    <div className="font-bold text-white">{coin.symbol}</div>
                                                    <div className="text-xs text-zinc-500">Vol: ${(coin.volume / 1000000).toFixed(1)}M</div>
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-300">
                                                    ${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toFixed(2)}
                                                </td>
                                                <td className={`p-4 text-right font-mono ${coin.priceChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                    {coin.priceChangePercent > 0 ? "+" : ""}{coin.priceChangePercent.toFixed(2)}%
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="inline-block px-2 py-1 rounded bg-rose-500/10 text-rose-400 font-bold font-mono text-xs border border-rose-500/20">
                                                        {coin.rsi.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono text-zinc-500">
                                                    ${coin.ema200 < 1 ? coin.ema200.toFixed(4) : coin.ema200.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className={`text-xs ${distanceToEma < 2 ? "text-yellow-400 font-bold" : "text-emerald-400"}`}>
                                                        +{distanceToEma.toFixed(2)}%
                                                    </span>
                                                    {distanceToEma < 2 && (
                                                        <div className="text-[10px] text-yellow-500/80">Near Support</div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Link href={`/analyse/${coin.symbol}`}>
                                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1 h-8">
                                                            Analyze <ArrowUpRight className="w-3 h-3" />
                                                        </Button>
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
        </Page>
    );
}
