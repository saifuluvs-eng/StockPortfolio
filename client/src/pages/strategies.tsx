import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { RefreshCw, Target, Flame, TrendingUp, BarChart3, Zap, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Link } from "wouter";

interface SupportResistanceResult {
    symbol: string;
    price: number;
    type: 'Support' | 'Resistance' | 'Breakout' | 'Breakdown';
    level: number;
    target?: number;
    distancePercent: number;
    tests: number;
    riskReward?: number;
    volume: number;
    rsi?: number;
    badges?: string[];
    timestamp: string;
}

interface HotSetup {
    symbol: string;
    price: number;
    score: number;
    sources: string[];
    tags: string[];
    reasons: string[];
    rsi?: number;
    volume?: number;
}

interface TrendDipResult {
    symbol: string;
    price: number;
    rsi: { m15: number; h1: number; h4: number; d1: number; w1: number };
    ema200: number;
    volume: number;
    priceChangePercent: number;
}

interface VolumeSpikeResult {
    symbol: string;
    price: number;
    volume: number;
    avgVolume: number;
    volumeMultiple: number;
    priceChangePercent: number;
}

type SortField = 'target' | 'tests' | 'riskReward' | 'type' | 'score';
type SortDirection = 'asc' | 'desc';

export default function StrategiesPage() {
    const [activeTab, setActiveTab] = useState("hot-setups");
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [lookbackDays, setLookbackDays] = useState("8");

    const formatPrice = (price: number) => {
        if (price < 0.00001) return price.toFixed(8);
        if (price < 0.001) return price.toFixed(7);
        if (price < 1) return price.toFixed(4);
        return price.toFixed(2);
    };

    const formatVolume = (vol: number) => {
        if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(1)}B`;
        if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(0)}M`;
        return `$${(vol / 1_000).toFixed(0)}K`;
    };

    const { data: hotSetups, isLoading: isLoadingHot, refetch: refetchHot, dataUpdatedAt: hotUpdatedAt } = useQuery<HotSetup[]>({
        queryKey: ['hot-setups'],
        queryFn: async () => {
            const res = await fetch('/api/market/strategies/hot-setups');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: activeTab === 'hot-setups',
    });

    const { data: srData, isLoading: isLoadingSR, refetch: refetchSR, dataUpdatedAt: srUpdatedAt } = useQuery<SupportResistanceResult[]>({
        queryKey: ['support-resistance', lookbackDays],
        queryFn: async () => {
            const res = await fetch(`/api/market/strategies/support-resistance?limit=75&days=${lookbackDays}&strategy=bounce`);
            return res.json();
        },
        refetchInterval: 60000,
        enabled: activeTab === 'sr',
    });

    const { data: trendDip, isLoading: isLoadingTrend, refetch: refetchTrend, dataUpdatedAt: trendUpdatedAt } = useQuery<TrendDipResult[]>({
        queryKey: ['trend-dip'],
        queryFn: async () => {
            const res = await fetch('/api/market/strategies/trend-dip');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: activeTab === 'trend-dip',
    });

    const { data: volumeSpike, isLoading: isLoadingVolume, refetch: refetchVolume, dataUpdatedAt: volumeUpdatedAt } = useQuery<VolumeSpikeResult[]>({
        queryKey: ['volume-spike'],
        queryFn: async () => {
            const res = await fetch('/api/market/strategies/volume-spike');
            return res.json();
        },
        refetchInterval: 60000,
        enabled: activeTab === 'volume-spike',
    });

    const handleRefresh = () => {
        if (activeTab === 'hot-setups') refetchHot();
        if (activeTab === 'sr') refetchSR();
        if (activeTab === 'trend-dip') refetchTrend();
        if (activeTab === 'volume-spike') refetchVolume();
    };

    const getLastUpdated = () => {
        const timestamps: Record<string, number | undefined> = {
            'hot-setups': hotUpdatedAt,
            'sr': srUpdatedAt,
            'trend-dip': trendUpdatedAt,
            'volume-spike': volumeUpdatedAt,
        };
        const ts = timestamps[activeTab];
        return ts ? format(new Date(ts), 'HH:mm:ss') : null;
    };

    const isLoading = activeTab === 'hot-setups' ? isLoadingHot :
        activeTab === 'sr' ? isLoadingSR :
        activeTab === 'trend-dip' ? isLoadingTrend :
        activeTab === 'volume-spike' ? isLoadingVolume : false;

    return (
        <Page>
            <div className="max-w-7xl mx-auto space-y-4">
                <Card>
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 text-orange-400">
                                        <Target className="h-6 w-6" />
                                    </div>
                                    <h1 className="text-2xl font-bold tracking-tight text-white/90">Strategy Scanner</h1>
                                </div>
                                <p className="text-sm text-zinc-400">
                                    Multi-strategy confluence scanner - coins appearing in multiple strategies are stronger signals.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {activeTab === 'sr' && (
                                    <select
                                        value={lookbackDays}
                                        onChange={(e) => setLookbackDays(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-md px-3 py-1.5"
                                    >
                                        <option value={8}>8 Days</option>
                                        <option value={14}>14 Days</option>
                                        <option value={30}>30 Days</option>
                                    </select>
                                )}
                                <button
                                    onClick={handleRefresh}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-transparent border border-zinc-700 text-zinc-300 rounded-full hover:bg-zinc-800 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                                {getLastUpdated() && (
                                    <span className="text-xs text-zinc-500 font-mono">
                                        {getLastUpdated()}
                                    </span>
                                )}
                            </div>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-5 bg-zinc-900/50">
                                <TabsTrigger value="hot-setups" className="flex items-center gap-2 data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                                    <Flame className="h-4 w-4" />
                                    <span className="hidden sm:inline">Hot Setups</span>
                                </TabsTrigger>
                                <TabsTrigger value="sr" className="flex items-center gap-2 data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400">
                                    <Target className="h-4 w-4" />
                                    <span className="hidden sm:inline">S/R Levels</span>
                                </TabsTrigger>
                                <TabsTrigger value="trend-dip" className="flex items-center gap-2 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="hidden sm:inline">Trend Dip</span>
                                </TabsTrigger>
                                <TabsTrigger value="volume-spike" className="flex items-center gap-2 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                                    <BarChart3 className="h-4 w-4" />
                                    <span className="hidden sm:inline">Vol Spike</span>
                                </TabsTrigger>
                                <TabsTrigger value="momentum" className="flex items-center gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                                    <Zap className="h-4 w-4" />
                                    <span className="hidden sm:inline">Momentum</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="hot-setups" className="mt-4">
                                <div className="mb-3 p-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border border-orange-500/20">
                                    <p className="text-sm text-orange-300">
                                        <strong>Hot Setups</strong> - Coins appearing in multiple scanners with confluence scoring. Higher scores = stronger signals.
                                    </p>
                                </div>
                                <div className="h-[60vh] overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-zinc-900">
                                            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                                <th className="p-3 font-medium">Asset</th>
                                                <th className="p-3 font-medium text-center">Score</th>
                                                <th className="p-3 font-medium text-center">Sources</th>
                                                <th className="p-3 font-medium">Tags</th>
                                                <th className="p-3 font-medium">Why</th>
                                                <th className="p-3 font-medium text-center">Price</th>
                                                <th className="p-3 font-medium text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {isLoadingHot ? (
                                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Scanning all strategies...</td></tr>
                                            ) : !hotSetups?.length ? (
                                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No hot setups found. Check back later.</td></tr>
                                            ) : (
                                                hotSetups.map((coin) => (
                                                    <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                        <td className="p-3 font-bold text-white">{coin.symbol.replace('USDT', '')}</td>
                                                        <td className="p-3 text-center">
                                                            <span className={`inline-block px-2 py-1 rounded font-bold text-xs ${
                                                                coin.score >= 80 ? 'bg-orange-500/20 text-orange-400' :
                                                                coin.score >= 60 ? 'bg-emerald-500/20 text-emerald-400' :
                                                                'bg-zinc-700/50 text-zinc-300'
                                                            }`}>
                                                                {coin.score}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <div className="flex flex-wrap gap-1 justify-center">
                                                                {coin.sources.map(s => (
                                                                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{s}</span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {coin.tags.map(tag => (
                                                                    <span key={tag} className={`text-[10px] px-2 py-0.5 rounded border ${
                                                                        tag === 'HOT SETUP' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                                                        tag.includes('Breakout') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                                                        tag.includes('Support') ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                                                        tag.includes('Volume') ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                                                        tag.includes('Uptrend') ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                                                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                                    }`}>
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-xs text-zinc-400 max-w-[200px]">
                                                            {coin.reasons.slice(0, 2).join(' | ')}
                                                        </td>
                                                        <td className="p-3 text-center font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                        <td className="p-3 text-center">
                                                            <Link href={`/analyse/${coin.symbol}`}>
                                                                <Button size="sm" className="bg-orange-600 hover:bg-orange-500 h-7 text-xs">Analyze</Button>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </TabsContent>

                            <TabsContent value="sr" className="mt-4">
                                <div className="mb-3 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                    <p className="text-sm text-indigo-300">
                                        <strong>Support & Resistance</strong> - Coins near key price levels. Support = potential bounce up, Resistance = potential rejection.
                                    </p>
                                </div>
                                <div className="h-[60vh] overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-zinc-900">
                                            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                                <th className="p-3 font-medium">Asset</th>
                                                <th className="p-3 font-medium text-center">Type</th>
                                                <th className="p-3 font-medium text-center">Level</th>
                                                <th className="p-3 font-medium text-center">Distance</th>
                                                <th className="p-3 font-medium text-center">Tests</th>
                                                <th className="p-3 font-medium text-center">R:R</th>
                                                <th className="p-3 font-medium">Badges</th>
                                                <th className="p-3 font-medium text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {isLoadingSR ? (
                                                <tr><td colSpan={8} className="p-8 text-center text-zinc-500">Scanning S/R levels...</td></tr>
                                            ) : !srData?.length ? (
                                                <tr><td colSpan={8} className="p-8 text-center text-zinc-500">No coins near key levels.</td></tr>
                                            ) : (
                                                srData.slice(0, 30).map((coin) => (
                                                    <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                        <td className="p-3 font-bold text-white">{coin.symbol.replace('USDT', '')}</td>
                                                        <td className="p-3 text-center">
                                                            <span className={`inline-block px-2 py-1 rounded font-bold text-xs ${
                                                                coin.type === 'Support' || coin.type === 'Breakout'
                                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                                    : 'bg-rose-500/20 text-rose-400'
                                                            }`}>
                                                                {coin.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center font-mono text-zinc-400">${formatPrice(coin.level)}</td>
                                                        <td className="p-3 text-center font-bold text-white">{coin.distancePercent.toFixed(2)}%</td>
                                                        <td className="p-3 text-center">
                                                            <span className={`text-xs px-2 py-0.5 rounded ${coin.tests >= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                                                                {coin.tests}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center font-mono">
                                                            {coin.riskReward ? (
                                                                <span className={coin.riskReward >= 3 ? 'text-emerald-400' : 'text-zinc-400'}>
                                                                    1:{coin.riskReward.toFixed(1)}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-wrap gap-1">
                                                                {coin.badges?.slice(0, 2).map(b => (
                                                                    <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{b}</span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Link href={`/analyse/${coin.symbol}`}>
                                                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 h-7 text-xs">Analyze</Button>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </TabsContent>

                            <TabsContent value="trend-dip" className="mt-4">
                                <div className="mb-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                    <p className="text-sm text-emerald-300">
                                        <strong>Trend Dip</strong> - Coins in long-term uptrend (above EMA200) with short-term RSI dips. Buy the dip in strong trends.
                                    </p>
                                </div>
                                <div className="h-[60vh] overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-zinc-900">
                                            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                                <th className="p-3 font-medium">Asset</th>
                                                <th className="p-3 font-medium text-center">Price</th>
                                                <th className="p-3 font-medium text-center">EMA 200</th>
                                                <th className="p-3 font-medium text-center">RSI 15m</th>
                                                <th className="p-3 font-medium text-center">RSI 1h</th>
                                                <th className="p-3 font-medium text-center">RSI 4h</th>
                                                <th className="p-3 font-medium text-center">24h %</th>
                                                <th className="p-3 font-medium text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {isLoadingTrend ? (
                                                <tr><td colSpan={8} className="p-8 text-center text-zinc-500">Scanning uptrends...</td></tr>
                                            ) : !trendDip?.length ? (
                                                <tr><td colSpan={8} className="p-8 text-center text-zinc-500">No trend dips found.</td></tr>
                                            ) : (
                                                trendDip.slice(0, 25).map((coin) => (
                                                    <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                        <td className="p-3 font-bold text-white">{coin.symbol.replace('USDT', '')}</td>
                                                        <td className="p-3 text-center font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                        <td className="p-3 text-center font-mono text-emerald-400">${formatPrice(coin.ema200)}</td>
                                                        <td className="p-3 text-center">
                                                            <span className={`font-mono ${coin.rsi.m15 < 40 ? 'text-emerald-400' : coin.rsi.m15 > 70 ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                                {Math.round(coin.rsi.m15)}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={`font-mono ${coin.rsi.h1 < 40 ? 'text-emerald-400' : coin.rsi.h1 > 70 ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                                {Math.round(coin.rsi.h1)}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={`font-mono ${coin.rsi.h4 < 40 ? 'text-emerald-400' : coin.rsi.h4 > 70 ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                                {Math.round(coin.rsi.h4)}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={coin.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                                {coin.priceChangePercent >= 0 ? '+' : ''}{coin.priceChangePercent.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Link href={`/analyse/${coin.symbol}`}>
                                                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 h-7 text-xs">Analyze</Button>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </TabsContent>

                            <TabsContent value="volume-spike" className="mt-4">
                                <div className="mb-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                    <p className="text-sm text-purple-300">
                                        <strong>Volume Spike</strong> - Coins with 1.5x+ average volume on green candles. Indicates institutional interest.
                                    </p>
                                </div>
                                <div className="h-[60vh] overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-zinc-900">
                                            <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                                                <th className="p-3 font-medium">Asset</th>
                                                <th className="p-3 font-medium text-center">Price</th>
                                                <th className="p-3 font-medium text-center">Volume</th>
                                                <th className="p-3 font-medium text-center">Avg Volume</th>
                                                <th className="p-3 font-medium text-center">Multiple</th>
                                                <th className="p-3 font-medium text-center">24h %</th>
                                                <th className="p-3 font-medium text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {isLoadingVolume ? (
                                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Scanning volume spikes...</td></tr>
                                            ) : !volumeSpike?.length ? (
                                                <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No volume spikes detected.</td></tr>
                                            ) : (
                                                volumeSpike.slice(0, 25).map((coin) => (
                                                    <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                        <td className="p-3 font-bold text-white">{coin.symbol.replace('USDT', '')}</td>
                                                        <td className="p-3 text-center font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                        <td className="p-3 text-center font-mono text-purple-400">{formatVolume(coin.volume)}</td>
                                                        <td className="p-3 text-center font-mono text-zinc-500">{formatVolume(coin.avgVolume)}</td>
                                                        <td className="p-3 text-center">
                                                            <span className={`font-bold ${coin.volumeMultiple >= 3 ? 'text-purple-400' : coin.volumeMultiple >= 2 ? 'text-purple-300' : 'text-zinc-400'}`}>
                                                                {coin.volumeMultiple.toFixed(1)}x
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={coin.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                                {coin.priceChangePercent >= 0 ? '+' : ''}{coin.priceChangePercent.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Link href={`/analyse/${coin.symbol}`}>
                                                                <Button size="sm" className="bg-purple-600 hover:bg-purple-500 h-7 text-xs">Analyze</Button>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </TabsContent>

                            <TabsContent value="momentum" className="mt-4">
                                <div className="mb-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                    <p className="text-sm text-amber-300">
                                        <strong>Momentum Scanner</strong> - For detailed momentum analysis with stop-loss calculations, visit the dedicated Momentum page.
                                    </p>
                                </div>
                                <div className="flex flex-col items-center justify-center h-[40vh] gap-4">
                                    <Zap className="h-16 w-16 text-amber-500/50" />
                                    <p className="text-zinc-400 text-center max-w-md">
                                        The Momentum Scanner includes advanced features like pivot-based stop-loss calculations and real-time signal detection.
                                    </p>
                                    <Link href="/momentum">
                                        <Button className="bg-amber-600 hover:bg-amber-500">
                                            <Zap className="h-4 w-4 mr-2" />
                                            Go to Momentum Scanner
                                        </Button>
                                    </Link>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </Card>
            </div>
        </Page>
    );
}
