import { useEffect, useMemo, useState } from "react";

interface SpotGainerRow {
  symbol: string;
  price: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
}

function resolveRows(data: unknown): SpotGainerRow[] | null {
  if (!data) return null;

  if (Array.isArray(data)) {
    return data as SpotGainerRow[];
  }

  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.rows)) {
      return record.rows as SpotGainerRow[];
    }

    if (Array.isArray(record.items)) {
      return record.items as SpotGainerRow[];
    }

    const nested = record.data;
    if (Array.isArray(nested)) {
      return nested as SpotGainerRow[];
    }

    if (nested && typeof nested === "object") {
      const nestedRows = resolveRows(nested);
      if (nestedRows) {
        return nestedRows;
      }
    }
  }

  return null;
}

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });

export default function Gainers() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tryUrls = async () => {
      const urls = [
        "/api/gainers",
        "/api/scan?mode=gainers",
        "/api/scan?type=gainers",
      ];

      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            continue;
          }

          const data = await response.json();
          if (cancelled) return;
          const list = resolveRows(data) ?? [];
          if (list.length) {
            setRows(list);
            setError(null);
            setLoading(false);
            return;
          }
        } catch {}
      }

      try {
        const response = await fetch("/api/watchlist");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data?.items ?? []);
        const withChange = (Array.isArray(list) ? list : [])
          .map((item: any) => ({
            ...item,
            _chg:
              item?.percentChange24h ??
              item?.change24h ??
              item?.pct_change_24h ??
              item?.priceChangePercent ??
              0,
          }))
          .sort((a: any, b: any) => (Number(b?._chg) || 0) - (Number(a?._chg) || 0))
          .slice(0, 20);

        setRows(withChange);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "No gainers endpoint available.");
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setError(null);
    setRows(null);
    void tryUrls();

    return () => {
      cancelled = true;
    };
  }, []);

  const processedRows = useMemo<SpotGainerRow[]>(() => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item: any): SpotGainerRow | null => {
        if (!item || typeof item !== "object") return null;

        const rawSymbol =
          typeof item.symbol === "string"
            ? item.symbol
            : typeof (item as any).pair === "string"
            ? (item as any).pair
            : typeof (item as any).asset === "string"
            ? (item as any).asset
            : typeof (item as any).ticker === "string"
            ? (item as any).ticker
            : "";

        const symbol = (rawSymbol || "").toUpperCase();
        if (!symbol) return null;

        const pickNumber = (values: any[], fallback = 0) => {
          for (const value of values) {
            const num = Number(value);
            if (Number.isFinite(num)) return num;
          }
          return fallback;
        };

        const price = pickNumber(
          [item.price, item.lastPrice, item.close, item.last, item.markPrice],
          0,
        );
        const changePct = pickNumber(
          [
            item.changePct,
            item.percentChange24h,
            item.change24h,
            item.pct_change_24h,
            item.priceChangePercent,
            item._chg,
          ],
          0,
        );
        const volume = pickNumber(
          [item.volume, item.quoteVolume, item.baseVolume, item.vol, item.totalVolume],
          0,
        );
        const high = pickNumber([item.high, item.highPrice, item.high24h], price);
        const low = pickNumber([item.low, item.lowPrice, item.low24h], price);

        return {
          symbol,
          price,
          changePct,
          volume,
          high,
          low,
        };
      })
      .filter((item): item is SpotGainerRow => Boolean(item));
  }, [rows]);

  const cleaned = useMemo(() => {
    return processedRows.filter((r) => typeof r.symbol === "string" && r.symbol.endsWith("USDT"));
  }, [processedRows]);

  if (loading) {
    return (
      <main className="p-4 text-zinc-200">
        <h1 className="text-xl font-semibold mb-4">All Top Gainers</h1>
        <div className="rounded-xl border border-zinc-800">
          <div className="py-10 text-center text-zinc-400">Loading gainers...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-4 text-zinc-200">
        <h1 className="text-xl font-semibold mb-4">All Top Gainers</h1>
        <div className="rounded-xl border border-zinc-800">
          <div className="py-10 text-center text-red-400">{error}</div>
        </div>
      </main>
    );
  }

  if ((Array.isArray(rows) && rows.length === 0) || !cleaned.length) {
    return (
      <main className="p-4 text-zinc-200">
        <h1 className="text-xl font-semibold mb-4">All Top Gainers</h1>
        <div className="rounded-xl border border-zinc-800">
          <div className="py-10 text-center text-zinc-400">No gainers data available.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 text-zinc-200">
      <h1 className="text-xl font-semibold mb-4">All Top Gainers</h1>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="h-[78vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/85 backdrop-blur z-10">
              <tr className="text-zinc-300">
                <th className="py-3 px-4 text-left whitespace-nowrap">Rank</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">Symbol</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Price</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">24h Change</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Volume</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">High/Low</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Quick Analysis</th>
              </tr>
            </thead>
            <tbody>
              {cleaned.map((r, i) => (
                <tr key={r.symbol} className="border-t border-zinc-900">
                  <td className="py-3 px-4 whitespace-nowrap">{i + 1}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{r.symbol}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    ${r.price.toFixed(6).replace(/\.?0+$/, "")}
                  </td>
                  <td
                    className={`py-3 px-4 text-right whitespace-nowrap ${
                      r.changePct >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {r.changePct >= 0 ? "+" : ""}
                    {r.changePct.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    ${numberFormatter.format(r.volume)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    H: ${r.high.toFixed(4)}
                    <br />L: ${r.low.toFixed(4)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <a
                      href={`/#/analyse/${r.symbol}`}
                      className="inline-block rounded-lg px-3 py-1 border border-zinc-700 hover:bg-zinc-900"
                    >
                      Analyse
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
