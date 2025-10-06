import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TradingViewChart from "@/components/scanner/trading-view-chart";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { asArray, asString } from "@/lib/utils";
import {
  BreakdownSection,
  type BreakdownRow,
} from "@/features/analyse/Breakdown";
import { useAuth } from "@/hooks/useAuth";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { toBinance } from "@/lib/symbols";
import { useRoute, useLocation } from "wouter";
import {
  Activity,
  BarChart3,
  Clock3,
  DollarSign,
  RefreshCw,
  Search,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { openSpotTickerStream } from "@/lib/binanceWs";

const API_BASE =
  asString((import.meta as any)?.env?.VITE_API_BASE).replace(/\/$/, "") || "";

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

interface ScannerAnalysis {
  symbol?: string;
  totalScore?: number;
  recommendation?: string;
  breakdown?: unknown;
  technicals?: unknown;
  checks?: unknown;
  [key: string]: unknown;
}

interface WatchlistItem {
  id: string;
  symbol: string;
  createdAt?: number | string | null;
}

const DEFAULT_TIMEFRAME = "240"; // 4h
const DEFAULT_SYMBOL = "BTCUSDT";
const ANALYSE_TOAST_ID = "analyse-status";

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

function extractScanResult(payload: unknown): ScannerAnalysis | ScanResult | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const withData = payload as { data?: unknown };
  if (withData.data && Array.isArray(withData.data)) {
    const [first] = withData.data as unknown[];
    return (first && typeof first === "object")
      ? (first as ScannerAnalysis | ScanResult)
      : null;
  }

  if (withData.data && typeof withData.data === "object") {
    return extractScanResult(withData.data);
  }

  if ((payload as ScannerAnalysis | ScanResult)?.symbol) {
    return payload as ScannerAnalysis | ScanResult;
  }

  return null;
}

