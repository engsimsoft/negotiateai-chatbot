"use client";

/**
 * Professor Progress Component (ТЗ-03, Фаза 7)
 *
 * Displays the progress of the Professor Pipeline with:
 * - Phase indicator (Analyze, Execute, Synthesize)
 * - Subtask list with checkboxes
 * - Real-time status updates
 */

import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, AlertCircle, Brain, Zap, Sparkles } from "lucide-react";
import type { PipelinePhase, Subtask } from "@/lib/ai/professor-pipeline";

interface ProfessorProgressProps {
  phase: PipelinePhase | null;
  subtasks: Subtask[];
  isComplete: boolean;
  error?: string;
}

/**
 * Phase configuration
 */
const PHASE_CONFIG: Record<PipelinePhase, { icon: typeof Brain; label: string; color: string }> = {
  analyze: {
    icon: Brain,
    label: "Анализ задачи",
    color: "text-purple-500",
  },
  execute: {
    icon: Zap,
    label: "Выполнение подзадач",
    color: "text-primary",
  },
  synthesize: {
    icon: Sparkles,
    label: "Синтез результата",
    color: "text-emerald-500",
  },
};

/**
 * Subtask status icon
 */
function SubtaskStatusIcon({ status }: { status: Subtask["status"] }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="size-3 text-emerald-500" />
        </div>
      );
    case "in_progress":
      return (
        <div className="flex size-5 items-center justify-center">
          <Loader2 className="size-4 text-primary animate-spin" />
        </div>
      );
    case "error":
      return (
        <div className="flex size-5 items-center justify-center rounded-full bg-red-500/20">
          <AlertCircle className="size-3 text-red-500" />
        </div>
      );
    default:
      return (
        <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
      );
  }
}

/**
 * Professor Progress Component
 */
export function ProfessorProgress({
  phase,
  subtasks,
  isComplete,
  error,
}: ProfessorProgressProps) {
  if (!phase && subtasks.length === 0 && !error) {
    return null;
  }

  const currentPhaseConfig = phase ? PHASE_CONFIG[phase] : null;
  const PhaseIcon = currentPhaseConfig?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-muted/30 p-4 mb-4"
    >
      {/* Header with phase */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
          <span className="text-lg">🎓</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Режим Профессор</div>
          {currentPhaseConfig && PhaseIcon && !isComplete && (
            <div className={`flex items-center gap-1.5 text-xs ${currentPhaseConfig.color}`}>
              <PhaseIcon className="size-3" />
              <span>{currentPhaseConfig.label}</span>
            </div>
          )}
          {isComplete && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <Check className="size-3" />
              <span>Завершено</span>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 mb-3">
          <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
          <span className="text-sm text-red-500">{error}</span>
        </div>
      )}

      {/* Subtasks list */}
      <AnimatePresence mode="popLayout">
        {subtasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {subtasks.map((subtask, index) => (
              <motion.div
                key={subtask.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  flex items-start gap-3 rounded-lg p-2.5 transition-colors
                  ${subtask.status === "in_progress" ? "bg-primary/5" : ""}
                  ${subtask.status === "error" ? "bg-red-500/5" : ""}
                `}
              >
                <div className="mt-0.5">
                  <SubtaskStatusIcon status={subtask.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`
                    text-sm font-medium leading-tight
                    ${subtask.status === "completed" ? "text-muted-foreground" : ""}
                    ${subtask.status === "error" ? "text-red-500" : ""}
                  `}>
                    {subtask.title}
                  </div>
                  {subtask.status === "in_progress" && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Выполняется...
                    </div>
                  )}
                  {subtask.error && (
                    <div className="text-xs text-red-400 mt-0.5">
                      {subtask.error}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {index + 1}/{subtasks.length}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar */}
      {subtasks.length > 0 && !isComplete && (
        <div className="mt-3 pt-3 border-t">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{
                width: `${(subtasks.filter(s => s.status === "completed").length / subtasks.length) * 100}%`,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>
              {subtasks.filter(s => s.status === "completed").length} из {subtasks.length} подзадач
            </span>
            {phase === "synthesize" && (
              <span className="text-emerald-500">Синтез...</span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default ProfessorProgress;
