import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const CACHE_KEY = "gainers_data_cache";
const TIMESTAMP_KEY = "gainers_data_timestamp";

const stripUSDT = (symbol: string): string => {
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
};

interface GainerData {
  symbol: string;
  change24h: number;
}

export default function TopGainersCard() {
  const [topGainers, setTopGainers] = useState<GainerData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load gainers from localStorage (shared with Gainers page)
  const loadGainers = () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(TIMESTAMP_KEY);

      if (cachedData && cachedTimestamp) {
        const data = JSON.parse(cachedData);
        const topThree = data.slice(0, 3).map((item: any) => ({
          symbol: item.symbol,
          change24h: typeof item.change24h === "number" ? item.change24h : parseFloat(item.change24h || "0"),
        }));
        setTopGainers(topThree);
        const newDate = new Date(cachedTimestamp);
        setLastUpdated(newDate);
        return true;
      }
    } catch (error) {
      console.error("Error loading gainers from cache:", error);
    }
    return false;
  };

  // Fetch gainers via backend API as fallback for first-time visitors
  const fetchGainersFallback = async () => {
    try {
      const res = await fetch("/api/market/gainers");
      if (!res.ok) return;

      const data = await res.json();
      const rows = Array.isArray(data) ? data : data?.rows;
      if (!Array.isArray(rows)) return;

      const toNum = (v: unknown): number | null => {
        if (typeof v === "number") return Number.isFinite(v) ? v : null;
        if (typeof v === "string") {
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        }
        return null;
      };

      const top = rows
        .slice(0, 3)
        .map((item: any) => ({
          symbol: item.symbol || item.pair || item.ticker || "",
          change24h: toNum(item.changePct) ?? toNum(item.change24h) ?? toNum(item.priceChangePercent) ?? 0,
        }))
        .filter((item) => item.symbol);

      if (top.length > 0) {
        setTopGainers(top);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Error fetching gainers fallback:", error);
    }
  };

  useEffect(() => {
    // Try to load from cache first
    const hasCache = loadGainers();

    // If no cache, fetch as fallback
    if (!hasCache) {
      fetchGainersFallback();
    }

    // Listen for storage changes (auto-refresh from Gainers page)
    const handleStorageChange = () => {
      loadGainers();
    };
    window.addEventListener("storage", handleStorageChange);

    // Also check periodically for updates (in case both tabs are open)
    const interval = setInterval(loadGainers, 5000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPercent = (pct: number) => {
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  return (
    <Link to="/gainers" className="block h-full">
      <Card className="dashboard-card neon-hover bg-gradient-to-br from-green-500/10 to-green-500/20 h-auto sm:h-full cursor-pointer" style={{ "--neon-glow": "hsl(120, 100%, 40%)" } as React.CSSProperties}>
        <CardContent className="p-2 sm:p-3 md:p-4 lg:p-6 flex flex-col justify-start h-full">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">
                Top Gainers
              </h3>
              <p className="text-xs text-muted-foreground">Market Leaders</p>
            </div>
            <Award className="w-6 sm:w-8 h-6 sm:h-8 text-green-500 flex-shrink-0" />
          </div>

          {/* Top 3 Gainers List */}
          <div className="space-y-1.5 flex-1 mb-2">
            {topGainers.length > 0 ? (
              topGainers.map((gainer) => (
                <div key={gainer.symbol} className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-medium text-foreground">{stripUSDT(gainer.symbol)}</span>
                  <span className={`font-semibold ${gainer.change24h >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {formatPercent(gainer.change24h)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Loading gainers...</p>
            )}
          </div>

          {/* View More Link */}
          <div className="text-xs text-primary font-medium mb-2 hover:underline">
            view more →
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
