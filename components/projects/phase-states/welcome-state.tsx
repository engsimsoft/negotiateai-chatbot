import { Upload, ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface WelcomeStateProps {
  projectId: string;
  hasFiles: boolean;
}

/**
 * ТЗ-A1: Welcome state (phase: setup/documents)
 * Показывается при первом открытии проекта
 */
export function WelcomeState({ projectId, hasFiles }: WelcomeStateProps) {
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
          Загрузите файлы проекта или начните планирование задач.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" className="gap-2" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              Загрузить файлы
              <input type="file" multiple className="hidden" />
            </label>
          </Button>

          <Button className="gap-2" asChild>
            <Link href={`/projects/${projectId}/chat`}>
              <ListChecks className="size-4" />
              Начать работу
            </Link>
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
