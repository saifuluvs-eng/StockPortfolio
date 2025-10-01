import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ScannerSummaryStatsProps {
  coins: number;
  advancers: number;
  decliners: number;
  avgChange: number;
  hasResults: boolean;
}

interface ScannerStatTileProps {
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}

function ScannerStatTile({ label, value, highlight }: ScannerStatTileProps) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-2 text-lg font-semibold text-foreground",
            highlight === "positive" && "text-emerald-400",
            highlight === "negative" && "text-red-400"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function ScannerSummaryStats({
  coins,
  advancers,
  decliners,
  avgChange,
  hasResults,
}: ScannerSummaryStatsProps) {
  const averageDisplay = hasResults
    ? `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`
    : "—";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <ScannerStatTile label="Coins" value={coins.toLocaleString()} />
      <ScannerStatTile label="Advancers" value={advancers.toLocaleString()} />
      <ScannerStatTile label="Decliners" value={decliners.toLocaleString()} />
      <ScannerStatTile
        label="Avg 24h %"
        value={averageDisplay}
        highlight={
          hasResults
            ? avgChange >= 0
              ? "positive"
              : "negative"
            : undefined
        }
      />
    </div>
  );
}
