"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProjectPassportProps {
  projectId: string;
  description?: string | null;
  instruction?: string | null;
  context?: string | null;
}

/**
 * ТЗ-07A: Паспорт проекта с табами
 * - Паспорт: Цель, Контекст, Помощники
 * - Инструкция: Инструкция для AI
 */
export function ProjectPassport({
  projectId,
  description,
  instruction,
  context,
}: ProjectPassportProps) {
  const [activeTab, setActiveTab] = useState<"passport" | "instruction">("passport");

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("passport")}
          className={cn(
            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "passport"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Паспорт
        </button>
        <button
          onClick={() => setActiveTab("instruction")}
          className={cn(
            "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "instruction"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Инструкция
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "passport" ? (
          <div className="space-y-4">
            {/* Цель */}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Цель
              </div>
              <div className="text-sm leading-relaxed text-foreground">
                {description || "Не указана"}
              </div>
            </div>

            {/* Контекст */}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Контекст
              </div>
              <div className="text-sm leading-relaxed text-foreground">
                {context || "Контекст проекта не задан"}
              </div>
            </div>

            {/* Помощники */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Помощники
              </div>
              <div className="flex flex-wrap gap-2">
                {/* TODO: Add helpers to project */}
                <span className="rounded-md bg-muted px-2.5 py-1 text-sm text-muted-foreground">
                  + добавить
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-foreground">
            {instruction || "Инструкция не задана. Укажите, как AI должен работать с этим проектом."}
          </div>
        )}
      </div>
    </div>
  );
}
