import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoginGate } from "@/auth/useLoginGate";
import { go } from "@/lib/nav";

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });

const MIN_USD_VOL = 1_000_000;

const isLeveragedName = (s: string) => /(UP|DOWN|BULL|BEAR|3L|3S)(USDT)?$/i.test(s);

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
    <main className="p-4 text-zinc-200">
      <h1 className="mb-4 text-xl font-semibold">All Top Gainers</h1>
      <div className="rounded-xl border border-zinc-800 bg-black/40">
        <div className="space-y-2 p-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg bg-zinc-900/80" />
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
    <tr className="hidden border-t border-zinc-900 md:table-row">
      <td className="whitespace-nowrap px-4 py-3">{index + 1}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex flex-col">
          <span>{symbol}</span>
          {name && name !== symbol ? (
            <span className="text-xs text-zinc-500">{name}</span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">{formatPrice(price)}</td>
      <td className={`whitespace-nowrap px-4 py-3 text-right ${isUp ? "text-green-500" : "text-red-500"}`}>
        {isUp ? "+" : ""}
        {changeDisplay.toFixed(2)}%
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">{formattedVolume}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onAnalyse(symbol)}
          className="inline-block rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
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
    <div className="md:hidden flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-semibold">{symbol}</span>
          {name && name !== symbol ? (
            <span className="text-xs text-zinc-500">{name}</span>
          ) : null}
        </div>
        <span className="text-xs text-zinc-400">#{index + 1}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Price</p>
          <p className="font-semibold">{formatPrice(price)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">24h Change</p>
          <p className={`font-semibold ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}{changeDisplay.toFixed(2)}%
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-zinc-500">Volume</p>
          <p className="font-semibold">{formattedVolume}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAnalyse(symbol)}
        className="w-full rounded-lg border border-zinc-700 px-4 py-3 font-medium hover:bg-zinc-900 active:bg-zinc-800"
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { requireLogin } = useLoginGate();

  const handleAnalyseTicker = (ticker: string) => {
    if (requireLogin("/gainers")) return;
    go(`#/analyse/${ticker}`);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setRows(null);
      try {
        const [exRes, tRes] = await Promise.all([
          fetch("https://api.binance.com/api/v3/exchangeInfo"),
          fetch("https://api.binance.com/api/v3/ticker/24hr"),
        ]);

        if (!exRes.ok) throw new Error(`exchangeInfo HTTP ${exRes.status}`);
        if (!tRes.ok) throw new Error(`ticker24hr HTTP ${tRes.status}`);

        const ex = await exRes.json();
        const tickers: any[] = await tRes.json();

        const allowed = new Set<string>(
          (ex?.symbols ?? [])
            .filter(
              (s: any) =>
                s?.status === "TRADING" &&
                s?.quoteAsset === "USDT" &&
                (s?.isSpotTradingAllowed === true || (s?.permissions ?? []).includes("SPOT")),
            )
            .map((s: any) => String(s?.symbol)),
        );

        const top = tickers
          .filter((t: any) => {
            const sym = String(t?.symbol || "");
            if (!allowed.has(sym)) return false;
            if (isLeveragedName(sym)) return false;
            const volUSD = num(t?.quoteVolume);
            return volUSD >= MIN_USD_VOL;
          })
          .map((t: any) => ({
            symbol: t.symbol,
            name: t.symbol,
            price: num(t.lastPrice ?? t.prevClosePrice ?? t.weightedAvgPrice),
            change24h: num(t.priceChangePercent),
            volumeUSDT: num(t.quoteVolume),
          }))
          .sort((a: any, b: any) => b.change24h - a.change24h)
          .slice(0, 20);

        if (!cancelled) {
          if (top.length === 0)
            setError("No gainers matched the SPOT/USDT/$1M filters.");
          setRows(top);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load gainers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
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

  if (loading) {
    return <GainersSkeleton />;
  }

  if (error) {
    return <div className="text-sm opacity-75">{error}</div>;
  }

  if (!displayRows.length) {
    return <div>No gainers data available</div>;
  }

  return (
    <main className="p-4 text-zinc-200">
      <h1 className="mb-4 text-lg font-semibold md:text-xl">All Top Gainers</h1>

      <div className="hidden md:block overflow-hidden rounded-xl border border-zinc-800">
        <div className="h-[78vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-black/85 text-zinc-300 backdrop-blur">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left">Rank</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Symbol</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Price</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">24h Change</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Volume</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Quick Analysis</th>
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
