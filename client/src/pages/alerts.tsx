import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, RadioTower, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { go } from "@/lib/nav";
import { apiRequest } from "@/lib/queryClient";
import { asArray } from "@/lib/utils";
import type { WatchlistItem } from "@shared/schema";

function toDisplayPair(symbol: string) {
  const value = (symbol || "").toUpperCase();
  if (!value) return "BTC/USDT";
  return value.endsWith("USDT") ? `${value.slice(0, -4)}/USDT` : value;
}

const PRESET_RULES = [
  {
    id: "breakout",
    title: "Breakout watcher",
    description: "Alert when price moves ±5% within the selected timeframe.",
    badge: "Momentum",
  },
  {
    id: "reversal",
    title: "Trend reversal",
    description: "Get notified when RSI crosses bullish or bearish thresholds.",
    badge: "Technicals",
  },
  {
    id: "volume",
    title: "Volume spike",
    description: "Ping when 24h volume surges above the rolling average.",
    badge: "Liquidity",
  },
] as const;

export default function AlertsPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const watchlistQuery = useQuery<WatchlistItem[]>({
    queryKey: ["alerts-watchlist", isAuthenticated],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/watchlist");
      const json = await res.json();
      return asArray<WatchlistItem>(json);
    },
    enabled: isAuthenticated,
  });

  const watchlistItems = useMemo(
    () => (watchlistQuery.data ? asArray<WatchlistItem>(watchlistQuery.data) : []),
    [watchlistQuery.data],
  );

  const handleSignIn = () => {
    go("#/account");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Smart alerts</h1>
          <p className="text-muted-foreground">
            Stay ahead of market swings with proactive notifications tied to your watchlist.
          </p>
        </div>
        {isAuthenticated ? (
          <Badge variant="outline" className="w-fit gap-2 px-3 py-1 text-sm">
            <Bell className="h-4 w-4" /> Synced with watchlist
          </Badge>
        ) : null}
      </div>

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Active markets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAuthenticated ? (
            <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-center">
              <h3 className="text-lg font-semibold text-foreground">Sign in to configure alerts</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Alerts follow the symbols you star. Connect your account to start receiving timely nudges.
              </p>
              <Button onClick={handleSignIn} className="mt-4" disabled={isLoading}>
                Start with Google
              </Button>
            </div>
          ) : watchlistQuery.isLoading || watchlistQuery.isRefetching ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : watchlistQuery.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
              <p className="text-sm font-medium text-destructive">We couldn&apos;t fetch your saved markets.</p>
              <p className="mt-2 text-xs text-destructive/80">Refresh the page or try again in a few moments.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => watchlistQuery.refetch()}
                disabled={watchlistQuery.isRefetching}
              >
                Retry
              </Button>
            </div>
          ) : watchlistItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-6 text-center">
              <RadioTower className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">No markets are being monitored yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Star at least one pair from the watchlist or charts to begin receiving price movement alerts.
              </p>
              <Link href="/watchlist">
                <Button variant="default" className="mt-4">
                  Manage watchlist
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlistItems.map((item) => {
                const symbol = toDisplayPair(item.symbol);
                const pathSymbol = (item.symbol || "").toUpperCase();
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4 transition hover:border-pri
mary/60 hover:bg-primary/5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Priority
                      </Badge>
                      <p className="text-base font-semibold text-foreground">{symbol}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link href={`/analyse/${pathSymbol}`} className="w-full sm:w-auto">
                        <Button className="w-full">
                          Configure in Analyse
                        </Button>
                      </Link>
                      <Link href={`/charts/${pathSymbol}`} className="w-full sm:w-auto">
                        <Button variant="outline" className="w-full">
                          Monitor live chart
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Zap className="h-5 w-5 text-primary" /> Suggested triggers
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {PRESET_RULES.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-border/60 bg-card/80 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-foreground text-sm">{rule.title}</p>
                <Badge variant="outline" className="text-xs w-fit">{rule.badge}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{rule.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" /> Delivery preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Alerts arrive instantly on the device you&apos;re signed into. We&apos;ll surface urgent moves in-app and follow up with
            email summaries for anything you miss.
          </p>
          <p>
            Prefer quieter trading sessions? Toggle Do Not Disturb from the top navigation to pause alerts while keeping your
            watchlist intact.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
