"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface NewTaskCardProps {
  projectId: string;
}

/**
 * ТЗ-07C3: Карточка "Новая задача" для страницы проекта
 * Клик → создаёт новый чат в проекте и переходит в него
 */
export function NewTaskCard({ projectId }: NewTaskCardProps) {
  return (
    <Link
      href={`/projects/${projectId}/chat`}
      className="group flex flex-1 items-center gap-2.5 rounded-2xl border border-border bg-background px-4 py-3.5 shadow-sm transition-all hover:border-primary hover:shadow-md"
    >
      <span className="text-xl">➕</span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          Новая задача
        </span>
        <span className="text-xs text-muted-foreground">
          Начать работу
        </span>
      </div>
      <ArrowRight className="ml-auto size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  );
}
