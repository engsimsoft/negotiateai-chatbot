import { Trophy } from "lucide-react";

/**
 * ТЗ-A1: Completed state (phase: completed)
 * Заглушка — проект завершён
 */
export function CompletedState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
          <Trophy className="size-8 text-amber-600" />
        </div>

        <h2 className="text-xl font-semibold">Проект завершён</h2>

        <p className="mt-2 text-muted-foreground">
          Все задачи выполнены. Результаты доступны в панели Пульса.
        </p>
      </div>
    </div>
  );
}
