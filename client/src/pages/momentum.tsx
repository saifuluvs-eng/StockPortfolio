```
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Rocket, Activity, AlertTriangle, TrendingUp, Zap, Info } from "lucide-react";
import { format } from "date-fns";
import { apiFetchLocal } from "@/lib/api";

interface MomentumResult {
    symbol: string;
    price: number;
    change24h: number;
    volume: number;
    volumeFactor: number;
    rsi: number;
    signal: 'RIDE' | 'MOMENTUM' | 'HEATED' | 'TOPPED' | 'CAUTION' | 'NEUTRAL';
    signalStrength: number;
    stopLoss?: number;
    riskPct?: number;
}

export default function MomentumPage() {
    // Auto-refresh every 30 seconds
    const { data, isLoading, isRefetching, dataUpdatedAt } = useQuery<MomentumResult[]>({
        queryKey: ['momentum-scanner'],
        queryFn: async () => {
            const res = await fetch(`/ api / market / strategies / momentum`);
            return res.json() as Promise<MomentumResult[]>;
        },
        refetchInterval: 30000,
    });

    const formatPrice = (price: number) => {
        if (price < 0.00001) return price.toFixed(8);
        if (price < 0.001) return price.toFixed(7);
        if (price < 1) return price.toFixed(4);
        return price.toFixed(2);
    };

    const formatVolume = (vol: number) => {
        if (vol > 1000000000) return "$" + (vol / 1000000000).toFixed(1) + "B";
        if (vol > 1000000) return "$" + (vol / 1000000).toFixed(1) + "M";
        if (vol > 1000) return "$" + (vol / 1000).toFixed(1) + "K";
        return "$" + vol.toFixed(0);
    };

    const getSignalBadge = (signal: string) => {
        switch (signal) {
            case 'RIDE':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit"><Rocket className="w-3 h-3" /> RIDE THE WAVE</span>;
            case 'MOMENTUM':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit"><Zap className="w-3 h-3" /> GAINING SPEED</span>;
            case 'HEATED':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1 w-fit"><Activity className="w-3 h-3" /> HEATED</span>;
            case 'TOPPED':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" /> TOPPED OUT</span>;
            default:
                return <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 w-fit">{signal}</span>;
        }
    };

    const lastUpdatedTime = dataUpdatedAt ? format(new Date(dataUpdatedAt), 'HH:mm:ss') : null;

    return (
        <Page>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="space-y-6">
                    <Card>
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                            <TrendingUp className="h-6 w-6" />
                                        </div>
                                        <h1 className="text-2xl font-bold tracking-tight text-white/90">Momentum Scanner</h1>
                                    </div>
                                    <p className="text-sm text-zinc-400 max-w-2xl">
                                        Identifies coins with <strong>High Velocity</strong> and <strong>Surging Volume</strong>. Catch the move before it tops out.
                                    </p>
                                </div>
                                <div className="text-right">
                                    {lastUpdatedTime && (
                                        <span className="text-xs text-zinc-500 flex items-center justify-end gap-2">
                                            {isRefetching && <span className="block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                            Updated {lastUpdatedTime}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar relative">
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-zinc-900 z-10 shadow-sm shadow-zinc-800">
                                        <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                                            <th className="p-4 font-medium">Asset</th>
                                            <th className="p-4 font-medium text-right">Price</th>
                                            <th className="p-4 font-medium text-right">24h Change</th>
                                            <th className="p-4 font-medium text-center">Volume Factor</th>
                                            <th className="p-4 font-medium text-center">RSI (14)</th>
                                            <th className="p-4 font-medium text-right">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center justify-end gap-1 cursor-help hover:text-zinc-300 transition-colors group">
                                                                Stop
                                                                <Info className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Structure stop based on recent pivot low<br/>(with safety buffer)</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </th>
                                            <th className="p-4 font-medium text-right">Risk</th>
                                            <th className="p-4 font-medium text-left">Signal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {isLoading ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-zinc-500">Scanning for Momentum...</td></tr>
                                        ) : !data?.length ? (
                                            <tr><td colSpan={8} className="p-8 text-center text-zinc-500">No high-momentum setups found right now. Market might be chop.</td></tr>
                                        ) : (
                                            data.map((coin) => (
                                                <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                                    <td className="p-4 font-bold text-white">{coin.symbol.replace('USDT', '')}</td>
                                                    <td className="p-4 text-right font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                    <td className="p-4 text-right font-mono font-bold text-emerald-400">+{coin.change24h.toFixed(2)}%</td>
                                                    <td className="p-4 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className={`text - sm font - bold ${ coin.volumeFactor > 2 ? 'text-emerald-400' : 'text-zinc-300' } `}>
                                                                {coin.volumeFactor}x
                                                            </span>
                                                            <span className="text-[10px] text-zinc-500">{formatVolume(coin.volume)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`font - mono ${ coin.rsi > 70 ? 'text-rose-400' : 'text-zinc-400' } `}>
                                                            {coin.rsi}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-zinc-400">
                                                        {coin.stopLoss ? '$' + formatPrice(coin.stopLoss) : '-'}
                                                    </td>
                                                    <td className="p-4 text-right font-mono">
                                                        {coin.riskPct ? (
                                                            <span className={`${ coin.riskPct < 5 ? 'text-emerald-400' : coin.riskPct < 8 ? 'text-amber-400' : 'text-rose-400' } `}>
                                                                {coin.riskPct.toFixed(1)}%
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="p-4">
                                                        {getSignalBadge(coin.signal)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-indigo-400" />
                                Strategy Logic
                            </h4>
                            <dl className="space-y-4">
                                <div>
                                    <dt className="text-sm font-medium text-zinc-300">Velocity (Price)</dt>
                                    <dd className="text-sm text-zinc-400 mt-1">
                                        Must be up <strong>&gt; 3%</strong> in 24h. We only want coins that are already moving.
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-zinc-300">Fuel (Volume)</dt>
                                    <dd className="text-sm text-zinc-400 mt-1">
                                        Current Volume must be <strong>&gt; 1.5x</strong> the 14-day average. This confirms "Whale Participation".
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-amber-400" />
                                Signal Guide
                            </h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="flex items-center gap-2 text-emerald-400 font-bold"><Rocket className="w-4 h-4" /> RIDE THE WAVE</div>
                                    <span className="text-zinc-400 text-xs">Strong Vol + Price + Room to run (RSI &lt; 75)</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded bg-orange-500/10 border border-orange-500/20">
                                    <div className="flex items-center gap-2 text-orange-400 font-bold"><Activity className="w-4 h-4" /> HEATED</div>
                                    <span className="text-zinc-400 text-xs">Strong move, but RSI &gt; 75. High Risk.</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded bg-rose-500/10 border border-rose-500/20">
                                    <div className="flex items-center gap-2 text-rose-400 font-bold"><AlertTriangle className="w-4 h-4" /> TOPPED</div>
                                    <span className="text-zinc-400 text-xs">RSI &gt; 85. Likely correction incoming.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </Page>
    );
}
