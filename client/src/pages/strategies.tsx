import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { ArrowUpRight, RefreshCw, TrendingUp, AlertCircle, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiFetchLocal } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TrendDipResult {
    symbol: string;
    price: number;
    rsi: number;
    ema200: number;
    volume: number;
    priceChangePercent: number;
    timestamp: string;
}

interface VolumeSpikeResult {
    symbol: string;
    price: number;
    volume: number;
    avgVolume: number;
    volumeMultiple: number;
    priceChangePercent: number;
    timestamp: string;
}

export default function StrategiesPage() {
    const { data: trendDipData, isLoading: isLoadingTrend, refetch: refetchTrend, isRefetching: isRefetchingTrend } = useQuery<TrendDipResult[]>({
        queryKey: ["trend-dip"],
        queryFn: async () => apiFetchLocal("/api/market/strategies/trend-dip"),
        refetchInterval: 60000,
    });

    const { data: volSpikeData, isLoading: isLoadingVol, refetch: refetchVol, isRefetching: isRefetchingVol } = useQuery<VolumeSpikeResult[]>({
        queryKey: ["volume-spike"],
        queryFn: async () => apiFetchLocal("/api/market/strategies/volume-spike"),
        refetchInterval: 60000,
    });

    const isLoading = isLoadingTrend || isLoadingVol;
    const isRefetching = isRefetchingTrend || isRefetchingVol;

    const handleRefresh = () => {
        refetchTrend();
        refetchVol();
    };

    return (
        <Page>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <TrendingUp className="text-emerald-400" />
                            Market Strategies
                        </h1>
                        <p className="text-zinc-400 mt-1">
                            Automated scanners to find high-probability trading setups.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoading || isRefetching}
                        className="gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
                        Refresh Scanners
                    </Button>
                </div>

                <Tabs defaultValue="trend-dip" className="w-full">
                    <TabsList className="bg-zinc-900 border border-zinc-800">
                        <TabsTrigger value="trend-dip" className="data-[state=active]:bg-emerald-900/20 data-[state=active]:text-emerald-400">
                            Trend + Dip
                        </TabsTrigger>
                        <TabsTrigger value="volume-spike" className="data-[state=active]:bg-blue-900/20 data-[state=active]:text-blue-400">
                            Volume Spike
                        </TabsTrigger>
                    </TabsList>

                    {/* TREND + DIP TAB */}
                    <TabsContent value="trend-dip" className="space-y-6 mt-6">
                        <Card>
                            <div className="p-6 bg-zinc-900/50 border-b border-zinc-800">
                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                                    Trend + Dip Strategy
                                </h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Identifies coins in a <strong>long-term uptrend</strong> (Price &gt; EMA200) that are currently <strong>oversold</strong> (RSI &lt; 55).
                                    Great for catching bounces in a bull market.
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                            <th className="p-4 font-medium">Asset</th>
                                            <th className="p-4 font-medium text-right">Price</th>
                                            <th className="p-4 font-medium text-right">24h Change</th>
                                            <th className="p-4 font-medium text-right">RSI (1h)</th>
                                            <th className="p-4 font-medium text-right">EMA 200</th>
                                            <th className="p-4 font-medium text-right">Distance</th>
                                            <th className="p-4 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {isLoadingTrend ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Scanning...</td></tr>
                                        ) : !trendDipData?.length ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No opportunities found.</td></tr>
                                        ) : (
                                            trendDipData.map((coin) => {
                                                const dist = ((coin.price - coin.ema200) / coin.ema200) * 100;
                                                return (
                                                    <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                                        <td className="p-4 font-bold text-white">{coin.symbol}</td>
                                                        <td className="p-4 text-right font-mono text-zinc-300">${coin.price.toFixed(coin.price < 1 ? 4 : 2)}</td>
                                                        <td className={`p-4 text-right font-mono ${coin.priceChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                            {coin.priceChangePercent > 0 ? "+" : ""}{coin.priceChangePercent.toFixed(2)}%
                                                        </td>
                                                        <td className="p-4 text-right"><span className="text-rose-400 font-bold">{coin.rsi.toFixed(1)}</span></td>
                                                        <td className="p-4 text-right font-mono text-zinc-500">${coin.ema200.toFixed(coin.ema200 < 1 ? 4 : 2)}</td>
                                                        <td className="p-4 text-right text-emerald-400">+{dist.toFixed(2)}%</td>
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
                    </TabsContent>

                    {/* VOLUME SPIKE TAB */}
                    <TabsContent value="volume-spike" className="space-y-6 mt-6">
                        <Card>
                            <div className="p-6 bg-zinc-900/50 border-b border-zinc-800">
                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-blue-400" />
                                    Volume Spike Detector
                                </h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Detects coins with <strong>unusual buying volume</strong> (Current Vol &gt; 1.5x Avg Vol) accompanied by a price increase.
                                    Often precedes a breakout or pump.
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                            <th className="p-4 font-medium">Asset</th>
                                            <th className="p-4 font-medium text-right">Price</th>
                                            <th className="p-4 font-medium text-right">24h Change</th>
                                            <th className="p-4 font-medium text-right">Current Vol</th>
                                            <th className="p-4 font-medium text-right">Avg Vol (20)</th>
                                            <th className="p-4 font-medium text-right">Multiple</th>
                                            <th className="p-4 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {isLoadingVol ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Scanning...</td></tr>
                                        ) : !volSpikeData?.length ? (
                                            <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No volume spikes found.</td></tr>
                                        ) : (
                                            volSpikeData.map((coin) => (
                                                <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                                    <td className="p-4 font-bold text-white">{coin.symbol}</td>
                                                    <td className="p-4 text-right font-mono text-zinc-300">${coin.price.toFixed(coin.price < 1 ? 4 : 2)}</td>
                                                    <td className={`p-4 text-right font-mono ${coin.priceChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                        {coin.priceChangePercent > 0 ? "+" : ""}{coin.priceChangePercent.toFixed(2)}%
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-zinc-300">{(coin.volume / 1000).toFixed(0)}K</td>
                                                    <td className="p-4 text-right font-mono text-zinc-500">{(coin.avgVolume / 1000).toFixed(0)}K</td>
                                                    <td className="p-4 text-right">
                                                        <span className="inline-block px-2 py-1 rounded bg-blue-500/10 text-blue-400 font-bold font-mono text-xs border border-blue-500/20">
                                                            {coin.volumeMultiple.toFixed(1)}x
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <Link href={`/analyse/${coin.symbol}`}>
                                                            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 h-8">Analyze</Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </Page>
    );
}
