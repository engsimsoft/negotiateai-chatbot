"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRight, MessageSquare, Star } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ChatWithStats } from "./chats-page-content";

interface ChatDetailPanelProps {
  chat: ChatWithStats | null;
  onToggleStar: (chatId: string) => void;
}

export function ChatDetailPanel({
  chat,
  onToggleStar,
}: ChatDetailPanelProps) {
  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        <p>Выберите чат из списка</p>
      </div>
    );
  }

  const formattedDate = format(new Date(chat.createdAt), "d MMMM yyyy, HH:mm", {
    locale: ru,
  });

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header with title */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">{chat.title}</h2>
          <Button
            size="icon"
            variant="ghost"
            className={chat.isStarred ? "text-yellow-500" : "text-muted-foreground"}
            onClick={() => onToggleStar(chat.id)}
          >
            <Star
              className="size-5"
              fill={chat.isStarred ? "currentColor" : "none"}
            />
          </Button>
        </div>

        {/* Meta */}
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{formattedDate}</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-4" />
            {chat.messageCount} сообщений
          </span>
        </div>

        {/* Open chat button - сразу под meta */}
        <Button asChild className="mt-4" size="sm">
          <Link href={`/chat/${chat.id}`}>
            Открыть чат
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>

      {/* Summary */}
      {chat.summary ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            О чём чат
          </h3>
          <p className="text-sm leading-relaxed">{chat.summary}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Краткое описание отсутствует
        </div>
      )}
    </div>
  );
}
