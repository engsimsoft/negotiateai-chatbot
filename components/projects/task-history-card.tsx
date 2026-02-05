"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface TaskHistoryCardProps {
  projectId: string;
  count: number;
}

/**
 * ТЗ-07C1: Карточка "История задач" для страницы проекта
 * Аналог ChatHistoryCard, но для проектных задач
 */
export function TaskHistoryCard({ projectId, count }: TaskHistoryCardProps) {
  const label = count === 1 ? "задача" : count >= 2 && count <= 4 ? "задачи" : "задач";

  return (
    <Link
      href={`/projects/${projectId}/tasks`}
      className="group flex shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-background px-4 py-3.5 shadow-sm transition-all hover:border-primary hover:shadow-md"
      style={{ minWidth: 160 }}
    >
      <span className="text-xl">📋</span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          История задач
        </span>
        <span className="text-xs text-muted-foreground">
          {count} {label}
        </span>
      </div>
      <ArrowRight className="ml-1 size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  );
}
