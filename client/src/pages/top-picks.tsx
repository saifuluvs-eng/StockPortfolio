import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { Sparkles, TrendingUp, AlertTriangle, ArrowRight, Zap, Target, Shield, Activity, Star, BarChart3 } from "lucide-react";
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
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/50 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 md:p-8">
                    <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                        <Sparkles className="w-64 h-64 text-indigo-400" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
                                    Artificial Intelligence
                                </span>
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold uppercase tracking-wider">
                                    Beta
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                                Market <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Top Picks</span>
                            </h1>
                        </div>
                        <div className="md:max-w-md">
                            <p className="text-sm md:text-base text-zinc-400 leading-relaxed md:text-right">
                                We analyze thousands of data points to find the <strong className="text-white">Perfect Confluence</strong>.
                                These assets are hitting key levels AND showing strong momentum.
                            </p>
                        </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                {/* Knowledge Base Section */}
                <Card>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold text-white/90">How Top Picks Works</h2>
                        </div>

                        {/* What is Confluence */}
                        <div className="p-4 bg-indigo-500/5 rounded-lg border border-indigo-500/20">
                            <h3 className="font-semibold text-indigo-400 mb-2">What is Confluence Scoring?</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Confluence means <strong className="text-white">multiple signals agreeing</strong>. Instead of relying on one indicator,
                                we look for coins where momentum, volume, trend, and RSI all point in the same direction.
                                The more factors align, the higher the score - and the more confident the setup.
                            </p>
                        </div>

                        {/* How Scoring Works */}
                        <div className="p-4 bg-zinc-800/50 rounded-lg">
                            <h3 className="font-semibold text-zinc-300 mb-3">How the Score is Calculated</h3>
                            <p className="text-sm text-zinc-500 mb-4">Every coin starts with a base score. Points are added based on these factors:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                                    <div className="text-emerald-400 font-bold text-lg">+25</div>
                                    <div>
                                        <div className="text-zinc-300 font-medium">Strong Momentum</div>
                                        <p className="text-zinc-500 text-xs">Price up 5-15% in 24h (sustainable pace)</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                                    <div className="text-blue-400 font-bold text-lg">+20</div>
                                    <div>
                                        <div className="text-zinc-300 font-medium">Uptrend</div>
                                        <p className="text-zinc-500 text-xs">Price above EMA 20 and EMA 50 (bullish structure)</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                                    <div className="text-amber-400 font-bold text-lg">+15</div>
                                    <div>
                                        <div className="text-zinc-300 font-medium">High Volume</div>
                                        <p className="text-zinc-500 text-xs">$20M+ daily volume shows strong interest</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                                    <div className="text-cyan-400 font-bold text-lg">+15</div>
                                    <div>
                                        <div className="text-zinc-300 font-medium">RSI Healthy</div>
                                        <p className="text-zinc-500 text-xs">RSI between 35-68 (room to run, not overbought)</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                                    <div className="text-purple-400 font-bold text-lg">+10</div>
                                    <div>
                                        <div className="text-zinc-300 font-medium">Volume Surge</div>
                                        <p className="text-zinc-500 text-xs">Today's volume 1.5x+ higher than average</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                                    <div className="text-rose-400 font-bold text-lg">-10</div>
                                    <div>
                                        <div className="text-zinc-300 font-medium">RSI Too High</div>
                                        <p className="text-zinc-500 text-xs">RSI above 70 means pullback risk (deducted)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* What Tags Mean */}
                        <div className="p-4 bg-zinc-800/50 rounded-lg">
                            <h3 className="font-semibold text-zinc-300 mb-3">What Each Tag Means</h3>
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-amber-500/10 border border-amber-500/20">
                                    <div className="flex items-center gap-2 text-amber-300 font-bold min-w-[150px]">
                                        <Star className="w-4 h-4" /> PERFECT Setup
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                        <strong className="text-amber-200">Highest confidence.</strong> All factors align: uptrend + healthy RSI + volume surge + room to grow. Rare but powerful.
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="flex items-center gap-2 text-emerald-400 font-bold min-w-[150px]">
                                        <TrendingUp className="w-4 h-4" /> Strong Momentum
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                        Price is moving up 5-15% - a "goldilocks" range that's strong but sustainable (not a pump-and-dump).
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-blue-500/10 border border-blue-500/20">
                                    <div className="flex items-center gap-2 text-blue-400 font-bold min-w-[150px]">
                                        <Activity className="w-4 h-4" /> Uptrend
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                        Price is above key moving averages (EMA 20 &gt; EMA 50). This confirms the overall direction is bullish.
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-indigo-500/10 border border-indigo-500/20">
                                    <div className="flex items-center gap-2 text-indigo-400 font-bold min-w-[150px]">
                                        <BarChart3 className="w-4 h-4" /> High Volume
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                        $20M+ daily trading volume. High liquidity means easier entry/exit and signals institutional interest.
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-cyan-500/10 border border-cyan-500/20">
                                    <div className="flex items-center gap-2 text-cyan-400 font-bold min-w-[150px]">
                                        <Zap className="w-4 h-4" /> RSI Dip
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                        RSI below 50 but coin is still in uptrend. This is a "buy the dip" opportunity within a healthy move.
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded bg-purple-500/10 border border-purple-500/20">
                                    <div className="flex items-center gap-2 text-purple-400 font-bold min-w-[150px]">
                                        <Sparkles className="w-4 h-4" /> Volume Surge
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                        Today's volume is 1.5x+ the 7-day average. Unusual activity often precedes bigger moves.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Score Guide */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-zinc-800/50 rounded-lg">
                                <h3 className="font-semibold text-zinc-300 mb-3">Understanding Scores</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between p-2 bg-indigo-500/10 rounded border border-indigo-500/20">
                                        <span className="text-indigo-400 font-bold">80-100</span>
                                        <span className="text-zinc-400">Exceptional - Multiple strong signals</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                                        <span className="text-emerald-400 font-bold">60-79</span>
                                        <span className="text-zinc-400">Strong - Good confluence of factors</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-amber-500/10 rounded border border-amber-500/20">
                                        <span className="text-amber-400 font-bold">40-59</span>
                                        <span className="text-zinc-400">Moderate - Some positive signals</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 bg-zinc-700/50 rounded border border-zinc-600/20">
                                        <span className="text-zinc-400 font-bold">30-39</span>
                                        <span className="text-zinc-500">Minimum threshold to show</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-zinc-800/50 rounded-lg">
                                <h3 className="font-semibold text-zinc-300 mb-3">What We Filter Out</h3>
                                <ul className="text-sm text-zinc-400 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-rose-400">×</span>
                                        <span>Coins with &lt;$5M daily volume (illiquid)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-rose-400">×</span>
                                        <span>Moves &gt;25% in 24h (likely pump-and-dump)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-rose-400">×</span>
                                        <span>Leveraged tokens (UP/DOWN tokens)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-rose-400">×</span>
                                        <span>Coins scoring below 30 (insufficient signals)</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Pro Tips */}
                        <div className="p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <h3 className="font-semibold text-indigo-400 mb-2">Pro Tips</h3>
                            <ul className="text-sm text-zinc-400 space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-indigo-400">•</span>
                                    <span><strong className="text-white">PERFECT Setup</strong> coins are rare - when you see one, pay attention</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-indigo-400">•</span>
                                    <span><strong className="text-white">Click "Analyze Chart"</strong> to see the full technical breakdown before trading</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-indigo-400">•</span>
                                    <span><strong className="text-white">Higher score = more factors agreeing</strong>, but always set your own stop-loss</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-indigo-400">•</span>
                                    <span><strong className="text-white">"No Perfect Setups"</strong> means the market is choppy - patience is a strategy</span>
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
        </Page>
    );
}
