"use client";

/**
 * ТЗ-07: Tool Activity UX
 *
 * Compact inline indicator for tool execution within AI messages.
 * Pure presentational — all grouping/aggregation logic lives in message.tsx useMemo.
 */

import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import type { ToolActivityConfig } from "@/lib/ai/tool-activity-config";
import { cn } from "@/lib/utils";
import { Loader } from "./elements/loader";

interface ToolActivityIndicatorProps {
  toolName: string;
  isActive: boolean;
  config: ToolActivityConfig;
  /** Number of parallel calls (shows ×N badge when > 1) */
  count?: number;
  /** Pre-computed result summary (e.g. "35 результатов") */
  summary?: string | null;
  /** Individual details for expandable list (e.g. search queries) */
  details?: string[];
}

export function ToolActivityIndicator({
  toolName,
  isActive,
  config,
  count,
  summary,
  details,
}: ToolActivityIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const label = isActive ? config.activeLabel : config.doneLabel;
  const hasExpandContent = !isActive && details && details.length > 0;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => hasExpandContent && setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm",
          hasExpandContent
            ? "cursor-pointer hover:bg-accent"
            : "cursor-default"
        )}
      >
        {/* Icon: spinner while active, check when complete */}
        {isActive ? (
          <Loader size={16} className="shrink-0 text-muted-foreground" />
        ) : (
          <CheckIcon className="size-4 shrink-0 text-muted-foreground" />
        )}

        {/* Label */}
        <span
          className={cn(
            "text-left",
            isActive ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {label}
          {isActive && "..."}
        </span>

        {/* Summary (e.g. "35 результатов") */}
        {summary && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{summary}</span>
          </>
        )}

        {/* ×N badge for parallel calls */}
        {count != null && count > 1 && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="rounded-full bg-muted-foreground/10 px-2 py-0.5 text-xs text-muted-foreground">
              ×{count}
            </span>
          </>
        )}

        {/* Spacer + chevron for expandable items */}
        {hasExpandContent && (
          <>
            <div className="flex-1" />
            <ChevronRightIcon
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </>
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && hasExpandContent && (
        <div className="mt-0.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {details!.length === 1 ? (
            details![0]
          ) : (
            <ul className="space-y-0.5">
              {details!.map((d, i) => (
                <li key={i}>• {d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
