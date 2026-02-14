"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Lock,
  Search,
  FileText,
  Eye,
  Brain,
  Play,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProjectTask } from "@/lib/db/schema";

// ============================================================================
// Tool helpers (shared with planning-state)
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
// Status helpers
// ============================================================================

function TaskStatusBadge({ status, dependsOn }: { status: string; dependsOn: number[] | null }) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-3" />
          Готова к работе
        </span>
      );
    case "locked": {
      const deps = dependsOn?.join(", ") || "?";
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Зависит от задачи {deps}
        </span>
      );
    }
    default:
      return null;
  }
}

// ============================================================================
// Main component
// ============================================================================

interface ApprovedStateProps {
  projectId: string;
  projectTasks: ProjectTask[];
}

/**
 * ТЗ-B2 + ТЗ-C1: Approved state — карта задач после утверждения плана
 * Клик по задаче → переход на страницу чата с Экспертом
 */
export function ApprovedState({ projectId, projectTasks }: ApprovedStateProps) {
  const router = useRouter();
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false);
  const [lockedTask, setLockedTask] = useState<ProjectTask | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleTaskClick = (task: ProjectTask) => {
    if (task.status === "locked") {
      setLockedTask(task);
      setLockedDialogOpen(true);
    } else {
      router.push(`/projects/${projectId}/tasks/${task.id}`);
    }
  };

  const handleUnlockAndNavigate = async () => {
    if (!lockedTask) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${lockedTask.id}/unlock`,
        { method: "POST" }
      );
      if (res.ok) {
        setLockedDialogOpen(false);
        router.push(`/projects/${projectId}/tasks/${lockedTask.id}`);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleStartFirstTask = () => {
    // Find first pending task
    const firstPending = projectTasks.find((t) => t.status === "pending");
    if (firstPending) {
      router.push(`/projects/${projectId}/tasks/${firstPending.id}`);
      return;
    }
    // If no pending, find first locked and offer to unlock
    const firstLocked = projectTasks.find((t) => t.status === "locked");
    if (firstLocked) {
      setLockedTask(firstLocked);
      setLockedDialogOpen(true);
    }
  };

  if (projectTasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="size-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold">План утверждён</h2>
          <p className="mt-2 text-muted-foreground">Задачи загружаются...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="size-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">План утверждён</h2>
            <p className="text-sm text-muted-foreground">
              {projectTasks.length} задач
            </p>
          </div>
        </div>

        {/* Task cards — clickable (ТЗ-C1) */}
        <div className="space-y-3">
          {projectTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => handleTaskClick(task)}
              className="w-full rounded-xl border p-4 text-left transition-all hover:border-primary hover:shadow-sm cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {task.orderIndex}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium">{task.title}</h4>
                    {task.needsReview && (
                      <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                        <Brain className="size-3" />
                        Проверка
                      </Badge>
                    )}
                  </div>

                  {task.goal && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.goal}
                    </p>
                  )}

                  {/* Tools */}
                  {task.tools && task.tools.length > 0 && (
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

                  {/* Status */}
                  <div className="mt-2">
                    <TaskStatusBadge
                      status={task.status}
                      dependsOn={task.dependsOn}
                    />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Start button */}
        <div className="pb-8">
          <Button className="w-full gap-2" onClick={handleStartFirstTask}>
            <Play className="size-4" />
            Начать первую задачу
          </Button>
        </div>
      </div>

      {/* ТЗ-C1: AlertDialog for locked tasks */}
      <AlertDialog open={lockedDialogOpen} onOpenChange={setLockedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Задача заблокирована</AlertDialogTitle>
            <AlertDialogDescription>
              Рекомендуем сначала завершить{" "}
              {lockedTask?.dependsOn?.length
                ? `задач${lockedTask.dependsOn.length > 1 ? "и" : "у"} ${lockedTask.dependsOn.join(", ")}`
                : "предыдущие задачи"}
              . Результаты предыдущих задач используются в следующих.
              <br />
              <br />
              Начать всё равно?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnlocking}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlockAndNavigate}
              disabled={isUnlocking}
            >
              {isUnlocking ? "Разблокировка..." : "Начать задачу"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
