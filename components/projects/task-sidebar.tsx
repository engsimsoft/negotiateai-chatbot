"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Circle,
  Loader2,
  Brain,
  Lock,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProjectTask } from "@/lib/db/schema";

interface TaskSidebarProps {
  projectId: string;
  projectName: string;
  tasks: ProjectTask[];
  activeTaskId: string;
}

function StatusIcon({ status }: { status: ProjectTask["status"] }) {
  switch (status) {
    case "done":
      return <Check className="size-4 text-green-600 shrink-0" />;
    case "in_progress":
      return <Loader2 className="size-4 text-primary animate-spin shrink-0" />;
    case "review":
      return <Brain className="size-4 text-primary/70 shrink-0" />;
    case "issues":
      return <AlertTriangle className="size-4 text-amber-600 shrink-0" />;
    case "locked":
      return <Lock className="size-4 text-muted-foreground/50 shrink-0" />;
    case "pending":
    default:
      return <Circle className="size-4 text-muted-foreground shrink-0" />;
  }
}

function isClickable(status: ProjectTask["status"]): boolean {
  return status !== "locked";
}

export function TaskSidebar({
  projectId,
  projectName,
  tasks,
  activeTaskId,
}: TaskSidebarProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleTaskClick = (task: ProjectTask) => {
    if (!isClickable(task.status)) return;
    if (task.id === activeTaskId) return;
    router.push(`/projects/${projectId}/tasks/${task.id}`);
  };

  return (
    <div
      className={cn(
        "flex flex-col border-r bg-background transition-all duration-200 shrink-0",
        collapsed ? "w-12" : "w-60"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-3 min-h-[52px]">
        {!collapsed && (
          <span className="text-sm font-medium truncate flex-1">
            {projectName}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto py-1">
        <TooltipProvider delayDuration={300}>
          {tasks.map((task) => {
            const active = task.id === activeTaskId;
            const clickable = isClickable(task.status);

            const taskButton = (
              <button
                key={task.id}
                onClick={() => handleTaskClick(task)}
                disabled={!clickable}
                className={cn(
                  "flex items-center gap-2 w-full text-left text-sm transition-colors",
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                  active && "bg-muted",
                  clickable && !active && "hover:bg-muted/50 cursor-pointer",
                  !clickable && "opacity-50 cursor-not-allowed"
                )}
              >
                <StatusIcon status={task.status} />
                {!collapsed && (
                  <>
                    <span className="text-xs text-muted-foreground tabular-nums w-4 shrink-0">
                      {task.orderIndex}
                    </span>
                    <span
                      className={cn(
                        "flex-1 truncate",
                        task.status === "done" && "text-muted-foreground line-through",
                        task.status === "locked" && "text-muted-foreground/50"
                      )}
                    >
                      {task.title}
                    </span>
                  </>
                )}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={task.id}>
                  <TooltipTrigger asChild>{taskButton}</TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[200px]">
                    <p className="text-xs">
                      {task.orderIndex}. {task.title}
                    </p>
                    {task.status === "locked" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Заблокирована
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }

            if (task.status === "locked") {
              return (
                <Tooltip key={task.id}>
                  <TooltipTrigger asChild>{taskButton}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-xs">Завершите предыдущие задачи</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return taskButton;
          })}
        </TooltipProvider>
      </div>

      {/* Footer */}
      <div className="border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full gap-2 text-muted-foreground",
            collapsed && "px-0"
          )}
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="size-4 shrink-0" />
          {!collapsed && <span className="text-xs">К проекту</span>}
        </Button>
      </div>
    </div>
  );
}
