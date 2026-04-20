"use client";

import { Package } from "lucide-react";
import { type ComponentProps, useMemo } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { CompactionEvent } from "@/lib/ai/compaction/types";
import type { AppUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";

export type ContextProps = ComponentProps<"button"> & {
  /** Cumulative session usage — summed across all messages in this chat. */
  usage?: AppUsage;
};

const PERCENT_MAX = 100;

// Lucide CircleIcon geometry
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_RADIUS = 10;
const ICON_STROKE_WIDTH = 2;

type ContextIconProps = {
  percent: number; // 0 - 100
  /**
   * Compaction indicator — меняет цвет иконки на muted-foreground если
   * в сессии хотя бы раз сработал compaction. ТЗ-COMPACTION-UNIFY: warning
   * (янтарная обводка) удалён — compaction работает молча.
   */
  isCompacted?: boolean;
};

export const ContextIcon = ({ percent, isCompacted }: ContextIconProps) => {
  const radius = ICON_RADIUS;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percent / PERCENT_MAX);

  const colorClass = isCompacted ? "text-muted-foreground" : undefined;

  return (
    <svg
      aria-label={
        isCompacted
          ? `${percent.toFixed(2)}% — разговор сжат`
          : `${percent.toFixed(2)}% of model context used`
      }
      className={colorClass}
      height="28"
      role="img"
      style={colorClass ? undefined : { color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="28"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={radius}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={radius}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        transform={`rotate(-90 ${ICON_CENTER} ${ICON_CENTER})`}
      />
    </svg>
  );
};

function formatRub(rub: number): string {
  if (rub <= 0) return "—";
  if (rub < 0.01) return "< ₽0.01";
  return `₽${rub.toFixed(2)}`;
}

// ТЗ-COMPACTION-UNIFY (ADR 054): индикатор compaction в popover виджета контекста.
// Compaction работает молча — только факт «произошло сжатие», без warning
// и action button. Ручной handoff в новый чат перенесён в COMPACTION-3.
function CompactionIndicator({ event }: { event: CompactionEvent }) {
  return (
    <div className="flex items-start gap-2">
      <Package
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="space-y-0.5 text-xs">
        <div className="font-medium">Разговор сжат</div>
        <div className="text-muted-foreground">
          {event.squeezedTokens.toLocaleString()} → ~
          {event.summaryTokens.toLocaleString()} токенов
          {event.compactionCount > 1 && ` · сжатий: ${event.compactionCount}`}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  tokens,
  rub,
  accent,
}: {
  label: string;
  tokens: number;
  rub: number;
  /** Optional color accent: "discount" (green) for cache_read, "premium" (amber) for cache_write. */
  accent?: "discount" | "premium";
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span
        className={cn(
          "text-muted-foreground",
          accent === "discount" && "text-emerald-600 dark:text-emerald-400",
          accent === "premium" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {label}
      </span>
      <div className="flex items-center gap-2 font-mono">
        <span className="min-w-[4ch] text-right">{tokens.toLocaleString()}</span>
        <span className="text-muted-foreground min-w-[5ch] text-right">
          {formatRub(rub)}
        </span>
      </div>
    </div>
  );
}

export const Context = ({
  className,
  usage,
  ...props
}: ContextProps) => {
  const contextUsed = usage?.contextWindow.used ?? 0;
  const contextMax = usage?.contextWindow.max ?? 0;
  const hasMax = contextMax > 0;
  const usedPercent = hasMax
    ? Math.min(100, (contextUsed / contextMax) * 100)
    : 0;

  const cost = usage?.costRub;
  const totalRub = cost?.totalRub ?? 0;

  // ТЗ-COMPACTION-1: подписка на data-compaction события. Извлекаем последнее
  // событие (если пришло несколько за сессию — показываем свежее состояние).
  const { dataStream } = useDataStream();
  const compactionEvent = useMemo<CompactionEvent | null>(() => {
    const parts = dataStream.filter((p) => p.type === "data-compaction");
    const latest = parts[parts.length - 1];
    return (latest?.data as CompactionEvent | undefined) ?? null;
  }, [dataStream]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex select-none items-center gap-1 rounded-md text-sm",
            "cursor-pointer bg-background text-foreground",
            className,
          )}
          type="button"
          {...props}
        >
          <ContextIcon
            isCompacted={compactionEvent !== null}
            percent={usedPercent}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit p-3" side="top">
        <div className="min-w-[260px] space-y-2">
          {/* ТЗ-COMPACTION-UNIFY: compaction indicator (при наличии события) */}
          {compactionEvent && (
            <>
              <CompactionIndicator event={compactionEvent} />
              <Separator />
            </>
          )}

          {/* Context window (last message fill) */}
          <div className="space-y-1">
            <div className="flex items-start justify-between text-sm">
              <span className="font-medium">Контекст</span>
              <span className="text-muted-foreground tabular-nums">
                {hasMax
                  ? `${contextUsed.toLocaleString()} / ${contextMax.toLocaleString()}`
                  : `${contextUsed.toLocaleString()} tokens`}
              </span>
            </div>
            <Progress className="h-2 bg-muted" value={usedPercent} />
            <div className="text-[10px] text-muted-foreground text-right">
              {usedPercent.toFixed(1)}% окна модели ({usage?.modelId ?? "—"})
            </div>
          </div>

          {usage && (
            <>
              <Separator />
              {/* Cumulative session cost */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Расход за сессию
                </div>
                {usage.noCacheInputTokens > 0 && (
                  <InfoRow
                    label="Fresh input"
                    tokens={usage.noCacheInputTokens}
                    rub={cost?.freshInputRub ?? 0}
                  />
                )}
                {usage.cacheReadTokens > 0 && (
                  <InfoRow
                    accent="discount"
                    label="Cache read"
                    tokens={usage.cacheReadTokens}
                    rub={cost?.cacheReadRub ?? 0}
                  />
                )}
                {usage.cacheWriteTokens > 0 && (
                  <InfoRow
                    accent="premium"
                    label="Cache write"
                    tokens={usage.cacheWriteTokens}
                    rub={cost?.cacheWriteRub ?? 0}
                  />
                )}
                <InfoRow
                  label="Output"
                  tokens={usage.outputTokens}
                  rub={cost?.outputRub ?? 0}
                />
                {usage.reasoningTokens > 0 && (
                  <InfoRow
                    label="Reasoning"
                    tokens={usage.reasoningTokens}
                    rub={cost?.reasoningRub ?? 0}
                  />
                )}
                <Separator className="mt-1" />
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="font-medium">Итого</span>
                  <span className="font-mono font-medium">
                    {formatRub(totalRub)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
