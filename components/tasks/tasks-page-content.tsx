"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TaskList } from "./task-list";
import { TaskDetailPanel } from "./task-detail-panel";
import { TasksEmptyState } from "./tasks-empty-state";

export type TaskWithStats = {
  id: string;
  createdAt: Date;
  title: string;
  summary: string | null;
  isStarred: boolean;
  isRenamed: boolean;
  messageCount: number;
};

interface TasksPageContentProps {
  projectId: string;
  projectName: string;
  initialTasks: TaskWithStats[];
}

/**
 * ТЗ-07C1: Контент страницы истории задач проекта
 * Аналог ChatsPageContent, но для проектных задач
 */
export function TasksPageContent({ projectId, projectName, initialTasks }: TasksPageContentProps) {
  const [tasks, setTasks] = useState<TaskWithStats[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTasks.length > 0 ? initialTasks[0].id : null
  );

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  // Delete task handler
  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/chat?id=${taskId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        // If deleted task was selected, select first available
        if (selectedTaskId === taskId) {
          const remaining = tasks.filter((t) => t.id !== taskId);
          setSelectedTaskId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  // Toggle star handler
  const handleToggleStar = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newIsStarred = !task.isStarred;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, isStarred: newIsStarred } : t
      )
    );

    try {
      const response = await fetch(`/api/chat?id=${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: newIsStarred }),
      });

      if (!response.ok) {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, isStarred: !newIsStarred } : t
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle star:", error);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, isStarred: !newIsStarred } : t
        )
      );
    }
  };

  const taskLabel = tasks.length === 1 ? "задача" : tasks.length >= 2 && tasks.length <= 4 ? "задачи" : "задач";

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`}>
            <Button size="icon" variant="ghost">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">
              <Link href={`/projects/${projectId}`} className="hover:underline">
                {projectName}
              </Link>
              <span className="text-muted-foreground"> / История задач</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {tasks.length} {taskLabel}
            </p>
          </div>
        </div>

        <Button asChild size="sm" className="gap-1.5">
          <Link href={`/projects/${projectId}/chat`}>
            <Plus className="size-4" />
            Новая задача
          </Link>
        </Button>
      </header>

      {/* Content */}
      {tasks.length === 0 ? (
        <TasksEmptyState projectId={projectId} />
      ) : (
        <div className="flex flex-1">
          {/* Left column: Task list */}
          <div className="w-full border-r md:w-80 lg:w-96">
            <TaskList
              tasks={tasks}
              projectId={projectId}
              selectedTaskId={selectedTaskId}
              onSelectTask={setSelectedTaskId}
              onDeleteTask={handleDeleteTask}
              onToggleStar={handleToggleStar}
            />
          </div>

          {/* Right column: Detail panel (hidden on mobile) */}
          <div className="hidden flex-1 md:block">
            <TaskDetailPanel
              task={selectedTask}
              projectId={projectId}
              onToggleStar={handleToggleStar}
            />
          </div>
        </div>
      )}
    </div>
  );
}
