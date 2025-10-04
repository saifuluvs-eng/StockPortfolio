import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

interface SpotGainerRow {
  symbol: string;
  price: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
}

type SpotGainerResponse = {
  rows: SpotGainerRow[];
};

async function fetchFromAppAPI(): Promise<SpotGainerRow[] | null> {
  try {
    const res = await api("/api/market/gainers");
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (typeof data === "object" && data !== null && Array.isArray((data as SpotGainerResponse).rows)) {
      return (data as SpotGainerResponse).rows;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFromBinance(): Promise<SpotGainerRow[]> {
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    if (!res.ok) return [];
    const stats = (await res.json()) as any[];
    return stats
      .filter((t) => typeof t?.symbol === "string" && t.symbol.endsWith("USDT"))
      .map((t) => ({
        symbol: String(t.symbol),
        price: Number(t.lastPrice ?? 0),
        changePct: Number(t.priceChangePercent ?? 0),
        volume: Number(t.quoteVolume ?? 0),
        high: Number(t.highPrice ?? 0),
        low: Number(t.lowPrice ?? 0),
      }))
      .sort((a, b) => b.changePct - a.changePct);
  } catch {
    return [];
  }
}

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });

export default function Gainers() {
  const { data, isLoading } = useQuery<SpotGainerResponse>({
    queryKey: ["gainers", "spot-usdt"],
    queryFn: async () => {
      const appRows = await fetchFromAppAPI();
      if (appRows && appRows.length) {
        return { rows: appRows };
      }

      const fallback = await fetchFromBinance();
      return { rows: fallback };
    },
    staleTime: 30_000,
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);

  if (isLoading) {
    return (
      <main className="p-4 text-zinc-200">
        <h1 className="text-xl font-semibold mb-4">All Top Gainers</h1>
        <div className="rounded-xl border border-zinc-800">
          <div className="py-10 text-center text-zinc-400">Loading gainers...</div>
        </div>
      </main>
    );
  }

  if (!rows.length) {
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

      <div className="rounded-xl border border-zinc-800">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/80 backdrop-blur z-10">
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
              {rows.map((r, i) => (
                <tr key={r.symbol} className="border-t border-zinc-900">
                  <td className="py-3 px-4 whitespace-nowrap">{i + 1}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{r.symbol}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    ${r.price.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}
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
                      href={`/analyse?symbol=${encodeURIComponent(r.symbol)}`}
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
