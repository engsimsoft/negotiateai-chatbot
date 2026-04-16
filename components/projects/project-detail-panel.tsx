"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowRight,
  FolderOpen,
  ListTodo,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ProjectWithStats } from "./projects-page-content";

const PHASE_LABELS: Record<string, string> = {
  setup: "Настройка",
  documents: "Документы",
  planning: "Планирование",
  approved: "Одобрен",
  execution: "В работе",
  completed: "Завершён",
};

interface ProjectDetailPanelProps {
  project: ProjectWithStats | null;
  onDelete: (projectId: string) => void;
  onRename: (projectId: string) => void;
}

export function ProjectDetailPanel({
  project,
  onDelete,
  onRename,
}: ProjectDetailPanelProps) {
  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        <p>Выберите проект из списка</p>
      </div>
    );
  }

  const formattedDate = format(
    new Date(project.updatedAt),
    "d MMMM yyyy, HH:mm",
    { locale: ru }
  );

  const phaseLabel = PHASE_LABELS[project.phase] || project.phase;

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header with title */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">{project.name}</h2>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {phaseLabel}
          </span>
        </div>

        {/* Meta */}
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{formattedDate}</span>
          <span className="flex items-center gap-1">
            <ListTodo className="size-4" />
            {project.taskCount}{" "}
            {project.taskCount === 1
              ? "задача"
              : project.taskCount >= 2 && project.taskCount <= 4
                ? "задачи"
                : "задач"}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="size-4" />
            {project.fileCount}{" "}
            {project.fileCount === 1
              ? "файл"
              : project.fileCount >= 2 && project.fileCount <= 4
                ? "файла"
                : "файлов"}
          </span>
        </div>

        {/* Open project button */}
        <Button asChild className="mt-4" size="sm">
          <Link href={`/projects/${project.id}`}>
            Открыть проект
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>

      {/* Description */}
      {project.description ? (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Описание
          </h3>
          <p className="text-sm leading-relaxed">{project.description}</p>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Описание не указано
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2 border-t pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRename(project.id)}
        >
          <Pencil className="mr-1 size-4" />
          Переименовать
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(project.id)}
        >
          <Trash2 className="mr-1 size-4" />
          Удалить
        </Button>
      </div>
    </div>
  );
}
