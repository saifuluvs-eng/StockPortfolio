import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

const CACHE_KEY = "high_potential_card_cache";
const TIMESTAMP_KEY = "high_potential_card_timestamp";

interface HighPotentialCoin {
    symbol: string;
    score: number;
    price: number;
}

export default function HighPotentialCard() {
    const [coins, setCoins] = useState<HighPotentialCoin[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        // 1. Try cache first
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            const cachedTimestamp = localStorage.getItem(TIMESTAMP_KEY);

            if (cachedData && cachedTimestamp) {
                const data = JSON.parse(cachedData);
                setCoins(data.slice(0, 3));
                setLastUpdated(new Date(cachedTimestamp));
                setLoading(false);

                // If cache is older than 5 minutes, fetch fresh in background
                const age = Date.now() - new Date(cachedTimestamp).getTime();
                if (age < 5 * 60 * 1000) return;
            }
        } catch (e) {
            console.error("Cache parse error", e);
        }

        // 2. Fetch fresh data
        try {
            const res = await api("/api/high-potential", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });

            if (!res.ok) return;

            const data = await res.json();
            if (Array.isArray(data.data)) {
                const top3 = data.data.slice(0, 3);
                setCoins(top3);

                const now = new Date();
                setLastUpdated(now);
                setLoading(false);

                localStorage.setItem(CACHE_KEY, JSON.stringify(top3));
                localStorage.setItem(TIMESTAMP_KEY, now.toISOString());
            }
        } catch (error) {
            console.error("Error fetching high potential coins:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        // Refresh every 5 minutes
        const interval = setInterval(loadData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTimestamp = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <Link to="/high-potential" className="block h-full">
            <Card className="dashboard-card neon-hover bg-gradient-to-br from-orange-500/10 to-orange-500/20 h-auto sm:h-full cursor-pointer" style={{ "--neon-glow": "hsl(30, 100%, 50%)" } as React.CSSProperties}>
                <CardContent className="p-2 sm:p-3 md:p-4 lg:p-6 flex flex-col justify-start h-full">
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">
                                High Potential
                            </h3>
                            <p className="text-xs text-muted-foreground">Top Opportunities</p>
                        </div>
                        <Flame className="w-5 h-5 text-[#f7931a] flex-shrink-0 mt-0.5" />
                    </div>

                    {/* Top 3 Coins List */}
                    <div className="space-y-1.5 flex-1 mb-2">
                        {coins.length > 0 ? (
                            coins.map((coin) => (
                                <div key={coin.symbol} className="flex items-center justify-between text-xs sm:text-sm">
                                    <span className="font-medium text-foreground">{coin.symbol}</span>
                                    <span className="font-mono font-bold text-[#4aff4a] bg-[#4aff4a]/10 px-1.5 rounded text-[10px]">
                                        {coin.score}/10
                                    </span>
                                </div>
                            ))
                        ) : loading ? (
                            <p className="text-xs text-muted-foreground">Scanning market...</p>
                        ) : (
                            <p className="text-xs text-muted-foreground">No signals found</p>
                        )}
                    </div>

                    {/* View More Link */}
                    <div className="text-xs text-primary font-medium mb-2 hover:underline">
                        view analysis →
                    </div>

                    {/* Last Updated */}
                    {lastUpdated && (
                        <p className="text-[10px] text-muted-foreground">
                            last updated {formatTimestamp(lastUpdated)}
                        </p>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
