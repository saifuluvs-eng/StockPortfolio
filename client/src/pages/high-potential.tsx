import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type {
  HighPotentialCoin,
  HighPotentialResponse,
  HighPotentialTimeframe,
} from "@shared/high-potential/types";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  deriveScannerState,
  loadCachedResponse,
  storeCachedResponse,
  type CachedHighPotentialEntry,
  type HighPotentialFiltersSnapshot,
} from "./high-potential-cache";

const STORAGE_KEY = "high-potential:filters";
const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000;

const DEFAULT_FILTERS: FilterState = {
  timeframe: "1d",
  minVolUSD: 2_000_000,
  capRange: [0, 2_000_000_000],
  excludeLeveraged: true,
  autoRefresh: true,
};

const TIMEFRAME_OPTIONS: HighPotentialTimeframe[] = ["1h", "4h", "1d"];

const ANALYSE_TIMEFRAME_PARAM: Record<HighPotentialTimeframe, string> = {
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

const currencyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const currencyStandard = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

type FilterState = {
  timeframe: HighPotentialTimeframe;
  minVolUSD: number;
  capRange: [number, number];
  excludeLeveraged: boolean;
  autoRefresh: boolean;
};

function loadInitialFilters(): FilterState {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_FILTERS;
    const parsed = JSON.parse(stored) as Partial<FilterState>;
    const timeframe = TIMEFRAME_OPTIONS.includes(parsed.timeframe as HighPotentialTimeframe)
      ? (parsed.timeframe as HighPotentialTimeframe)
      : DEFAULT_FILTERS.timeframe;
    const minVol = Number.isFinite(parsed.minVolUSD) ? Math.max(0, Number(parsed.minVolUSD)) : DEFAULT_FILTERS.minVolUSD;
    const excludeLeveraged = typeof parsed.excludeLeveraged === "boolean"
      ? parsed.excludeLeveraged
      : DEFAULT_FILTERS.excludeLeveraged;
    const autoRefresh = typeof parsed.autoRefresh === "boolean" ? parsed.autoRefresh : DEFAULT_FILTERS.autoRefresh;
    const capRangeArray = Array.isArray(parsed.capRange) ? parsed.capRange : DEFAULT_FILTERS.capRange;
    const capMin = Math.max(0, Number(capRangeArray?.[0] ?? DEFAULT_FILTERS.capRange[0]));
    const capMaxRaw = Number(capRangeArray?.[1] ?? DEFAULT_FILTERS.capRange[1]);
    const capMax = Number.isFinite(capMaxRaw) ? Math.max(capMin, capMaxRaw) : DEFAULT_FILTERS.capRange[1];
    return {
      timeframe,
      minVolUSD: minVol,
      capRange: [capMin, capMax],
      excludeLeveraged,
      autoRefresh,
    };
  } catch (error) {
    console.warn("Failed to load stored high potential filters", error);
    return DEFAULT_FILTERS;
  }
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000) return currencyCompact.format(value);
  if (value >= 1) return currencyStandard.format(value);
  if (value >= 0.1) return `$${value.toFixed(3)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return currencyCompact.format(value);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const formatted = abs >= 100 ? abs.toFixed(0) : abs >= 10 ? abs.toFixed(1) : abs.toFixed(2);
  return `${sign}${formatted}%`;
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value.toFixed(2)}×`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return decimalFormatter.format(value);
}

