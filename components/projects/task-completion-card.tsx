"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  ThumbsUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast";
import type { TaskSummary, ProfessorVerdict } from "@/lib/ai/task-completion-types";

interface TaskCompletionCardProps {
  projectId: string;
  taskId: string;
  taskStatus: "done" | "issues";
  outputSummary: TaskSummary | null;
  professorVerdict: ProfessorVerdict | null;
  nextTaskId?: string;
  onReopened?: () => void;
  onAccepted?: () => void;
}

export function TaskCompletionCard({
  projectId,
  taskId,
  taskStatus,
  professorVerdict,
  nextTaskId,
  onReopened,
  onAccepted,
}: TaskCompletionCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const verdictType = professorVerdict?.verdict;
  const isSuccess = taskStatus === "done";
  const isIssues = taskStatus === "issues" && verdictType !== "critical";
  const isCritical = taskStatus === "issues" && verdictType === "critical";

  async function handleReopen() {
    setIsReopening(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/reopen`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reopen task");
      }
      toast({ type: "success", description: "Задача возвращена в работу" });
      onReopened?.();
      router.refresh();
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Ошибка при возврате задачи",
      });
    } finally {
      setIsReopening(false);
    }
  }

  async function handleAccept() {
    setIsAccepting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/accept`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept task");
      }
      const result = await res.json();
      toast({ type: "success", description: "Задача принята" });
      onAccepted?.();
      if (result.projectCompleted) {
        router.push(`/projects/${projectId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Ошибка при принятии задачи",
      });
    } finally {
      setIsAccepting(false);
    }
  }

  // --- Success card ---
  if (isSuccess) {
    return (
      <div className="mx-auto mb-4 w-full max-w-2xl rounded-xl border border-green-500/20 bg-green-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500/20">
            <CheckCircle2 className="size-4 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">
              Задача завершена
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Результаты сохранены и будут использованы в следующих задачах.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {nextTaskId && (
            <Button
              size="sm"
              onClick={() =>
                router.push(`/projects/${projectId}/tasks/${nextTaskId}`)
              }
            >
              Следующая задача
              <ChevronRight className="ml-1 size-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}`)}
          >
            <ArrowLeft className="mr-1 size-4" />К проекту
          </Button>
        </div>
      </div>
    );
  }

  // --- Issues / Critical card ---
  return (
    <div
      className={`mx-auto mb-4 w-full max-w-2xl rounded-xl border p-5 ${
        isCritical
          ? "border-red-500/20 bg-red-500/5"
          : "border-amber-500/20 bg-amber-500/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            isCritical ? "bg-red-500/20" : "bg-amber-500/20"
          }`}
        >
          {isCritical ? (
            <XCircle className="size-4 text-red-600" />
          ) : (
            <AlertTriangle className="size-4 text-amber-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-semibold ${
              isCritical
                ? "text-red-700 dark:text-red-400"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            {isCritical ? "Критические замечания" : "Замечания Профессора"}
          </h3>
          {professorVerdict?.shortSummary && (
            <p className="mt-1 text-sm text-muted-foreground">
              {professorVerdict.shortSummary}
            </p>
          )}
        </div>
      </div>

      {/* Expandable details */}
      {professorVerdict && (professorVerdict.fullAnalysis || professorVerdict.issues.length > 0) && (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            Подробнее
          </button>

          {isExpanded && (
            <div className="mt-3 border-t pt-3">
              <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                {professorVerdict.issues.length > 0 && (
                  <div className="space-y-2">
                    {professorVerdict.issues.map((issue, i) => (
                      <div key={i} className="rounded-lg bg-background/60 p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              issue.severity === "critical"
                                ? "bg-red-500/15 text-red-600"
                                : issue.severity === "major"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : "bg-primary/15 text-primary"
                            }`}
                          >
                            {issue.severity}
                          </span>
                          {issue.criterion && (
                            <span className="text-xs text-muted-foreground">
                              {issue.criterion}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm">{issue.description}</p>
                        {issue.suggestion && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Рекомендация: {issue.suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {professorVerdict.fullAnalysis && (
                  <div className="rounded-lg bg-background/60 p-3">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {professorVerdict.fullAnalysis}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp className="size-3.5" />
                Свернуть
              </button>
            </div>
          )}
        </>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleReopen}
          disabled={isReopening || isAccepting}
        >
          {isReopening ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-1 size-4" />
          )}
          Доработать
        </Button>

        {isIssues && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAccept}
            disabled={isReopening || isAccepting}
          >
            {isAccepting ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <ThumbsUp className="mr-1 size-4" />
            )}
            Принять
          </Button>
        )}
      </div>
    </div>
  );
}
