import { CheckCircle2 } from "lucide-react";

/**
 * ТЗ-A1: Approved state (phase: approved)
 * Заглушка — план утверждён
 */
export function ApprovedState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="size-8 text-green-600" />
        </div>

        <h2 className="text-xl font-semibold">План утверждён</h2>

        <p className="mt-2 text-muted-foreground">
          План проекта утверждён. Скоро здесь можно будет перейти
          к выполнению задач.
        </p>
      </div>
    </div>
  );
}
