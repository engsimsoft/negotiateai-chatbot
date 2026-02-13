"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContextIndicatorProps {
  percent: number;
}

/**
 * ТЗ-C1.5: Thin progress bar showing context window usage.
 * - 0-60%: subtle gray (barely visible)
 * - 60-80%: amber (percent label appears)
 * - 80-100%: orange with pulse (expert already suggested snapshot)
 */
export function ContextIndicator({ percent }: ContextIndicatorProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  if (clamped <= 0) return null;

  const isWarning = clamped >= 60;
  const isCritical = clamped >= 80;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full px-2 md:px-4">
          <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isCritical
                  ? "bg-orange-500 animate-pulse"
                  : isWarning
                    ? "bg-amber-500"
                    : "bg-muted-foreground/20"
              )}
              style={{ width: `${clamped}%` }}
            />
          </div>
          {isWarning && (
            <div className="flex justify-end mt-0.5">
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  isCritical ? "text-orange-500" : "text-amber-500"
                )}
              >
                {clamped}%
              </span>
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        Контекст диалога: {clamped}%
      </TooltipContent>
    </Tooltip>
  );
}
