import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TradingViewChart from "@/components/scanner/trading-view-chart";
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
import { useAuth } from "@/hooks/useAuth";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { useRoute, useLocation } from "wouter";
import {
  Activity,
  BarChart3,
  Clock3,
  DollarSign,
  History,
  ListChecks,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { openSpotTickerStream } from "@/lib/binanceWs";

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, "") || "";

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

interface ScanIndicator {
  value?: number;
  signal?: "bullish" | "bearish" | "neutral";
  score?: number;
  tier?: number;
  description?: string;
}

interface ScanResult {
  symbol: string;
  price: number;
  indicators: Record<string, ScanIndicator>;
  totalScore: number;
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  meta?: Record<string, unknown> | null;
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

interface HighPotentialFilters {
  timeframe?: string;
  minScore?: number;
  minVolume?: string;
  excludeStablecoins?: boolean;
  limit?: number;
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

function BackendWarningBanner({ status }: { status: boolean | null }) {
  // TEMP: hide banner until backend integration is ready again
  return null;
}

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

export default function Analyse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const backendStatus = useBackendHealth();
  const networkEnabled = backendStatus === true;
  const backendOffline = backendStatus === false;
  const backendPending = backendStatus === null;

  const [matchWithParam, params] = useRoute("/analyse/:symbol?");
  const [location, setLocation] = useLocation();

  const locationInfo = useMemo(() => {
    const rawLocation = location ?? "";
    const withoutHash = rawLocation.startsWith("#")
      ? rawLocation.slice(1)
      : rawLocation;
    const [pathPart = "", searchPart = ""] = withoutHash.split("?");
    const normalizedPath = pathPart
      ? pathPart.startsWith("/")
        ? pathPart
        : `/${pathPart}`
      : "/";
    return {
      path: normalizedPath,
      search: searchPart,
    };
  }, [location]);

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
    const targetPath = `/analyse/${selectedSymbol}`;
    const target = queryString ? `${targetPath}?${queryString}` : targetPath;
    const current = `${locationInfo.path}${
      locationInfo.search ? `?${locationInfo.search}` : ""
    }`;

    if (current !== target) {
      setLocation(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, selectedTimeframe, locationInfo.path, locationInfo.search, matchWithParam]);

