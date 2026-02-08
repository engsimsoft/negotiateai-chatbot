import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FolderOpen } from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getFilesByProjectId,
  getChatsByProjectId,
  getProjectFolders,
  updateProjectPhase,
} from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { ProjectPageLayout } from "@/components/projects/project-page-layout";
import { ProjectPulse } from "@/components/projects/project-pulse";
import { ProjectWorkArea } from "@/components/projects/project-work-area";
import type { ProfessorPlanJson } from "@/lib/ai/professor-types";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

/**
 * ТЗ-A1: Страница проекта — новый двухколоночный layout
 *
 * Layout:
 * - Header: breadcrumbs слева, кнопка Менеджера справа (управляется layout-ом)
 * - Левая колонка: Пульс (план, файлы, паспорт)
 * - Правая колонка: Рабочая область (по фазе проекта)
 */
export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const { id } = await params;
  const project = await getProjectById({ id });

  if (!project) {
    notFound();
  }

  if (project.userId !== session.user.id) {
    redirect("/dashboard");
  }

  // Auto-transition: setup → documents on first page load
  let currentPhase = project.phase;
  if (currentPhase === "setup") {
    await updateProjectPhase({ id, phase: "documents" });
    currentPhase = "documents";
  }

  const [files, chats, folders] = await Promise.all([
    getFilesByProjectId({ projectId: id }),
    getChatsByProjectId({ projectId: id }),
    getProjectFolders({ projectId: id }),
  ]);

  const tasks = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    summary: chat.summary,
    taskStatus: (chat.taskStatus || "not_started") as
      | "not_started"
      | "in_progress"
      | "done",
    createdAt: chat.createdAt,
  }));

  return (
    <ProjectPageLayout
      projectId={id}
      headerLeft={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href="/dashboard">
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Главная</span>
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4 text-primary" />
            <h1 className="font-semibold truncate max-w-[200px] sm:max-w-none">
              {project.name}
            </h1>
          </div>
        </div>
      }
      pulse={
        <ProjectPulse
          projectId={id}
          phase={currentPhase}
          tasks={tasks}
          files={files}
          folders={folders}
          planJson={(project.planJson as ProfessorPlanJson) ?? null}
          projectName={project.name}
          description={project.description}
          instruction={project.instruction}
          context={project.context}
          createdAt={project.createdAt}
        />
      }
      workArea={
        <ProjectWorkArea
          projectId={id}
          phase={currentPhase}
          tasks={tasks}
          hasFiles={files.length > 0}
          planJson={(project.planJson as ProfessorPlanJson) ?? null}
          planReport={project.planReport ?? null}
        />
      }
    />
  );
}
