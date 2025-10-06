export type Recommendation = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

export function getScoreColor(score: number) {
  if (score >= 10) return "text-green-600";
  if (score >= 5) return "text-green-500";
  if (score <= -10) return "text-red-600";
  if (score <= -5) return "text-red-500";
  return "text-yellow-500";
}

export function getScoreBorderTone(score: number) {
  if (score >= 5) return "border-green-500/80";
  if (score <= -5) return "border-red-500/80";
  return "border-yellow-500/80";
}

export function getRecommendationColor(recommendation: string) {
  switch (recommendation.toLowerCase() as Recommendation) {
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

export function confidenceToRecommendation(confidence: string): Recommendation {
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
