"use client";

import { Package } from "lucide-react";
import { type ComponentProps, useMemo } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import type { CompactionEvent } from "@/lib/ai/compaction/types";
import {
  COMPACTION_THRESHOLD_SOFT,
  SIMPLY_CONTEXT_LIMIT,
} from "@/lib/ai/context-limits";
import type { AppUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";

export type ContextProps = ComponentProps<"button"> & {
  /**
   * Текущее заполнение контекста для прогресс-бара. Cost-секции в виджете
   * больше нет (last-turn — плашка под сообщением, разбивка — DevPanel).
   * Best practice (Claude Code statusline / Cursor): только % + индикатор
   * сжатия, никаких токенов и ID моделей в UI пользователя.
   */
  usage?: AppUsage;
};

const PERCENT_MAX = 100;

/**
 * Шкала прогресс-бара = заполнение **до Compaction Soft порога** (100K из
 * 200K = «критическая масса» с точки зрения пользователя). Это то что
 * реально влияет на UX: при достижении 100% сработает сжатие.
 * Полный лимит 200K — техническая деталь, в UI не показывается.
 */
const COMPACTION_TRIGGER_TOKENS =
  SIMPLY_CONTEXT_LIMIT * COMPACTION_THRESHOLD_SOFT;

/** Цветовые пороги по % до сжатия (от 0 до COMPACTION_TRIGGER_TOKENS). */
const COLOR_AMBER_THRESHOLD = 70;
const COLOR_RED_THRESHOLD = 90;

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

// ТЗ-COMPACTION-UNIFY (ADR 054): индикатор compaction в popover виджета контекста.
// Compaction работает молча — только факт «произошло сжатие», без warning
// и action button. Текст человеческий — без цифр squeezed/summary, они в DevPanel.
function CompactionIndicator({ event }: { event: CompactionEvent }) {
  const multiple = event.compactionCount > 1;
  return (
    <div className="flex items-start gap-2">
      <Package
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="space-y-0.5 text-xs">
        <div className="font-medium">Память освобождена</div>
        <div className="text-muted-foreground">
          {multiple
            ? `Старая часть разговора собрана в краткое резюме · ${event.compactionCount} раза`
            : "Старая часть разговора собрана в краткое резюме, чтобы освободить место для новых сообщений"}
        </div>
      </div>
    </div>
  );
}

/**
 * Цвет прогресс-бара по % приближения к моменту сжатия:
 *  - до 70% — нейтральный bg-primary («свободно»)
 *  - 70-90% — янтарный («скоро сжатие»)
 *  - 90%+ — destructive («сжатие близко»)
 */
function getBarColorClass(percent: number): string {
  if (percent >= COLOR_RED_THRESHOLD) return "bg-destructive";
  if (percent >= COLOR_AMBER_THRESHOLD)
    return "bg-amber-500 dark:bg-amber-400";
  return "bg-primary";
}

/** Короткая фраза-статус для пользователя по % до сжатия. */
function getStatusLabel(percent: number): string {
  if (percent >= COLOR_RED_THRESHOLD) return "Сжатие близко";
  if (percent >= COLOR_AMBER_THRESHOLD) return "Скоро сжатие";
  return "Свободно";
}

export const Context = ({
  className,
  usage,
  ...props
}: ContextProps) => {
  const contextUsed = usage?.contextWindow.used ?? 0;
  // Шкала идёт до Soft порога (точка сжатия), не до полного лимита 200K.
  // Когда контекст переходит порог — Compaction срабатывает, prior history
  // ужимается в summary, used уменьшится естественно. До этого момента
  // прогресс-бар может показывать до 100% (≥ COMPACTION_TRIGGER_TOKENS).
  const usedPercent = Math.min(
    PERCENT_MAX,
    (contextUsed / COMPACTION_TRIGGER_TOKENS) * 100,
  );
  const barColorClass = getBarColorClass(usedPercent);
  const statusLabel = getStatusLabel(usedPercent);

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
        <div className="min-w-65 space-y-2">
          {/* ТЗ-COMPACTION-UNIFY: compaction indicator (при наличии события) */}
          {compactionEvent && (
            <>
              <CompactionIndicator event={compactionEvent} />
              <Separator />
            </>
          )}

          {/* Заполнение контекста до момента сжатия. Только % + статус-фраза,
              без токенов и ID моделей (best practice Claude Code/Cursor). */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Контекст</span>
              <span className="font-mono font-medium tabular-nums">
                {Math.round(usedPercent)}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all", barColorClass)}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {statusLabel}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
