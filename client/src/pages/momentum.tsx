import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
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
    signal: 'RIDE' | 'MOMENTUM' | 'GAINING SPEED' | 'HEATED' | 'TOPPED' | 'LOW VOLUME' | 'CAUTION' | 'NEUTRAL';
    signalStrength: number;
    stopLoss?: number;
    riskPct?: number;
}

export default function MomentumPage() {
    // Auto-refresh every 30 seconds
    const { data, isLoading, isRefetching, dataUpdatedAt } = useQuery<MomentumResult[]>({
        queryKey: ['momentum-scanner'],
        queryFn: async () => {
            const res = await fetch(`/api/market/strategies/momentum`);
            return res.json() as Promise<MomentumResult[]>;
        },
        refetchInterval: 30000,
    });

    // State for Position Sizing
    const [tradeSize, setTradeSize] = useState<number>(1000);

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

    // Calculate Risk Amount & Quantity based on Fixed Trade Size
    const getTradeMetrics = (price: number, riskPct?: number) => {
        if (!price || !tradeSize) return { riskDollars: null, qty: null };

        // Quantity is strictly based on how much the user wants to invest (Trade Size)
        const quantity = tradeSize / price;

        // Risk Dollars is how much they lose if Stop is hit
        // If riskPct is missing, we can't calculate risk dollars
        const riskDollars = (riskPct && riskPct > 0)
            ? tradeSize * (riskPct / 100)
            : null;

        return {
            riskDollars,
            qty: quantity
        };
    };

    const getSignalBadge = (signal: string) => {
        switch (signal) {
            case 'RIDE':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit"><Rocket className="w-3 h-3" /> RIDE THE WAVE</span>;
            case 'MOMENTUM':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit"><Zap className="w-3 h-3" /> MOMENTUM</span>;
            case 'GAINING SPEED':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 w-fit"><TrendingUp className="w-3 h-3" /> GAINING SPEED</span>;
            case 'HEATED':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1 w-fit"><Activity className="w-3 h-3" /> HEATED</span>;
            case 'TOPPED':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" /> TOPPED OUT</span>;
            case 'LOW VOLUME':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-700/50 text-zinc-400 border border-zinc-600/30 flex items-center gap-1 w-fit"><Activity className="w-3 h-3" /> LOW VOLUME</span>;
            case 'CAUTION':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" /> CAUTION</span>;
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
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
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

                                <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                                    <div className="flex items-center gap-3 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 w-full md:w-auto justify-between md:justify-start">
                                        <label className="text-xs font-medium text-zinc-400">Trade Size ($)</label>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={tradeSize}
                                                onChange={(e) => setTradeSize(Number(e.target.value))}
                                                className="w-24 bg-zinc-950 border border-zinc-700 rounded py-1 pl-5 pr-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        </div>
                                    </div>

                                    {lastUpdatedTime && (
                                        <span className="text-xs text-zinc-500 flex items-center justify-end gap-2">
                                            {isRefetching && <span className="block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                            Updated {lastUpdatedTime}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Card View (< md) */}
                            <div className="md:hidden space-y-4">
                                {isLoading ? (
                                    <div className="p-8 text-center text-zinc-500 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                        Scanning for Momentum...
                                    </div>
                                ) : !data?.length ? (
                                    <div className="p-8 text-center text-zinc-500 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                        No high-momentum setups found right now. Market might be chop.
                                    </div>
                                ) : (
                                    data.map((coin) => {
                                        const { riskDollars } = getTradeMetrics(coin.price, coin.riskPct);
                                        return (
                                            <div key={coin.symbol} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-4">
                                                {/* Card Header */}
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg font-bold text-white">{coin.symbol.replace('USDT', '')}</span>
                                                            <span className="text-xs text-zinc-500">USDT</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="font-mono text-zinc-300">${formatPrice(coin.price)}</span>
                                                            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                                +{coin.change24h.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        {getSignalBadge(coin.signal)}
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">RSI (14) :</span>
                                                            <span className={`font-mono font-bold text-sm ${coin.rsi > 70 ? 'text-rose-400' : 'text-zinc-200'}`}>
                                                                {coin.rsi}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Metrics Grid */}
                                                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-zinc-800/50 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <div className="text-[10px] uppercase text-zinc-500 font-medium mb-1">Vol Factor</div>
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-sm font-bold ${coin.volumeFactor > 2 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                                                {coin.volumeFactor}x
                                                            </span>
                                                            <span className="text-[10px] text-zinc-500">
                                                                {formatVolume(coin.volume)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-center border-l border-zinc-800/50 border-r">
                                                        <div className="text-[10px] uppercase text-zinc-500 font-medium mb-1">Stop Loss</div>
                                                        <span className="font-mono text-sm text-zinc-300">
                                                            {coin.stopLoss ? '$' + formatPrice(coin.stopLoss) : '-'}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-col items-center">
                                                        <div className="text-[10px] uppercase text-zinc-500 font-medium mb-1">Risk</div>
                                                        <div className="flex flex-col items-center">
                                                            {coin.riskPct ? (
                                                                <span className={`font-mono text-sm ${coin.riskPct < 5 ? 'text-emerald-400' : coin.riskPct < 8 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                                    {coin.riskPct.toFixed(1)}%
                                                                </span>
                                                            ) : <span className="text-zinc-500">-</span>}
                                                            {riskDollars !== null && (
                                                                <span className="text-[10px] font-mono text-rose-300">
                                                                    -${Math.round(riskDollars).toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Desktop Table View (>= md) */}
                            <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar relative">
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-zinc-900 z-10 shadow-sm shadow-zinc-800">
                                        <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                                            <th className="p-4 font-medium">Asset</th>
                                            <th className="p-4 font-medium text-right">24h Change</th>
                                            <th className="p-4 font-medium text-center">Volume Factor</th>
                                            <th className="p-4 font-medium text-center">RSI (14)</th>
                                            <th className="p-4 font-medium text-right">Price</th>
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
                                                            <p>Structure stop based on recent pivot low<br />(with safety buffer)</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </th>
                                            <th className="p-4 font-medium text-right">Risk %</th>
                                            <th className="p-4 font-medium text-right text-rose-400/80">Risk ($)</th>
                                            <th className="p-4 font-medium text-left">Signal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {isLoading ? (
                                            <tr><td colSpan={9} className="p-8 text-center text-zinc-500">Scanning for Momentum...</td></tr>
                                        ) : !data?.length ? (
                                            <tr><td colSpan={9} className="p-8 text-center text-zinc-500">No high-momentum setups found right now. Market might be chop.</td></tr>
                                        ) : (
                                            data.map((coin) => {
                                                const { riskDollars } = getTradeMetrics(coin.price, coin.riskPct);
                                                return (
                                                    <tr key={coin.symbol} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                                        <td className="p-4 font-bold text-white">{coin.symbol.replace('USDT', '')}</td>
                                                        <td className="p-4 text-right font-mono font-bold text-emerald-400">+{coin.change24h.toFixed(2)}%</td>
                                                        <td className="p-4 text-center">
                                                            <div className="inline-flex flex-col items-center">
                                                                <span className={`text-sm font-bold ${coin.volumeFactor > 2 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                                                    {coin.volumeFactor}x
                                                                </span>
                                                                <span className="text-[10px] text-zinc-500">{formatVolume(coin.volume)}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className={`font-mono ${coin.rsi > 70 ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                                {coin.rsi}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-zinc-300">${formatPrice(coin.price)}</td>
                                                        <td className="p-4 text-right font-mono text-zinc-400">
                                                            {coin.stopLoss ? '$' + formatPrice(coin.stopLoss) : '-'}
                                                        </td>
                                                        <td className="p-4 text-right font-mono">
                                                            {coin.riskPct ? (
                                                                <span className={`${coin.riskPct < 5 ? 'text-emerald-400' : coin.riskPct < 8 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                                    {coin.riskPct.toFixed(1)}%
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-rose-300">
                                                            {riskDollars !== null ? '$' + Math.round(riskDollars).toLocaleString() : '-'}
                                                        </td>
                                                        <td className="p-4">
                                                            {getSignalBadge(coin.signal)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Card>

                    {/* Knowledge Base Section */}
                    <Card>
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold text-white/90">How This Scanner Works</h2>
                            </div>

                            {/* What is Momentum */}
                            <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                                <h3 className="font-semibold text-emerald-400 mb-2">What is Momentum?</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Momentum measures the <strong className="text-white">speed and strength</strong> of a price move.
                                    Coins with strong momentum are moving up quickly and may continue. This scanner finds coins that are
                                    <strong className="text-white"> already in motion</strong> with the volume to back it up - the goal is to
                                    catch the wave, not predict it.
                                </p>
                            </div>

                            {/* How Coins Are Selected */}
                            <div className="p-4 bg-zinc-800/50 rounded-lg">
                                <h3 className="font-semibold text-zinc-300 mb-3">How Coins Are Selected</h3>
                                <ul className="text-sm text-zinc-400 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-1">1.</span>
                                        <span>We filter for coins with <strong className="text-white">&gt;3% gain</strong> in the last 24 hours (already moving up)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-1">2.</span>
                                        <span>Minimum <strong className="text-white">$3 million daily volume</strong> to ensure liquidity</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-1">3.</span>
                                        <span>We calculate the <strong className="text-white">Volume Factor</strong> - comparing current volume to the 24-hour average</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-1">4.</span>
                                        <span>We compute <strong className="text-white">RSI (14-period)</strong> from hourly candles to measure how overbought the coin is</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 mt-1">5.</span>
                                        <span>We find the <strong className="text-white">pivot low</strong> (recent swing low) to calculate a structure-based stop-loss</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Understanding the Table */}
                            <div className="p-4 bg-zinc-800/50 rounded-lg">
                                <h3 className="font-semibold text-zinc-300 mb-3">Understanding the Table</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-zinc-300 font-medium mb-1">24h Change</div>
                                        <p className="text-zinc-500">How much the price has moved in the last 24 hours. Higher = stronger move.</p>
                                    </div>
                                    <div>
                                        <div className="text-zinc-300 font-medium mb-1">Volume Factor</div>
                                        <p className="text-zinc-500">Current volume vs. average. 2x means twice the normal trading activity - big players are involved.</p>
                                    </div>
                                    <div>
                                        <div className="text-zinc-300 font-medium mb-1">RSI (14)</div>
                                        <p className="text-zinc-500">Relative Strength Index. Below 70 is healthy. Above 75 is "heated". Above 85 is overextended.</p>
                                    </div>
                                    <div>
                                        <div className="text-zinc-300 font-medium mb-1">Stop</div>
                                        <p className="text-zinc-500">Suggested stop-loss based on recent pivot low (swing low). If price breaks this, the move may be over.</p>
                                    </div>
                                    <div>
                                        <div className="text-zinc-300 font-medium mb-1">Risk %</div>
                                        <p className="text-zinc-500">Distance from current price to stop. Under 5% is tight. Over 8% is wide (more risk).</p>
                                    </div>
                                    <div>
                                        <div className="text-zinc-300 font-medium mb-1">Risk ($)</div>
                                        <p className="text-zinc-500">Dollar amount you'd lose if the stop is hit, based on your Trade Size input above.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Signal Explanations */}
                            <div className="p-4 bg-zinc-800/50 rounded-lg">
                                <h3 className="font-semibold text-zinc-300 mb-3">What Each Signal Means</h3>
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold min-w-[140px]">
                                            <Rocket className="w-4 h-4" /> RIDE THE WAVE
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            <strong className="text-emerald-300">Best Signal.</strong> Price up 5%+, volume 2x+ average, RSI under 75, and we found a valid stop-loss level.
                                            This coin has strong momentum with room to continue.
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-blue-500/10 border border-blue-500/20">
                                        <div className="flex items-center gap-2 text-blue-400 font-bold min-w-[140px]">
                                            <Zap className="w-4 h-4" /> MOMENTUM
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            <strong className="text-blue-300">Good Signal.</strong> Solid volume (1.5x+), healthy RSI, and a valid stop-loss.
                                            May not be as explosive as "Ride" but still a quality setup.
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-cyan-500/10 border border-cyan-500/20">
                                        <div className="flex items-center gap-2 text-cyan-400 font-bold min-w-[140px]">
                                            <TrendingUp className="w-4 h-4" /> GAINING SPEED
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            <strong className="text-cyan-300">Early Move.</strong> Strong price action (5%+) with decent volume (1.3x+), but no clear pivot low yet.
                                            The move is new - watch for a pullback to establish a proper stop.
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-orange-500/10 border border-orange-500/20">
                                        <div className="flex items-center gap-2 text-orange-400 font-bold min-w-[140px]">
                                            <Activity className="w-4 h-4" /> HEATED
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            <strong className="text-orange-300">Warning.</strong> RSI is between 75-85. The coin has moved a lot and may be getting tired.
                                            Higher risk of a pullback. Consider smaller position or wait for a dip.
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-rose-500/10 border border-rose-500/20">
                                        <div className="flex items-center gap-2 text-rose-400 font-bold min-w-[140px]">
                                            <AlertTriangle className="w-4 h-4" /> TOPPED OUT
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            <strong className="text-rose-300">Danger Zone.</strong> RSI above 85 - extremely overbought.
                                            A correction is very likely. Avoid buying here. Consider taking profits if you're already in.
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-zinc-700/50 border border-zinc-600/20">
                                        <div className="flex items-center gap-2 text-zinc-400 font-bold min-w-[140px]">
                                            <Activity className="w-4 h-4" /> LOW VOLUME
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            <strong className="text-zinc-300">Weak Move.</strong> Volume is below 1.2x average.
                                            The price move isn't backed by strong participation - it could reverse easily.
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-yellow-500/10 border border-yellow-500/20">
                                        <div className="flex items-center gap-2 text-yellow-400 font-bold min-w-[140px]">
                                            <AlertTriangle className="w-4 h-4" /> CAUTION
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            <strong className="text-yellow-300">Mixed Signals.</strong> The coin is moving up but doesn't clearly fit other categories.
                                            Proceed carefully - not a high-conviction setup.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Signal Priority & Color Guide */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">Signal Priority Order</h3>
                                    <p className="text-sm text-zinc-500 mb-3">We check conditions in this order (first match wins):</p>
                                    <ol className="text-sm text-zinc-400 space-y-1">
                                        <li className="flex items-center gap-2"><span className="text-rose-400 font-bold">1.</span> RSI &gt; 85 → TOPPED</li>
                                        <li className="flex items-center gap-2"><span className="text-orange-400 font-bold">2.</span> RSI &gt; 75 → HEATED</li>
                                        <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">3.</span> +5%, 2x Vol, Stop → RIDE</li>
                                        <li className="flex items-center gap-2"><span className="text-blue-400 font-bold">4.</span> +3%, 1.5x Vol, Stop → MOMENTUM</li>
                                        <li className="flex items-center gap-2"><span className="text-cyan-400 font-bold">5.</span> +5%, No Stop → GAINING SPEED</li>
                                        <li className="flex items-center gap-2"><span className="text-zinc-400 font-bold">6.</span> Vol &lt; 1.2x → LOW VOLUME</li>
                                        <li className="flex items-center gap-2"><span className="text-yellow-400 font-bold">7.</span> Everything else → CAUTION</li>
                                    </ol>
                                </div>

                                <div className="p-4 bg-zinc-800/50 rounded-lg">
                                    <h3 className="font-semibold text-zinc-300 mb-3">Risk % Color Guide</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-emerald-400 font-bold">Under 5%</span>
                                            <span className="text-zinc-500">Tight stop - lower risk per trade</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-amber-400 font-bold">5% - 8%</span>
                                            <span className="text-zinc-500">Medium risk - normal for momentum plays</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-rose-400 font-bold">Over 8%</span>
                                            <span className="text-zinc-500">Wide stop - higher risk, consider smaller size</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-400 font-bold">— (dash)</span>
                                            <span className="text-zinc-500">No pivot low found - can't calculate stop</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* How to Use */}
                            <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                <h3 className="font-semibold text-emerald-400 mb-2">Pro Tips</h3>
                                <ul className="text-sm text-zinc-400 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400">•</span>
                                        <span><strong className="text-white">Best setups:</strong> "RIDE" or "MOMENTUM" signals with Risk % under 5%</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400">•</span>
                                        <span><strong className="text-white">Use the Trade Size input</strong> to see exactly how much you'd risk in dollars</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400">•</span>
                                        <span><strong className="text-white">Avoid "TOPPED" coins</strong> - they often pull back 5-10% quickly</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400">•</span>
                                        <span><strong className="text-white">"GAINING SPEED" coins</strong> may be worth watching for a pullback entry</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Disclaimer */}
                            <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                                <p className="text-xs text-zinc-500 text-center">
                                    This scanner is for informational purposes only. Always do your own research before trading.
                                    Past performance does not guarantee future results.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </Page>
    );
}
