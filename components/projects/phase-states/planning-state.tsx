import { ClipboardList } from "lucide-react";

/**
 * ТЗ-A1: Planning state (phase: planning)
 * Заглушка — планирование в разработке
 */
export function PlanningState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
          <ClipboardList className="size-8 text-blue-600" />
        </div>

        <h2 className="text-xl font-semibold">Планирование</h2>

        <p className="mt-2 text-muted-foreground">
          Режим планирования скоро будет доступен. Менеджер проекта
          поможет составить план задач на основе загруженных файлов.
        </p>
      </div>
    </div>
  );
}
