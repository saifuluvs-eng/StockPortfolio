import { TrendBadge, MomentumBadge, VolumeBadge, VolatilityBadge } from "@/components/high-potential/Badges";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";
import { go } from "@/lib/nav";
import { useLoginGate } from "@/auth/useLoginGate";

interface HighPotentialCoin {
    symbol: string;
    score: number;
    passes: boolean;
    price: number;
    rsi: number;
    volume: number;
    avgVolume: number;
    volatilityState: "low" | "normal" | "high";
    likely10PercentUpside?: boolean;
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
    trend: false,
    rsi: false,
    macd: false,
    volume: false,
    obv: false,
    volatility: false,
    likely10PercentUpside: false
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
    const { requireLogin } = useLoginGate();

    const formatTimestamp = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    };

    const handleAnalyse = (symbol: string) => {
        if (requireLogin("/high-potential")) return;
        go(`#/analyse/${symbol}`);
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
        let passes = true;

        // Filter by individual technicals
        if (coin.passesDetail) {
            const activeTechFilters = Object.entries(filters).filter(([key, isActive]) => isActive && key !== 'likely10PercentUpside');
            if (activeTechFilters.length > 0) {
                passes = activeTechFilters.every(([key]) => (coin.passesDetail as any)[key]);
            }
        } else {
            // If passesDetail is missing, it cannot pass technical filters
            const hasActiveTechFilters = Object.entries(filters).some(([key, isActive]) => isActive && key !== 'likely10PercentUpside');
            if (hasActiveTechFilters) {
                passes = false;
            }
        }

        // Filter by "Likely +10% Upside"
        if (filters.likely10PercentUpside && !coin.likely10PercentUpside) {
            passes = false;
        }

        return passes;
    });

    return (
        <div className="p-4 sm:p-6 text-foreground min-h-screen">
            <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2">
                        🔥 High Potential Coins
                    </h1>
                    <div className="flex flex-col gap-1">
                        <p className="text-muted-foreground">
                            Top coins filtered by Trend, RSI, Volume, and Volatility.
                        </p>
                    </div>
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
                    <button
                        onClick={() => {
                            // Trigger debug fetch
                            setLoading(true);
                            setError(null); // Clear previous errors
                            api("/api/high-potential", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ debug: true })
                            })
                                .then(res => {
                                    if (!res.ok) throw new Error(`Server error: ${res.status}`);
                                    return res.json();
                                })
                                .then(data => {
                                    console.log("Simulate Response Data:", data);
                                    if (!data.data || !Array.isArray(data.data)) {
                                        throw new Error("Invalid data format received");
                                    }
                                    setCoins(data.data);
                                    setLastUpdated(new Date());
                                    setLoading(false);
                                })
                                .catch(err => {
                                    console.error("Simulate Error:", err);
                                    setError(err.message);
                                    setLoading(false);
                                });
                        }}
                        className="flex items-center gap-2 border-2 border-yellow-500 text-yellow-500 bg-transparent hover:bg-yellow-500/10 active:bg-yellow-500/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-all min-h-[44px]"
                    >
                        <span className="hidden sm:inline">Simulate</span>
                        <span className="sm:hidden">Sim</span>
                    </button>
                    {lastUpdated && (
                        <p className="text-xs text-muted-foreground">
                            Last updated: {formatTimestamp(lastUpdated)}
                        </p>
                    )}
                </div>
            </div>

            {/* Top Section: Filters & Placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Left Card: Choose your Technicals */}
                <div className="bg-[#111] p-4 rounded-lg flex flex-col justify-between min-h-[140px]">
                    <div>
                        <h3 className="font-bold text-base mb-2">Choose your Technicals</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                            {Object.keys(pendingFilters).filter(key => key !== 'likely10PercentUpside').map(key => (
                                <label key={key} className="flex items-center cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={(pendingFilters as any)[key]}
                                        onChange={() => handleFilterChange(key)}
                                        className="accent-primary w-3 h-3"
                                    />
                                    <span className="ml-2 text-xs font-medium">{key.toUpperCase()}</span>
                                </label>
                            ))}
                            <label className="flex items-center cursor-pointer hover:bg-white/5 p-1 rounded transition-colors col-span-2 mt-1 border-t border-white/10 pt-2">
                                <input
                                    type="checkbox"
                                    checked={pendingFilters.likely10PercentUpside}
                                    onChange={() => handleFilterChange('likely10PercentUpside')}
                                    className="accent-[#0f0] w-3 h-3"
                                />
                                <span className="ml-2 text-xs font-bold text-[#0f0]">Likely +10% Upside</span>
                            </label>
                        </div>
                    </div>

                    <Button
                        onClick={applyFilters}
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full font-bold text-sm h-8"
                    >
                        Submit Filters
                    </Button>
                </div>

                {/* Right Card: Placeholder */}
                <div className="bg-[#111] p-4 rounded-lg flex items-center justify-center min-h-[140px]">
                    {/* Empty for now */}
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
                    No coins match the selected criteria. Try unchecking some filters.
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
                                            <Button
                                                size="sm"
                                                className="bg-[#4aff4a] text-black hover:bg-[#4aff4a]/90 font-bold"
                                                onClick={() => handleAnalyse(coin.symbol)}
                                            >
                                                Analyse
                                            </Button>
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

                <div className="space-y-8">
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
                        <h3 className="font-semibold text-lg mb-3 text-primary">Pass/Fail Criteria</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                            <div className="flex justify-between border-b border-border/40 pb-2">
                                <span className="font-bold">Trend</span>
                                <div className="text-right">
                                    <div className="text-green-400">✓ Price &gt; EMA20 <span className="text-muted-foreground">OR</span> EMA20 &gt; EMA50</div>
                                    <div className="text-red-400">✕ Price &lt; EMA20 <span className="text-muted-foreground">AND</span> EMA20 &lt; EMA50</div>
                                </div>
                            </div>
                            <div className="flex justify-between border-b border-border/40 pb-2">
                                <span className="font-bold">RSI</span>
                                <div className="text-right">
                                    <div className="text-green-400">✓ 48 ≤ RSI ≤ 65</div>
                                    <div className="text-red-400">✕ RSI &lt; 48 <span className="text-muted-foreground">OR</span> RSI &gt; 65</div>
                                </div>
                            </div>
                            <div className="flex justify-between border-b border-border/40 pb-2">
                                <span className="font-bold">MACD</span>
                                <div className="text-right">
                                    <div className="text-green-400">✓ Histogram &gt; 0</div>
                                    <div className="text-red-400">✕ Histogram ≤ 0</div>
                                </div>
                            </div>
                            <div className="flex justify-between border-b border-border/40 pb-2">
                                <span className="font-bold">Volume</span>
                                <div className="text-right">
                                    <div className="text-green-400">✓ Volume &gt; AvgVolume</div>
                                    <div className="text-red-400">✕ Volume ≤ AvgVolume</div>
                                </div>
                            </div>
                            <div className="flex justify-between border-b border-border/40 pb-2">
                                <span className="font-bold">OBV</span>
                                <div className="text-right">
                                    <div className="text-green-400">✓ Slope &gt; 0</div>
                                    <div className="text-red-400">✕ Slope ≤ 0</div>
                                </div>
                            </div>
                            <div className="flex justify-between border-b border-border/40 pb-2">
                                <span className="font-bold">Volatility</span>
                                <div className="text-right">
                                    <div className="text-green-400">✓ Normal <span className="text-muted-foreground">OR</span> High (Expanding)</div>
                                    <div className="text-red-400">✕ Low (Compression)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div>
                <h3 className="font-semibold text-lg mb-3 text-[#0f0]">Likely +10% Upside Filter</h3>
                <p className="text-muted-foreground text-sm mb-4">
                    When checked, this filter selects coins that meet at least <strong>4 out of 5</strong> of the following bullish conditions:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 ml-2">
                    <li><strong>Volatility Expanding:</strong> Expanding Bollinger Bands or rising ATR.</li>
                    <li><strong>Momentum Rising:</strong> Rising MACD, healthy RSI (45-80), or bullish Stochastic.</li>
                    <li><strong>Trend Bullish/Recovering:</strong> Price above EMAs or strong ADX trend.</li>
                    <li><strong>Volume Improved:</strong> Volume above average or rising OBV.</li>
                    <li><strong>Room to Rise:</strong> Nearest resistance level is at least +10% away.</li>
                </ul>
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-200">
                    <strong>Disclaimer:</strong> Not financial advice. This is a technical probability score based on historical data and does not guarantee future performance.
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-lg mb-3 text-primary">Badge Definitions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {/* Trend Badges */}
                    <div className="flex items-start gap-2">
                        <span className="text-[#0f0] mt-1">🟢</span>
                        <div>
                            <span className="font-bold block">Strong Trend</span>
                            <span className="text-muted-foreground">Score ≥ 8. Price significantly above EMAs with strong momentum.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-[#4aff4a] mt-1">🟩</span>
                        <div>
                            <span className="font-bold block">Trend Strong</span>
                            <span className="text-muted-foreground">Score ≥ 6. Solid uptrend, price above key EMAs.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-[#ffff55] mt-1">🟨</span>
                        <div>
                            <span className="font-bold block">Trend Forming</span>
                            <span className="text-muted-foreground">Score ≥ 5. Early signs of a trend, potentially breaking out.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-[#999] mt-1">⚪</span>
                        <div>
                            <span className="font-bold block">Weak Trend</span>
                            <span className="text-muted-foreground">Score &lt; 5. No clear trend or consolidation.</span>
                        </div>
                    </div>

                    {/* Momentum Badges */}
                    <div className="flex items-start gap-2">
                        <span className="text-[#0f0] mt-1">🟢</span>
                        <div>
                            <span className="font-bold block">Momentum Rising</span>
                            <span className="text-muted-foreground">RSI 55-65. Sweet spot for bullish momentum without being overbought.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-[#4aff4a] mt-1">🟩</span>
                        <div>
                            <span className="font-bold block">Healthy Momentum</span>
                            <span className="text-muted-foreground">RSI &ge; 48. Positive momentum, room to grow.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-[#999] mt-1">⚪</span>
                        <div>
                            <span className="font-bold block">Momentum Neutral</span>
                            <span className="text-muted-foreground">RSI below 48 or weak momentum signals.</span>
                        </div>
                    </div>

                    {/* Volume Badges */}
                    <div className="flex items-start gap-2">
                        <span className="text-[#0f0] mt-1">🟢</span>
                        <div>
                            <span className="font-bold block">Strong Volume</span>
                            <span className="text-muted-foreground">Volume &gt; 1.5x average. High buying interest.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-[#4aff4a] mt-1">🟩</span>
                        <div>
                            <span className="font-bold block">Volume Rising</span>
                            <span className="text-muted-foreground">Volume &gt; Average. Increasing market participation.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-[#999] mt-1">⚪</span>
                        <div>
                            <span className="font-bold block">Neutral Volume</span>
                            <span className="text-muted-foreground">Volume at or below average levels.</span>
                        </div>
                    </div>

                    {/* Volatility Badges */}
                    <div className="flex items-start gap-2">
                        <span className="text-[#c084fc] mt-1">🟣</span>
                        <div>
                            <span className="font-bold block">Volatility Expanding</span>
                            <span className="text-muted-foreground">Bollinger Bands widening. Expect large price moves.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-white mt-1">⚪</span>
                        <div>
                            <span className="font-bold block">Normal Volatility</span>
                            <span className="text-muted-foreground">Standard price fluctuation range.</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-[#60a5fa] mt-1">🔵</span>
                        <div>
                            <span className="font-bold block">Compression</span>
                            <span className="text-muted-foreground">Bollinger Bands squeezing. Potential breakout imminent.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

