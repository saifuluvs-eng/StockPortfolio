import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PriceActionPlaceholder from "@/components/scanner/price-action-placeholder";
import TechnicalIndicators from "@/components/scanner/technical-indicators";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { asArray, asString } from "@/lib/utils";
import { extractScanResult } from "@/lib/scanner-results";
import { useAuth } from "@/hooks/useAuth";
import { toBinance } from "@/lib/symbols";
import { useRoute, useLocation } from "wouter";
import type { ScanResult } from "@shared/types/scanner";
import { useLoginGate } from "@/auth/useLoginGate";
import {
  Activity,
  BarChart3,
  Clock3,
  DollarSign,
  History,
  ListChecks,
  RefreshCw,
  Search,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { openSpotTickerStream } from "@/lib/binanceWs";

interface PriceData {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

interface WatchlistItem {
  id: string;
  symbol: string;
  createdAt?: number | string | null;
}

interface ScanHistoryItem {
  id: string;
  scanType: string;
  filters?: { symbol?: string; timeframe?: string } | null;
  results?: ScanResult | null;
  createdAt?: number | string | null;
}

const DEFAULT_TIMEFRAME = "240"; // 4h
const DEFAULT_SYMBOL = "BTCUSDT";

const TIMEFRAMES = [
  { value: "15", label: "15min", display: "15m", backend: "15m" },
  { value: "60", label: "1hr", display: "1h", backend: "1h" },
  { value: "240", label: "4hr", display: "4h", backend: "4h" },
  { value: "D", label: "1Day", display: "1D", backend: "1d" },
  { value: "W", label: "1Week", display: "1W", backend: "1w" },
] as const;

function toUsdtSymbol(input: string) {
  const coin = (input || "").trim().toUpperCase();
  if (!coin) return DEFAULT_SYMBOL;
  return coin.endsWith("USDT") ? coin : `${coin}USDT`;
}

function displayPair(sym: string) {
  const s = (sym || "").toUpperCase();
  return s.endsWith("USDT") ? `${s.slice(0, -4)}/USDT` : (s || DEFAULT_SYMBOL);
}

function toFrontendTimeframe(value: string | undefined) {
  if (!value) return DEFAULT_TIMEFRAME;
  const match = TIMEFRAMES.find((tf) => tf.backend === value || tf.value === value);
  return match?.value ?? DEFAULT_TIMEFRAME;
}

function formatRelativeTime(input?: number | string | null) {
  if (!input && input !== 0) return "";
  const date = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function mergeSearchParams(hashSearch: string) {
  const merged = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "",
  );

  if (hashSearch) {
    const hashParams = new URLSearchParams(hashSearch);
    hashParams.forEach((value, key) => {
      merged.set(key, value);
    });
  }

  return merged.toString();
}

function clearWindowSearch() {
  if (typeof window === "undefined") return;
  if (!window.location.search) return;

  const url = new URL(window.location.href);
  if (!url.search) return;

  url.search = "";
  window.history.replaceState(null, "", url.toString());
}

export default function Charts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const { requireLogin } = useLoginGate();

  const [matchWithParam, params] = useRoute("/charts/:symbol?");
  const [location, setLocation] = useLocation();

  const locationInfo = useMemo(() => {
    const rawLocation = location ?? "";
    const withoutHash = rawLocation.startsWith("#")
      ? rawLocation.slice(1)
      : rawLocation;
    const [pathPart = "", hashSearch = ""] = withoutHash.split("?");
    const normalizedPath = pathPart
      ? pathPart.startsWith("/")
        ? pathPart
        : `/${pathPart}`
      : "/";
    return {
      path: normalizedPath,
      hashSearch,
      search: mergeSearchParams(hashSearch),
    };
  }, [location]);

  const redirectPath = useMemo(() => {
    const search = locationInfo.search;
    return search ? `${locationInfo.path}?${search}` : locationInfo.path;
  }, [locationInfo.path, locationInfo.search]);

  const urlParams = useMemo(
    () => new URLSearchParams(locationInfo.search),
    [locationInfo.search],
  );

  const querySymbol = urlParams.get("symbol");
  const shouldAutoScan = urlParams.get("scan") === "true";
  const queryTimeframe = urlParams.get("tf");

  const initialSymbol = toUsdtSymbol(params?.symbol || querySymbol || DEFAULT_SYMBOL);
  const initialTimeframe = toFrontendTimeframe(queryTimeframe || undefined);

  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(initialTimeframe);
  const syncingFromQueryRef = useRef(false);
  const [searchInput, setSearchInput] = useState<string>(() => {
    const base = initialSymbol.endsWith("USDT") ? initialSymbol.slice(0, -4) : initialSymbol;
    return base || "BTC";
  });
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    const nextSymbol = toUsdtSymbol(params?.symbol || querySymbol || DEFAULT_SYMBOL);
    if (nextSymbol !== selectedSymbol) {
      syncingFromQueryRef.current = true;
      setSelectedSymbol(nextSymbol);
    }
    const nextTimeframe = toFrontendTimeframe(queryTimeframe || undefined);
    if (nextTimeframe !== selectedTimeframe) {
      syncingFromQueryRef.current = true;
      setSelectedTimeframe(nextTimeframe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.symbol, querySymbol, queryTimeframe]);

  useEffect(() => {
    if (!matchWithParam) return;

    if (syncingFromQueryRef.current) {
      syncingFromQueryRef.current = false;
      return;
    }

    const nextParams = new URLSearchParams(locationInfo.search);
    nextParams.set("tf", selectedTimeframe);
    const queryString = nextParams.toString();
    const targetPath = `/charts/${selectedSymbol}`;
    const target = queryString ? `${targetPath}?${queryString}` : targetPath;
    const current = `${locationInfo.path}${
      locationInfo.hashSearch ? `?${locationInfo.hashSearch}` : ""
    }`;

    if (current !== target) {
      setLocation(target);
      clearWindowSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSymbol,
    selectedTimeframe,
    locationInfo.path,
    locationInfo.search,
    locationInfo.hashSearch,
    matchWithParam,
  ]);

  const [priceData, setPriceData] = useState<PriceData | null>(null);
  useEffect(() => {
    setPriceData(null);
    if (!selectedSymbol) return;
    const targetSymbol = selectedSymbol.toUpperCase();
    let active = true;
    const unsubscribe = openSpotTickerStream(selectedSymbol, {
      onMessage: (ticker) => {
        if (!active) return;
        if ((ticker.symbol || "").toUpperCase() !== targetSymbol) return;
        setPriceData({
          symbol: ticker.symbol,
          lastPrice: ticker.lastPrice,
          priceChange: ticker.priceChange,
          priceChangePercent: ticker.priceChangePercent,
          highPrice: ticker.highPrice,
          lowPrice: ticker.lowPrice,
          volume: ticker.volume,
          quoteVolume: ticker.quoteVolume,
        });
      },
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [selectedSymbol, selectedTimeframe]);

  const latestPrice =
    (priceData?.symbol || "").toUpperCase() === selectedSymbol.toUpperCase() ? priceData : null;
  const showLoadingState = !latestPrice;
  const priceChange = showLoadingState ? 0 : parseFloat(latestPrice?.priceChangePercent || "0");
  const isPositive = priceChange > 0;
  const loadingMessage = showLoadingState ? "Loading..." : "...";

  const scanMutation = useMutation({
    mutationFn: async () => {
      const timeframeConfig = TIMEFRAMES.find((tf) => tf.value === selectedTimeframe);
      const backendTimeframe = timeframeConfig?.backend ?? selectedTimeframe ?? "1d";
      const res = await apiRequest("POST", "/api/scanner/scan", {
        symbol: toBinance(selectedSymbol),
        timeframe: backendTimeframe,
      });
      return (await res.json()) as unknown;
    },
    onSuccess: (payload) => {
      const result = extractScanResult<ScanResult>(payload);

      if (result) {
        setScanResult(result);
        toast({
          title: "Analysis complete",
          description: `Technical breakdown ready for ${displayPair(result.symbol)}`,
        });
        queryClient.invalidateQueries({ queryKey: ["scan-history"] });
        return;
      }

      toast({
        title: "Analysis unavailable",
        description: "Unexpected response from the scanner service.",
        variant: "destructive",
      });
    },
    onError: (error: unknown) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Sign in required",
          description: "Please sign back in to analyze symbols.",
          variant: "destructive",
        });
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }
      toast({
        title: "Analysis failed",
        description: "Could not analyze the symbol. Please try again.",
        variant: "destructive",
      });
    },
  });

  const hasScannedRef = useRef(false);
  useEffect(() => {
    if (scanResult) hasScannedRef.current = true;
  }, [scanResult]);

  useEffect(() => {
    if (
      isAuthenticated &&
      !scanMutation.isPending &&
      !hasScannedRef.current &&
      ((selectedSymbol === DEFAULT_SYMBOL && !scanResult) || shouldAutoScan)
    ) {
      const timer = setTimeout(() => {
        scanMutation.mutate();
        hasScannedRef.current = true;
      }, 250);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedSymbol]);

  useEffect(() => {
    if (isAuthenticated && hasScannedRef.current && !scanMutation.isPending) {
      scanMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeframe, isAuthenticated]);

  const watchlistQuery = useQuery({
    queryKey: ["watchlist"],
    enabled: isAuthenticated,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/watchlist");
      return (await res.json()) as WatchlistItem[];
    },
  });

  const watchlistItems = asArray<WatchlistItem>(watchlistQuery.data);

  const historyQuery = useQuery({
    queryKey: ["scan-history"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/scanner/history");
      return (await res.json()) as ScanHistoryItem[];
    },
  });

  const historyItems = asArray<ScanHistoryItem>(historyQuery.data);

  const timeframeConfig = useMemo(
    () => TIMEFRAMES.find((tf) => tf.value === selectedTimeframe),
    [selectedTimeframe],
  );

  const addToWatchlist = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("POST", "/api/watchlist", { symbol: toBinance(symbol) });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to watchlist",
        description: `${displayPair(selectedSymbol)} is now on your radar.`,
      });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error: unknown) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Sign in required",
          description: "Please sign in to manage your watchlist.",
          variant: "destructive",
        });
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }
      toast({
        title: "Could not add symbol",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const removeFromWatchlist = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("DELETE", `/api/watchlist/${toBinance(symbol)}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Removed from watchlist",
        description: `${displayPair(selectedSymbol)} was removed from your list.`,
      });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (error: unknown) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Sign in required",
          description: "Please sign in to manage your watchlist.",
          variant: "destructive",
        });
        signInWithGoogle().catch((authError) => {
          console.error("Failed to sign in after unauthorized error", authError);
        });
        return;
      }
      toast({
        title: "Could not update watchlist",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const watchlistSymbols = watchlistItems.map((item) =>
    asString(item.symbol).toUpperCase(),
  );
  const symbolInWatchlist = watchlistSymbols.includes(selectedSymbol.toUpperCase());

  const navigateToSymbol = (fullSymbol: string) => {
    const normalized = toUsdtSymbol(fullSymbol);
    setSelectedSymbol(normalized);
    const nextParams = new URLSearchParams(locationInfo.search);
    nextParams.set("tf", selectedTimeframe);
    const queryString = nextParams.toString();
    const targetPath = `/charts/${normalized}`;
    const target = queryString ? `${targetPath}?${queryString}` : targetPath;
    setLocation(target);
    clearWindowSearch();
  };

  const handleToggleWatchlist = () => {
    if (requireLogin(redirectPath)) return;
    if (symbolInWatchlist) {
      removeFromWatchlist.mutate(selectedSymbol);
    } else {
      addToWatchlist.mutate(selectedSymbol);
    }
  };

  const handleSearch = () => {
    if (requireLogin(redirectPath)) return;
    const raw = (searchInput || "").trim().toUpperCase();
    if (!raw) {
      toast({
        title: "Invalid input",
        description: "Enter a coin symbol (e.g., BTC, ETH, SOL)",
        variant: "destructive",
      });
      return;
    }
    const fullSymbol = toUsdtSymbol(raw);
    navigateToSymbol(fullSymbol);
    setSearchInput("");
    toast({
      title: "Symbol updated",
      description: `Loading ${displayPair(fullSymbol)} chart`,
    });
  };

  const handleScan = () => {
    if (requireLogin(redirectPath)) return;
    const raw = (searchInput || "").trim().toUpperCase();
    if (
      raw &&
      raw !== selectedSymbol &&
      raw !== asString(displayPair(selectedSymbol)).replace("/USDT", "")
    ) {
      const fullSymbol = toUsdtSymbol(raw);
      navigateToSymbol(fullSymbol);
      setSearchInput("");
      toast({
        title: "Symbol updated",
        description: `Analyzing ${displayPair(fullSymbol)}`,
      });
      setTimeout(() => scanMutation.mutate(), 100);
      return;
    }
    if (!selectedSymbol) {
      toast({
        title: "Invalid symbol",
        description: "Select a valid symbol first.",
        variant: "destructive",
      });
      return;
    }
    scanMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const priceSummaryCards = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-lg font-bold text-foreground" data-testid="current-price">
                {showLoadingState
                  ? loadingMessage
                  : formatPrice(latestPrice?.lastPrice)}
              </p>
            </div>
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">24h Change</p>
              <p className={`text-lg font-bold ${isPositive ? "text-accent" : "text-destructive"}`}>
                {showLoadingState ? loadingMessage : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(2)}%`}
              </p>
            </div>
            {isPositive ? (
              <TrendingUp className="h-5 w-5 text-accent" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">24h Volume</p>
              <p className="text-lg font-bold text-foreground">
                {showLoadingState ? loadingMessage : formatVolume(latestPrice?.quoteVolume)}
              </p>
            </div>
            <Target className="h-5 w-5 text-secondary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today&apos;s Range</p>
              <p className="text-sm font-medium text-foreground">
                {showLoadingState ? (
                  loadingMessage
                ) : (
                  <>
                    {formatPrice(latestPrice?.lowPrice)} - {formatPrice(latestPrice?.highPrice)}
                  </>
                )}
              </p>
            </div>
            <Clock3 className="h-5 w-5 text-accent" />
          </div>
        </CardContent>
      </Card>

      {scanResult && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Overall Analysis</p>
                <div className="mt-1 flex items-center space-x-2">
                  <span
                    className={`text-lg font-bold ${getScoreColor(scanResult.totalScore)}`}
                    data-testid="text-total-score"
                  >
                    {scanResult.totalScore > 0 ? "+" : ""}
                    {scanResult.totalScore}
                  </span>
                  <Badge
                    className={`${getRecommendationColor(scanResult.recommendation)} px-2 py-1 text-xs`}
                    data-testid="badge-recommendation"
                  >
                    {asString(scanResult.recommendation).replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                <Progress
                  value={Math.max(0, Math.min(100, ((scanResult.totalScore + 30) / 60) * 100))}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">Range: -30 to +30</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex min-w-0 items-center gap-2 break-keep whitespace-normal text-3xl font-bold text-foreground">
              <BarChart3 className="h-7 w-7 text-primary" />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Decision Hub</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time charts, quantitative scans, and idea discovery in one cockpit.
            </p>
          </div>
          <Button
            variant={symbolInWatchlist ? "secondary" : "outline"}
            onClick={handleToggleWatchlist}
            disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
          >
            <Star className={`h-4 w-4 ${symbolInWatchlist ? "fill-yellow-400 text-yellow-400" : ""}`} />
            <span className="ml-2">
              {symbolInWatchlist ? "Watching" : "Add to Watchlist"}
            </span>
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex min-w-64 flex-1 gap-2 lg:col-span-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Enter coin (BTC, ETH, SOL...)"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                  data-testid="input-search-symbol"
                  disabled={!isAuthenticated}
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                onClick={handleSearch}
                variant="outline"
                className="px-4"
                data-testid="button-search-coin"
                disabled={!isAuthenticated}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-foreground">Timeframe</label>
              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger className="w-32" data-testid="select-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value}>
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleScan}
              disabled={scanMutation.isPending || !isAuthenticated}
              className="bg-primary text-primary-foreground hover:bg-primary/90 lg:justify-self-start"
              data-testid="button-scan"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${scanMutation.isPending ? "animate-spin" : ""}`} />
              {scanMutation.isPending ? "Scanning..." : "Run Analysis"}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            Currently viewing <span className="font-medium text-foreground">{displayPair(selectedSymbol)}</span>
            <span className="text-muted-foreground">
              ({timeframeConfig?.display ?? selectedTimeframe})
            </span>
          </div>
        </CardContent>
      </Card>

      {priceSummaryCards}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Price Action</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <PriceActionPlaceholder
                title="Chart data unavailable"
                description={`Interactive charts for ${displayPair(selectedSymbol)} (${timeframeConfig?.display ?? selectedTimeframe}) are not available in this build.`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="h-[560px] border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex min-w-0 items-center gap-2 text-lg font-semibold">
                <ListChecks className="h-5 w-5 text-primary" />
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  Breakdown Technicals
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full overflow-hidden p-0">
              <ScrollArea className="h-full px-4 pb-4">
                {scanResult ? (
                  <TechnicalIndicators analysis={scanResult} />
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <Search className="mx-auto mb-4 h-12 w-12 opacity-40" />
                    <h3 className="text-lg font-medium">No analysis yet</h3>
                    <p className="mx-auto mt-1 max-w-xs text-sm">
                      Run a scan to unlock AI-enhanced technical breakdowns across all indicators.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex min-w-0 items-center gap-2 text-lg font-semibold">
                <History className="h-5 w-5 text-primary" />
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  Recent Scans
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground">
                  Sign in to keep a searchable log of every analysis you run.
                </p>
              ) : historyQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : historyQuery.error ? (
                <p className="text-sm text-red-400">
                  Could not load scan history right now.
                </p>
              ) : historyItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Run your first scan to start building your decision history.
                </p>
              ) : (
                <div className="space-y-3">
                  {historyItems.slice(0, 6).map((item) => {
                    const filters = item.filters || {};
                    const result = item.results;
                    const symbol = toUsdtSymbol(
                      result?.symbol || filters.symbol || selectedSymbol,
                    );
                    const frontendTimeframe = toFrontendTimeframe(filters.timeframe);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 p-3"
                      >
                        <div className="min-w-0">
                          <p className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-foreground">
                            {displayPair(symbol)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {frontendTimeframe} • {formatRelativeTime(item.createdAt)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSymbol(symbol);
                            setSelectedTimeframe(frontendTimeframe);
                            if (result) {
                              setScanResult(result);
                            }
                            toast({
                              title: "Scan loaded",
                              description: `Restored ${displayPair(symbol)} (${frontendTimeframe})`,
                            });
                          }}
                        >
                          Load
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex min-w-0 items-center gap-2 text-lg font-semibold">
                  <Star className="h-5 w-5 text-primary" />
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Watchlist</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isAuthenticated ? (
                  <p className="text-sm text-muted-foreground">
                    Sign in to curate a personalized watchlist and jump back into symbols instantly.
                  </p>
                ) : watchlistQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Skeleton key={idx} className="h-10 rounded-xl" />
                    ))}
                  </div>
                ) : watchlistQuery.error ? (
                  <p className="text-sm text-red-400">Unable to load watchlist right now.</p>
                ) : watchlistItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No symbols yet. Tap "Add to Watchlist" on any chart to build your list.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {watchlistItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedSymbol(item.symbol);
                          setSearchInput(asString(item.symbol).replace(/USDT$/i, ""));
                          toast({
                            title: "Symbol loaded",
                            description: `Loaded ${displayPair(item.symbol)} from watchlist`,
                          });
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-2 text-left transition hover:border-primary/60 hover:bg-primary/5 ${
                          item.symbol.toUpperCase() === selectedSymbol.toUpperCase()
                            ? "border-primary/60"
                            : ""
                        }`}
                      >
                        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-foreground">
                          {displayPair(item.symbol)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}

function formatPrice(price?: string) {
  const num = parseFloat(price || "0");
  if (Number.isNaN(num)) return "$0.00";
  if (num >= 1000)
    return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (num >= 1) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(8)}`;
}

function formatVolume(volume?: string) {
  const num = parseFloat(volume || "0");
  if (Number.isNaN(num)) return "$0.00";
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function getScoreColor(score: number) {
  if (score >= 10) return "text-green-600";
  if (score >= 5) return "text-accent";
  if (score <= -10) return "text-red-600";
  if (score <= -5) return "text-destructive";
  return "text-yellow-500";
}

function confidenceToRecommendation(confidence: string): ScanResult["recommendation"] {
  switch (confidence) {
    case "High":
      return "strong_buy";
    case "Medium":
      return "buy";
    case "Watch":
      return "hold";
    default:
      return "hold";
  }
}

function getRecommendationColor(recommendation: string) {
  switch (recommendation) {
    case "strong_buy":
      return "bg-green-600 text-white";
    case "buy":
      return "text-accent text-white";
    case "strong_sell":
      return "bg-red-600 text-white";
    case "sell":
      return "bg-red-500 text-white";
    default:
      return "bg-yellow-500 text-black";
  }
}
