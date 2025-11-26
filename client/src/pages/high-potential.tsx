import { TrendBadge, MomentumBadge, VolumeBadge, VolatilityBadge } from "@/components/high-potential/Badges";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

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

export default function HighPotentialPage() {
    const [coins, setCoins] = useState<HighPotentialCoin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState(defaultFilters);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const res = await api("/api/high-potential", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}) // Backend scans top coins automatically
                });
                if (!res.ok) throw new Error("Failed to fetch high potential coins");
                const data = await res.json();
                console.log("High Potential API Response:", data);
                setCoins(Array.isArray(data.data) ? data.data : []);
            } catch (err) {
                console.error("High Potential Page Error:", err);
                setError("Failed to load high potential coins. Please try again later.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

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
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2">
                    🔥 High Potential Coins
                </h1>
                <p className="text-muted-foreground">
                    Top coins filtered by Trend, RSI, Volume, and Volatility.
                </p>
            </div>

            {/* Debug Filters Panel */}
            <div style={{
                background: "#111",
                padding: "12px",
                borderRadius: "10px",
                marginBottom: "20px"
            }}>
                <h3 className="font-bold mb-2">Debug Filters</h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.keys(filters).map(key => (
                        key !== "showAll" && (
                            <label key={key} className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(filters as any)[key]}
                                    onChange={() => setFilters({ ...filters, [key]: !(filters as any)[key] })}
                                    className="accent-primary"
                                />
                                <span style={{ marginLeft: "8px" }}>{key.toUpperCase()} Filter</span>
                            </label>
                        )
                    ))}
                </div>

                <label style={{ display: "block", marginTop: "12px", cursor: "pointer" }} className="flex items-center">
                    <input
                        type="checkbox"
                        checked={filters.showAll}
                        onChange={() => setFilters({ ...filters, showAll: !filters.showAll })}
                        className="accent-cyan-500"
                    />
                    <span style={{ marginLeft: "8px", fontWeight: "bold", color: "#0af" }}>SHOW ALL COINS</span>
                </label>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="text-center p-8 text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
                    {error}
                </div>
            ) : filteredCoins.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground bg-card rounded-lg border border-border">
                    No coins match the selected criteria. Try unchecking some filters or use "SHOW ALL COINS".
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredCoins.map((coin) => (
                        <Card key={coin.symbol} className="bg-card border-border hover:border-primary/50 transition-colors">
                            <CardContent className="p-4 sm:p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-bold">{coin.symbol}</h3>
                                            <span className="text-[#4aff4a] font-mono font-bold bg-[#4aff4a]/10 px-2 py-0.5 rounded text-sm">
                                                Score: {coin.score}/10
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-y-2 gap-x-3 text-sm items-center mb-3">
                                            <TrendBadge score={coin.score} />
                                            <span className="text-muted-foreground/30 hidden sm:inline">•</span>
                                            <MomentumBadge rsi={coin.rsi} />
                                            <span className="text-muted-foreground/30 hidden sm:inline">•</span>
                                            <VolumeBadge volume={coin.volume} avgVolume={coin.avgVolume} />
                                            <span className="text-muted-foreground/30 hidden sm:inline">•</span>
                                            <VolatilityBadge state={coin.volatilityState} />
                                        </div>

                                        {/* Pass/Fail Table */}
                                        {coin.passesDetail && (
                                            <div style={{ marginTop: "10px", fontSize: "14px" }} className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-muted-foreground">
                                                <div className="flex justify-between"><span>Trend:</span> <span className={coin.passesDetail.trend ? "text-green-400" : "text-red-400"}>{coin.passesDetail.trend ? "✓" : "✕"}</span></div>
                                                <div className="flex justify-between"><span>RSI:</span> <span className={coin.passesDetail.rsi ? "text-green-400" : "text-red-400"}>{coin.passesDetail.rsi ? "✓" : "✕"}</span></div>
                                                <div className="flex justify-between"><span>MACD:</span> <span className={coin.passesDetail.macd ? "text-green-400" : "text-red-400"}>{coin.passesDetail.macd ? "✓" : "✕"}</span></div>
                                                <div className="flex justify-between"><span>Volume:</span> <span className={coin.passesDetail.volume ? "text-green-400" : "text-red-400"}>{coin.passesDetail.volume ? "✓" : "✕"}</span></div>
                                                <div className="flex justify-between"><span>OBV:</span> <span className={coin.passesDetail.obv ? "text-green-400" : "text-red-400"}>{coin.passesDetail.obv ? "✓" : "✕"}</span></div>
                                                <div className="flex justify-between"><span>Volatility:</span> <span className={coin.passesDetail.volatility ? "text-green-400" : "text-red-400"}>{coin.passesDetail.volatility ? "✓" : "✕"}</span></div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end">
                                        <Link href={`/analyse/${coin.symbol}`}>
                                            <Button className="bg-[#4aff4a] text-black hover:bg-[#4aff4a]/90 font-bold">
                                                Analyse
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