function formatIndicatorLabel(key: string) {
  const normalized = key.replace(/[_-]+/g, " ").trim();
  if (!normalized) return key;
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function getRawBreakdownRows(item: ScannerAnalysis | ScanResult | null | undefined) {
  if (!item) return [] as any[];

  const breakdown = asArray<any>((item as { breakdown?: unknown }).breakdown);
  if (breakdown.length > 0) return breakdown;

  const technicals = asArray<any>((item as { technicals?: unknown }).technicals);
  if (technicals.length > 0) return technicals;

  const checks = asArray<any>((item as { checks?: unknown }).checks);
  if (checks.length > 0) return checks;

  const indicators = (item as { indicators?: unknown }).indicators;
  if (indicators && typeof indicators === "object" && !Array.isArray(indicators)) {
    return Object.entries(indicators as Record<string, any>)
      .map(([key, value]) => {
        if (!value || typeof value !== "object") {
          return {
            title: formatIndicatorLabel(key),
            value,
            signal: undefined,
            reason: undefined,
          };
        }

        const candidateValue =
          typeof value.value === "number"
            ? value.value
            : typeof value.value === "string"
              ? value.value
              : typeof value.score === "number"
                ? value.score
                : value.score;

        return {
          title: formatIndicatorLabel(key),
          value: candidateValue,
          signal: value.signal,
          reason: value.reason ?? value.description,
        };
      })
      .filter((entry) => entry?.title);
  }

  return [] as any[];
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
  const [scanResult, setScanResult] = useState<ScannerAnalysis | ScanResult | null>(
    null,
  );
  const [isScanning, setIsScanning] = useState(false);
  const lastRequestIdRef = useRef<string>("");
  const previousSymbolRef = useRef<string>(initialSymbol);
  const isFirstRenderRef = useRef(true);
  const initialExplicitSymbolRef = useRef(Boolean(params?.symbol || querySymbol));

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
  }, [selectedSymbol, selectedTimeframe, networkEnabled]);

  const latestPrice =
    (priceData?.symbol || "").toUpperCase() === selectedSymbol.toUpperCase() ? priceData : null;
  const showLoadingState = !latestPrice;
  const priceChange = showLoadingState ? 0 : parseFloat(latestPrice?.priceChangePercent || "0");
  const isPositive = priceChange > 0;
  const loadingMessage = showLoadingState ? "Loading..." : "...";
  const computedTotalScore = Number(scanResult?.totalScore ?? 0);
  const safeTotalScore = Number.isFinite(computedTotalScore) ? computedTotalScore : 0;
  const rawRecommendation = asString(scanResult?.recommendation || "hold");
  const safeRecommendation = rawRecommendation.toLowerCase();
  const recommendationLabel = rawRecommendation.replace(/_/g, " ").toUpperCase();

  const runScan = useCallback(
    async (symbol: string, timeframe: string) => {
      const rid = crypto.randomUUID();
      lastRequestIdRef.current = rid;
      setIsScanning(true);
      setScanResult(null);

      const timeframeConfig = TIMEFRAMES.find((tf) => tf.value === timeframe);
      const backendTimeframe = timeframeConfig?.backend ?? timeframe ?? "1d";

      try {
        const normalized = toBinance(symbol);
        toast.dismiss(ANALYSE_TOAST_ID);
        toast.loading("Analysing…", { id: ANALYSE_TOAST_ID });
        const res = await apiRequest(
          "POST",
          "/api/scanner/scan",
          {
            symbol: normalized,
            timeframe: backendTimeframe,
          },
        );
        const payload = await res.json().catch(() => null);

        if (lastRequestIdRef.current !== rid) return;

        const item = extractScanResult(payload);
        if (!item) {
          toast.error("Analysis unavailable", { id: ANALYSE_TOAST_ID });
          setScanResult(null);
          return;
        }

        const resolvedSymbol = asString(item.symbol || normalized).toUpperCase();
        toast.success(`${resolvedSymbol} analysed`, { id: ANALYSE_TOAST_ID });
        setScanResult(item);
        queryClient.invalidateQueries({ queryKey: ["scan-history"] });
      } catch (error) {
        if (lastRequestIdRef.current !== rid) return;

        if (isUnauthorizedError(error)) {
          toast.dismiss(ANALYSE_TOAST_ID);
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

        toast.error("Analysis failed", { id: ANALYSE_TOAST_ID });
      } finally {
        if (lastRequestIdRef.current === rid) {
          setIsScanning(false);
        }
      }
    },
    [queryClient, signInWithGoogle, toast],
  );

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousSymbolRef.current = selectedSymbol;
      if (
        initialExplicitSymbolRef.current &&
        selectedSymbol &&
        isAuthenticated &&
        networkEnabled
      ) {
        runScan(selectedSymbol, selectedTimeframe);
      }
      return;
    }

    if (!selectedSymbol || selectedSymbol === previousSymbolRef.current) {
      return;
    }

    previousSymbolRef.current = selectedSymbol;

    if (!isAuthenticated || !networkEnabled) {
      return;
    }

    runScan(selectedSymbol, selectedTimeframe);
  }, [selectedSymbol, selectedTimeframe, isAuthenticated, networkEnabled, runScan]);

  const watchlistQuery = useQuery<WatchlistItem[]>({
    queryKey: ["watchlist"],
    enabled: isAuthenticated && networkEnabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/watchlist");
      const data = (await res.json()) as
        | WatchlistItem[]
        | { items?: unknown }
        | null
        | undefined;

      if (Array.isArray(data)) {
        return data;
      }

      const items = data && typeof data === "object" ? (data as { items?: unknown }).items : null;
      if (Array.isArray(items)) {
        return items;
      }

      return [];
    },
  });

  const watchlistItems = asArray<WatchlistItem>(watchlistQuery.data);
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
    setScanResult(null);
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
    if (
      raw &&
      raw !== selectedSymbol &&
      raw !== asString(displayPair(selectedSymbol)).replace("/USDT", "")
    ) {
      const fullSymbol = toUsdtSymbol(raw);
      setSelectedSymbol(fullSymbol);
      setSearchInput("");
      toast({
        title: "Symbol updated",
        description: `Analyzing ${displayPair(fullSymbol)}`,
      });
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
    runScan(selectedSymbol, selectedTimeframe);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const hasScanResult = Boolean(scanResult);

  const overallAnalysisCard = (
    <Card
      className={`h-full border-2 ${
        hasScanResult ? getScoreBorderTone(safeTotalScore) : "border-border/60"
      } bg-card/70`}
    >
      <CardContent className="h-full p-6">
        {hasScanResult ? (
          <div className="flex h-full min-h-[220px] flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Overall Analysis</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span
                    className={`text-2xl font-bold leading-none ${getScoreColor(safeTotalScore)}`}
                    data-testid="text-total-score"
                  >
                    {safeTotalScore > 0 ? "+" : ""}
                    {safeTotalScore}
                  </span>
                  <Badge
                    className={`${getRecommendationColor(safeRecommendation)} px-2 py-1 text-xs`}
                    data-testid="badge-recommendation"
                  >
                    {recommendationLabel}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Progress
                  value={Math.max(0, Math.min(100, ((safeTotalScore + 30) / 60) * 100))}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">Range: -30 to +30</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span className="text-foreground">{recommendationLabel}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Search className="h-10 w-10 text-muted-foreground/60" />
            <div>
              <p className="text-lg font-semibold text-foreground">No analysis yet</p>
              <p className="text-sm text-muted-foreground">
                Run a scan to unlock overall recommendations.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const priceSummaryCards = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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

    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
      <BackendWarningBanner status={backendStatus} />
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="h-full">
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] lg:items-center lg:gap-4">
              <div className="flex w-full items-center gap-2">
                <div className="relative flex-1 min-w-[280px]">
                  <Input
                    placeholder="Enter coin (BTC, ETH, SOL...)"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="h-11 pl-10"
                    data-testid="input-search-symbol"
                    disabled={!isAuthenticated || !networkEnabled}
                  />
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <Button
                  onClick={handleSearch}
                  variant="outline"
                  className="h-11 w-11 min-w-11 p-0"
                  data-testid="button-search-coin"
                  disabled={!isAuthenticated || !networkEnabled}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex w-full flex-col items-stretch gap-2 lg:col-start-2 lg:flex-row lg:items-center lg:justify-end lg:gap-3">
                <div className="flex w-full items-center gap-2 lg:w-auto lg:justify-end">
                  <label className="text-sm font-medium text-foreground">Timeframe</label>
                  <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                    <SelectTrigger className="h-11 w-full min-w-[160px] lg:w-48" data-testid="select-timeframe">
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
                  disabled={isScanning || !isAuthenticated || !networkEnabled}
                  className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 lg:w-auto"
                  data-testid="button-scan"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
                  {isScanning ? "Scanning..." : "Run Analysis"}
                </Button>
              </div>
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

        {overallAnalysisCard}
      </div>

      {priceSummaryCards}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col">
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
        </div>

        <div className="flex flex-col">
          {scanResult ? (
            (() => {
              const item = scanResult;
              const rawRows = getRawBreakdownRows(item);

              const breakdownRows: BreakdownRow[] = rawRows
                .map((row: any) => {
                  const rawSignal = asString(row?.signal).toLowerCase();
                  const normalizedSignal: BreakdownRow["signal"] =
                    rawSignal === "bullish" || rawSignal === "bearish"
                      ? (rawSignal as BreakdownRow["signal"])
                      : "neutral";

                  const rawValue = row?.value;
                  const value =
                    typeof rawValue === "number"
                      ? rawValue
                      : asString(rawValue);

                  return {
                    title: asString(row?.title || row?.key || row?.name),
                    value,
                    signal: normalizedSignal,
                    reason: row?.reason
                      ? asString(row.reason)
                      : row?.description
                        ? asString(row.description)
                        : undefined,
                  } satisfies BreakdownRow;
                })
                .filter((row: BreakdownRow) => row.title);

              if (breakdownRows.length === 0) {
                return <BreakdownSection rows={[]} />;
              }

              return <BreakdownSection rows={breakdownRows} />;
            })()
          ) : (
            <BreakdownSection
              rows={[]}
              emptyState={
                <div className="py-12 text-center text-white/70">
                  <Search className="mx-auto mb-4 h-12 w-12 opacity-40" />
                  <h4 className="text-lg font-medium text-white">No analysis yet</h4>
                  <p className="mx-auto mt-1 max-w-xs text-sm">
                    Run a scan to unlock AI-enhanced technical breakdowns across all indicators.
                  </p>
                </div>
              }
            />
          )}
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

function getScoreBorderTone(score: number) {
  if (score >= 5) return "border-green-500/80";
  if (score <= -5) return "border-red-500/80";
  return "border-yellow-500/80";
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
      return "bg-green-500 text-white";
    case "strong_sell":
      return "bg-red-600 text-white";
    case "sell":
      return "bg-red-500 text-white";
    default:
      return "bg-yellow-500 text-black";
  }
}
