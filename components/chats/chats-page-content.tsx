"use client";

import { MessageSquare } from "lucide-react";
import { useState } from "react";

import { ListDetailPage } from "@/components/list-detail";
import { ChatList } from "./chat-list";
import { ChatDetailPanel } from "./chat-detail-panel";

export type ChatWithStats = {
  id: string;
  createdAt: Date;
  title: string;
  summary: string | null;
  isStarred: boolean;
  isRenamed: boolean;
  chatMode: string;
  messageCount: number;
};

interface ChatsPageContentProps {
  initialChats: ChatWithStats[];
}

function chatCountLabel(count: number): string {
  if (count === 1) return "чат";
  if (count >= 2 && count <= 4) return "чата";
  return "чатов";
}

export function ChatsPageContent({ initialChats }: ChatsPageContentProps) {
  const [chats, setChats] = useState<ChatWithStats[]>(initialChats);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    initialChats.length > 0 ? initialChats[0].id : null
  );

  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;

  // Delete chat handler
  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat?id=${chatId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        // If deleted chat was selected, select first available
        if (selectedChatId === chatId) {
          const remaining = chats.filter((c) => c.id !== chatId);
          setSelectedChatId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  // Toggle star handler
  const handleToggleStar = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;

    const newIsStarred = !chat.isStarred;

    // Optimistic update
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, isStarred: newIsStarred } : c
      )
    );

    try {
      const response = await fetch(`/api/chat?id=${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: newIsStarred }),
      });

      if (!response.ok) {
        // Revert on error
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId ? { ...c, isStarred: !newIsStarred } : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle star:", error);
      // Revert on error
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, isStarred: !newIsStarred } : c
        )
      );
    }
  };

  return (
    <ListDetailPage
      title="История чатов"
      itemCount={chats.length}
      itemCountLabel={chatCountLabel}
      emptyState={{
        icon: <MessageSquare className="size-8 text-muted-foreground" />,
        title: "Нет чатов",
        description:
          "Здесь будут отображаться ваши чаты. Начните разговор с AI на главной странице.",
      }}
      isEmpty={chats.length === 0}
      listContent={
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
          onDeleteChat={handleDeleteChat}
          onToggleStar={handleToggleStar}
        />
      }
      detailContent={
        <ChatDetailPanel
          chat={selectedChat}
          onToggleStar={handleToggleStar}
        />
      }
    />
  );
}