  const [priceData, setPriceData] = useState<PriceData | null>(null);
  useEffect(() => {
    setPriceData(null);
    if (!networkEnabled) return;
    let active = true;
    const unsubscribe = openSpotTickerStream(selectedSymbol, {
      onMessage: (ticker) => {
        if (!active) return;
        if ((ticker.symbol || "").toUpperCase() !== selectedSymbol.toUpperCase()) return;
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
  }, [selectedSymbol, networkEnabled]);

  const latestPrice =
    (priceData?.symbol || "").toUpperCase() === selectedSymbol.toUpperCase() ? priceData : null;
  const showLoadingState = !latestPrice;
  const priceChange = showLoadingState ? 0 : parseFloat(latestPrice?.priceChangePercent || "0");
  const isPositive = priceChange > 0;
  const loadingMessage = showLoadingState ? "Loading..." : "...";

  const scanMutation = useMutation({
    mutationFn: async () => {
      const timeframeConfig = TIMEFRAMES.find((tf) => tf.value === selectedTimeframe);
      const backendTimeframe = timeframeConfig?.backend || selectedTimeframe;
      const res = await apiRequest(
        "POST",
        `${API_BASE || ""}/api/scanner/scan`,
        {
          symbol: selectedSymbol,
          timeframe: backendTimeframe,
        },
      );
      return (await res.json()) as ScanResult;
    },
    onSuccess: (data) => {
      setScanResult(data);
      toast({
        title: "Analysis complete",
        description: `Technical breakdown ready for ${displayPair(data.symbol)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["scan-history"] });
      queryClient.invalidateQueries({ queryKey: ["high-potential"] });
    },
    onError: (error: unknown) => {
      if (error instanceof Error && isUnauthorizedError(error)) {
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
    if (!networkEnabled) return undefined;
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
  }, [isAuthenticated, selectedSymbol, networkEnabled]);

  useEffect(() => {
    if (!networkEnabled) return;
    if (isAuthenticated && hasScannedRef.current && !scanMutation.isPending) {
      scanMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeframe, isAuthenticated, networkEnabled]);

  const watchlistQuery = useQuery({
    queryKey: ["watchlist"],
    enabled: isAuthenticated && networkEnabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/watchlist");
      return (await res.json()) as WatchlistItem[];
    },
  });

  const historyQuery = useQuery({
    queryKey: ["scan-history"],
    enabled: isAuthenticated && networkEnabled,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/scanner/history");
      return (await res.json()) as ScanHistoryItem[];
    },
  });

  const timeframeConfig = useMemo(
    () => TIMEFRAMES.find((tf) => tf.value === selectedTimeframe),
    [selectedTimeframe],
  );

  const highPotentialQuery = useQuery({
    queryKey: ["high-potential", timeframeConfig?.backend],
    enabled: isAuthenticated && networkEnabled,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const payload: HighPotentialFilters = {
        timeframe: timeframeConfig?.backend || "4h",
        minScore: 18,
        minVolume: "1M",
        excludeStablecoins: true,
        limit: 8,
      };
      const res = await apiRequest("POST", "/api/scanner/high-potential", payload);
      const data = (await res.json()) as ScanResult[];
      return Array.isArray(data) ? data.slice(0, 6) : [];
    },
  });

  const addToWatchlist = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("POST", "/api/watchlist", { symbol });
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
      if (error instanceof Error && isUnauthorizedError(error)) {
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
      const res = await apiRequest("DELETE", `/api/watchlist/${symbol}`);
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
      if (error instanceof Error && isUnauthorizedError(error)) {
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

  const watchlistSymbols = (watchlistQuery.data || []).map((item) =>
    (item.symbol || "").toUpperCase(),
  );
  const symbolInWatchlist = watchlistSymbols.includes(selectedSymbol.toUpperCase());

  const handleToggleWatchlist = () => {
    if (!networkEnabled) {
      if (backendOffline) {
        toast({
          title: "Backend required",
          description: "Log into a backend-enabled deployment to manage your watchlist.",
          variant: "destructive",
        });
      }
      return;
    }
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Log in to manage your watchlist and save scans.",
        variant: "destructive",
      });
      return;
    }
    if (symbolInWatchlist) {
      removeFromWatchlist.mutate(selectedSymbol);
    } else {
      addToWatchlist.mutate(selectedSymbol);
    }
  };

  const handleSearch = () => {
    if (!networkEnabled) {
      if (backendOffline) {
        toast({
          title: "Backend required",
          description: "Connect this dashboard to your backend build before searching symbols.",
          variant: "destructive",
        });
      }
      return;
    }
    if (!isAuthenticated) {
      toast({
        title: "Feature locked",
        description: "Please log in to search for other coins.",
        variant: "destructive",
      });
      return;
    }
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
    setSelectedSymbol(fullSymbol);
    setSearchInput("");
    toast({
      title: "Symbol updated",
      description: `Loading ${displayPair(fullSymbol)} chart`,
    });
  };

  const handleScan = () => {
    if (!networkEnabled) {
      if (backendOffline) {
        toast({
          title: "Backend required",
          description: "Provide a backend URL (VITE_API_BASE) to run scans from Vercel.",
          variant: "destructive",
        });
      }
      return;
    }
    if (!isAuthenticated) {
      toast({
        title: "Feature locked",
        description: "Please sign in to run scans.",
        variant: "destructive",
      });
      return;
    }
    const raw = (searchInput || "").trim().toUpperCase();
    if (raw && raw !== selectedSymbol && raw !== displayPair(selectedSymbol).replace("/USDT", "")) {
      const fullSymbol = toUsdtSymbol(raw);
      setSelectedSymbol(fullSymbol);
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
              <p className={`text-lg font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {showLoadingState ? loadingMessage : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(2)}%`}
              </p>
            </div>
            {isPositive ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
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
                    {scanResult.recommendation.replace(/_/g, " ").toUpperCase()}
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
      <BackendWarningBanner status={backendStatus} />
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
              <BarChart3 className="h-7 w-7 text-primary" />
              Decision Hub
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time charts, quantitative scans, and idea discovery in one cockpit.
            </p>
          </div>
          <Button
            variant={symbolInWatchlist ? "secondary" : "outline"}
            onClick={handleToggleWatchlist}
            disabled={
              addToWatchlist.isPending ||
              removeFromWatchlist.isPending ||
              !networkEnabled
            }
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
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-64 flex-1 gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Enter coin (BTC, ETH, SOL...)"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                  data-testid="input-search-symbol"
                  disabled={!isAuthenticated || !networkEnabled}
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                onClick={handleSearch}
                variant="outline"
                className="px-4"
                data-testid="button-search-coin"
                disabled={!isAuthenticated || !networkEnabled}
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
              disabled={scanMutation.isPending || !isAuthenticated || !networkEnabled}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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
              <TradingViewChart
                key={`${selectedSymbol}-${selectedTimeframe}`}
                symbol={selectedSymbol}
                interval={selectedTimeframe}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-5 w-5 text-primary" />
                High Potential Ideas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {backendOffline ? (
                <p className="text-sm text-muted-foreground">
                  Connect this dashboard to your backend (set <code>VITE_API_BASE</code>) to
                  surface high potential ideas.
                </p>
              ) : !isAuthenticated ? (
                <p className="text-sm text-muted-foreground">
                  Sign in to view AI-powered high potential setups tailored to your timeframe.
                </p>
              ) : backendPending || highPotentialQuery.isLoading ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : highPotentialQuery.error ? (
                <p className="text-sm text-red-400">
                  Could not fetch high potential ideas right now.
                </p>
              ) : (highPotentialQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No standout opportunities detected. Try rescanning with different filters.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {highPotentialQuery.data!.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => {
                        setSelectedSymbol(item.symbol);
                        setSelectedTimeframe(timeframeConfig?.value ?? DEFAULT_TIMEFRAME);
                        setScanResult(null);
                        setSearchInput(item.symbol.replace(/USDT$/i, ""));
                        toast({
                          title: "Symbol loaded",
                          description: `Loaded ${displayPair(item.symbol)} from high potential list`,
                        });
                      }}
                      className="group flex w-full flex-col rounded-xl border border-border/60 bg-card/60 p-4 text-left transition hover:border-primary/60 hover:bg-primary/5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {displayPair(item.symbol)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Score {item.totalScore > 0 ? "+" : ""}{item.totalScore}
                          </p>
                        </div>
                        <Badge className={getRecommendationColor(item.recommendation)}>
                          {item.recommendation.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Tap to load chart &amp; run full breakdown.
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="h-[560px] border-border/70 bg-card/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <ListChecks className="h-5 w-5 text-primary" />
                Breakdown Technicals
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
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <History className="h-5 w-5 text-primary" />
                Recent Scans
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
              ) : (historyQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Run your first scan to start building your decision history.
                </p>
              ) : (
                <div className="space-y-3">
                  {historyQuery.data!.slice(0, 6).map((item) => {
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
                          <div>
                            <p className="text-sm font-semibold text-foreground">
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
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Star className="h-5 w-5 text-primary" />
                  Watchlist
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
                ) : (watchlistQuery.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No symbols yet. Tap "Add to Watchlist" on any chart to build your list.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {watchlistQuery.data!.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedSymbol(item.symbol);
                          setScanResult(null);
                          setSearchInput(item.symbol.replace(/USDT$/i, ""));
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
                        <span className="text-sm font-medium text-foreground">
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
  if (score >= 5) return "text-green-500";
  if (score <= -10) return "text-red-600";
  if (score <= -5) return "text-red-500";
  return "text-yellow-500";
}

function getRecommendationColor(recommendation: string) {
  switch (recommendation) {
    case "strong_buy":
      return "bg-green-600 text-white";
    case "buy":
      return "bg-green-500 text-white";
    case "strong_sell":
      return "bg-red-600 text-white";
    case "sell":
      return "bg-red-500 text-white";
    default:
      return "bg-yellow-500 text-black";
  }
}
