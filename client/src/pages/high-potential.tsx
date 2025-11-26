
import { TrendBadge, MomentumBadge, VolumeBadge, VolatilityBadge } from "@/components/high-potential/Badges";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";

interface HighPotentialCoin {
    symbol: string;
    score: number;
    passes: boolean;
    price: number;
    rsi: number;
    volume: number;
    avgVolume: number;
    volatilityState: string;
    passesDetail: {
        trend: boolean;
        rsi: boolean;
        macd: boolean;
        volume: boolean;
        obv: boolean;
        volatility: boolean;
    };
}

const defaultFilters = {
    trend: true,
    rsi: true,
    macd: true,
    volume: true,
    obv: true,
    volatility: true,
    showAll: false
};

const CACHE_KEY = "high_potential_data_cache";
const TIMESTAMP_KEY = "high_potential_data_timestamp";

export default function HighPotentialPage() {
    const [coins, setCoins] = useState<HighPotentialCoin[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [filters, setFilters] = useState(defaultFilters);
    const [pendingFilters, setPendingFilters] = useState(defaultFilters);

    const formatTimestamp = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    };

    const fetchData = async (isRefresh: boolean = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            // Only show full loading if we don't have cached data
            if (!localStorage.getItem(CACHE_KEY)) {
                setLoading(true);
            }
        }
        setError(null);

        try {
            const res = await api("/api/high-potential", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}) // Backend scans top coins automatically
            });
            if (!res.ok) throw new Error("Failed to fetch high potential coins");
            const data = await res.json();
            console.log("High Potential API Response:", data);

            const newCoins = Array.isArray(data.data) ? data.data : [];
            setCoins(newCoins);

            const now = new Date();
            setLastUpdated(now);

            // Update cache
            localStorage.setItem(CACHE_KEY, JSON.stringify(newCoins));
            localStorage.setItem(TIMESTAMP_KEY, now.toISOString());

        } catch (err) {
            console.error("High Potential Page Error:", err);
            setError("Failed to load high potential coins. Please try again later.");
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        // Load from cache first
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cachedTimestamp = localStorage.getItem(TIMESTAMP_KEY);

        if (cachedData && cachedTimestamp) {
            try {
                setCoins(JSON.parse(cachedData));
                setLastUpdated(new Date(cachedTimestamp));
                setLoading(false);
            } catch (e) {
                console.error("Cache parse error", e);
            }
        }

        // Always fetch fresh data
        fetchData();
    }, []);

    const handleFilterChange = (key: string) => {
        setPendingFilters(prev => ({ ...prev, [key]: !(prev as any)[key] }));
    };

    const applyFilters = () => {
        setFilters(pendingFilters);
    };

    // Safe check for coins
    const safeCoins = Array.isArray(coins) ? coins : [];

    const filteredCoins = safeCoins.filter(coin => {
        if (filters.showAll) return true;
        if (!coin.passesDetail) return false; // Safety check

        const { passesDetail } = coin;
        let ok = true;

        if (filters.trend && !passesDetail.trend) ok = false;
        if (filters.rsi && !passesDetail.rsi) ok = false;
        if (filters.macd && !passesDetail.macd) ok = false;
        if (filters.volume && !passesDetail.volume) ok = false;
        if (filters.obv && !passesDetail.obv) ok = false;
        if (filters.volatility && !passesDetail.volatility) ok = false;

        return ok;
    });

    return (
        <div className="p-4 sm:p-6 text-foreground min-h-screen">
            <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2">
                        🔥 High Potential Coins
                    </h1>
                    <p className="text-muted-foreground">
                        Top coins filtered by Trend, RSI, Volume, and Volatility.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <button
                        onClick={() => fetchData(true)}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 border-2 border-primary text-primary bg-transparent hover:bg-primary/10 active:bg-primary/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                    >
                        <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                        <span className="hidden sm:inline">{isRefreshing ? "Refreshing…" : "Refresh"}</span>
                    </button>
                    {lastUpdated && (
                        <p className="text-xs text-muted-foreground">
                            Last updated: {formatTimestamp(lastUpdated)}
                        </p>
                    )}
                </div>
            </div>

            {/* Debug Filters Panel */}
            <div style={{
                background: "#111",
                padding: "16px",
                borderRadius: "10px",
                marginBottom: "20px"
            }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h3 className="font-bold text-lg">Debug Filters</h3>
                    <Button
                        onClick={applyFilters}
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                    >
                        Submit Filters
                    </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Object.keys(pendingFilters).map(key => (
                        key !== "showAll" && (
                            <label key={key} className="flex items-center cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={(pendingFilters as any)[key]}
                                    onChange={() => handleFilterChange(key)}
                                    className="accent-primary w-4 h-4"
                                />
                                <span className="ml-2 text-sm font-medium">{key.toUpperCase()}</span>
                            </label>
                        )
                    ))}

                    <label className="flex items-center cursor-pointer p-2 rounded hover:bg-white/5 transition-colors col-span-2 sm:col-span-1">
                        <input
                            type="checkbox"
                            checked={pendingFilters.showAll}
                            onChange={() => setPendingFilters(prev => ({ ...prev, showAll: !prev.showAll }))}
                            className="accent-cyan-500 w-4 h-4"
                        />
                        <span className="ml-2 text-sm font-bold text-[#0af]">SHOW ALL COINS</span>
                    </label>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : error && filteredCoins.length === 0 ? (
                <div className="text-center p-8 text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
                    {error}
                </div>
            ) : filteredCoins.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground bg-card rounded-lg border border-border">
                    No coins match the selected criteria. Try unchecking some filters or use "SHOW ALL COINS".
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="h-[600px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-muted/50 text-muted-foreground backdrop-blur">
                                <tr className="border-b border-border">
                                    <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Symbol</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Score</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Badges</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Pass/Fail Details</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCoins.map((coin, index) => (
                                    <tr key={coin.symbol} className="border-t border-border hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-bold">{coin.symbol}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-[#4aff4a] font-mono font-bold bg-[#4aff4a]/10 px-2 py-0.5 rounded text-xs">
                                                {coin.score}/10
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                <TrendBadge score={coin.score} />
                                                <MomentumBadge rsi={coin.rsi} />
                                                <VolumeBadge volume={coin.volume} avgVolume={coin.avgVolume} />
                                                <VolatilityBadge state={coin.volatilityState} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {coin.passesDetail && (
                                                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-1"><span>Trend:</span> <span className={coin.passesDetail.trend ? "text-green-400" : "text-red-400"}>{coin.passesDetail.trend ? "✓" : "✕"}</span></div>
                                                    <div className="flex items-center gap-1"><span>RSI:</span> <span className={coin.passesDetail.rsi ? "text-green-400" : "text-red-400"}>{coin.passesDetail.rsi ? "✓" : "✕"}</span></div>
                                                    <div className="flex items-center gap-1"><span>MACD:</span> <span className={coin.passesDetail.macd ? "text-green-400" : "text-red-400"}>{coin.passesDetail.macd ? "✓" : "✕"}</span></div>
                                                    <div className="flex items-center gap-1"><span>Volume:</span> <span className={coin.passesDetail.volume ? "text-green-400" : "text-red-400"}>{coin.passesDetail.volume ? "✓" : "✕"}</span></div>
                                                    <div className="flex items-center gap-1"><span>OBV:</span> <span className={coin.passesDetail.obv ? "text-green-400" : "text-red-400"}>{coin.passesDetail.obv ? "✓" : "✕"}</span></div>
                                                    <div className="flex items-center gap-1"><span>Volatility:</span> <span className={coin.passesDetail.volatility ? "text-green-400" : "text-red-400"}>{coin.passesDetail.volatility ? "✓" : "✕"}</span></div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link href={`/ analyse / ${coin.symbol} `}>
                                                <Button size="sm" className="bg-[#4aff4a] text-black hover:bg-[#4aff4a]/90 font-bold">
                                                    Analyse
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Explanations Section */}
            <div className="mt-8 p-6 bg-card rounded-xl border border-border">
                <h2 className="text-xl font-bold mb-4">How it works & Definitions</h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="font-semibold text-lg mb-2 text-primary">How do coins populate in the list?</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            The system automatically scans the <strong>Top 50 Daily Gainers</strong> from Binance every few minutes.
                            It then applies a strict set of 6 technical filters (Trend, RSI, MACD, Volume, OBV, Volatility) to these coins.
                            Only coins that pass the selected filters appear in the list above.
                            This ensures you are looking at coins that are not only moving up but also have strong technical backing.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold text-lg mb-2 text-primary">Badge Definitions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">🟢</span>
                                <div>
                                    <span className="font-bold block">Strong Trend</span>
                                    <span className="text-muted-foreground">Price is above both EMA 20 and EMA 50, indicating a solid uptrend.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">🟢</span>
                                <div>
                                    <span className="font-bold block">Momentum Rising</span>
                                    <span className="text-muted-foreground">RSI is above 50 (bullish territory) and MACD histogram is positive (momentum increasing).</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-1">🟢</span>
                                <div>
                                    <span className="font-bold block">Strong Volume</span>
                                    <span className="text-muted-foreground">Recent volume is higher than the 20-period average, confirming interest.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-gray-400 mt-1">⚪</span>
                                <div>
                                    <span className="font-bold block">Normal Volatility</span>
                                    <span className="text-muted-foreground">Bollinger Bands are within a standard range, suggesting stable movement.</span>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-purple-400 mt-1">🟣</span>
                                <div>
                                    <span className="font-bold block">Volatility Expanding</span>
                                    <span className="text-muted-foreground">Bollinger Bands are widening, often preceding a major price move.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

