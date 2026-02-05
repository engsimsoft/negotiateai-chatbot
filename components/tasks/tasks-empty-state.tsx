"use client";

import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface TasksEmptyStateProps {
  projectId: string;
}

/**
 * ТЗ-07C1: Пустое состояние страницы задач
 */
export function TasksEmptyState({ projectId }: TasksEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <ClipboardList className="size-8 text-muted-foreground" />
      </div>

      <h2 className="mb-2 text-lg font-semibold">Нет задач</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Здесь будут отображаться задачи проекта. Создайте первую задачу для работы с AI.
      </p>

      <Button asChild>
        <Link href={`/projects/${projectId}/chat`}>
          <Plus className="mr-2 size-4" />
          Новая задача
        </Link>
      </Button>
    </div>
  );
}
