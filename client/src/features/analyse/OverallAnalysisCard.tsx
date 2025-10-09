import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

import {
  getRecommendationColor,
  getScoreBorderTone,
  getScoreColor,
  type Recommendation,
} from "./utils";

export interface OverallResult {
  score: number;
  recommendation: Recommendation | string;
  recommendationLabel: string;
  confidenceLabel?: string;
  percent?: number;
}

interface OverallAnalysisCardProps {
  data?: OverallResult | null;
  variant?: "full" | "compact";
  className?: string;
}

export function OverallAnalysisCard({
  data,
  variant = "full",
  className,
}: OverallAnalysisCardProps) {
  const compact = variant === "compact";
  const hasResult = Boolean(data);
  const score = data?.score ?? 0;
  const normalizedRecommendation = data?.recommendation?.toString().toLowerCase() ?? "";
  const badgeClass = getRecommendationColor(normalizedRecommendation);
  const progressValue = Math.max(
    0,
    Math.min(100, data?.percent ?? ((score + 30) / 60) * 100),
  );
  const confidence = data?.confidenceLabel ?? data?.recommendationLabel;

  const compactBadgeTone = (() => {
    switch (normalizedRecommendation) {
      case "strong_buy":
      case "buy":
        return "bg-emerald-500/15 text-emerald-300";
      case "strong_sell":
      case "sell":
        return "bg-rose-500/15 text-rose-300";
      default:
        return "bg-amber-500/15 text-amber-300";
    }
  })();

  const compactProgressTone = (() => {
    if (score >= 5) return "bg-emerald-400";
    if (score <= -5) return "bg-rose-400";
    return "bg-amber-400";
  })();

  if (compact) {
    return (
      <div className="min-h-[76px] rounded-xl border border-slate-700/60 bg-slate-900/50 p-3 md:min-h-[84px]">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-slate-200">Overall Analysis</div>
          <div className="flex-1">
            {hasResult ? (
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                    compactBadgeTone,
                  )}
                >
                  {data?.recommendationLabel}
                </span>
                <div className="h-1 w-full rounded bg-slate-700/60">
                  <div
                    className={cn("h-1 rounded", compactProgressTone)}
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                No analysis yet · Run a scan to unlock
              </div>
            )}
          </div>
          {hasResult && confidence ? (
            <div className="text-[11px] text-slate-400">{confidence}</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "h-full border-2 bg-card/70",
        hasResult ? getScoreBorderTone(score) : "border-border/60",
        className,
      )}
    >
      <CardContent className="h-full p-6">
        {hasResult ? (
          <div className="flex h-full min-h-[154px] flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Overall Analysis</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span
                    className={cn("text-2xl font-bold leading-none", getScoreColor(score))}
                    data-testid="text-total-score"
                  >
                    {score > 0 ? "+" : ""}
                    {score}
                  </span>
                  <Badge
                    className={cn(badgeClass, "px-2 py-1 text-xs")}
                    data-testid="badge-recommendation"
                  >
                    {data?.recommendationLabel}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={progressValue} className="h-2" />
                <p className="text-xs text-muted-foreground">Range: -30 to +30</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span className="text-foreground">{confidence}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[154px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
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
}
