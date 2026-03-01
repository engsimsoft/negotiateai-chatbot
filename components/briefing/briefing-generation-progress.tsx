// ТЗ-А5 + ТЗ-DEV2: Briefing generation progress — shows live pipeline steps + trace footer

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BriefingGenerationStep } from "@/hooks/use-briefing-generation";
import type {
  PipelineStageTrace,
  PipelineTraceSummary,
} from "@/lib/ai/pipeline-trace";
import { PipelineTraceFooter } from "@/components/dev-panel/pipeline-trace-footer";

const STEP_ICONS: Record<string, string> = {
  connecting: "\u{1F4E1}", // 📡
  fetching: "\u{1F4E5}", // 📥
  filtering: "\u{1F50D}", // 🔍
  writing: "\u{270D}\u{FE0F}", // ✍️
  complete: "\u{2705}", // ✅
  error: "\u{274C}", // ❌
};

interface BriefingGenerationProgressProps {
  steps: BriefingGenerationStep[];
  isGenerating: boolean;
  error: string | null;
  onRetry: () => void;
  /** ТЗ-DEV2: Pipeline trace stages (dev mode only) */
  traceStages?: PipelineStageTrace[];
  /** ТЗ-DEV2: Pipeline trace summary (dev mode only) */
  traceSummary?: PipelineTraceSummary | null;
}

export function BriefingGenerationProgress({
  steps,
  isGenerating,
  error,
  onRetry,
  traceStages,
  traceSummary,
}: BriefingGenerationProgressProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">{"\u{2600}\u{FE0F}"}</div>
          <h2 className="text-xl font-semibold">Готовим ваш брифинг</h2>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {steps.map((step) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="flex items-center gap-3"
              >
                <span className="w-6 text-center text-lg">
                  {STEP_ICONS[step.step] ?? "\u{2699}\u{FE0F}"}
                </span>
                <span className="flex-1 text-sm text-foreground">
                  {step.message}
                </span>
                <div className="shrink-0">
                  {step.done ? (
                    <span className="text-xs text-muted-foreground">
                      {"\u{2713}"} {step.detail}
                    </span>
                  ) : (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Generating placeholder when no steps yet */}
          {steps.length === 0 && isGenerating && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 space-y-3 text-center"
          >
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={onRetry}>
              Попробовать снова
            </Button>
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
    </div>
  );
}
