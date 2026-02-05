"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowRight,
  Check,
  Circle,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TaskStatus = "not_started" | "in_progress" | "done";

interface Task {
  id: string;
  title: string;
  summary: string | null;
  taskStatus: TaskStatus;
  createdAt: Date;
}

interface ProjectPulseProps {
  projectId: string;
  tasks: Task[];
  projectSummary: string | null;
  summaryUpdatedAt: Date | null;
}

/**
 * ТЗ-07C2: Пульс проекта
 * Живая панель состояния проекта в правой колонке
 */
export function ProjectPulse({
  projectId,
  tasks,
  projectSummary,
  summaryUpdatedAt,
}: ProjectPulseProps) {
  const [summary, setSummary] = useState(projectSummary);
  const [updatedAt, setUpdatedAt] = useState(summaryUpdatedAt);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate status counts
  const statusCounts = tasks.reduce(
    (acc, task) => {
      const status = task.taskStatus || "not_started";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { done: 0, in_progress: 0, not_started: 0 } as Record<TaskStatus, number>
  );

  // Get active tasks (in_progress)
  const activeTasks = tasks
    .filter((t) => t.taskStatus === "in_progress")
    .slice(0, 5);

  // Get last task by createdAt
  const lastTask = tasks.length > 0
    ? tasks.reduce((latest, task) =>
        new Date(task.createdAt) > new Date(latest.createdAt) ? task : latest
      )
    : null;

  // Refresh summary handler
  const handleRefreshSummary = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/generate-summary`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        setUpdatedAt(data.summaryUpdatedAt ? new Date(data.summaryUpdatedAt) : null);
      }
    } catch (error) {
      console.error("Failed to refresh summary:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Empty state
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <Sparkles className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium">Пульс проекта</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Пока нет задач. Поставьте первую задачу через поле ввода выше.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {/* Gradient top bar */}
      <div className="h-1.5 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="size-5 text-primary" />
          <h3 className="font-semibold">Пульс проекта</h3>
        </div>

        {/* Status counts */}
        <div className="flex items-center gap-3 text-sm mb-6">
          {statusCounts.done > 0 && (
            <span className="flex items-center gap-1.5 text-green-600">
              <Check className="size-4" />
              {statusCounts.done} готово
            </span>
          )}
          {statusCounts.in_progress > 0 && (
            <span className="flex items-center gap-1.5 text-blue-600">
              <Loader2 className="size-4" />
              {statusCounts.in_progress} в работе
            </span>
          )}
          {statusCounts.not_started > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Circle className="size-4" />
              {statusCounts.not_started}
            </span>
          )}
        </div>

        {/* Project summary */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Где мы сейчас
            </h4>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              onClick={handleRefreshSummary}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            </Button>
          </div>

          {summary ? (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm leading-relaxed">{summary}</p>
              {updatedAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Обновлён: {formatDistanceToNow(new Date(updatedAt), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-center">
              <p className="text-sm text-muted-foreground">
                Нажмите 🔄 чтобы сгенерировать итог
              </p>
            </div>
          )}
        </div>

        {/* Active tasks */}
        {activeTasks.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Активные задачи
            </h4>
            <div className="space-y-1.5">
              {activeTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${projectId}/chat/${task.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <Loader2 className="size-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{task.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Last task */}
        {lastTask && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Последняя задача
            </h4>
            <div className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h5 className="font-medium text-sm truncate">{lastTask.title}</h5>
                  {lastTask.summary && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {lastTask.summary}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {format(new Date(lastTask.createdAt), "d MMM", { locale: ru })}
                    </span>
                    <span>·</span>
                    {lastTask.taskStatus === "done" ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Check className="size-3" />
                        Готово
                      </span>
                    ) : lastTask.taskStatus === "in_progress" ? (
                      <span className="flex items-center gap-1 text-blue-600">
                        <Loader2 className="size-3" />
                        В работе
                      </span>
                    ) : (
                      <span>Не начата</span>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="shrink-0" asChild>
                  <Link href={`/projects/${projectId}/chat/${lastTask.id}`}>
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
