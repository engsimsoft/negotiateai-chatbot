import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getProjectById, getProjectChatsWithStats } from "@/lib/db/queries";
import { TasksPageContent } from "@/components/tasks";

interface TasksPageProps {
  params: Promise<{ id: string }>;
}

/**
 * ТЗ-07C1: Страница истории задач проекта
 * /projects/[id]/tasks
 */
export default async function TasksPage({ params }: TasksPageProps) {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const { id: projectId } = await params;

  // Get project and verify ownership
  const project = await getProjectById({ id: projectId });

  if (!project) {
    notFound();
  }

  if (project.userId !== session.user.id) {
    notFound();
  }

  // Get tasks (chats) with stats
  const tasks = await getProjectChatsWithStats({ projectId });

  return (
    <TasksPageContent
      projectId={projectId}
      projectName={project.name}
      initialTasks={tasks}
    />
  );
}
