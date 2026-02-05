"use client";

import { ArrowRight } from "lucide-react";

interface ManagerCardProps {
  onOpen: () => void;
}

/**
 * ТЗ-07C3: Карточка "Менеджер" для страницы проекта
 * Клик → открывает модалку Менеджера проекта
 */
export function ManagerCard({ onOpen }: ManagerCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-1 items-center gap-2.5 rounded-2xl border border-border bg-background px-4 py-3.5 shadow-sm transition-all hover:border-primary hover:shadow-md text-left"
    >
      <span className="text-xl">👤</span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          Менеджер
        </span>
        <span className="text-xs text-muted-foreground">
          Организовать работу
        </span>
      </div>
      <ArrowRight className="ml-auto size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </button>
  );
}
