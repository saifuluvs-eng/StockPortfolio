import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoginGate } from "@/auth/useLoginGate";
import { go } from "@/lib/nav";
import { RefreshCw } from "lucide-react";

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });
const CACHE_KEY = "gainers_data_cache";
const TIMESTAMP_KEY = "gainers_data_timestamp";

const MIN_USD_VOL = 1_000_000;

const isLeveragedName = (s: string) => /(UP|DOWN|BULL|BEAR|3L|3S)(USDT)?$/i.test(s);

const stripUSDT = (symbol: string): string => {
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
};

const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0";
  const fixed = value >= 1 ? value.toFixed(2) : value.toFixed(6);
  return `$${fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}`;
}

function GainersSkeleton() {
  return (
    <main className="p-4 text-foreground">
      <h1 className="mb-4 text-xl font-semibold">All Top Gainers</h1>
      <div className="rounded-xl border border-border bg-card">
        <div className="space-y-2 p-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    </main>
  );
}

interface GainerRowProps {
  index: number;
  symbol: string;
  name: string;
  change24h: number;
  price: number | null;
  volume: number | null;
  onAnalyse: (symbol: string) => void;
}

function GainerRow({ index, symbol, name, change24h, price, volume, onAnalyse }: GainerRowProps) {
  const changeDisplay = Number.isFinite(change24h) ? change24h : 0;
  const isUp = changeDisplay >= 0;
  const formattedVolume = volume === null ? "—" : `$${numberFormatter.format(volume)}`;

  return (
    <tr className="hidden border-t border-border md:table-row hover:bg-muted/30 transition-colors">
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{index + 1}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium">{stripUSDT(symbol)}</span>
          {name && name !== symbol ? (
            <span className="text-xs text-muted-foreground">{stripUSDT(name)}</span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatPrice(price)}</td>
      <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${isUp ? "text-emerald-500" : "text-destructive"}`}>
        {isUp ? "+" : ""}
        {changeDisplay.toFixed(2)}%
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">{formattedVolume}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onAnalyse(symbol)}
          className="inline-block rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 px-3 py-2 font-medium transition-all"
        >
          Analyse
        </button>
      </td>
    </tr>
  );
}

function GainerRowMobile({ index, symbol, name, change24h, price, volume, onAnalyse }: GainerRowProps) {
  const changeDisplay = Number.isFinite(change24h) ? change24h : 0;
  const isUp = changeDisplay >= 0;
  const formattedVolume = volume === null ? "—" : `$${numberFormatter.format(volume)}`;

  return (
    <div className="md:hidden flex flex-col gap-3 rounded-lg border border-border bg-card p-4 hover:bg-card/80 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{stripUSDT(symbol)}</span>
          {name && name !== symbol ? (
            <span className="text-xs text-muted-foreground">{stripUSDT(name)}</span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="font-semibold text-foreground">{formatPrice(price)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">24h Change</p>
          <p className={`font-semibold ${isUp ? "text-emerald-500" : "text-destructive"}`}>
            {isUp ? "+" : ""}{changeDisplay.toFixed(2)}%
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Volume</p>
          <p className="font-semibold text-muted-foreground">{formattedVolume}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAnalyse(symbol)}
        className="w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 px-4 py-3 font-medium transition-all"
      >
        Analyse
      </button>
    </div>
  );
}

interface DisplayRow {
  symbol: string;
  name: string;
  price: number | null;
  change24h: number;
  volume: number | null;
}

export default function Gainers() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { requireLogin } = useLoginGate();

  const handleAnalyseTicker = (ticker: string) => {
    if (requireLogin("/gainers")) return;
    go(`#/analyse/${ticker}`);
  };

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
      setInitialLoading(true);
    }
    setError(null);
    try {
      // Try backend endpoint first (works on Replit)
      const res = await fetch("/api/market/gainers");
      if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);

      const data = await res.json();
      const rows = Array.isArray(data) ? data : data?.rows;
      if (!Array.isArray(rows)) throw new Error("Invalid response format");

      const top = rows
        .map((t: any) => ({
          symbol: t.symbol || "",
          name: t.symbol || "",
          price: num(t.price),
          change24h: num(t.changePct),
          volumeUSDT: num(t.volume),
        }))
        .filter((item) => item.symbol)
        .slice(0, 20);

      if (top.length === 0)
        setError("No gainers data available.");

      const now = new Date();
      setRows(top);
      setLastUpdated(now);

      // Cache the data and timestamp
      localStorage.setItem(CACHE_KEY, JSON.stringify(top));
      localStorage.setItem(TIMESTAMP_KEY, now.toISOString());
    } catch (e: any) {
      console.error("[Gainers] Fetch error:", e?.message);
      setError(e?.message || "Failed to load gainers.");
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Load from cache first for instant display (no loading state)
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(TIMESTAMP_KEY);

    if (cachedData && cachedTimestamp) {
      try {
        setRows(JSON.parse(cachedData));
        setLastUpdated(new Date(cachedTimestamp));
        setInitialLoading(false);
        // Fetch fresh data silently in background
        fetch("/api/market/gainers")
          .then(res => res.json())
          .then(data => {
            const rows = Array.isArray(data) ? data : data?.rows;
            if (Array.isArray(rows)) {
              const top = rows
                .map((t: any) => ({
                  symbol: t.symbol || "",
                  name: t.symbol || "",
                  price: num(t.price),
                  change24h: num(t.changePct),
                  volumeUSDT: num(t.volume),
                }))
                .filter((item) => item.symbol)
                .slice(0, 20);
              const now = new Date();
              setRows(top);
              setLastUpdated(now);
              localStorage.setItem(CACHE_KEY, JSON.stringify(top));
              localStorage.setItem(TIMESTAMP_KEY, now.toISOString());
            }
          })
          .catch(() => {
            // Silent fail, keep cached data
          });
        return;
      } catch {
        // Cache corrupted, will fetch fresh below
      }
    }

    // No cache, do full load
    fetchData(false);
  }, []);

  // Auto-refresh every 10-15 minutes
  useEffect(() => {
    const randomInterval = 10 + Math.random() * 5; // 10-15 minutes
    const intervalMs = randomInterval * 60 * 1000;

    console.log(`[Gainers] Auto-refresh configured for ${randomInterval.toFixed(1)} minutes`);

    const intervalId = setInterval(() => {
      console.log(`[Gainers] ✓ Auto-refreshing data now...`);
      fetchData(true);
    }, intervalMs);

    return () => {
      console.log(`[Gainers] Auto-refresh cleared on unmount`);
      clearInterval(intervalId);
    };
  }, []);

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const symbol = String(item?.symbol ?? "");
        if (!symbol) return null;
        const rawPrice = item?.price;
        const rawVolume = item?.volumeUSDT ?? item?.volume;
        return {
          symbol,
          name: item?.name ?? symbol,
          price:
            rawPrice === null || rawPrice === undefined ? null : num(rawPrice),
          change24h: num(item?.change24h),
          volume:
            rawVolume === null || rawVolume === undefined ? null : num(rawVolume),
        };
      })
      .filter((item): item is DisplayRow => Boolean(item));
  }, [rows]);

  if (initialLoading) {
    return <GainersSkeleton />;
  }

  if (error && !displayRows.length) {
    return <div className="text-sm text-destructive p-4">{error}</div>;
  }

  if (!displayRows.length) {
    return <div>No gainers data available</div>;
  }

  return (
    <main className="w-full max-w-full overflow-x-hidden text-foreground px-3 sm:px-4 md:px-6 py-4">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold md:text-lg">Top Gainers</h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {formatTimestamp(lastUpdated)}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 border-2 border-primary text-primary bg-transparent hover:bg-primary/10 active:bg-primary/20 rounded-lg px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">{isRefreshing ? "Refreshing…" : "Refresh"}</span>
        </button>
      </div>

      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-[78vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/50 text-muted-foreground backdrop-blur">
              <tr className="border-b border-border">
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Rank</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Symbol</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Price</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">24h Change</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Volume</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Quick Analysis</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <GainerRow
                  key={`${row.symbol}-${index}`}
                  index={index}
                  symbol={row.symbol}
                  name={row.name}
                  change24h={row.change24h}
                  price={row.price}
                  volume={row.volume}
                  onAnalyse={handleAnalyseTicker}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {displayRows.map((row, index) => (
          <GainerRowMobile
            key={`${row.symbol}-${index}`}
            index={index}
            symbol={row.symbol}
            name={row.name}
            change24h={row.change24h}
            price={row.price}
            volume={row.volume}
            onAnalyse={handleAnalyseTicker}
          />
        ))}
      </div>
    </main>
  );
}
