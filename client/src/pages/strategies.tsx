import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { RefreshCw, Target, Flame, TrendingUp, BarChart3, Zap, ArrowUpDown, AlertTriangle } from "lucide-react";
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
    rsi: { m15: number | null; h1: number | null; h4: number | null; d1: number | null; w1: number | null };
    ema200: number;
    volume: number;
    priceChangePercent: number;
    isFallbackData?: boolean;
}

interface VolumeSpikeResult {
    symbol: string;
    price: number;
    volume: number;
    avgVolume: number;
    volumeMultiple: number;
    priceChangePercent: number;
    isFallbackData?: boolean;
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
        if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
        return `$${(vol / 1_000).toFixed(1)}K`;
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

    // Check if any data is fallback/demo data
    const isFallbackData = useMemo(() => {
        if (activeTab === 'trend-dip' && trendDip?.some(item => item.isFallbackData)) return true;
        if (activeTab === 'volume-spike' && volumeSpike?.some(item => item.isFallbackData)) return true;
        return false;
    }, [activeTab, trendDip, volumeSpike]);

    // Fallback warning component
    const FallbackWarning = () => (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-amber-300 font-semibold text-sm">Demo Data - Not Real-Time</p>
                <p className="text-amber-200/70 text-xs mt-1">
                    Live market data is currently unavailable (API restrictions on this server).
                    The data shown below is for demonstration purposes only.
                    <strong className="text-amber-200"> Publish the app</strong> to see real-time data.
                </p>
            </div>
        </div>
    );

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
                                                            <span className={`inline-block px-2 py-1 rounded font-bold text-xs ${coin.score >= 80 ? 'bg-orange-500/20 text-orange-400' :
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
                                                                    <span key={tag} className={`text-[10px] px-2 py-0.5 rounded border ${tag === 'HOT SETUP' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
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
                                                            <span className={`inline-block px-2 py-1 rounded font-bold text-xs ${coin.type === 'Support' || coin.type === 'Breakout'
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
                                {isFallbackData && <FallbackWarning />}
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
                                                trendDip.slice(0, 25).map((coin) => {
                                                    const rsiM15 = coin.rsi?.m15;
                                                    const rsiH1 = coin.rsi?.h1;
                                                    const rsiH4 = coin.rsi?.h4;
                                                    return (
                                                        <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                                            <td className="p-3 font-bold text-white">{coin.symbol.replace('USDT', '')}</td>
                                                            <td className="p-3 text-center font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                            <td className="p-3 text-center font-mono text-emerald-400">${formatPrice(coin.ema200)}</td>
                                                            <td className="p-3 text-center">
                                                                {rsiM15 !== null && rsiM15 !== undefined ? (
                                                                    <span className={`font-mono ${rsiM15 < 40 ? 'text-emerald-400' : rsiM15 > 70 ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                                        {rsiM15}
                                                                    </span>
                                                                ) : <span className="text-zinc-600">-</span>}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {rsiH1 !== null && rsiH1 !== undefined ? (
                                                                    <span className={`font-mono ${rsiH1 < 40 ? 'text-emerald-400' : rsiH1 > 70 ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                                        {rsiH1}
                                                                    </span>
                                                                ) : <span className="text-zinc-600">-</span>}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {rsiH4 !== null && rsiH4 !== undefined ? (
                                                                    <span className={`font-mono ${rsiH4 < 40 ? 'text-emerald-400' : rsiH4 > 70 ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                                        {rsiH4}
                                                                    </span>
                                                                ) : <span className="text-zinc-600">-</span>}
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
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </TabsContent>

                            <TabsContent value="volume-spike" className="mt-4">
                                {isFallbackData && <FallbackWarning />}
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

                {/* Knowledge Base Section */}
                <Card>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold text-white/90">How This Scanner Works</h2>
                        </div>

                        {/* Tab-specific explanations */}
                        {activeTab === 'hot-setups' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-orange-500/5 rounded-lg border border-orange-500/20">
                                    <h3 className="font-semibold text-orange-400 mb-2">What is Hot Setups?</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        Hot Setups finds coins that appear in <strong className="text-white">multiple scanners at once</strong>.
                                        When a coin shows up in 2 or more of our strategies (like Support + Momentum),
                                        it's a stronger signal because multiple factors are lining up in its favor.
                                    </p>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">How Coins Are Selected</h3>
                                    <ul className="text-sm text-zinc-400 space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-orange-400 mt-1">1.</span>
                                            <span>We scan the <strong className="text-white">top 40 coins</strong> by trading volume (most actively traded)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-orange-400 mt-1">2.</span>
                                            <span>Each coin is checked against <strong className="text-white">4 different strategies</strong>: Support/Resistance, Trend Dip, Volume Spike, and Momentum</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-orange-400 mt-1">3.</span>
                                            <span>Coins earn <strong className="text-white">points</strong> for each strategy they match, and coins with higher scores appear first</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">What the Tags Mean</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-xs font-medium">Strong Signal</span>
                                            <span className="text-zinc-400">Appears in 2+ scanners - higher confidence</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">At Support</span>
                                            <span className="text-zinc-400">Price near a floor where it often bounces up</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-medium">Breakout</span>
                                            <span className="text-zinc-400">Price breaking above previous highs</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">Uptrend</span>
                                            <span className="text-zinc-400">Long-term direction is up, short-term dip</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-medium">Volume Surge</span>
                                            <span className="text-zinc-400">Much more trading activity than usual</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-medium">Strong Move</span>
                                            <span className="text-zinc-400">Price gained 5-15% with room to continue</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">Scoring System</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div className="text-center p-2 bg-zinc-900 rounded">
                                            <div className="text-emerald-400 font-bold">+15 pts</div>
                                            <div className="text-zinc-500 text-xs">At Support</div>
                                        </div>
                                        <div className="text-center p-2 bg-zinc-900 rounded">
                                            <div className="text-blue-400 font-bold">+30 pts</div>
                                            <div className="text-zinc-500 text-xs">Breakout</div>
                                        </div>
                                        <div className="text-center p-2 bg-zinc-900 rounded">
                                            <div className="text-emerald-400 font-bold">+20 pts</div>
                                            <div className="text-zinc-500 text-xs">Trend Dip</div>
                                        </div>
                                        <div className="text-center p-2 bg-zinc-900 rounded">
                                            <div className="text-purple-400 font-bold">+15 pts</div>
                                            <div className="text-zinc-500 text-xs">Volume Spike</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2 text-center">
                                        Coins appearing in 2+ scanners get a bonus +15 points
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'sr' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-indigo-500/5 rounded-lg border border-indigo-500/20">
                                    <h3 className="font-semibold text-indigo-400 mb-2">What is Support & Resistance?</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        <strong className="text-white">Support</strong> is like a floor - a price level where buyers tend to step in and push the price back up.
                                        <strong className="text-white"> Resistance</strong> is like a ceiling - a price level where sellers often appear and push the price back down.
                                        The more times a level is tested and holds, the stronger it becomes.
                                    </p>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">How Coins Are Selected</h3>
                                    <ul className="text-sm text-zinc-400 space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-indigo-400 mt-1">1.</span>
                                            <span>We look at coins with at least <strong className="text-white">$2 million daily volume</strong></span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-indigo-400 mt-1">2.</span>
                                            <span>We calculate the <strong className="text-white">24-hour price range</strong> (high to low)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-indigo-400 mt-1">3.</span>
                                            <span>Coins trading in the <strong className="text-white">bottom 20%</strong> of their range are "At Support"</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-indigo-400 mt-1">4.</span>
                                            <span>Coins in the <strong className="text-white">top 10%</strong> of their range may be breaking out</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">Understanding the Table</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">Type</div>
                                            <p className="text-zinc-500">Whether the coin is near Support (potential bounce up) or Resistance (potential rejection down)</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">Level</div>
                                            <p className="text-zinc-500">The exact price of the support or resistance zone</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">Distance</div>
                                            <p className="text-zinc-500">How far the current price is from the level (lower = closer to the level)</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">Tests</div>
                                            <p className="text-zinc-500">How many times this level has been tested - more tests = stronger level</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">R:R (Risk:Reward)</div>
                                            <p className="text-zinc-500">How much you could gain vs. how much you risk. 1:3 means potential 3x gain for 1x risk</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">What the Badges Mean</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-medium">Strong Support</span>
                                            <span className="text-zinc-400">Level tested 3+ times - very reliable</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 text-xs font-medium">Weak Level</span>
                                            <span className="text-zinc-400">Only tested once - less reliable</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">Oversold</span>
                                            <span className="text-zinc-400">Dropped 5%+ - may be due for a bounce</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-xs font-medium">Overbought</span>
                                            <span className="text-zinc-400">Gained 5%+ - may be due for a pullback</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-medium">Approaching</span>
                                            <span className="text-zinc-400">Within 2% of the level - watch closely</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'trend-dip' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                                    <h3 className="font-semibold text-emerald-400 mb-2">What is Trend Dip?</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        This scanner finds coins in a <strong className="text-white">long-term uptrend</strong> that have
                                        temporarily pulled back. The idea is to "buy the dip" in strong trends rather than trying to
                                        catch falling knives. When the overall trend is up, short-term dips often present good entry points.
                                    </p>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">How Coins Are Selected</h3>
                                    <ul className="text-sm text-zinc-400 space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-400 mt-1">1.</span>
                                            <span>We scan the <strong className="text-white">top 30 coins</strong> by trading volume</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-400 mt-1">2.</span>
                                            <span>We calculate the <strong className="text-white">EMA 200</strong> (200-period moving average) - a common long-term trend indicator</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-400 mt-1">3.</span>
                                            <span>Only coins trading <strong className="text-white">above their EMA 200</strong> are shown (confirms uptrend)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-emerald-400 mt-1">4.</span>
                                            <span>We check <strong className="text-white">RSI across multiple timeframes</strong> to spot oversold conditions</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">Understanding the Table</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">EMA 200</div>
                                            <p className="text-zinc-500">The 200-period moving average. Price above it = uptrend. The green color confirms bullish structure.</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">RSI 15m / 1h / 4h</div>
                                            <p className="text-zinc-500">Relative Strength Index on different timeframes. Below 40 (green) = oversold dip. Above 70 (red) = overbought.</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">24h %</div>
                                            <p className="text-zinc-500">How much the price changed in the last 24 hours</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                    <h3 className="font-semibold text-emerald-400 mb-2">Pro Tip</h3>
                                    <p className="text-sm text-zinc-400">
                                        Look for coins where the <strong className="text-white">short-term RSI (15m, 1h) is green</strong> (oversold)
                                        while the <strong className="text-white">longer-term RSI (4h) is neutral or healthy</strong>.
                                        This suggests a temporary dip in an otherwise strong trend.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'volume-spike' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-purple-500/5 rounded-lg border border-purple-500/20">
                                    <h3 className="font-semibold text-purple-400 mb-2">What is Volume Spike?</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        Volume is the amount of trading activity. When volume is <strong className="text-white">much higher than usual</strong>,
                                        it often signals that big players (institutions, whales) are entering positions.
                                        High volume on a price increase suggests strong buying interest.
                                    </p>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">How Coins Are Selected</h3>
                                    <ul className="text-sm text-zinc-400 space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-purple-400 mt-1">1.</span>
                                            <span>We scan coins with at least <strong className="text-white">$5 million daily volume</strong></span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-purple-400 mt-1">2.</span>
                                            <span>Only coins with <strong className="text-white">positive price change</strong> are shown (green candles)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-purple-400 mt-1">3.</span>
                                            <span>We compare current volume to the <strong className="text-white">average volume</strong></span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-purple-400 mt-1">4.</span>
                                            <span>Coins with <strong className="text-white">1.5x or higher</strong> volume than average are shown</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">Understanding the Table</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">Volume</div>
                                            <p className="text-zinc-500">Current 24-hour trading volume in dollars</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">Avg Volume</div>
                                            <p className="text-zinc-500">The typical/average trading volume for comparison</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">Multiple</div>
                                            <p className="text-zinc-500">How many times higher than average. 2.5x means 2.5 times the normal volume.</p>
                                        </div>
                                        <div>
                                            <div className="text-zinc-300 font-medium mb-1">24h %</div>
                                            <p className="text-zinc-500">Price change - higher volume + positive change = strong signal</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                    <h3 className="font-semibold text-purple-400 mb-2">What the Colors Mean</h3>
                                    <div className="flex flex-wrap gap-4 text-sm mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-purple-400">3x+</span>
                                            <span className="text-zinc-400">Extreme volume - major interest</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-purple-300">2x+</span>
                                            <span className="text-zinc-400">High volume - notable activity</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-zinc-400">1.5x+</span>
                                            <span className="text-zinc-400">Elevated volume - worth watching</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'momentum' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
                                    <h3 className="font-semibold text-amber-400 mb-2">What is Momentum?</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        Momentum measures the <strong className="text-white">speed and strength</strong> of a price move.
                                        Coins with strong momentum are moving up quickly and may continue. The dedicated Momentum Scanner
                                        includes advanced features like pivot-based stop-loss calculations.
                                    </p>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">Key Momentum Signals</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">RIDE</span>
                                            <span className="text-zinc-400">Strong momentum + high volume - ride the wave</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-bold">MOMENTUM</span>
                                            <span className="text-zinc-400">Good volume backing the move</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-bold">GAINING SPEED</span>
                                            <span className="text-zinc-400">Building momentum, no clear stop yet</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-xs font-bold">HEATED</span>
                                            <span className="text-zinc-400">RSI above 75 - getting overbought</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-xs font-bold">TOPPED</span>
                                            <span className="text-zinc-400">RSI above 85 - likely to pull back</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 text-xs font-bold">CAUTION</span>
                                            <span className="text-zinc-400">Low volume - move may not be reliable</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* General disclaimer */}
                        <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                            <p className="text-xs text-zinc-500 text-center">
                                This scanner is for informational purposes only. Always do your own research before trading.
                                Past performance does not guarantee future results.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </Page>
    );
}
