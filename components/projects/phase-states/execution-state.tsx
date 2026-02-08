"use client";

import { Check, Circle, Loader2, Plus, MessageSquare } from "lucide-react";
import Link from "next/link";

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

interface ExecutionStateProps {
  projectId: string;
  tasks: Task[];
}

function statusIcon(status: TaskStatus) {
  switch (status) {
    case "done":
      return <Check className="size-4 text-green-600" />;
    case "in_progress":
      return <Loader2 className="size-4 text-blue-600" />;
    default:
      return <Circle className="size-4 text-muted-foreground" />;
  }
}

function statusLabel(status: TaskStatus) {
  switch (status) {
    case "done":
      return "Готово";
    case "in_progress":
      return "В работе";
    default:
      return "Не начата";
  }
}

/**
 * ТЗ-A1: Execution state (phase: execution)
 * Сетка карточек задач (чатов) с навигацией
 */
export function ExecutionState({ projectId, tasks }: ExecutionStateProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="size-8 text-muted-foreground" />
          </div>

          <h2 className="text-xl font-semibold">Нет задач</h2>

          <p className="mt-2 text-muted-foreground">
            Создайте первую задачу, чтобы начать работу над проектом.
          </p>

          <Button className="mt-6 gap-2" asChild>
            <Link href={`/projects/${projectId}/chat`}>
              <Plus className="size-4" />
              Новая задача
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Задачи</h2>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link href={`/projects/${projectId}/chat`}>
            <Plus className="size-4" />
            Новая задача
          </Link>
        </Button>
      </div>

      {/* Task grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={`/projects/${projectId}/chat/${task.id}`}
            className="group rounded-xl border bg-background p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {statusIcon(task.taskStatus)}
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  className={cn(
                    "font-medium text-sm truncate",
                    task.taskStatus === "done" && "text-muted-foreground"
                  )}
                >
                  {task.title}
                </h3>
                {task.summary && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {task.summary}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {statusIcon(task.taskStatus)}
                  <span>{statusLabel(task.taskStatus)}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
