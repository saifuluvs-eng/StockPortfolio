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
}

export default function HighPotentialPage() {
    const [coins, setCoins] = useState<HighPotentialCoin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="text-center p-8 text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
                    {error}
                </div>
            ) : safeCoins.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground bg-card rounded-lg border border-border">
                    No coins match the high potential criteria right now.
                </div>
            ) : (
                <div className="grid gap-4">
                    {safeCoins.map((coin) => (
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

                                        <div className="flex flex-wrap gap-y-2 gap-x-3 text-sm items-center">
                                            <TrendBadge score={coin.score} />
                                            <span className="text-muted-foreground/30 hidden sm:inline">•</span>
                                            <MomentumBadge rsi={coin.rsi} />
                                            <span className="text-muted-foreground/30 hidden sm:inline">•</span>
                                            <VolumeBadge volume={coin.volume} avgVolume={coin.avgVolume} />
                                            <span className="text-muted-foreground/30 hidden sm:inline">•</span>
                                            <VolatilityBadge state={coin.volatilityState} />
                                        </div>
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
