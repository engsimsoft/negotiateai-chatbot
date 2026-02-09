"use client";

import {
  CheckCircle2,
  Lock,
  Search,
  FileText,
  Eye,
  Brain,
  Play,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProjectTask } from "@/lib/db/schema";

// ============================================================================
// Tool helpers (shared with planning-state)
// ============================================================================

function getToolIcon(tool: string) {
  switch (tool) {
    case "web_search":
      return <Search className="size-3" />;
    case "file_generation":
      return <FileText className="size-3" />;
    case "file_analysis":
      return <Eye className="size-3" />;
    default:
      return null;
  }
}

function getToolLabel(tool: string) {
  switch (tool) {
    case "web_search":
      return "Поиск";
    case "file_generation":
      return "Документы";
    case "file_analysis":
      return "Анализ файлов";
    default:
      return tool;
  }
}

// ============================================================================
// Status helpers
// ============================================================================

function TaskStatusBadge({ status, dependsOn }: { status: string; dependsOn: number[] | null }) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-3" />
          Готова к работе
        </span>
      );
    case "locked": {
      const deps = dependsOn?.join(", ") || "?";
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Зависит от задачи {deps}
        </span>
      );
    }
    default:
      return null;
  }
}

// ============================================================================
// Main component
// ============================================================================

interface ApprovedStateProps {
  projectTasks: ProjectTask[];
}

/**
 * ТЗ-B2: Approved state — карта задач после утверждения плана
 */
export function ApprovedState({ projectTasks }: ApprovedStateProps) {
  const handleStartTask = () => {
    toast("Скоро — в следующем обновлении", {
      description: "Открытие задач будет доступно совсем скоро.",
    });
  };

  if (projectTasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="size-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold">План утверждён</h2>
          <p className="mt-2 text-muted-foreground">Задачи загружаются...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="size-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">План утверждён</h2>
            <p className="text-sm text-muted-foreground">
              {projectTasks.length} задач
            </p>
          </div>
        </div>

        {/* Task cards */}
        <div className="space-y-3">
          {projectTasks.map((task) => (
            <div key={task.id} className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {task.orderIndex}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium">{task.title}</h4>
                    {task.needsReview && (
                      <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                        <Brain className="size-3" />
                        Проверка
                      </Badge>
                    )}
                  </div>

                  {task.goal && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.goal}
                    </p>
                  )}

                  {/* Tools */}
                  {task.tools && task.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {task.tools.map((tool) => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {getToolIcon(tool)}
                          {getToolLabel(tool)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Status */}
                  <div className="mt-2">
                    <TaskStatusBadge
                      status={task.status}
                      dependsOn={task.dependsOn}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Start button (stub) */}
        <div className="pb-8">
          <Button className="w-full gap-2" onClick={handleStartTask}>
            <Play className="size-4" />
            Начать первую задачу
          </Button>
        </div>
      </div>
    </div>
  );
}
