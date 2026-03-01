// ТЗ-MR Этап 3: Meeting processing progress — shows live pipeline steps
// Pattern: briefing-generation-progress.tsx (steps, animation, error/retry)

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MeetingProcessingStep } from "@/hooks/use-meeting-processing";

const STEP_ICONS: Record<string, string> = {
  uploading: "\u{1F4E4}", // 📤
  transcribing: "\u{1F3A4}", // 🎤
  summarizing: "\u{270D}\u{FE0F}", // ✍️
  saving: "\u{1F4BE}", // 💾
  complete: "\u{2705}", // ✅
  error: "\u{274C}", // ❌
};

interface MeetingProgressProps {
  steps: MeetingProcessingStep[];
  isProcessing: boolean;
  error: string | null;
  onRetry: () => void;
}

export function MeetingProgress({
  steps,
  isProcessing,
  error,
  onRetry,
}: MeetingProgressProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">{"\u{1F3A4}"}</div>
          <h2 className="font-serif text-xl font-semibold">
            Обрабатываем запись
          </h2>
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
          {steps.length === 0 && isProcessing && (
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
      </div>
    </div>
  );
}
