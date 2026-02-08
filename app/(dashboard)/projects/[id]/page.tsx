import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FolderOpen, User } from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getFilesByProjectId,
  getChatsByProjectId,
  getProjectFolders,
} from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { ProjectPageLayout } from "@/components/projects/project-page-layout";
import { ProjectPulse } from "@/components/projects/project-pulse";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

/**
 * ТЗ-A1: Страница проекта — новый двухколоночный layout
 *
 * Layout:
 * - Header: breadcrumbs слева, кнопка Менеджера справа
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
      header={
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
            <User className="size-4" />
            <span className="hidden sm:inline">Менеджер</span>
          </Button>
        </header>
      }
      pulse={
        <ProjectPulse
          projectId={id}
          tasks={tasks}
          files={files}
          folders={folders}
          projectName={project.name}
          description={project.description}
          instruction={project.instruction}
          context={project.context}
          createdAt={project.createdAt}
        />
      }
      workArea={
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center text-muted-foreground">
            <FolderOpen className="mx-auto mb-4 size-12 opacity-30" />
            <p className="text-lg font-medium">Рабочая область</p>
            <p className="text-sm mt-1">
              Здесь будет контент по фазе проекта (Этап 4)
            </p>
          </div>
        </div>
      }
    />
  );
}
