import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Settings, FolderOpen } from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getFilesByProjectId,
  getChatsByProjectId,
  getProjectFolders,
  getProjectChatsCount,
} from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { ProjectInput } from "@/components/projects/project-input";
import { ProjectPassport } from "@/components/projects/project-passport";
import { ProjectFilesCard } from "@/components/projects/project-files-card";
import { TaskHistoryCard } from "@/components/projects/task-history-card";
import { ProjectMeta } from "@/components/projects/project-meta";
import { ProjectPulse } from "@/components/projects/project-pulse";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

/**
 * ТЗ-07A: Страница проекта
 *
 * Layout:
 * - Header с breadcrumbs и кнопкой Настроить
 * - Поле ввода сверху (как на главной)
 * - Двухколоночный layout:
 *   - Левая: Паспорт (табы) + Файлы
 *   - Правая: Чаты
 * - Project meta внизу
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

  const [files, chats, folders, tasksCount] = await Promise.all([
    getFilesByProjectId({ projectId: id }),
    getChatsByProjectId({ projectId: id }),
    getProjectFolders({ projectId: id }),
    getProjectChatsCount({ projectId: id }),
  ]);

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 lg:px-8">
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
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="size-4" />
          <span className="hidden sm:inline">Настроить</span>
        </Button>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-8 lg:px-6">
        {/* Task History Card + Input (ТЗ-07C1) */}
        <section className="mb-8">
          <div className="flex items-stretch gap-3">
            {tasksCount > 0 && (
              <TaskHistoryCard projectId={id} count={tasksCount} />
            )}
            <ProjectInput projectId={id} projectName={project.name} />
          </div>
        </section>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Left column — Context */}
          <div className="flex flex-col gap-6">
            {/* Passport / Instruction */}
            <ProjectPassport
              projectId={id}
              description={project.description}
              instruction={project.instruction}
            />

            {/* Files */}
            <ProjectFilesCard projectId={id} files={files} folders={folders} />
          </div>

          {/* Right column — Pulse (ТЗ-07C2) */}
          <ProjectPulse
            projectId={id}
            tasks={chats.map((chat) => ({
              id: chat.id,
              title: chat.title,
              summary: chat.summary,
              taskStatus: (chat.taskStatus || "not_started") as "not_started" | "in_progress" | "done",
              createdAt: chat.createdAt,
            }))}
            projectSummary={project.summary}
            summaryUpdatedAt={project.summaryUpdatedAt}
          />
        </div>

        {/* Project meta */}
        <ProjectMeta
          createdAt={project.createdAt}
          chatsCount={chats.length}
          filesCount={files.length}
        />
      </main>
    </div>
  );
}
