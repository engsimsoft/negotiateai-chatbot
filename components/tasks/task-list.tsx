"use client";

import { TaskListItem } from "./task-list-item";
import type { TaskWithStats } from "./tasks-page-content";

interface TaskListProps {
  tasks: TaskWithStats[];
  projectId: string;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
}

/**
 * ТЗ-07C1: Список задач проекта (левая колонка)
 */
export function TaskList({
  tasks,
  projectId,
  selectedTaskId,
  onSelectTask,
  onDeleteTask,
  onToggleStar,
}: TaskListProps) {
  // Sort: starred first, then by date
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {sortedTasks.map((task) => (
          <TaskListItem
            key={task.id}
            task={task}
            projectId={projectId}
            isSelected={task.id === selectedTaskId}
            onSelect={() => onSelectTask(task.id)}
            onDelete={() => onDeleteTask(task.id)}
            onToggleStar={() => onToggleStar(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
