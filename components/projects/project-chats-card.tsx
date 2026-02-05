"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { Plus, MessageSquare, MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Chat } from "@/lib/db/schema";

interface ProjectChatsCardProps {
  projectId: string;
  chats: Chat[];
}

function formatChatTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: false, locale: ru });
}

interface ChatItemProps {
  chat: Chat;
  projectId: string;
  onUpdate: () => void;
}

function ChatItem({ chat, projectId, onUpdate }: ChatItemProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(chat.title || "");

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/chat/${chat.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }

      setShowDeleteDialog(false);
      setIsDeleting(false);
      onUpdate();
      router.refresh();
    } catch (error) {
      console.error("Failed to delete chat:", error);
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === chat.title) {
      setShowRenameDialog(false);
      return;
    }

    setIsRenaming(true);
    try {
      const response = await fetch(`/api/chat/${chat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename chat");
      }

      setShowRenameDialog(false);
      setIsRenaming(false);
      onUpdate();
      router.refresh();
    } catch (error) {
      console.error("Failed to rename chat:", error);
      setIsRenaming(false);
      setShowRenameDialog(false);
    }
  };

  return (
    <>
      <div className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
        <Link
          href={`/projects/${projectId}/chat/${chat.id}`}
          className="flex flex-1 items-center gap-3 min-w-0"
        >
          <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0 pr-8">
            <div className="truncate text-sm font-medium">
              {chat.title || "Новая задача"}
            </div>
            <div className="text-xs text-muted-foreground">
              Обновлён {formatChatTime(chat.createdAt)}
            </div>
          </div>
        </Link>

        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.preventDefault()}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setNewTitle(chat.title || "");
                setShowRenameDialog(true);
              }}
            >
              <Pencil className="size-4 mr-2" />
              Переименовать
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="size-4 mr-2" />
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
              Задача «{chat.title || "Новая задача"}» будет удалена безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать задачу</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Название задачи"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleRename} disabled={isRenaming || !newTitle.trim()}>
              {isRenaming && <Loader2 className="size-4 mr-2 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * ТЗ-07A: Карточка чатов проекта с меню управления
 */
export function ProjectChatsCard({ projectId, chats }: ProjectChatsCardProps) {
  const handleUpdate = () => {
    // Trigger re-fetch of project data
    mutate(`/api/projects/${projectId}`);
  };

  return (
    <div className="rounded-xl border bg-background p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Задачи ({chats.length})
        </h3>
        <Button size="sm" className="h-7 gap-1.5 text-xs" asChild>
          <Link href={`/projects/${projectId}/chat`}>
            <Plus className="size-3.5" />
            Новая задача
          </Link>
        </Button>
      </div>

      {/* Chats list */}
      {chats.length > 0 ? (
        <div className="space-y-1">
          {chats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              projectId={projectId}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <MessageSquare className="mx-auto mb-2 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Нет задач. Создайте первую задачу для работы с AI.
          </p>
        </div>
      )}
    </div>
  );
}
