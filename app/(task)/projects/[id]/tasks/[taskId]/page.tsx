import { redirect, notFound } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getProjectTasksByProjectId,
} from "@/lib/db/queries";

interface TaskPageProps {
  params: Promise<{ id: string; taskId: string }>;
}

/**
 * ТЗ-C1: Страница задачи — чат с Экспертом
 * Этап 1: Заглушка (Server Component с auth + data loading)
 */
export default async function TaskPage({ params }: TaskPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id: projectId, taskId } = await params;

  const project = await getProjectById({ id: projectId });

  if (!project) {
    notFound();
  }

  if (project.userId !== session.user.id) {
    redirect("/dashboard");
  }

  const allTasks = await getProjectTasksByProjectId({ projectId });
  const currentTask = allTasks.find((t) => t.id === taskId);

  if (!currentTask) {
    notFound();
  }

  return (
    <div className="flex items-center justify-center h-dvh">
      <div className="text-center space-y-2">
        <h1 className="text-lg font-semibold">
          Задача: {currentTask.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Проект: {project.name}
        </p>
        <p className="text-xs text-muted-foreground">
          Task page placeholder (ТЗ-C1, Этап 1)
        </p>
      </div>
    </div>
  );
}
