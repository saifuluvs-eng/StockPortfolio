import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

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
  const [gainers, setGainers] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const endpoints = ["/api/gainers", "/api/scan?mode=gainers", "/api/scan?type=gainers"];
        let payload: any = null;
        let list: SpotGainerRow[] = [];
        let success = false;
        let lastError: any = null;

        for (const endpoint of endpoints) {
          try {
            const res = await api(endpoint, { method: "GET" });
            if (!res.ok) {
              lastError = new Error(`[${endpoint}] HTTP ${res.status}`);
              console.error("[Gainers] error", lastError);
              continue;
            }

            const data: unknown = await res.json();
            payload = data;
            const rows = resolveRows(data) ?? [];
            list = rows;
            success = true;
            break;
          } catch (innerError) {
            console.error("[Gainers] error", innerError);
            lastError = innerError;
          }
        }

        if (!success) {
          throw lastError || new Error("Failed to load gainers.");
        }

        if (!active) return;
        console.log("[Gainers] fetched", payload);
        setGainers(list);
        setError(list.length ? null : "No gainers returned by API.");
      } catch (e: any) {
        if (!active) return;
        console.error("[Gainers] error", e);
        setError(e?.message || "Failed to load gainers.");
        setGainers([]);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const safeRows = useMemo<SpotGainerRow[]>(() => {
    return Array.isArray(gainers) ? (gainers as SpotGainerRow[]) : [];
  }, [gainers]);

  const cleaned = useMemo(() => {
    return safeRows.filter((r: any): r is SpotGainerRow => {
      return (
        r &&
        typeof r.symbol === "string" &&
        r.symbol.endsWith("USDT") &&
        Number.isFinite(r.price) &&
        r.price > 0 &&
        Number.isFinite(r.volume) &&
        r.volume > 0
      );
    });
  }, [safeRows]);

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

  if ((Array.isArray(gainers) && gainers.length === 0) || !cleaned.length) {
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
