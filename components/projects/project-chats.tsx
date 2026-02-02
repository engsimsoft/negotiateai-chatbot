"use client";

import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Chat } from "@/lib/db/schema";

interface ProjectChatsProps {
  projectId: string;
  chats: Pick<Chat, "id" | "title" | "createdAt">[];
}

export function ProjectChats({ projectId, chats }: ProjectChatsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Чаты проекта</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${projectId}/chat`}>
              <Plus className="size-4 mr-1" />
              Новый чат
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {chats.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Нет чатов. Начните общение с AI в контексте проекта.
          </p>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/projects/${projectId}/chat/${chat.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
                  <MessageSquare className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{chat.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(chat.createdAt, {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
