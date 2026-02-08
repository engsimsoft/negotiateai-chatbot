"use client";

import { useState } from "react";
import {
  Check,
  Circle,
  Loader2,
  ListTodo,
  FolderOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  Brain,
} from "lucide-react";
import Link from "next/link";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ProjectFilesCard } from "@/components/projects/project-files-card";
import { cn } from "@/lib/utils";
import type { ProjectFile, ProjectFolder } from "@/lib/db/schema";
import type { ProfessorPlanJson } from "@/lib/ai/professor-types";
import { isPlanWithTasks } from "@/lib/ai/professor-types";

type TaskStatus = "not_started" | "in_progress" | "done";

interface Task {
  id: string;
  title: string;
  summary: string | null;
  taskStatus: TaskStatus;
  createdAt: Date;
}

interface ProjectPulseProps {
  projectId: string;
  phase: string;
  tasks: Task[];
  files: ProjectFile[];
  folders: ProjectFolder[];
  planJson: ProfessorPlanJson | null;
  // Passport data
  projectName: string;
  description: string | null;
  instruction: string | null;
  context: string | null;
  createdAt: Date;
}

// Status icon mapping
function TaskStatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "done":
      return <Check className="size-3.5 text-green-600 shrink-0" />;
    case "in_progress":
      return <Loader2 className="size-3.5 text-blue-600 shrink-0" />;
    default:
      return <Circle className="size-3.5 text-muted-foreground shrink-0" />;
  }
}

// Section header component
function SectionHeader({
  icon: Icon,
  title,
  count,
  isOpen,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  isOpen: boolean;
}) {
  return (
    <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
      {isOpen ? (
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-left">{title}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
    </CollapsibleTrigger>
  );
}

/**
 * ТЗ-A1: Пульс проекта — навигационная панель с тремя сворачиваемыми секциями
 *
 * Секции:
 * 1. 📋 План — задачи со статусами
 * 2. 📁 Файлы — ProjectFilesCard
 * 3. ⚙️ Паспорт — описание, контекст, мета
 */
export function ProjectPulse({
  projectId,
  phase,
  tasks,
  files,
  folders,
  planJson,
  projectName,
  description,
  instruction,
  context,
  createdAt,
}: ProjectPulseProps) {
  const [planOpen, setPlanOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [passportOpen, setPassportOpen] = useState(false);

  // Plan tasks from Professor (planning phase)
  const hasPlanTasks = planJson && isPlanWithTasks(planJson);
  const planTasks = hasPlanTasks ? planJson.tasks : [];
  const isPlanning = phase === "planning";

  // Status counts for execution-phase tasks
  const statusCounts = tasks.reduce(
    (acc, task) => {
      const status = task.taskStatus || "not_started";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { done: 0, in_progress: 0, not_started: 0 } as Record<TaskStatus, number>
  );

  // Determine plan section count
  const planCount = isPlanning ? planTasks.length : tasks.length;

  return (
    <div className="flex flex-col">
      {/* ═══════════════ Section 1: План ═══════════════ */}
      <Collapsible open={planOpen} onOpenChange={setPlanOpen}>
        <div className="border-b">
          <SectionHeader
            icon={ListTodo}
            title="План"
            count={planCount || undefined}
            isOpen={planOpen}
          />
        </div>

        <CollapsibleContent>
          <div className="border-b">
            {isPlanning ? (
              /* Planning phase: show professor's planned tasks or analyzing state */
              hasPlanTasks ? (
                <div className="py-1">
                  {planTasks.map((task) => (
                    <div
                      key={task.order}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {task.order}
                      </span>
                      <span className="flex-1 truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 px-4 py-6 justify-center text-sm text-muted-foreground">
                  <Brain className="size-4 animate-pulse" />
                  <span>Анализ проекта...</span>
                </div>
              )
            ) : tasks.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Нет задач. Создайте первую задачу в рабочей области.
              </div>
            ) : (
              <>
                {/* Status counters */}
                <div className="flex items-center gap-3 px-4 py-2 text-xs border-b bg-muted/30">
                  {statusCounts.done > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Check className="size-3" />
                      {statusCounts.done}
                    </span>
                  )}
                  {statusCounts.in_progress > 0 && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Loader2 className="size-3" />
                      {statusCounts.in_progress}
                    </span>
                  )}
                  {statusCounts.not_started > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Circle className="size-3" />
                      {statusCounts.not_started}
                    </span>
                  )}
                </div>

                {/* Task list */}
                <div className="py-1">
                  {tasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/projects/${projectId}/chat/${task.id}`}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors group"
                    >
                      <TaskStatusIcon status={task.taskStatus} />
                      <span
                        className={cn(
                          "flex-1 truncate",
                          task.taskStatus === "done" &&
                            "text-muted-foreground line-through"
                        )}
                      >
                        {task.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════════ Section 2: Файлы ═══════════════ */}
      <Collapsible open={filesOpen} onOpenChange={setFilesOpen}>
        <div className="border-b">
          <SectionHeader
            icon={FolderOpen}
            title="Файлы"
            count={files.length}
            isOpen={filesOpen}
          />
        </div>

        <CollapsibleContent>
          <div className="border-b">
            <ProjectFilesCard
              projectId={projectId}
              files={files}
              folders={folders}
              compact
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══════════════ Section 3: Паспорт ═══════════════ */}
      <Collapsible open={passportOpen} onOpenChange={setPassportOpen}>
        <div className="border-b">
          <SectionHeader
            icon={Settings}
            title="Паспорт"
            isOpen={passportOpen}
          />
        </div>

        <CollapsibleContent>
          <div className="space-y-4 px-4 py-3 border-b">
            {/* Описание */}
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Описание
              </div>
              <div className="text-sm leading-relaxed">
                {description || "Не указано"}
              </div>
            </div>

            {/* Контекст */}
            {context && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Контекст
                </div>
                <div className="text-sm leading-relaxed">{context}</div>
              </div>
            )}

            {/* Инструкция */}
            {instruction && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Инструкция для AI
                </div>
                <div className="text-sm leading-relaxed text-muted-foreground">
                  {instruction}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t text-xs text-muted-foreground">
              <span>
                Создан:{" "}
                {new Date(createdAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span>Задач: {tasks.length}</span>
              <span>Файлов: {files.length}</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
