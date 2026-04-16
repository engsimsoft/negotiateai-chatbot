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
import { TaskChat } from "@/components/projects/task-chat";
import { TaskSidebar } from "@/components/projects/task-sidebar";

interface TaskPageProps {
  params: Promise<{ id: string; taskId: string }>;
}

/**
 * ТЗ-C1: Страница задачи — чат с Экспертом
 * Этап 3: Полная реализация с TaskChat
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
  let [task, allTasks] = await Promise.all([
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
    // startTask changed status to 'in_progress' in DB but task was loaded before —
    // update the object so TaskChat renders the input on first navigation (no F5 needed)
    task = { ...task, status: "in_progress" };
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
  const isReadonly = task.status === "done" || task.status === "issues";

  return (
    <div className="flex h-dvh">
      <TaskSidebar
        projectId={projectId}
        projectName={project.name}
        tasks={allTasks}
        activeTaskId={taskId}
      />

      <div className="flex-1 min-w-0">
        <TaskChat
          chatId={chatId}
          projectId={projectId}
          taskId={taskId}
          task={task}
          allTasks={allTasks}
          initialMessages={initialMessages}
          isReadonly={isReadonly}
        />
      </div>
    </div>
  );
}
