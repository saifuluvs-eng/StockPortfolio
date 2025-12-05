import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { ArrowUpRight, RefreshCw, TrendingUp, AlertCircle, BarChart2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiFetchLocal } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface VolumeSpikeResult {
    symbol: string;
    price: number;
    volume: number;
    avgVolume: number;
    volumeMultiple: number;
    priceChangePercent: number;
    timestamp: string;
}

interface SupportResistanceResult {
    symbol: string;
    price: number;
    type: 'Support' | 'Resistance';
    level: number;
    distancePercent: number;
    tests: number;
    riskReward?: number;
    volume: number;
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

    const { data: srData, isLoading: isLoadingSR, refetch: refetchSR, isRefetching: isRefetchingSR } = useQuery<SupportResistanceResult[]>({
        queryKey: ["support-resistance"],
        queryFn: async () => apiFetchLocal("/api/market/strategies/support-resistance"),
        refetchInterval: 60000,
    });

    const isLoading = isLoadingTrend || isLoadingVol || isLoadingSR;
    const isRefetching = isRefetchingTrend || isRefetchingVol || isRefetchingSR;

    const handleRefresh = () => {
        refetchTrend();
        refetchVol();
        refetchSR();
    };

    // Debugging: Check if new fields are present
    // useEffect(() => { if (srData) console.log("SR Data Received:", srData); }, [srData]);

    const formatVolume = (val: number) => {
        if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + "M";
        if (val >= 1_000) return (val / 1_000).toFixed(0) + "K";
        return val.toFixed(0);
    };

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
                        className="gap-2 min-w-[140px]"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
                        {isRefetching ? "Scanning..." : "Refresh Scanners"}
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
                        <TabsTrigger value="support-resistance" className="data-[state=active]:bg-purple-900/20 data-[state=active]:text-purple-400">
                            Support & Resistance
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
                                        {isLoadingTrend ? (
                                            <tr><td colSpan={9} className="p-8 text-center text-zinc-500">Scanning multi-timeframe data... this may take a moment.</td></tr>
                                        ) : !trendDipData?.length ? (
                                            <tr><td colSpan={9} className="p-8 text-center text-zinc-500">No uptrending coins found.</td></tr>
                                        ) : (
                                            trendDipData.map((coin) => {
                                                const dist = ((coin.price - coin.ema200) / coin.ema200) * 100;
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
                            <div className="h-[65vh] overflow-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-zinc-900">
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
                                                    <td className="p-4 text-right font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                    <td className={`p-4 text-right font-mono ${coin.priceChangePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                        {coin.priceChangePercent > 0 ? "+" : ""}{coin.priceChangePercent.toFixed(2)}%
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-zinc-300">${formatVolume(coin.volume * coin.price)}</td>
                                                    <td className="p-4 text-right font-mono text-zinc-500">${formatVolume(coin.avgVolume * coin.price)}</td>
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

                    {/* SUPPORT/RESISTANCE TAB */}
                    <TabsContent value="support-resistance" className="space-y-6 mt-6">
                        <Card>
                            <div className="p-6 bg-zinc-900/50 border-b border-zinc-800">
                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-purple-400" />
                                    Support & Resistance Proximity
                                </h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Identifies coins that are trading <strong>very close (within 2%)</strong> to key support or resistance levels.
                                    Look for <strong>High R:R</strong> ratios (&gt; 3.0) and multiple <strong>Tests</strong> (bounces).
                                </p>
                            </div>
                            <div className="h-[65vh] overflow-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-zinc-900">
                                        <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                            <th className="p-4 font-medium">Asset</th>
                                            <th className="p-4 font-medium text-right">Price</th>
                                            <th className="p-4 font-medium text-right">Type</th>
                                            <th className="p-4 font-medium text-right">Level</th>
                                            <th className="p-4 font-medium text-right">Distance</th>
                                            <th className="p-4 font-medium text-right">Strength</th>
                                            <th className="p-4 font-medium text-right">Risk:Reward</th>
                                            <th className="p-4 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {isLoadingSR ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-zinc-500">Scanning...</td></tr>
                                        ) : !srData?.length ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-zinc-500">No coins near key levels.</td></tr>
                                        ) : (
                                            srData.map((coin) => (
                                                <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                                    <td className="p-4 font-bold text-white">{coin.symbol}</td>
                                                    <td className="p-4 text-right font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                    <td className="p-4 text-right">
                                                        <span className={`inline-block px-2 py-1 rounded font-bold font-mono text-xs border ${coin.type === 'Support'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                            }`}>
                                                            {coin.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-zinc-500">${formatPrice(coin.level)}</td>
                                                    <td className="p-4 text-right font-bold text-white">{coin.distancePercent.toFixed(2)}%</td>
                                                    <td className="p-4 text-right">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${coin.tests >= 2 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                                                            {coin.tests} Tests
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {coin.riskReward ? (
                                                            <span className={`font-mono font-bold ${coin.riskReward >= 3 ? "text-emerald-400" : "text-zinc-400"}`}>
                                                                1:{coin.riskReward.toFixed(1)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <Link href={`/analyse/${coin.symbol}`}>
                                                            <Button size="sm" className="bg-purple-600 hover:bg-purple-500 h-8">Analyze</Button>
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