async function fetchHighPotential(filters: FilterState): Promise<HighPotentialResponse> {
  const params = new URLSearchParams();
  params.set("tf", filters.timeframe);
  params.set("minVolUSD", Math.round(filters.minVolUSD).toString());
  params.set("excludeLeveraged", String(filters.excludeLeveraged));
  params.set("capMin", Math.round(filters.capRange[0]).toString());
  params.set("capMax", Math.round(filters.capRange[1]).toString());

  const res = await fetch(`/api/high-potential?${params.toString()}`);
  if (!res.ok) {
    let message = "Failed to fetch high potential data";
    try {
      const errorPayload = (await res.json()) as { error?: string };
      if (errorPayload && typeof errorPayload.error === "string" && errorPayload.error.trim().length > 0) {
        message = errorPayload.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return (await res.json()) as HighPotentialResponse;
}

export default function HighPotentialPage() {
  const [filters, setFilters] = useState<FilterState>(() => loadInitialFilters());
  const { timeframe, minVolUSD, capRange, excludeLeveraged } = filters;
  const [capMin, capMax] = capRange;
  const filtersSnapshot = useMemo<HighPotentialFiltersSnapshot>(
    () => ({
      tf: timeframe,
      minVolUSD,
      capRange: [capMin, capMax],
      excludeLeveraged,
    }),
    [timeframe, minVolUSD, capMin, capMax, excludeLeveraged],
  );
  const [cachedEntry, setCachedEntry] = useState<CachedHighPotentialEntry | null>(() => {
    if (typeof window === "undefined") return null;
    return loadCachedResponse(window.localStorage, filtersSnapshot);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCachedEntry(loadCachedResponse(window.localStorage, filtersSnapshot));
  }, [filtersSnapshot]);

  const queryKey = useMemo(
    () => [
      "high-potential",
      filters.timeframe,
      filters.minVolUSD,
      filters.capRange[0],
      filters.capRange[1],
      filters.excludeLeveraged,
    ],
    [filters.timeframe, filters.minVolUSD, filters.capRange, filters.excludeLeveraged],
  );

  const query = useQuery<HighPotentialResponse>({
    queryKey,
    queryFn: () => fetchHighPotential(filters),
    refetchInterval: filters.autoRefresh ? AUTO_REFRESH_INTERVAL : false,
    placeholderData: (previousData) => previousData,
    staleTime: 0,
  });

  const { data: queryData, isLoading, isFetching, refetch, error } = query;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!query.data || query.dataUpdatedAt === 0) return;
    setCachedEntry(storeCachedResponse(window.localStorage, filtersSnapshot, query.data));
  }, [filtersSnapshot, query.data, query.dataUpdatedAt]);

  const { resolvedData, errorBannerMessage, showUnavailableState } = deriveScannerState({
    queryData,
    queryError: error,
    cachedEntry,
  });

  const handleTimeframeChange = (value: string) => {
    if (TIMEFRAME_OPTIONS.includes(value as HighPotentialTimeframe)) {
      setFilters((prev) => ({ ...prev, timeframe: value as HighPotentialTimeframe }));
    }
  };

  const handleMinVolumeChange = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setFilters((prev) => ({ ...prev, minVolUSD: Math.max(0, parsed) }));
  };

  const handleCapChange = (index: 0 | 1, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setFilters((prev) => {
      const next: [number, number] = [...prev.capRange];
      next[index] = Math.max(0, parsed);
      if (index === 0 && next[1] < next[0]) next[1] = next[0];
      if (index === 1 && next[1] < next[0]) next[0] = next[1];
      return { ...prev, capRange: next };
    });
  };

  const handleExcludeLeveragedChange = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, excludeLeveraged: checked }));
  };

  const handleAutoRefreshChange = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, autoRefresh: checked }));
  };

  const topCoins = resolvedData?.top ?? [];
  const buckets = resolvedData?.buckets ?? { breakoutZone: [], oversoldRecovery: [], strongMomentum: [] };
  const scannerUnavailableMessage = "Scanner data is unavailable right now. Please try again later.";

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold text-foreground whitespace-normal break-keep">High Potential Scanner</h1>
          <p className="text-sm text-muted-foreground">
            Ranked crypto setups combining momentum, volume, breakout proximity, market cap and social sentiment on Binance
            USDT pairs.
          </p>
        </div>

        {errorBannerMessage && (
          <Alert
            variant="destructive"
            className="border-red-500/60 bg-red-500/10 text-red-200"
            data-testid="scanner-error-banner"
          >
            <AlertTitle>Scanner issue</AlertTitle>
            <AlertDescription>{errorBannerMessage}</AlertDescription>
          </Alert>
        )}

        {resolvedData?.dataStale && (
          <Alert variant="warning" className="border-amber-500/60 bg-amber-500/10 text-amber-100">
            <AlertTitle>Showing cached results</AlertTitle>
            <AlertDescription>Scanner limits hit. Displaying the last successful scan while we retry.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Scanner Controls</CardTitle>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Timeframe</Label>
              <ToggleGroup
                type="single"
                value={filters.timeframe}
                onValueChange={handleTimeframeChange}
                className="flex w-full min-w-0 flex-wrap gap-2 overflow-hidden"
              >
                {TIMEFRAME_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="flex-1 min-w-0 truncate"
                    aria-label={`Timeframe ${option}`}
                  >
                    {option.toUpperCase()}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="min-vol" className="text-xs uppercase text-muted-foreground">
                Min 24h Volume (USD)
              </Label>
              <Input
                id="min-vol"
                type="number"
                min={0}
                step={100000}
                value={filters.minVolUSD}
                onChange={(event) => handleMinVolumeChange(event.target.value)}
              />
            </div>

            <div className="min-w-0 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Market Cap Range (USD)</Label>
              <div className="grid gap-2 lg:grid-cols-2">
                <Input
                  type="number"
                  min={0}
                  step={1000000}
                  value={filters.capRange[0]}
                  onChange={(event) => handleCapChange(0, event.target.value)}
                  aria-label="Minimum market cap"
                />
                <Input
                  type="number"
                  min={filters.capRange[0]}
                  step={1000000}
                  value={filters.capRange[1]}
                  onChange={(event) => handleCapChange(1, event.target.value)}
                  aria-label="Maximum market cap"
                />
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Exclude Leveraged Tokens</Label>
              <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:justify-between">
                <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">Exclude leveraged products</span>
                <Switch checked={filters.excludeLeveraged} onCheckedChange={handleExcludeLeveragedChange} />
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Auto Refresh (10 min)</Label>
              <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-hidden rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:justify-between">
                <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">Auto refresh results</span>
                <Switch checked={filters.autoRefresh} onCheckedChange={handleAutoRefreshChange} />
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-end gap-2">
              <Button onClick={() => refetch()} disabled={isFetching} className="w-full">
                Refresh Now
              </Button>
              {isFetching && <p className="text-xs text-muted-foreground">Updating…</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 overflow-hidden">
          <h2 className="text-lg font-semibold whitespace-normal break-keep">Top 10 High Potentials</h2>
          <span className="min-w-0 truncate whitespace-nowrap text-xs text-muted-foreground">
            Updated {isFetching
              ? "just now"
              : resolvedData
                ? new Date(resolvedData.top[0]?.updatedAt * 1000 || Date.now()).toLocaleTimeString()
                : "—"}
          </span>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <LoadingCard key={`loading-${index}`} />
            ))}
          </div>
        ) : showUnavailableState ? (
          <EmptyState message={scannerUnavailableMessage} />
        ) : topCoins.length > 0 ? (
          <div className="grid gap-4">
            {topCoins.map((coin) => (
              <HighPotentialCard key={coin.symbol} coin={coin} timeframe={filters.timeframe} />
            ))}
          </div>
        ) : (
          <EmptyState message="No symbols match your filters. Try reducing the minimum volume or widening the market cap range." />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold whitespace-normal break-keep">Opportunity Buckets</h2>
        <Tabs defaultValue="breakout" className="w-full">
          <TabsList className="mb-3 w-full justify-start gap-2 overflow-x-auto">
            <TabsTrigger value="breakout" className="min-w-0 overflow-hidden text-ellipsis">
              Breakout Zone ({buckets.breakoutZone.length})
            </TabsTrigger>
            <TabsTrigger value="recovery" className="min-w-0 overflow-hidden text-ellipsis">
              Oversold Recovery ({buckets.oversoldRecovery.length})
            </TabsTrigger>
            <TabsTrigger value="momentum" className="min-w-0 overflow-hidden text-ellipsis">
              Strong Momentum ({buckets.strongMomentum.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="breakout">
            <BucketList
              coins={buckets.breakoutZone}
              timeframe={filters.timeframe}
              emptyMessage="No coins are currently within 2.5% of resistance with elevated volume."
              isUnavailable={showUnavailableState}
              unavailableMessage={scannerUnavailableMessage}
            />
          </TabsContent>
          <TabsContent value="recovery">
            <BucketList
              coins={buckets.oversoldRecovery}
              timeframe={filters.timeframe}
              emptyMessage="No oversold recoveries detected under the current filters."
              isUnavailable={showUnavailableState}
              unavailableMessage={scannerUnavailableMessage}
            />
          </TabsContent>
          <TabsContent value="momentum">
            <BucketList
              coins={buckets.strongMomentum}
              timeframe={filters.timeframe}
              emptyMessage="No strong momentum plays matched this scan."
              isUnavailable={showUnavailableState}
              unavailableMessage={scannerUnavailableMessage}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

type BucketListProps = {
  coins: HighPotentialCoin[];
  timeframe: HighPotentialTimeframe;
  emptyMessage: string;
  isUnavailable: boolean;
  unavailableMessage: string;
};

function BucketList({ coins, timeframe, emptyMessage, isUnavailable, unavailableMessage }: BucketListProps) {
  if (isUnavailable) {
    return <EmptyState message={unavailableMessage} />;
  }
  if (!coins.length) {
    return <EmptyState message={emptyMessage} />;
  }
  return (
    <div className="grid gap-4">
      {coins.map((coin) => (
        <HighPotentialCard key={`${coin.symbol}-${coin.bucket}`} coin={coin} timeframe={timeframe} compact />
      ))}
    </div>
  );
}

type CardProps = {
  coin: HighPotentialCoin;
  timeframe: HighPotentialTimeframe;
  compact?: boolean;
};

function HighPotentialCard({ coin, timeframe, compact = false }: CardProps) {
  const price = formatPrice(coin.price);
  const changePct = formatPercent(coin.change24hPct);
  const changePositive = Number.isFinite(coin.change24hPct) && coin.change24hPct >= 0;
  const distancePct = formatPercent(coin.breakoutDistancePct);
  const dayVolumeRatio = coin.vol7dAvg > 0 ? coin.vol24h / coin.vol7dAvg : 0;
  const chartPath = `/analyse/${coin.baseAsset}?tf=${ANALYSE_TIMEFRAME_PARAM[timeframe] ?? "240"}`;
  const sparklineData = coin.sparkline ?? [];
  const sparkId = compact ? `spark-${coin.symbol}-compact` : `spark-${coin.symbol}`;

  return (
    <Card className={cn("border-border/60", compact && "bg-muted/30")}>
      <CardHeader className="flex min-w-0 flex-col gap-4 pb-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback>{coin.baseAsset.slice(0, 3)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">
                <CardTitle className="min-w-0 truncate text-base font-semibold leading-tight">
                  {coin.name}
                </CardTitle>
                <Badge variant="secondary" className="truncate whitespace-nowrap text-xs">
                  Score {coin.score}
                </Badge>
                {coin.bucket && (
                  <Badge className="truncate whitespace-nowrap text-xs" variant="outline">
                    {coin.bucket}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{coin.symbol}</div>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden sm:justify-end">
            <Badge className={cn("min-w-0 truncate whitespace-nowrap text-xs", confidenceVariant(coin.confidence))}>
              {coin.confidence} confidence
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link to={chartPath}>View Chart</Link>
            </Button>
          </div>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Metric label="Price" value={price} />
          <Metric
            label="24h Change"
            value={changePct}
            valueClassName={changePositive ? "text-emerald-500" : "text-red-500"}
          />
          <Metric label="Market Cap" value={formatCompactCurrency(coin.marketCap)} />
          <Metric label="24h Volume" value={formatCompactCurrency(coin.vol24h)} />
          <Metric label="Vol 7d Avg" value={formatCompactCurrency(coin.vol7dAvg)} />
          <Metric label="Dist. to Resistance" value={distancePct} />
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap gap-4 overflow-hidden text-sm text-muted-foreground">
            <span className="whitespace-nowrap">RSI {formatNumber(coin.rsi)}</span>
            <span className="whitespace-nowrap">MACD Hist {formatNumber(coin.macd.histogram)}</span>
            <span className="whitespace-nowrap">ADX {formatNumber(coin.adx.adx)}</span>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2 overflow-hidden text-xs">
            <Badge variant="secondary" className="truncate whitespace-nowrap">
              24h vs 7d {formatRatio(dayVolumeRatio)}
            </Badge>
            <Badge variant="outline" className="truncate whitespace-nowrap">
              Intra-TF {formatRatio(coin.intraTFVolRatio)}
            </Badge>
          </div>
        </div>
        <div className="flex w-full max-w-[180px] min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">7D Sparkline</span>
          {sparklineData.length > 1 ? (
            <div className="h-12 text-primary">
              <Sparkline data={sparklineData} id={sparkId} />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Not enough data</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
function confidenceVariant(confidence: HighPotentialCoin["confidence"]): string {
  switch (confidence) {
    case "High":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    case "Medium":
      return "bg-sky-500/10 text-sky-300 border border-sky-500/20";
    case "Watch":
      return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

type MetricProps = {
  label: string;
  value: string;
  valueClassName?: string;
};

function Metric({ label, value, valueClassName }: MetricProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="truncate text-xs uppercase text-muted-foreground">{label}</div>
      <div className={cn("truncate text-sm font-medium", valueClassName)}>{value}</div>
    </div>
  );
}

type SparklineProps = {
  data: number[];
  id: string;
};

function Sparkline({ data, id }: SparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 6, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="currentColor" stopOpacity={0.6} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke="currentColor"
          strokeWidth={2}
          fill={`url(#${id})`}
          fillOpacity={0.4}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function LoadingCard() {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-md" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}
