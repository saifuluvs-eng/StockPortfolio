import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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

async function fetchGainers(): Promise<SpotGainerResponse> {
  try {
    const res = await api("/api/market/gainers");
    if (!res.ok) {
      throw new Error("Failed to fetch gainers");
    }

    const data: unknown = await res.json();
    if (typeof data === "object" && data !== null && Array.isArray((data as SpotGainerResponse).rows)) {
      return data as SpotGainerResponse;
    }

    throw new Error("Invalid gainers response");
  } catch (error) {
    console.error(error);
    return { rows: [] };
  }
}

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });

export default function Gainers() {
  const { data, isLoading } = useQuery<SpotGainerResponse>({
    queryKey: ["gainers", "spot-usdt"],
    queryFn: fetchGainers,
    staleTime: 30_000,
  });

  const cleaned = useMemo(() => {
    return (data?.rows ?? []).filter((r: any): r is SpotGainerRow => {
      return (
        r &&
        typeof r.symbol === "string" &&
        /USDT$/.test(r.symbol) &&
        Number.isFinite(r.price) &&
        r.price > 0 &&
        Number.isFinite(r.volume) &&
        r.volume > 0 &&
        Number.isFinite(r.high) &&
        r.high > 0 &&
        Number.isFinite(r.low) &&
        r.low > 0
      );
    });
  }, [data]);

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

  if (!cleaned.length) {
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
