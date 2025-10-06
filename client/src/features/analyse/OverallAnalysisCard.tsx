import { Card, CardContent } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type Recommendation = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

export interface OverallAnalysisCardProps {
  score?: number | null;
  recommendation?: Recommendation | string | null;
  recommendationLabel?: string | null;
  isLoading?: boolean;
  compact?: boolean;
  title?: string;
  className?: string;
  rangeText?: string;
  confidenceLabel?: string | null;
}

const DEFAULT_TITLE = "Overall Analysis";
const DEFAULT_RANGE_TEXT = "Range: -30 to +30";

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

function formatRecommendationLabel(recommendation?: string | null) {
  if (!recommendation) return "HOLD";
  return recommendation.replace(/_/g, " ").toUpperCase();
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, ((score + 30) / 60) * 100));
}

function CompactView({
  title,
  isLoading,
  hasData,
  score,
  scoreColor,
  badgeColor,
  badgeLabel,
}: {
  title: string;
  isLoading?: boolean;
  hasData: boolean;
  score: number;
  scoreColor: string;
  badgeColor: string;
  badgeLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#111214] p-4 h-[140px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        {isLoading ? (
          <Skeleton className="h-6 w-20" />
        ) : hasData ? (
          <Badge className={cn("px-2 py-1 text-xs", badgeColor)} data-testid="badge-recommendation">
            {badgeLabel}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-7 w-16" />
        ) : hasData ? (
          <span className={cn("text-2xl font-bold", scoreColor)} data-testid="text-total-score">
            {score > 0 ? "+" : ""}
            {score}
          </span>
        ) : (
          <p className="text-sm text-muted-foreground">Run a scan to unlock insights.</p>
        )}

        <Progress value={hasData ? clampScore(score) : 0} className="h-2" />
      </div>
    </div>
  );
}

function DefaultView({
  title,
  className,
  borderClass,
  isLoading,
  hasData,
  score,
  scoreColor,
  badgeColor,
  badgeLabel,
  rangeText,
  confidenceLabel,
}: {
  title: string;
  className?: string;
  borderClass: string;
  isLoading?: boolean;
  hasData: boolean;
  score: number;
  scoreColor: string;
  badgeColor: string;
  badgeLabel: string;
  rangeText: string;
  confidenceLabel: string;
}) {
  return (
    <Card className={cn("h-full border-2 bg-card/70", borderClass, className)}>
      <CardContent className="h-full p-6">
        {isLoading ? (
          <div className="flex h-full min-h-[220px] flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ) : hasData ? (
          <div className="flex h-full min-h-[220px] flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <span className={cn("text-2xl font-bold leading-none", scoreColor)} data-testid="text-total-score">
                    {score > 0 ? "+" : ""}
                    {score}
                  </span>
                  <Badge className={cn("px-2 py-1 text-xs", badgeColor)} data-testid="badge-recommendation">
                    {badgeLabel}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={clampScore(score)} className="h-2" />
                <p className="text-xs text-muted-foreground">{rangeText}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span className="text-foreground">{confidenceLabel}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Search className="h-10 w-10 text-muted-foreground/60" />
            <div>
              <p className="text-lg font-semibold text-foreground">No analysis yet</p>
              <p className="text-sm text-muted-foreground">Run a scan to unlock overall recommendations.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OverallAnalysisCard({
  score,
  recommendation,
  recommendationLabel,
  isLoading,
  compact,
  title = DEFAULT_TITLE,
  className,
  rangeText = DEFAULT_RANGE_TEXT,
  confidenceLabel,
}: OverallAnalysisCardProps) {
  const hasData = typeof score === "number" && Number.isFinite(score);
  const safeScore = hasData ? score ?? 0 : 0;
  const normalizedRecommendation = (recommendation || "hold").toString().toLowerCase();
  const badgeLabel = recommendationLabel || formatRecommendationLabel(recommendation);
  const badgeColor = getRecommendationColor(normalizedRecommendation);
  const scoreColor = getScoreColor(safeScore);
  const borderClass = hasData ? getScoreBorderTone(safeScore) : "border-border/60";
  const confidence = confidenceLabel || badgeLabel;

  if (compact) {
    return (
      <CompactView
        title={title}
        isLoading={isLoading}
        hasData={hasData}
        score={safeScore}
        scoreColor={scoreColor}
        badgeColor={badgeColor}
        badgeLabel={badgeLabel}
      />
    );
  }

  return (
    <DefaultView
      title={title}
      className={className}
      borderClass={borderClass}
      isLoading={isLoading}
      hasData={hasData}
      score={safeScore}
      scoreColor={scoreColor}
      badgeColor={badgeColor}
      badgeLabel={badgeLabel}
      rangeText={rangeText}
      confidenceLabel={confidence}
    />
  );
}

export default OverallAnalysisCard;
