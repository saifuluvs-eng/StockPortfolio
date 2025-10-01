// client/src/pages/scan.tsx
import React, { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/ui";
import { ScannerSummaryStats } from "@/components/scanner/scan-summary-stats";

/**
 * Scan Page
 * - Minimal, safe client-side scan that fetches Binance 24h stats for entered coins
 */

type Row = {
  base: string; // e.g., BTC
  pair: string; // e.g., BTCUSDT
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  priceChangePercent: number;
};

const TIMEFRAMES = [
  { label: "15min", value: "15" },
  { label: "30min", value: "30" },
  { label: "1Hr", value: "60" },
  { label: "4hr", value: "240" },
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
];

// Helpers
function sanitizeBaseTicker(input: string): string {
  const lettersOnly =
    (input || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, " ")
      .trim()
      .split(/\s+/)[0] || "";
  if (lettersOnly.endsWith("USDT")) return lettersOnly.slice(0, -4);
  return lettersOnly;
}

function toUsdtPair(baseOrPair: string): string {
  const up = (baseOrPair || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!up) return "BTCUSDT";
  return up.endsWith("USDT") ? up : `${up}USDT`;
}

export default function Scan() {
  // UI filters
  const [coinsInput, setCoinsInput] = useState<string>("BTC, ETH, AVAX");
  const [timeframe, setTimeframe] = useState<string>("60"); // 1Hr default
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  // Quick summary for stat boxes
  const summary = useMemo(() => {
    if (!rows.length) {
      return {
        coins: 0,
        advancers: 0,
        decliners: 0,
        avgChange: 0,
      };
    }
    let adv = 0,
      dec = 0,
      sum = 0;
    for (const r of rows) {
      if (r.priceChangePercent > 0) adv++;
      else if (r.priceChangePercent < 0) dec++;
      sum += r.priceChangePercent;
    }
    return {
      coins: rows.length,
      advancers: adv,
      decliners: dec,
      avgChange: sum / rows.length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.base.toLowerCase().includes(q) ||
        r.pair.toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  async function runScan() {
    try {
      setLoading(true);
      setError(null);
      setRows([]);

      // Parse coins list
      const bases = coinsInput
        .split(/[,\n]/g)
        .map((s) => sanitizeBaseTicker(s.trim()))
        .filter(Boolean);

      if (!bases.length) {
        setError("Please enter at least one coin name (e.g., BTC, ETH).");
        setLoading(false);
        return;
      }

      // Fetch Binance 24h stats for each coin (USDT pairs)
      const results = await Promise.allSettled(
        bases.map(async (b) => {
          const pair = toUsdtPair(b);
          const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(
            pair
          )}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${pair} error: ${res.status}`);
          const j = await res.json();
          const row: Row = {
            base: b,
            pair,
            lastPrice: parseFloat(j.lastPrice),
            highPrice: parseFloat(j.highPrice),
            lowPrice: parseFloat(j.lowPrice),
            priceChangePercent: parseFloat(j.priceChangePercent),
          };
          return row;
        })
      );

      const ok: Row[] = [];
      const errs: string[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") ok.push(r.value);
        else errs.push((r.reason as Error)?.message || "Unknown error");
      }

      // Sort by % change desc
      ok.sort((a, b) => b.priceChangePercent - a.priceChangePercent);

      setRows(ok);
      if (errs.length) setError(errs.join(" • "));
    } catch (e: any) {
      setError(e?.message || "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  const hasResults = rows.length > 0;
  const hasFilteredResults = filteredRows.length > 0;

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground">Scan</h1>
          <p className="text-sm text-muted-foreground">
            Lightweight Binance market scanner for quick 24h performance checks.
          </p>
        </header>

        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-4">
            <div>
              <CardTitle className="text-xl font-semibold">Scanner Controls</CardTitle>
              <CardDescription>
                Enter coins, choose a timeframe, and fetch the latest Binance 24h stats.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Coin Names
                </label>
                <Textarea
                  value={coinsInput}
                  onChange={(e) => setCoinsInput(e.target.value)}
                  placeholder="BTC, ETH, AVAX"
                  className="min-h-[104px]"
                />
                <p className="text-xs text-muted-foreground">
                  Separate coins with commas or new lines.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Timeframe
                </label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEFRAMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex md:justify-end">
                <Button
                  onClick={runScan}
                  disabled={loading}
                  className="h-11 w-full md:w-auto"
                >
                  {loading ? "Scanning…" : "Run Scan"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:w-72">
              <label className="text-sm font-medium text-muted-foreground">
                Filter Results
              </label>
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search coin or pair"
              />
            </div>
          </CardContent>
        </Card>

        <ScannerSummaryStats
          coins={summary.coins}
          advancers={summary.advancers}
          decliners={summary.decliners}
          avgChange={summary.avgChange}
          hasResults={hasResults}
        />

        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-0">
            <CardTitle className="text-xl font-semibold">Scan Results</CardTitle>
            <CardDescription>
              {loading
                ? "Fetching latest data…"
                : hasResults
                ? `Showing ${hasFilteredResults ? filteredRows.length : rows.length} of ${rows.length} pairs.`
                : "Results will appear after you run a scan."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {!hasResults && !loading ? (
              <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
                No results yet. Enter coin names and click <span className="font-semibold text-foreground">Run Scan</span>.
              </div>
            ) : null}

            {hasResults && !hasFilteredResults && !loading ? (
              <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
                No pairs match your current filter.
              </div>
            ) : null}

            {hasFilteredResults ? (
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Coin</TableHead>
                    <TableHead>Pair</TableHead>
                    <TableHead className="text-right">Last Price</TableHead>
                    <TableHead className="text-right">24h High</TableHead>
                    <TableHead className="text-right">24h Low</TableHead>
                    <TableHead className="text-right">24h %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r) => (
                    <TableRow key={r.pair}>
                      <TableCell className="font-medium text-foreground">{r.base}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{r.pair}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.lastPrice.toFixed(6)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.highPrice.toFixed(6)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.lowPrice.toFixed(6)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm font-semibold ${
                          r.priceChangePercent >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {r.priceChangePercent.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
