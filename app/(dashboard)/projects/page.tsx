import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, FolderOpen, MessageSquare, FileText } from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import { getProjectsWithStats } from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";

export default async function ProjectsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const projects = await getProjectsWithStats({ userId: session.user.id });

  return (
    <div className="flex min-h-svh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold">Проекты</h1>
        </div>
        <CreateProjectDialog>
          <Button size="sm">
            <Plus className="size-4 mr-1" />
            Создать
          </Button>
        </CreateProjectDialog>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 lg:p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="size-10 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Нет проектов</h2>
              <p className="text-sm text-muted-foreground">
                Создайте первый проект для организации работы с AI
              </p>
            </div>
            <CreateProjectDialog>
              <Button>
                <Plus className="size-4 mr-1" />
                Создать проект
              </Button>
            </CreateProjectDialog>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
