"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Sparkles, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface WelcomeStateProps {
  projectId: string;
  hasFiles: boolean;
}

/**
 * ТЗ-A3: Welcome state (phase: setup/documents)
 * Показывается при первом открытии проекта
 * Адаптивная кнопка: «Начать планирование» / «Начать планирование без документов»
 */
export function WelcomeState({ projectId, hasFiles }: WelcomeStateProps) {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleStartPlanning = async () => {
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "planning" }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update phase:", error);
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-8 text-primary" />
        </div>

        <h2 className="text-xl font-semibold">
          Добро пожаловать в проект
        </h2>

        <p className="mt-2 text-muted-foreground">
          {hasFiles
            ? "Файлы загружены. Начните планирование, чтобы AI составил план работы."
            : "Загрузите файлы проекта для лучшего результата или начните планирование сразу."}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {!hasFiles && (
            <p className="text-xs text-muted-foreground">
              Загрузите файлы в панели Пульса слева
            </p>
          )}

          <Button
            className="gap-2"
            onClick={handleStartPlanning}
            disabled={isTransitioning}
          >
            {isTransitioning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ListChecks className="size-4" />
            )}
            {hasFiles ? "Начать планирование" : "Начать планирование без документов"}
          </Button>
        </div>

        {hasFiles && (
          <p className="mt-4 text-xs text-muted-foreground">
            Файлы проекта можно посмотреть в панели Пульса слева
          </p>
        )}
      </div>
    </div>
  );
}
