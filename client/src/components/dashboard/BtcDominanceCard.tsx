import { useEffect, type CSSProperties } from "react";
import { PieChart } from "lucide-react";

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
    <Card className="dashboard-card neon-hover bg-gradient-to-br from-amber-500/10 to-amber-500/20 flex flex-col h-[180px] sm:h-full sm:min-h-[260px]" style={cardStyle}>
      <CardContent className="p-3 sm:p-4 lg:p-6 flex flex-col justify-start">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-0.5">BTC Dominance</h3>
            <p className="text-sm sm:text-lg md:text-2xl font-bold text-foreground mt-0.5">{isLoading ? "—" : display}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <PieChart className="w-6 sm:w-8 h-6 sm:h-8 text-amber-500 flex-shrink-0" />
        </div>
      </CardContent>
      <CardFooter className="pt-0 px-6 pb-6">
        <span className="text-xs opacity-70">Source: CoinGecko</span>
      </CardFooter>
    </Card>
  );
}
