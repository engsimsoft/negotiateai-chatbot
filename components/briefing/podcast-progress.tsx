// ТЗ-Б2 + ТЗ-DEV2: Full-screen podcast generation progress view + trace footer
// Replaces article content during generation — Apple-level "wow" experience

"use client";

import { motion } from "framer-motion";
import { Loader2, Circle, Check, X, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PodcastTopicStatus } from "@/hooks/use-podcast-generation";
import type {
  PipelineStageTrace,
  PipelineTraceSummary,
} from "@/lib/ai/pipeline-trace";
import { PipelineTraceFooter } from "@/components/dev-panel/pipeline-trace-footer";

interface PodcastProgressProps {
  topicStatuses: PodcastTopicStatus[];
  isGenerating: boolean;
  error: string | null;
  completionMessage: string | null;
  readyCount: number;
  failedCount: number;
  onRetry?: () => void;
  onDismiss?: () => void;
  /** ТЗ-DEV2: Pipeline trace stages (dev mode only) */
  traceStages?: PipelineStageTrace[];
  /** ТЗ-DEV2: Pipeline trace summary (dev mode only) */
  traceSummary?: PipelineTraceSummary | null;
}

function StepIcon({ step }: { step: PodcastTopicStatus["step"] }) {
  switch (step) {
    case "pending":
      return (
        <div className="flex size-7 items-center justify-center rounded-full bg-muted">
          <Circle className="size-3.5 text-muted-foreground" />
        </div>
      );
    case "script":
    case "recording":
      return (
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="size-3.5 animate-spin text-primary" />
        </div>
      );
    case "done":
      return (
        <div className="flex size-7 items-center justify-center rounded-full bg-success/10">
          <Check className="size-3.5 text-success" />
        </div>
      );
    case "error":
      return (
        <div className="flex size-7 items-center justify-center rounded-full bg-destructive/10">
          <X className="size-3.5 text-destructive" />
        </div>
      );
  }
}

function StepDetail({ step }: { step: PodcastTopicStatus["step"] }) {
  switch (step) {
    case "pending":
      return <span className="text-muted-foreground">Ожидание</span>;
    case "script":
      return <span className="text-primary">Сценарий...</span>;
    case "recording":
      return <span className="text-primary">Запись...</span>;
    case "done":
      return <span className="text-success">Готово</span>;
    case "error":
      return <span className="text-destructive">Ошибка</span>;
  }
}

/** CSS-only sound wave (plays when complete, paused otherwise) */
function SoundWave({ animate }: { animate: boolean }) {
  const bars = [12, 20, 28, 36, 24, 32, 16, 28, 20, 12];
  return (
    <div className="mt-5 flex items-center gap-[3px]" style={{ height: 40 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-primary-foreground/60"
          style={{
            height: h,
            animation: animate ? `podcast-wave 1.2s ease-in-out ${i * 0.1}s infinite` : "none",
            transform: animate ? undefined : "scaleY(0.3)",
            transition: "transform 0.4s ease",
          }}
        />
      ))}
    </div>
  );
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
  traceStages,
  traceSummary,
}: PodcastProgressProps) {
  if (topicStatuses.length === 0 && !error && !completionMessage) return null;

  const isComplete = !isGenerating && !!(completionMessage || error);
  const isSuccess = isComplete && readyCount > 0;

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-8 py-10">
      {/* Artwork */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="relative mb-8 flex size-52 flex-col items-center justify-center overflow-hidden rounded-3xl bg-primary shadow-lg md:size-64"
      >
        {/* Radial highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.15)_0%,transparent_60%)]" />

        {/* Center icon */}
        <div className="relative z-10">
          {isGenerating ? (
            <div className="size-16 animate-spin rounded-full border-4 border-primary-foreground/30 border-t-primary-foreground" />
          ) : isSuccess ? (
            <Mic className="size-16 text-primary-foreground" />
          ) : (
            <X className="size-16 text-primary-foreground/70" />
          )}
        </div>

        {/* Title on artwork */}
        {!isGenerating && isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative z-10 mt-2"
          >
            <p className="font-serif text-lg font-semibold text-primary-foreground">
              Подкаст готов
            </p>
          </motion.div>
        )}

        {/* Sound wave */}
        <div className="relative z-10">
          <SoundWave animate={!isGenerating && isSuccess} />
        </div>
      </motion.div>

      {/* Status text */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-8 text-center"
      >
        <h2 className="font-serif text-xl font-semibold">
          {isGenerating
            ? "Создаём подкаст..."
            : completionMessage ?? error ?? "Готово"}
        </h2>
        {isGenerating && (
          <p className="mt-1 text-sm text-muted-foreground">
            Два ведущих готовятся к эфиру
          </p>
        )}
      </motion.div>

      {/* Per-topic steps */}
      <div className="w-full max-w-sm space-y-1">
        {topicStatuses.map((topic, i) => (
          <motion.div
            key={topic.topicId}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex items-center gap-3 py-2"
          >
            <StepIcon step={topic.step} />
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                topic.step === "pending" ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {topic.message}
            </span>
            <span className="shrink-0 text-xs">
              <StepDetail step={topic.step} />
            </span>
          </motion.div>
        ))}
      </div>

      {/* Actions (on completion) */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex items-center gap-3"
        >
          {error && readyCount === 0 && onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Повторить
            </Button>
          )}
          {onDismiss && (
            <Button variant="default" onClick={onDismiss}>
              {isSuccess ? "Готово" : "Закрыть"}
            </Button>
          )}
        </motion.div>
      )}

      {/* ТЗ-DEV2: Pipeline trace footer (dev mode only) */}
      {traceStages && (
        <PipelineTraceFooter
          stages={traceStages}
          summary={traceSummary ?? null}
          isGenerating={isGenerating}
        />
      )}
    </div>
  );
}
