import { useEffect, type CSSProperties } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useBtcDominance } from "@/hooks/useBtcDominance";
import { fmtPct } from "@/lib/num";

const cardStyle = { "--neon-glow": "hsl(45, 92%, 60%)" } as CSSProperties;

export default function BtcDominanceCard() {
  const { data, isLoading, isError } = useBtcDominance();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["btcDominance"] });
    };

    window.addEventListener("dashboard:refresh", handler);
    return () => {
      window.removeEventListener("dashboard:refresh", handler);
    };
  }, [queryClient]);

  const hasValue = typeof data === "number" && Number.isFinite(data);
  const display = isError || !hasValue ? "—" : fmtPct(data);
  const subtitle = isError ? "Unavailable" : "Share of total crypto market cap";

  return (
    <Card className="dashboard-card neon-hover bg-gradient-to-br from-amber-400/5 to-amber-500/10 flex flex-col" style={cardStyle}>
      <CardContent className="p-6 flex-1 flex flex-col justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">BTC Dominance</h3>
          <p className="text-3xl font-bold text-foreground mt-2">{isLoading ? "—" : display}</p>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </CardContent>
      <CardFooter className="pt-0 px-6 pb-6">
        <span className="text-xs opacity-70">Source: CoinGecko</span>
      </CardFooter>
    </Card>
  );
}
