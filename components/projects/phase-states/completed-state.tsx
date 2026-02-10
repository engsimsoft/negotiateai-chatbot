import Link from "next/link";
import { Trophy, Check } from "lucide-react";
import type { ProjectTask } from "@/lib/db/schema";

interface CompletedStateProps {
  projectId: string;
  projectTasks: ProjectTask[];
}

/**
 * ТЗ-C2: Completed state (phase: completed)
 * Показывает список завершённых задач с результатами
 */
export function CompletedState({ projectId, projectTasks }: CompletedStateProps) {
  const doneCount = projectTasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex h-full flex-col items-center p-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
            <Trophy className="size-7 text-amber-600" />
          </div>

          <h2 className="text-xl font-semibold">Проект завершён</h2>

          <p className="mt-1.5 text-sm text-muted-foreground">
            {doneCount === projectTasks.length
              ? `Все ${doneCount} задач выполнены`
              : `Выполнено ${doneCount} из ${projectTasks.length} задач`}
          </p>
        </div>

        {/* Task list */}
        {projectTasks.length > 0 && (
          <div className="mt-8 space-y-2">
            {projectTasks.map((task) => {
              const href = task.chatId
                ? `/projects/${projectId}/tasks/${task.id}`
                : undefined;

              const content = (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <Check className="size-4 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{task.title}</span>
                    {task.goal && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {task.goal}
                      </p>
                    )}
                  </div>
                </div>
              );

              if (href) {
                return (
                  <Link
                    key={task.id}
                    href={href}
                    className="block rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div key={task.id} className="rounded-lg border bg-background p-3">
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
