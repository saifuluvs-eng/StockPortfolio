import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });

// Try common fields; fall back to derived % if needed
const pct24 = (x: any): number => {
  const direct =
    x.price_change_percentage_24h ??
    x.percentChange24h ??
    x.change24h ??
    x.changePercent24h ??
    x.pct_change_24h ??
    x?.stats?.percentChange24h ??
    x.priceChangePercent; // Binance key
  if (direct !== undefined && direct !== null) {
    const n = Number(direct);
    return Number.isFinite(n) ? n : 0;
  }
  const price = x.price ?? x.last ?? x.close ?? x.c ?? x?.stats?.last;
  const prev = x.open24h ?? x.prev_close ?? x.previousClose ?? x.o ?? x?.stats?.prevClose;
  if (price != null && prev != null) {
    const p = Number(price);
    const pc = Number(prev);
    if (Number.isFinite(p) && Number.isFinite(pc) && pc !== 0) return ((p - pc) / pc) * 100;
  }
  return 0;
};

const symOf = (x: any) => (x.symbol ?? x.ticker ?? x.id ?? x.base ?? "").toString().toUpperCase();

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function priceOf(x: any): number | null {
  const sources = [x.price, x.last, x.close, x.c, x.lastPrice, x.markPrice, x?.stats?.last];
  for (const candidate of sources) {
    const num = toNumber(candidate);
    if (num !== null) return num;
  }
  return null;
}

function volumeOf(x: any): number | null {
  const sources = [
    x.volume,
    x.quoteVolume,
    x.baseVolume,
    x.vol,
    x.totalVolume,
    x.qv,
    x?.stats?.volume24h,
  ];
  for (const candidate of sources) {
    const num = toNumber(candidate);
    if (num !== null) return num;
  }
  return null;
}

function highOf(x: any): number | null {
  const sources = [x.high, x.highPrice, x.high24h, x.h, x?.stats?.high24h];
  for (const candidate of sources) {
    const num = toNumber(candidate);
    if (num !== null) return num;
  }
  return null;
}

function lowOf(x: any): number | null {
  const sources = [x.low, x.lowPrice, x.low24h, x.l, x?.stats?.low24h];
  for (const candidate of sources) {
    const num = toNumber(candidate);
    if (num !== null) return num;
  }
  return null;
}

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "$0";
  const fixed = value >= 1 ? value.toFixed(2) : value.toFixed(6);
  return `$${fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}`;
}

function formatHighLow(high: number | null, low: number | null): JSX.Element {
  return (
    <>
      H: {high === null ? "—" : `$${high.toFixed(4).replace(/(\.\d*?)0+$/, "$1")}`}
      <br />L: {low === null ? "—" : `$${low.toFixed(4).replace(/(\.\d*?)0+$/, "$1")}`}
    </>
  );
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
  high: number | null;
  low: number | null;
}

function GainerRow({ index, symbol, name, change24h, price, volume, high, low }: GainerRowProps) {
  const changeDisplay = Number.isFinite(change24h) ? change24h : 0;
  const isUp = changeDisplay >= 0;
  const formattedVolume = volume === null ? "—" : `$${numberFormatter.format(volume)}`;

  return (
    <tr className="border-t border-zinc-900">
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
      <td className="whitespace-nowrap px-4 py-3 text-right">{formatHighLow(high, low)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <a
          href={`/#/analyse/${symbol}`}
          className="inline-block rounded-lg border border-zinc-700 px-3 py-1 hover:bg-zinc-900"
        >
          Analyse
        </a>
      </td>
    </tr>
  );
}

interface DisplayRow {
  symbol: string;
  name: string;
  price: number | null;
  change24h: number;
  volume: number | null;
  high: number | null;
  low: number | null;
}

export default function Gainers() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const toList = (d: any) => (Array.isArray(d) ? d : d?.items ?? []);
    const tryOnce = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return toList(await r.json());
    };

    const pickTop = (list: any[], n = 20) =>
      list
        .map((x) => ({ ...x, _chg24: Number(pct24(x) || 0) }))
        .sort((a, b) => b._chg24 - a._chg24)
        .slice(0, n);

    const run = async () => {
      setLoading(true);
      setError(null);
      setRows(null);
      try {
        for (const u of ["/api/gainers", "/api/scan?mode=gainers", "/api/scan?type=gainers"]) {
          try {
            const list = await tryOnce(u);
            if (list?.length) {
              if (!cancelled) {
                setRows(pickTop(list));
              }
              return;
            }
          } catch {
            /* ignore */
          }
        }

        try {
          const wl = await tryOnce("/api/watchlist");
          if (wl?.length) {
            if (!cancelled) {
              setRows(pickTop(wl));
            }
            return;
          }
        } catch {
          /* ignore */
        }

        const rb = await fetch("https://api.binance.com/api/v3/ticker/24hr");
        if (rb.ok) {
          const all = await rb.json();
          const usdt = (all || []).filter(
            (it: any) => typeof it?.symbol === "string" && it.symbol.endsWith("USDT"),
          );
          const mapped = usdt.map((it: any) => ({
            symbol: it.symbol,
            name: it.symbol,
            price: Number(it.lastPrice ?? it.prevClosePrice ?? it.weightedAvgPrice ?? 0),
            price_change_percentage_24h: Number(it.priceChangePercent ?? 0),
          }));
          const top = pickTop(mapped);
          if (!cancelled) {
            if (top.length) {
              setRows(top);
            } else {
              setError("No gainers available from Binance.");
            }
          }
          return;
        }
        throw new Error(`Binance HTTP ${rb.status}`);
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
        const symbol = symOf(item);
        if (!symbol) return null;
        const price = priceOf(item);
        const high = highOf(item);
        const low = lowOf(item);
        return {
          symbol,
          name: item.name ?? item.fullName ?? symbol,
          price,
          change24h: Number.isFinite(item?._chg24) ? item._chg24 : pct24(item),
          volume: volumeOf(item),
          high: high ?? price,
          low: low ?? price,
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
      <h1 className="mb-4 text-xl font-semibold">All Top Gainers</h1>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <div className="h-[78vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-black/85 text-zinc-300 backdrop-blur">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left">Rank</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Symbol</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Price</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">24h Change</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Volume</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">High/Low</th>
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
                  high={row.high}
                  low={row.low}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
