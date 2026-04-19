"use client";

import { AlertTriangle, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentProps, useMemo } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { CompactionEvent } from "@/lib/ai/compaction/types";
import type { AppUsage } from "@/lib/usage";
import { cn, generateUUID, getChatUrl } from "@/lib/utils";

export type ContextProps = ComponentProps<"button"> & {
  /** Cumulative session usage — summed across all messages in this chat. */
  usage?: AppUsage;
  /**
   * Текущий chatMode — нужен для корректной терминологии и URL-механики
   * «новый запрос / новое задание» в compaction-индикаторе. Если не передан —
   * кнопка-действие скрывается (только текст-предупреждение).
   */
  chatMode?: string;
};

const PERCENT_MAX = 100;

// Lucide CircleIcon geometry
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_RADIUS = 10;
const ICON_STROKE_WIDTH = 2;

type ContextIconProps = {
  percent: number; // 0 - 100
};

export const ContextIcon = ({ percent }: ContextIconProps) => {
  const radius = ICON_RADIUS;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percent / PERCENT_MAX);

  return (
    <svg
      aria-label={`${percent.toFixed(2)}% of model context used`}
      height="28"
      role="img"
      style={{ color: "currentcolor" }}
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

// ТЗ-COMPACTION-1: индикатор compaction в popover виджета контекста.
// Архитектура v1.9 §Виджет контекста — 2 типа event'ов:
//  - kind:"compaction" — Package иконка, «Разговор сжат», действий не нужно.
//  - kind:"truncation_warning" — AlertTriangle янтарный, кнопка начать
//    новую сессию текущего режима (терминология mode-aware — в expertise
//    «запрос», в create «задание»; слово «чат» в этих режимах не используется).
//
// Кнопка-действие в MVP — **basic action**: создаёт UUID нового диалога и
// навигирует на `getChatUrl(newId, chatMode)` по канонической механике
// app-sidebar.tsx:79-86. Полная реализация с pre-fill summary — COMPACTION-3.
//
// Если `chatMode` не передан — кнопка скрывается (safety), показывается
// только предупреждающий текст.
function CompactionIndicator({
  event,
  chatMode,
}: {
  event: CompactionEvent;
  chatMode?: string;
}) {
  const router = useRouter();
  const isWarning = event.kind === "truncation_warning";

  // Mode-aware label: в expertise/create термин «чат» НЕ используется (устойчивое
  // продуктовое решение — «запросы» и «задания»).
  const actionLabel =
    chatMode === "expertise"
      ? "Новый запрос с итогом"
      : chatMode === "create"
        ? "Новое задание с итогом"
        : null;
  const warningTitle =
    chatMode === "expertise"
      ? "Рекомендуем начать новый запрос"
      : chatMode === "create"
        ? "Рекомендуем начать новое задание"
        : "Рекомендуем начать заново";

  const handleStartNew = () => {
    if (!chatMode) return;
    const newId = generateUUID();
    router.push(getChatUrl(newId, chatMode));
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {isWarning ? (
          <AlertTriangle
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
        ) : (
          <Package
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
        )}
        <div className="space-y-0.5 text-xs">
          <div
            className={cn(
              "font-medium",
              isWarning && "text-amber-700 dark:text-amber-300",
            )}
          >
            {isWarning ? warningTitle : "Разговор сжат"}
          </div>
          <div className="text-muted-foreground">
            {event.squeezedTokens.toLocaleString()} → ~
            {event.summaryTokens.toLocaleString()} токенов
            {event.compactionCount > 1 && ` · сжатий: ${event.compactionCount}`}
          </div>
        </div>
      </div>
      {isWarning && actionLabel && (
        <Button
          className="w-full"
          onClick={handleStartNew}
          size="sm"
          type="button"
          variant="secondary"
        >
          {actionLabel}
        </Button>
      )}
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
  chatMode,
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
          <ContextIcon percent={usedPercent} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit p-3" side="top">
        <div className="min-w-[260px] space-y-2">
          {/* ТЗ-COMPACTION-1: compaction indicator (при наличии события) */}
          {compactionEvent && (
            <>
              <CompactionIndicator event={compactionEvent} chatMode={chatMode} />
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
