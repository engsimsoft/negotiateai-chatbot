import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  MessageSquare,
  Settings,
  FileText,
  Mic,
  FolderOpen,
} from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getFilesByProjectId,
  getChatsByProjectId,
} from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { ProjectInstruction } from "@/components/projects/project-instruction";
import { ProjectFiles } from "@/components/projects/project-files";
import { ProjectChats } from "@/components/projects/project-chats";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

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
    redirect("/projects");
  }

  const [files, chats] = await Promise.all([
    getFilesByProjectId({ projectId: id }),
    getChatsByProjectId({ projectId: id }),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects">
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Проекты</span>
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
        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href={`/projects/${id}/chat`}>
              <MessageSquare className="size-4 mr-1" />
              Чат
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 lg:p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Instruction Section */}
          <ProjectInstruction
            projectId={id}
            initialInstruction={project.instruction || ""}
          />

          {/* Files Section */}
          <ProjectFiles projectId={id} initialFiles={files} />

          {/* Chats Section */}
          <ProjectChats projectId={id} chats={chats} />
        </div>
      </main>
    </div>
  );
}
