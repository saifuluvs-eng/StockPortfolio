import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TVChart from "../components/TVChart";
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
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { asArray, asString } from "@/lib/utils";
import { extractScanResult } from "@/lib/scanner-results";
import {
  BreakdownSection,
  type BreakdownRow,
} from "@/features/analyse/Breakdown";
import {
  OverallAnalysisCard,
  type OverallResult,
} from "@/features/analyse/OverallAnalysisCard";
import { type Recommendation } from "@/features/analyse/utils";
import { useAuth } from "@/hooks/useAuth";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { toBinance } from "@/lib/symbols";
import { getFirebaseIdToken } from "@/lib/firebase";
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
  recommendation: Recommendation;
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

const DEFAULT_TIMEFRAME = "4h";
const DEFAULT_SYMBOL = "BTCUSDT";
const ANALYSE_TOAST_ID = "analyse-status";

const TIMEFRAMES = [
  { value: "15m", label: "15min", display: "15m", backend: "15m", legacy: ["15"] },
  { value: "1h", label: "1hr", display: "1h", backend: "1h", legacy: ["60"] },
  { value: "4h", label: "4hr", display: "4h", backend: "4h", legacy: ["240"] },
  { value: "1d", label: "1Day", display: "1D", backend: "1d", legacy: ["D", "1day"] },
  { value: "1w", label: "1Week", display: "1W", backend: "1w", legacy: ["W"] },
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

const normalizeSymbol = (raw: string) => {
  const v = (raw || "").toString().trim().toUpperCase();
  return (v.includes(":") ? v.split(":").pop()! : v).replace(/\s+/g, "");
};

type TimeframeOption = (typeof TIMEFRAMES)[number];

const TIMEFRAME_LEGACY_MAP = TIMEFRAMES.reduce<Record<string, TimeframeOption>>((acc, tf) => {
  acc[tf.value.toLowerCase()] = tf;
  acc[tf.backend.toLowerCase()] = tf;
  tf.legacy?.forEach((legacy) => {
    acc[legacy.toLowerCase()] = tf;
  });
  return acc;
}, {});

function toFrontendTimeframe(value: string | undefined) {
  if (!value) return DEFAULT_TIMEFRAME;
  const resolved = TIMEFRAME_LEGACY_MAP[value.toLowerCase()];
  return resolved?.value ?? DEFAULT_TIMEFRAME;
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

type MiniStatProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "up" | "down";
  icon?: React.ReactNode;
};

const MiniStat: React.FC<MiniStatProps> = ({ label, value, hint, tone = "default", icon }) => {
  const toneCls =
    tone === "up"
      ? "text-emerald-400"
      : tone === "down"
        ? "text-rose-400"
        : "text-slate-200";
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/40 px-3 py-1.5 shadow-sm ring-1 ring-black/5"
      role="status"
      aria-label={label}
      title={typeof value === "string" ? `${label}: ${value}` : label}
    >
      {icon ? <span className="opacity-80">{icon}</span> : null}
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${toneCls}`}>{value}</span>
      {hint ? <span className="text-[11px] text-slate-500">{hint}</span> : null}
    </div>
  );
};

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

  const urlParams = useMemo(
    () => new URLSearchParams(locationInfo.search),
    [locationInfo.search],
  );

  const querySymbol = urlParams.get("symbol");
  const queryTimeframe = urlParams.get("tf");

  const initialSymbol = toUsdtSymbol(params?.symbol || querySymbol || DEFAULT_SYMBOL);
  const initialTimeframe = toFrontendTimeframe(queryTimeframe || undefined);

  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol);
  const [timeframe, setTimeframe] = useState<string>(initialTimeframe);
  const [chartSymbol, setChartSymbol] = useState<string>(normalizeSymbol(initialSymbol));
  const [chartTf, setChartTf] = useState<string>(initialTimeframe);
  const [chartKey, setChartKey] = useState<string>(() => `tv-${Date.now()}`);
  const syncingFromQueryRef = useRef(false);
  const [symbolInput, setSymbolInput] = useState<string>(initialSymbol || DEFAULT_SYMBOL);
  const [scanResult, setScanResult] = useState<ScannerAnalysis | ScanResult | null>(
    null,
  );
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastScanRef = useRef<string>("");
  const previousSymbolRef = useRef<string>(initialSymbol);
  const isFirstRenderRef = useRef(true);
  const initialExplicitSymbolRef = useRef(Boolean(params?.symbol || querySymbol));

  useEffect(() => {
    setIsScanning(false);
    return () => {
      try {
        abortRef.current?.abort();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const nextSymbol = toUsdtSymbol(params?.symbol || querySymbol || DEFAULT_SYMBOL);
    if (nextSymbol !== selectedSymbol) {
      syncingFromQueryRef.current = true;
      setSelectedSymbol(nextSymbol);
    }
    const nextTimeframe = toFrontendTimeframe(queryTimeframe || undefined);
    if (nextTimeframe !== timeframe) {
      syncingFromQueryRef.current = true;
      setTimeframe(nextTimeframe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.symbol, querySymbol, queryTimeframe]);

  useEffect(() => {
    setSymbolInput(selectedSymbol || DEFAULT_SYMBOL);
  }, [selectedSymbol]);

  useEffect(() => {
    if (!matchWithParam) return;

    if (syncingFromQueryRef.current) {
      syncingFromQueryRef.current = false;
      return;
    }

    const nextParams = new URLSearchParams(locationInfo.search);
    nextParams.set("tf", timeframe);
    const queryString = nextParams.toString();
    const targetPath = `/analyse/${selectedSymbol}`;
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
    timeframe,
    locationInfo.path,
    locationInfo.search,
    locationInfo.hashSearch,
    matchWithParam,
  ]);

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
  }, [selectedSymbol, timeframe, networkEnabled]);

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

  const runAnalysis = useCallback(
    async (symbolOverride?: string, timeframeOverride?: string) => {
      const fallbackSymbol = symbolOverride ?? selectedSymbol ?? symbolInput ?? DEFAULT_SYMBOL;
      const resolvedSymbol = toUsdtSymbol(fallbackSymbol);
      const normalizedSymbol = normalizeSymbol(resolvedSymbol || DEFAULT_SYMBOL);
      const tfValue = timeframeOverride ?? timeframe ?? DEFAULT_TIMEFRAME;

      const key = `${normalizedSymbol}|${tfValue}`;
      if (key === lastScanRef.current && isScanning) return;
      lastScanRef.current = key;

      try {
        abortRef.current?.abort();
      } catch {}
      const ac = new AbortController();
      abortRef.current = ac;

      setIsScanning(true);
      setScanResult(null);
      setChartSymbol(normalizedSymbol);
      setChartTf(tfValue);
      setChartKey(`tv-${normalizedSymbol}-${tfValue}-${Date.now()}`);

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        timeoutId = setTimeout(() => ac.abort(), 25_000);

        const timeframeConfig = TIMEFRAMES.find((tf) => tf.value === tfValue);
        const backendTimeframe = timeframeConfig?.backend ?? tfValue ?? "1d";
        const apiSymbol = toBinance(resolvedSymbol);

        toast.dismiss(ANALYSE_TOAST_ID);
        toast.loading("Analysing…", { id: ANALYSE_TOAST_ID });

        window.dispatchEvent(
          new CustomEvent("tv:update", {
            detail: {
              symbol: normalizedSymbol,
              timeframe: backendTimeframe,
            },
          }),
        );

        const token = await getFirebaseIdToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await api("/api/scanner/scan", {
          method: "POST",
          headers,
          body: JSON.stringify({ symbol: apiSymbol, timeframe: backendTimeframe }),
          signal: ac.signal,
        });

        if (res.status === 401) {
          throw new Error("401: Unauthorized");
        }

        if (!res.ok) {
          throw new Error(`Scan HTTP ${res.status}`);
        }

        const payload = await res.json().catch(() => null);
        const item = extractScanResult<ScannerAnalysis | ScanResult>(payload);
        if (!item) {
          toast.error("Analysis unavailable", { id: ANALYSE_TOAST_ID });
          setScanResult(null);
          return;
        }

        const resolved = asString(item.symbol || apiSymbol).toUpperCase();
        toast.success(`${resolved} analysed`, { id: ANALYSE_TOAST_ID });
        setScanResult(item);
        queryClient.invalidateQueries({ queryKey: ["scan-history"] });

        window.__tvSet?.(normalizedSymbol, tfValue);
        console.log("[Analyse] Run Analysis →", normalizedSymbol, tfValue);
      } catch (error: any) {
        if (error?.name === "AbortError") {
          console.warn("[Analyse] scan aborted");
        } else if (isUnauthorizedError(error)) {
          toast.dismiss(ANALYSE_TOAST_ID);
          toast({
            title: "Sign in required",
            description: "Please sign back in to analyze symbols.",
            variant: "destructive",
          });
          signInWithGoogle().catch((authError) => {
            console.error("Failed to sign in after unauthorized error", authError);
          });
        } else {
          toast.error("Analysis failed", { id: ANALYSE_TOAST_ID });
          console.error("[Analyse] scan failed", error);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        abortRef.current = null;
        setIsScanning(false);
      }
    },
    [
      isScanning,
      queryClient,
      selectedSymbol,
      signInWithGoogle,
      symbolInput,
      timeframe,
      toast,
    ],
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
        void runAnalysis(selectedSymbol, timeframe);
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

    void runAnalysis(selectedSymbol, timeframe);
  }, [selectedSymbol, timeframe, isAuthenticated, networkEnabled, runAnalysis]);

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
    () => TIMEFRAMES.find((tf) => tf.value === timeframe),
    [timeframe],
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
    const raw = (symbolInput || "").trim().toUpperCase();
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
    setSymbolInput(fullSymbol);
    setChartSymbol(normalizeSymbol(fullSymbol));
    setChartTf(timeframe);

    if (!networkEnabled) {
      if (backendOffline) {
        toast({
          title: "Backend required",
          description: `Symbol set to ${displayPair(fullSymbol)}. Connect this dashboard to your backend build to load analysis.`,
          variant: "destructive",
        });
      } else if (backendPending) {
        toast({
          title: "Symbol updated",
          description: `Waiting for backend status before loading ${displayPair(fullSymbol)}.`,
        });
      }
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: "Symbol updated",
        description: `Showing ${displayPair(fullSymbol)} price data. Sign in to run full analysis.`,
      });
      return;
    }

    toast({
      title: "Symbol updated",
      description: `Loading ${displayPair(fullSymbol)} chart`,
    });
  };

  const handleScan = () => {
    const raw = (symbolInput || "").trim().toUpperCase();
    let targetSymbol = selectedSymbol;

    if (
      raw &&
      raw !== selectedSymbol &&
      raw !== asString(displayPair(selectedSymbol)).replace("/USDT", "")
    ) {
      const fullSymbol = toUsdtSymbol(raw);
      targetSymbol = fullSymbol;
      setSelectedSymbol(fullSymbol);
      setSymbolInput(fullSymbol);
    }

    if (!targetSymbol) {
      toast({
        title: "Invalid symbol",
        description: "Select a valid symbol first.",
        variant: "destructive",
      });
      return;
    }

    const normalizedTarget = normalizeSymbol(targetSymbol);

    if (!networkEnabled) {
      setChartSymbol(normalizedTarget);
      setChartTf(timeframe);
      setChartKey(`tv-${normalizedTarget}-${timeframe}-${Date.now()}`);
      if (backendOffline) {
        toast({
          title: "Backend required",
          description: "Provide a backend URL (VITE_API_BASE) to run scans from Vercel.",
          variant: "destructive",
        });
      } else if (backendPending) {
        toast({
          title: "Please wait",
          description: "Still checking backend status. Try again in a moment.",
        });
      }
      return;
    }

    if (!isAuthenticated) {
      setChartSymbol(normalizedTarget);
      setChartTf(timeframe);
      setChartKey(`tv-${normalizedTarget}-${timeframe}-${Date.now()}`);
      toast({
        title: "Feature locked",
        description: "Please sign in to run scans.",
        variant: "destructive",
      });
      return;
    }

    const displayTarget = displayPair(targetSymbol);
    toast({
      title: "Symbol updated",
      description: `Analyzing ${displayTarget}`,
    });

    setScanResult(null);
    void runAnalysis(targetSymbol, timeframe);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const hasScanResult = Boolean(scanResult);
  const overallResult: OverallResult | null = hasScanResult
    ? {
        score: safeTotalScore,
        recommendation: safeRecommendation,
        recommendationLabel,
      }
    : null;

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6">
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <Card className="border border-border/60 bg-card/70">
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center gap-3 md:gap-4">
                  <div className="min-w-[220px] basis-full grow md:basis-auto md:grow-0">
                    <div className="relative">
                      <Input
                        placeholder="Enter coin (BTC, ETH, SOL...)"
                        value={symbolInput}
                        onChange={(e) => setSymbolInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="h-11 w-full min-w-0 pl-10"
                        data-testid="input-search-symbol"
                      />
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:text-sm">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      <span className="whitespace-nowrap">Timeframe</span>
                      <Select value={timeframe} onValueChange={setTimeframe}>
                        <SelectTrigger
                          className="h-9 min-w-[140px] border-border/60 bg-background/70 text-left text-foreground"
                          data-testid="select-timeframe"
                        >
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
                    <div className="flex min-w-0 items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <Badge className="truncate bg-zinc-800/80 px-2 py-1 text-xs font-medium uppercase text-foreground">
                        {displayPair(selectedSymbol)}
                      </Badge>
                      <span className="whitespace-nowrap text-xs">
                        ({timeframeConfig?.display ?? timeframe})
                      </span>
                    </div>
                  </div>

                  <div className="ml-auto flex flex-wrap items-center gap-2 md:gap-3">
                    <MiniStat
                      label="Current Price"
                      value={
                        showLoadingState
                          ? loadingMessage
                          : formatPrice(latestPrice?.lastPrice)
                      }
                      icon={<DollarSign className="h-3.5 w-3.5 text-emerald-300" />}
                    />
                    <MiniStat
                      label="24h Change"
                      value={
                        showLoadingState
                          ? loadingMessage
                          : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(2)}%`
                      }
                      tone={
                        showLoadingState
                          ? "default"
                          : priceChange > 0
                            ? "up"
                            : priceChange < 0
                              ? "down"
                              : "default"
                      }
                      icon={
                        showLoadingState ? (
                          <TrendingUp className="h-3.5 w-3.5 text-slate-300" />
                        ) : isPositive ? (
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
                        ) : priceChange < 0 ? (
                          <TrendingDown className="h-3.5 w-3.5 text-rose-300" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5 text-slate-300" />
                        )
                      }
                    />
                    <MiniStat
                      label="24h Volume"
                      value={
                        showLoadingState
                          ? loadingMessage
                          : formatVolume(latestPrice?.quoteVolume)
                      }
                      icon={<Target className="h-3.5 w-3.5 text-sky-300" />}
                    />
                    <MiniStat
                      label="Today's Range"
                      value={
                        showLoadingState ? (
                          loadingMessage
                        ) : (
                          `${formatPrice(latestPrice?.lowPrice)} - ${formatPrice(latestPrice?.highPrice)}`
                        )
                      }
                      icon={<Clock3 className="h-3.5 w-3.5 text-amber-300" />}
                    />
                  </div>

                  <div className="shrink-0">
                    <Button
                      type="button"
                      onClick={handleScan}
                      disabled={isScanning}
                      aria-busy={isScanning ? "true" : "false"}
                      className="h-11 whitespace-nowrap bg-primary px-4 text-primary-foreground hover:bg-primary/90 lg:w-auto"
                      data-testid="button-scan"
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
                      {isScanning ? "Scanning..." : "Run Analysis"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0">
          <OverallAnalysisCard data={overallResult ?? null} size="fixed" />
        </div>
      </div>

      {false && priceSummaryCards}

      <section className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
          <Card className="flex h-full flex-col border-border/70 bg-card/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Price Action</CardTitle>
            </CardHeader>
            <CardContent className="grow min-h-[60vh] p-0">
              <div className="h-full">
                <TVChart
                  key={chartKey}
                  symbol={chartSymbol}
                  timeframe={chartTf}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 flex flex-col lg:col-span-5">
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
      </section>
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
