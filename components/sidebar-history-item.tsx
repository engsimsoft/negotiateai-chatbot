import Link from "next/link";
import { memo, useState, useRef, useEffect } from "react";
import type { Chat } from "@/lib/db/schema";
import { Check, Star } from "lucide-react";
import {
  MoreHorizontalIcon,
  PencilEditIcon,
  TrashIcon,
} from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  onRename,
  onToggleStar,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, newTitle: string) => void;
  onToggleStar: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== chat.title) {
      onRename(chat.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setEditTitle(chat.title);
      setIsEditing(false);
    }
  };

  return (
    <SidebarMenuItem>
      {isEditing ? (
        <div className="flex h-8 w-full items-center px-2">
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-primary bg-background px-2 py-1 text-sm outline-none"
          />
        </div>
      ) : (
        <SidebarMenuButton asChild isActive={isActive} tooltip={chat.title}>
          <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
            {/* ТЗ-07C2: Show check mark for completed project tasks */}
            {chat.projectId && chat.taskStatus === "done" && (
              <Check className="size-3.5 shrink-0 text-green-600" />
            )}
            {/* ТЗ-DV2: chatMode badge */}
            {chat.chatMode === "expertise" && <span className="shrink-0">🔍</span>}
            {chat.chatMode === "create" && <span className="shrink-0">✨</span>}
            <span>{chat.title}</span>
          </Link>
        </SidebarMenuButton>
      )}

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="mr-0.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setIsEditing(true)}
          >
            <PencilEditIcon />
            <span>Переименовать</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => onToggleStar(chat.id)}
          >
            <Star className="size-4" fill={chat.isStarred ? "currentColor" : "none"} />
            <span>{chat.isStarred ? "Снять звезду" : "Отметить"}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon />
            <span>Удалить</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  if (prevProps.chat.title !== nextProps.chat.title) {
    return false;
  }
  if (prevProps.chat.isStarred !== nextProps.chat.isStarred) {
    return false;
  }
  // ТЗ-07C2: Re-render if taskStatus changes
  if (prevProps.chat.taskStatus !== nextProps.chat.taskStatus) {
    return false;
  }
  return true;
});
