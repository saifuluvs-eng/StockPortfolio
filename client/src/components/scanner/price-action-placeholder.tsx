import { memo } from "react";
import { BarChart3 } from "lucide-react";

import { cn } from "@/lib/utils";

type PriceActionPlaceholderProps = {
  className?: string;
  title?: string;
  description?: string;
};

function PriceActionPlaceholderComponent({
  className,
  title = "Chart preview unavailable",
  description = "Interactive price charts are currently disabled while we redesign this experience.",
}: PriceActionPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[420px] w-full flex-col items-center justify-center gap-4 p-6 text-center",
        className,
      )}
      data-testid="chart-placeholder"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/30 text-primary">
        <BarChart3 className="h-8 w-8" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground/90">{title}</p>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export const PriceActionPlaceholder = memo(PriceActionPlaceholderComponent);
export default PriceActionPlaceholder;
