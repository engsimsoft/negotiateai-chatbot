"use client";

import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { MoreHorizontal, Star, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TaskWithStats } from "./tasks-page-content";

interface TaskListItemProps {
  task: TaskWithStats;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
}

/**
 * ТЗ-07C1: Элемент списка задач
 */
export function TaskListItem({
  task,
  projectId,
  isSelected,
  onSelect,
  onDelete,
  onToggleStar,
}: TaskListItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(task.createdAt), {
    addSuffix: true,
    locale: ru,
  });

  return (
    <>
      <div
        className={cn(
          "group flex cursor-pointer items-start gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/50",
          isSelected && "bg-muted"
        )}
        onClick={onSelect}
      >
        {/* Star indicator */}
        <button
          className={cn(
            "mt-0.5 shrink-0 transition-colors",
            task.isStarred
              ? "text-yellow-500"
              : "text-muted-foreground/30 hover:text-yellow-500"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
        >
          <Star
            className="size-4"
            fill={task.isStarred ? "currentColor" : "none"}
          />
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-medium text-sm">{task.title || "Новая задача"}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{task.messageCount} сообщ.</span>
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="size-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              size="icon"
              variant="ghost"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/projects/${projectId}/chat/${task.id}`}>
                <ExternalLink className="mr-2 size-4" />
                Открыть задачу
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleStar}>
              <Star className="mr-2 size-4" />
              {task.isStarred ? "Снять звезду" : "Отметить"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Задача «{task.title || "Новая задача"}» будет удалена без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
