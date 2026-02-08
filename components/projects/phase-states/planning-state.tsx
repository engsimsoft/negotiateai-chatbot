"use client";

/**
 * ТЗ-B1: PlanningState — три состояния планирования
 *
 * 1. Прогресс — анимация 6 шагов пока Профессор думает
 * 2. Вопросы (needs_input) — текстовые поля + отправка
 * 3. План (complete/partial) — карточки задач, риски, рекомендации
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
  Send,
  ChevronDown,
  MessageSquare,
  Lock,
  Search,
  FileText,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ProfessorPlanJson } from "@/lib/ai/professor-types";

// ============================================================================
// Types
// ============================================================================

interface PlanningStateProps {
  projectId: string;
  planJson: ProfessorPlanJson | null;
  planReport: string | null;
}

// ============================================================================
// Progress steps
// ============================================================================

const PROGRESS_STEPS = [
  "Аудит входных данных",
  "Анализ ресурсов и инструментов",
  "Декомпозиция на задачи",
  "Построение зависимостей",
  "Анализ рисков",
  "Финализация плана",
];

const STEP_INTERVAL_MS = 2000;

// ============================================================================
// Tool helpers
// ============================================================================

function getToolIcon(tool: string) {
  switch (tool) {
    case "web_search":
      return <Search className="size-3" />;
    case "file_generation":
      return <FileText className="size-3" />;
    case "file_analysis":
      return <Eye className="size-3" />;
    default:
      return null;
  }
}

function getToolLabel(tool: string) {
  switch (tool) {
    case "web_search":
      return "Поиск";
    case "file_generation":
      return "Документы";
    case "file_analysis":
      return "Анализ файлов";
    default:
      return tool;
  }
}

// ============================================================================
// State 1: Progress animation
// ============================================================================

function ProgressView({ completedSteps }: { completedSteps: number }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <Loader2 className="size-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold">Профессор анализирует проект</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Это займёт 15–30 секунд
          </p>
        </div>

        <div className="space-y-3">
          {PROGRESS_STEPS.map((label, i) => {
            const isCompleted = i < completedSteps;
            const isActive = i === completedSteps;

            if (i > completedSteps) return null;

            return (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2",
                  isCompleted && "bg-green-50 dark:bg-green-950/30",
                  isActive && "bg-blue-50 dark:bg-blue-950/30"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-5 shrink-0 text-green-600" />
                ) : (
                  <Loader2 className="size-5 shrink-0 text-blue-600 animate-spin" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    isCompleted && "text-green-700 dark:text-green-400",
                    isActive && "text-blue-700 dark:text-blue-400 font-medium"
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// State 2: Questions (needs_input)
// ============================================================================

function QuestionsView({
  questions,
  onSubmit,
  isSubmitting,
}: {
  questions: Array<{ question: string; why: string; blocking: boolean }>;
  onSubmit: (answers: Array<{ question: string; answer: string }>) => void;
  isSubmitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const handleSubmit = () => {
    const result = questions.map((q, i) => ({
      question: q.question,
      answer: answers[i] || "",
    }));
    onSubmit(result);
  };

  const allAnswered = questions.every((_, i) => answers[i]?.trim());

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto p-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
            <AlertTriangle className="size-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold">Профессору нужны уточнения</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ответьте на вопросы, чтобы план был точнее
          </p>
        </div>

        <div className="space-y-6">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2">
              <label className="text-sm font-medium">{q.question}</label>
              <p className="text-xs text-muted-foreground">{q.why}</p>
              <Textarea
                placeholder="Ваш ответ..."
                value={answers[i] || ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                }
                rows={3}
                className="resize-none"
              />
            </div>
          ))}
        </div>

        <Button
          className="mt-6 w-full gap-2"
          onClick={handleSubmit}
          disabled={!allAnswered || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Отправить ответы
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// State 3: Plan display (complete / partial)
// ============================================================================

function PlanView({
  planJson,
  planReport,
}: {
  planJson: ProfessorPlanJson & { status: "complete" | "partial" };
  planReport: string | null;
}) {
  const [reportOpen, setReportOpen] = useState(false);

  const handleOpenManager = () => {
    window.dispatchEvent(new CustomEvent("open-manager-drawer"));
  };

  return (
    <div className="overflow-y-auto p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold">План проекта</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {planJson.tasks.length} задач
            {planJson.status === "partial" && " · с оговорками"}
          </p>
        </div>

        {/* Caveats block (partial only) */}
        {planJson.status === "partial" && planJson.caveats.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
                Профессор рекомендует уточнить
              </span>
            </div>
            <div className="space-y-3">
              {planJson.caveats.map((caveat, i) => (
                <div key={i} className="text-sm">
                  <p className="font-medium">{caveat.issue}</p>
                  <p className="mt-1 text-muted-foreground">
                    {caveat.consequence}
                  </p>
                  <p className="mt-1 text-amber-700 dark:text-amber-400">
                    Затронуты задачи: {caveat.affectedTasks.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        <div className="space-y-3">
          {planJson.tasks.map((task) => (
            <div key={task.order} className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {task.order}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium">{task.title}</h4>
                    {task.needsReview && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        Проверка
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.goal}
                  </p>
                  {task.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {task.tools.map((tool) => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {getToolIcon(tool)}
                          {getToolLabel(tool)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Risks */}
        {planJson.risks.length > 0 && (
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4" />
              Риски
            </h3>
            <div className="space-y-2">
              {planJson.risks.map((risk, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">{risk.description}</p>
                    <Badge
                      variant={
                        risk.severity === "high" ? "destructive" : "secondary"
                      }
                      className="shrink-0 text-xs"
                    >
                      {risk.severity === "high"
                        ? "Высокий"
                        : risk.severity === "medium"
                          ? "Средний"
                          : "Низкий"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {risk.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {planJson.recommendations.length > 0 && (
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4" />
              Рекомендации
            </h3>
            <div className="space-y-2">
              {planJson.recommendations.map((rec, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <p className="text-sm">{rec.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rec.impact}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable report */}
        {planReport && (
          <Collapsible open={reportOpen} onOpenChange={setReportOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-lg border p-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    reportOpen && "rotate-180"
                  )}
                />
                Подробный отчёт Профессора
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {planReport}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pb-8 sm:flex-row">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button className="w-full gap-2" disabled>
                    <Lock className="size-4" />
                    Утвердить план
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Автоматическое утверждение — в будущих обновлениях</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleOpenManager}
          >
            <MessageSquare className="size-4" />
            Обсудить с Менеджером
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function PlanningState({
  projectId,
  planJson,
  planReport,
}: PlanningStateProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [localPlanJson, setLocalPlanJson] = useState<ProfessorPlanJson | null>(
    planJson
  );
  const [localPlanReport, setLocalPlanReport] = useState<string | null>(
    planReport
  );
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const hasFetchedRef = useRef(false);

  const callProfessor = useCallback(
    async (userAnswers?: Array<{ question: string; answer: string }>) => {
      setIsLoading(true);
      setCompletedSteps(0);
      setError(null);

      // Start step animation
      let step = 0;
      timerRef.current = setInterval(() => {
        step++;
        if (step < PROGRESS_STEPS.length) {
          setCompletedSteps(step);
        }
      }, STEP_INTERVAL_MS);

      try {
        const res = await fetch(`/api/projects/${projectId}/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userAnswers }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Ошибка при создании плана");
        }

        const data = await res.json();

        // Complete all steps instantly
        if (timerRef.current) clearInterval(timerRef.current);
        setCompletedSteps(PROGRESS_STEPS.length);

        // Short pause to show all steps completed
        await new Promise((resolve) => setTimeout(resolve, 600));

        setLocalPlanJson(data.planJson);
        setLocalPlanReport(data.planReport);
        setIsLoading(false);

        router.refresh();
      } catch (err) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsLoading(false);
        setError(
          err instanceof Error ? err.message : "Произошла непредвиденная ошибка"
        );
      }
    },
    [projectId, router]
  );

  // Auto-trigger on mount if no plan exists
  useEffect(() => {
    if (!localPlanJson && !isLoading && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      callProfessor();
    }
  }, [localPlanJson, isLoading, callProfessor]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // State 1: Loading / Progress
  if (isLoading) {
    return <ProgressView completedSteps={completedSteps} />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
            <AlertTriangle className="size-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold">Ошибка</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-6" onClick={() => callProfessor()}>
            Попробовать снова
          </Button>
        </div>
      </div>
    );
  }

  // State 2: Questions (needs_input)
  if (localPlanJson?.status === "needs_input") {
    return (
      <QuestionsView
        questions={localPlanJson.questions}
        onSubmit={(answers) => callProfessor(answers)}
        isSubmitting={isLoading}
      />
    );
  }

  // State 3: Plan ready (complete / partial)
  if (
    localPlanJson &&
    (localPlanJson.status === "complete" || localPlanJson.status === "partial")
  ) {
    return <PlanView planJson={localPlanJson} planReport={localPlanReport} />;
  }

  return null;
}
