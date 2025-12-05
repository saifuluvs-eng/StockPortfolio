import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page, Card } from "@/components/layout/Layout";
import { RefreshCw, Target, Info, HelpCircle, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiFetchLocal } from "@/lib/api";

interface SupportResistanceResult {
    symbol: string;
    price: number;
    type: 'Support' | 'Resistance';
    level: number;
    target?: number;
    distancePercent: number;
    tests: number;
    riskReward?: number;
    volume: number;
    timestamp: string;
}

type SortField = 'target' | 'tests' | 'riskReward';
type SortDirection = 'asc' | 'desc';

export default function StrategiesPage() {
    const { data: srData, isLoading: isLoadingSR, refetch: refetchSR, isRefetching: isRefetchingSR } = useQuery<SupportResistanceResult[]>({
        queryKey: ["support-resistance"],
        queryFn: async () => apiFetchLocal("/api/market/strategies/support-resistance"),
        refetchInterval: 60000,
    });

    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default to descending for numbers usually (highest profit, most tests)
        }
    };

    const sortedData = React.useMemo(() => {
        if (!srData) return [];
        if (!sortField) return srData;

        return [...srData].sort((a, b) => {
            const aValue = a[sortField] || 0;
            const bValue = b[sortField] || 0;

            if (sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }, [srData, sortField, sortDirection]);

    const formatPrice = (price: number) => {
        if (price < 0.00001) return price.toFixed(8);
        if (price < 0.001) return price.toFixed(7);
        if (price < 1) return price.toFixed(4);
        return price.toFixed(2);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-zinc-600 inline opacity-50" />;
        return <ArrowUpDown className={`w-3 h-3 ml-1 inline ${sortDirection === 'asc' ? 'text-emerald-500' : 'text-rose-500'}`} />;
    };

    return (
        <Page>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="space-y-6">
                    <Card>
                        <div className="p-6 bg-zinc-900/50 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-purple-400" />
                                    Support & Resistance Proximity
                                </h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Identifies coins that are trading <strong>close (within 5%)</strong> to key support or resistance levels.
                                    Look for <strong>High R:R</strong> ratios (&gt; 3.0) and multiple <strong>Tests</strong> (bounces).
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetchSR()}
                                disabled={isLoadingSR || isRefetchingSR}
                                className="gap-2 min-w-[140px] shrink-0"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRefetchingSR ? "animate-spin" : ""}`} />
                                {isRefetchingSR ? "Scanning..." : "Refresh"}
                            </Button>
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
                                        <th
                                            className="p-4 font-medium text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                                            onClick={() => handleSort('target')}
                                        >
                                            Target <SortIcon field="target" />
                                        </th>
                                        <th
                                            className="p-4 font-medium text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                                            onClick={() => handleSort('tests')}
                                        >
                                            Strength <SortIcon field="tests" />
                                        </th>
                                        <th
                                            className="p-4 font-medium text-right cursor-pointer hover:text-zinc-300 transition-colors select-none"
                                            onClick={() => handleSort('riskReward')}
                                        >
                                            Risk:Reward <SortIcon field="riskReward" />
                                        </th>
                                        <th className="p-4 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {isLoadingSR ? (
                                        <tr><td colSpan={9} className="p-8 text-center text-zinc-500">Scanning...</td></tr>
                                    ) : !sortedData?.length ? (
                                        <tr><td colSpan={9} className="p-8 text-center text-zinc-500">No coins near key levels.</td></tr>
                                    ) : (
                                        sortedData.map((coin) => (
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
                                                <td className="p-4 text-right font-mono text-zinc-400">
                                                    {coin.target ? `$${formatPrice(coin.target)}` : '-'}
                                                </td>
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

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Info className="w-5 h-5 text-indigo-400" />
                                Scanner Logic
                            </h4>
                            <dl className="space-y-4">
                                <div>
                                    <dt className="text-sm font-medium text-zinc-300">Target Price</dt>
                                    <dd className="text-sm text-zinc-400 mt-1">
                                        The highest price reached in the last ~8 days. We assume price moves in a range, so this is the "Ceiling" the coin might return to.
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-zinc-300">Why this list? (Top 75)</dt>
                                    <dd className="text-sm text-zinc-400 mt-1 space-y-1">
                                        <p>We scan the <strong>Top 75 coins</strong> by 24h Volume.</p>
                                        <ul className="list-disc list-inside pl-1 text-xs">
                                            <li><strong>Liquidity:</strong> Most active coins, so you can easily enter/exit.</li>
                                            <li><strong>Trends:</strong> Hot coins naturally enter this list when their volume spikes.</li>
                                        </ul>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-zinc-300">Strength (Tests)</dt>
                                    <dd className="text-sm text-zinc-400 mt-1">
                                        How many times the price has bounced off this level recently. Higher is better.
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-emerald-400" />
                                Trading Tips
                            </h4>
                            <dl className="space-y-4">
                                <div>
                                    <dt className="text-sm font-medium text-zinc-300">Risk : Reward (R:R)</dt>
                                    <dd className="text-sm text-zinc-400 mt-1">
                                        Potential Profit vs. Potential Loss. <strong>1:10</strong> means for every $1 you risk losing (if it breaks support), you could make $10 (if it hits target).
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-zinc-300">Why did a coin disappear?</dt>
                                    <dd className="text-sm text-zinc-400 mt-1">
                                        Coins are only listed when they are <strong>within 5%</strong> of the support line. If a coin bounces up (Good!) or crashes down (Bad), it leaves the "Setup Zone" and is removed.
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        </Page>
    );
}
