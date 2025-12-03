import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface RsiDataPoint {
    symbol: string;
    rsi: Record<string, number>;
    price: number;
    change: number;
}

export function RsiTicker() {
    const { data } = useQuery({
        queryKey: ['rsiTicker'],
        queryFn: async () => {
            // Fetch top 50 by volume with all relevant timeframes
            const res = await fetch('/api/market/rsi?limit=50&source=volume&timeframe=15m,1h,4h,1d,1w');
            if (!res.ok) throw new Error('Failed to fetch ticker data');
            return res.json() as Promise<RsiDataPoint[]>;
        },
        refetchInterval: 60000,
    });

    // Filter for coins where ANY timeframe has RSI < 40
    const lowRsiCoins = data?.filter(coin => {
        const rsiValues = Object.values(coin.rsi || {});
        return rsiValues.some(val => val < 40);
    }) || [];

    if (!lowRsiCoins.length) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 h-10 bg-zinc-950 border-t border-zinc-800 flex items-center z-50">
            {/* Static Label */}
            <div className="bg-zinc-900 h-full px-4 flex items-center border-r border-zinc-800 z-10 shrink-0">
                <span className="text-xs font-bold text-emerald-400 whitespace-nowrap">RSI 40&lt; :</span>
            </div>

            {/* Scrolling Marquee */}
            <div className="flex-1 overflow-hidden relative h-full flex items-center group">
                {/* First Copy */}
                <div className="animate-scroll flex items-center gap-8 px-4 shrink-0 min-w-full">
                    {lowRsiCoins.map((coin, i) => (
                        <div key={`${coin.symbol}-${i}-1`} className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-white">{coin.symbol}</span>
                            <div className="flex items-center gap-1 text-zinc-400">
                                {Object.entries(coin.rsi || {}).map(([tf, val]) => (
                                    <span key={tf} className="flex items-center">
                                        <span className="text-zinc-500 mr-1">({tf})</span>
                                        <span className={val < 40 ? "text-emerald-400 font-mono font-bold" : "text-zinc-500 font-mono"}>
                                            {val}
                                        </span>
                                        <span className="mx-1 text-zinc-800">|</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Second Copy for Seamless Loop */}
                <div className="animate-scroll flex items-center gap-8 px-4 shrink-0 min-w-full">
                    {lowRsiCoins.map((coin, i) => (
                        <div key={`${coin.symbol}-${i}-2`} className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-white">{coin.symbol}</span>
                            <div className="flex items-center gap-1 text-zinc-400">
                                {Object.entries(coin.rsi || {}).map(([tf, val]) => (
                                    <span key={tf} className="flex items-center">
                                        <span className="text-zinc-500 mr-1">({tf})</span>
                                        <span className={val < 40 ? "text-emerald-400 font-mono font-bold" : "text-zinc-500 font-mono"}>
                                            {val}
                                        </span>
                                        <span className="mx-1 text-zinc-800">|</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                .animate-scroll {
                    animation: scroll 60s linear infinite;
                }
                /* Pause on hover */
                .group:hover .animate-scroll {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
}
