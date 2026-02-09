import { redirect, notFound } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  getChatById,
  getMessagesByChatId,
  getProjectById,
  getProjectTaskById,
  getProjectTasksByProjectId,
  startTask,
  updateProjectPhase,
} from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";
import { TaskSidebar } from "@/components/projects/task-sidebar";

interface TaskPageProps {
  params: Promise<{ id: string; taskId: string }>;
}

/**
 * ТЗ-C1: Страница задачи — чат с Экспертом
 * Этап 2: Полная реализация (auth + guards + startTask + phase transition + TaskSidebar)
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

  // Load task + all tasks in parallel
  const [task, allTasks] = await Promise.all([
    getProjectTaskById({ taskId, projectId }),
    getProjectTasksByProjectId({ projectId }),
  ]);

  if (!task) {
    notFound();
  }

  // Phase transition: approved → execution (first task opened)
  if (project.phase === "approved") {
    await updateProjectPhase({ id: projectId, phase: "execution" });
  }

  // First visit: create Chat + set status to in_progress
  let chatId = task.chatId;
  if (!chatId) {
    chatId = await startTask({
      taskId,
      userId: session.user.id,
      projectId,
      taskTitle: task.title,
    });
  }

  // Load chat data
  const [chat, messagesFromDb] = await Promise.all([
    getChatById({ id: chatId }),
    getMessagesByChatId({ id: chatId }),
  ]);

  if (!chat) {
    notFound();
  }

  const initialMessages = convertToUIMessages(messagesFromDb);
  const isReadonly = task.status === "done";

  return (
    <div className="flex h-dvh">
      <TaskSidebar
        projectId={projectId}
        projectName={project.name}
        tasks={allTasks}
        activeTaskId={taskId}
      />

      {/* TaskChat placeholder — будет заменён на реальный компонент в Этапе 3 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold">
            {task.orderIndex}. {task.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Проект: {project.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Chat ID: {chatId} | Messages: {initialMessages.length} | {isReadonly ? "Read-only" : "Active"}
          </p>
          <p className="text-xs text-muted-foreground">
            TaskChat placeholder (ТЗ-C1, Этап 2 — TaskChat в Этапе 3)
          </p>
        </div>
      </div>
    </div>
  );
}
