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

interface OverallAnalysisCardProps {
  score: number;
  recommendation: Recommendation | string;
  recommendationLabel: string;
  hasResult: boolean;
  confidenceLabel?: string;
  className?: string;
}

export function OverallAnalysisCard({
  score,
  recommendation,
  recommendationLabel,
  hasResult,
  confidenceLabel,
  className,
}: OverallAnalysisCardProps) {
  const normalizedRecommendation = recommendation?.toString().toLowerCase();
  const badgeClass = getRecommendationColor(normalizedRecommendation);
  const progressValue = Math.max(0, Math.min(100, ((score + 30) / 60) * 100));
  const confidence = confidenceLabel ?? recommendationLabel;

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
          <div className="flex h-full min-h-[220px] flex-col justify-between gap-4">
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
                    {recommendationLabel}
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
}
