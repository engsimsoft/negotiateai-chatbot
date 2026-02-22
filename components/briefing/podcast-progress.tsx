// ТЗ-Б2: Compact podcast generation progress banner
// Sticky at top of content area — article remains visible beneath

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Circle, Check, X, Mic, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PodcastTopicStatus } from "@/hooks/use-podcast-generation";

interface PodcastProgressProps {
  topicStatuses: PodcastTopicStatus[];
  isGenerating: boolean;
  error: string | null;
  completionMessage: string | null;
  readyCount: number;
  failedCount: number;
  onRetry?: () => void;
  onDismiss?: () => void;
}

function StepIcon({ step }: { step: PodcastTopicStatus["step"] }) {
  switch (step) {
    case "pending":
      return <Circle className="size-3.5 text-muted-foreground" />;
    case "script":
    case "recording":
      return <Loader2 className="size-3.5 animate-spin text-primary" />;
    case "done":
      return <Check className="size-3.5 text-success" />;
    case "error":
      return <X className="size-3.5 text-destructive" />;
  }
}

function StepLabel({ step }: { step: PodcastTopicStatus["step"] }) {
  switch (step) {
    case "pending":
      return <span className="text-muted-foreground">Ожидание</span>;
    case "script":
      return <span className="text-foreground">Пишем сценарий...</span>;
    case "recording":
      return <span className="text-foreground">Записано</span>;
    case "done":
      return <span className="text-muted-foreground">Готово</span>;
    case "error":
      return <span className="text-destructive">Ошибка</span>;
  }
}

export function PodcastProgress({
  topicStatuses,
  isGenerating,
  error,
  completionMessage,
  readyCount,
  failedCount,
  onRetry,
  onDismiss,
}: PodcastProgressProps) {
  const [expanded, setExpanded] = useState(true);

  if (topicStatuses.length === 0 && !error && !completionMessage) return null;

  const doneCount = topicStatuses.filter((t) => t.step === "done").length;
  const totalCount = topicStatuses.length;
  const isComplete = !isGenerating && (completionMessage || error);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-10 border-b bg-card shadow-sm"
    >
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Icon */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {isGenerating ? (
            <Mic className="size-4 text-primary" />
          ) : error && readyCount === 0 ? (
            <X className="size-4 text-destructive" />
          ) : (
            <Check className="size-4 text-primary" />
          )}
        </div>

        {/* Status text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {isGenerating
              ? `Записываем подкаст... ${doneCount}/${totalCount}`
              : completionMessage ?? error ?? "Готово"}
          </p>
          {isGenerating && (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {isComplete && onDismiss && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDismiss}>
              Скрыть
            </Button>
          )}
          {error && readyCount === 0 && onRetry && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry}>
              Повторить
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded topic list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-2 pb-3">
              <div className="space-y-1">
                {topicStatuses.map((topic) => (
                  <motion.div
                    key={topic.topicId}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 py-0.5"
                  >
                    <StepIcon step={topic.step} />
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {topic.message}
                    </span>
                    <span className="shrink-0 text-[10px]">
                      <StepLabel step={topic.step} />
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
