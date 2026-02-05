"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRight, Check, MessageSquare, RotateCcw, Star } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { TaskWithStats } from "./tasks-page-content";

interface TaskDetailPanelProps {
  task: TaskWithStats | null;
  projectId: string;
  onToggleStar: (taskId: string) => void;
  onToggleTaskStatus: (taskId: string) => void;
}

/**
 * ТЗ-07C1: Панель деталей задачи (правая колонка)
 * ТЗ-07C2: Добавлена кнопка "Готово" для изменения статуса
 */
export function TaskDetailPanel({
  task,
  projectId,
  onToggleStar,
  onToggleTaskStatus,
}: TaskDetailPanelProps) {
  if (!task) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        <p>Выберите задачу из списка</p>
      </div>
    );
  }

  const formattedDate = format(new Date(task.createdAt), "d MMMM yyyy, HH:mm", {
    locale: ru,
  });

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header with title */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">{task.title || "Новая задача"}</h2>
          <Button
            size="icon"
            variant="ghost"
            className={task.isStarred ? "text-yellow-500" : "text-muted-foreground"}
            onClick={() => onToggleStar(task.id)}
          >
            <Star
              className="size-5"
              fill={task.isStarred ? "currentColor" : "none"}
            />
          </Button>
        </div>

        {/* Meta */}
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{formattedDate}</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-4" />
            {task.messageCount} сообщений
          </span>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={`/projects/${projectId}/chat/${task.id}`}>
              Открыть задачу
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>

          {/* ТЗ-07C2: Toggle task status button */}
          {task.taskStatus === "done" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onToggleTaskStatus(task.id)}
            >
              <RotateCcw className="mr-2 size-4" />
              Вернуть в работу
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:bg-green-50 hover:text-green-700"
              onClick={() => onToggleTaskStatus(task.id)}
            >
              <Check className="mr-2 size-4" />
              Отметить готово
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      {task.summary ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            О чём задача
          </h3>
          <p className="text-sm leading-relaxed">{task.summary}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Краткое описание отсутствует
        </div>
      )}
    </div>
  );
}
