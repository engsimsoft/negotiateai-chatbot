"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  ListTodo,
  FileText,
} from "lucide-react";
import Link from "next/link";

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ProjectWithStats } from "./projects-page-content";

interface ProjectListItemProps {
  project: ProjectWithStats;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: () => void;
}

export function ProjectListItem({
  project,
  isSelected,
  onSelect,
  onDelete,
  onRename,
}: ProjectListItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(project.updatedAt), {
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
        {/* Icon */}
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FolderOpen className="size-4 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-medium text-sm">{project.name}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ListTodo className="size-3" />
              {project.taskCount}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="size-3" />
              {project.fileCount}
            </span>
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
              <Link href={`/projects/${project.id}`}>
                <ExternalLink className="mr-2 size-4" />
                Открыть проект
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRename();
              }}
            >
              <Pencil className="mr-2 size-4" />
              Переименовать
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
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
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Проект «{project.name}» и все его задачи будут удалены
              безвозвратно.
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
