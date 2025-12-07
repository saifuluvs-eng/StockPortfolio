import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { Sparkles, TrendingUp, AlertTriangle, ArrowRight, Zap, Target, Shield } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface TopPick {
    symbol: string;
    price: number;
    score: number;
    tags: string[];
    reasons: string[];
    sources: {
        sr: any;
        mom: any;
    }
}

export default function TopPicksPage() {
    const { data: picks, isLoading } = useQuery<TopPick[]>({
        queryKey: ['top-picks'],
        queryFn: async () => {
            const res = await fetch(`/api/market/strategies/top-picks`);
            return res.json();
        },
        refetchInterval: 30000,
    });

    const formatPrice = (price: number) => {
        if (price < 0.00001) return price.toFixed(8);
        if (price < 0.001) return price.toFixed(7);
        if (price < 1) return price.toFixed(4);
        return price.toFixed(2);
    };

    return (
        <Page>
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/50 via-zinc-900 to-zinc-950 border border-zinc-800 p-8 md:p-12">
                    <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                        <Sparkles className="w-64 h-64 text-indigo-400" />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
                                Artificial Intelligence
                            </span>
                            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold uppercase tracking-wider">
                                Beta
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                            Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Top Picks</span>
                        </h1>
                        <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
                            We analyze thousands of data points to find the <strong className="text-white">Perfect Confluence</strong>.
                            These assets are hitting key levels AND showing strong momentum.
                        </p>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Target className="w-6 h-6 text-emerald-400" />
                            High Conviction Setups
                        </h2>
                        {!isLoading && (
                            <span className="text-sm text-zinc-500">
                                Scanning top 100 assets • Updated just now
                            </span>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-64 rounded-2xl bg-zinc-900/50 animate-pulse border border-zinc-800" />
                            ))}
                        </div>
                    ) : !picks?.length ? (
                        <div className="text-center py-24 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
                            <AlertTriangle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-zinc-400 mb-2">No "Perfect" Setups Found</h3>
                            <p className="text-zinc-500 max-w-md mx-auto">
                                The market is either choppy or quiet. Our algorithm is strict: we don't show mediocre trades.
                                <br />Check back in a few hours.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {picks.map((pick, idx) => (
                                <div
                                    key={pick.symbol}
                                    className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-900/20 hover:-translate-y-1"
                                >
                                    {/* Score Badge */}
                                    <div className="absolute top-4 right-4 z-10">
                                        <div className={`
                                            flex flex-col items-center justify-center w-14 h-14 rounded-xl font-bold text-sm border backdrop-blur-md
                                            ${idx === 0 ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
                                                'bg-zinc-800/80 text-white/90 border-zinc-700'}
                                        `}>
                                            <span className="text-xs font-normal opacity-70">Score</span>
                                            {Math.round(pick.score)}
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* Header */}
                                        <div>
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <h3 className="text-3xl font-black text-white tracking-tight">{pick.symbol.replace('USDT', '')}</h3>
                                                <span className="text-zinc-500 text-sm font-medium">USDT</span>
                                            </div>
                                            <div className="font-mono text-2xl text-zinc-300">
                                                ${formatPrice(pick.price)}
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        <div className="flex flex-wrap gap-2">
                                            {pick.tags.map(tag => (
                                                <span key={tag} className={`
                                                    text-xs font-bold px-2.5 py-1 rounded-md border
                                                    ${tag.includes('Shield') || tag.includes('Support') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        tag.includes('Ride') || tag.includes('Breakout') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                                            tag.includes('Golden') || tag.includes('PERFECT') ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                                                                'bg-zinc-800 text-zinc-400 border-zinc-700'}
                                                `}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px bg-zinc-800 w-full" />

                                        {/* Reasons */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                <Zap className="w-3 h-3" />
                                                Why we picked this
                                            </h4>
                                            <ul className="space-y-2">
                                                {pick.reasons.map((reason, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                                        <span className="mt-1.5 w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                                                        <span className="leading-snug">{reason}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Action */}
                                        <div className="pt-2">
                                            <Link href={`/analyse/${pick.symbol}`}>
                                                <Button className="w-full bg-zinc-100 text-zinc-900 hover:bg-white font-bold group-hover:scale-[1.02] transition-transform">
                                                    Analyze Chart <ArrowRight className="w-4 h-4 ml-2 opacity-50" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Bottom Gradient Bar */}
                                    <div className={`h-1.5 w-full bg-gradient-to-r ${idx === 0 ? 'from-indigo-500 via-purple-500 to-pink-500' :
                                            'from-zinc-700 to-zinc-800 group-hover:from-indigo-900 group-hover:to-blue-900'
                                        }`} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Page>
    );
}
