"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { ListDetailPage } from "@/components/list-detail";
import { ChatList } from "./chat-list";
import { ChatDetailPanel } from "./chat-detail-panel";
import type { ChatWithStats } from "./chats-page-content";

function chatCountLabel(count: number): string {
  if (count === 1) return "чат";
  if (count >= 2 && count <= 4) return "чата";
  return "чатов";
}

interface ModeChatsPageProps {
  title: string;
  createButton: { label: string; href: string };
  emptyState: { icon: ReactNode; title: string; description: string };
  initialChats: ChatWithStats[];
}

export function ModeChatsPage({
  title,
  createButton,
  emptyState,
  initialChats,
}: ModeChatsPageProps) {
  const [chats, setChats] = useState<ChatWithStats[]>(initialChats);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    initialChats.length > 0 ? initialChats[0].id : null
  );

  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat?id=${chatId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (selectedChatId === chatId) {
          const remaining = chats.filter((c) => c.id !== chatId);
          setSelectedChatId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleToggleStar = async (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;

    const newIsStarred = !chat.isStarred;

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
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId ? { ...c, isStarred: !newIsStarred } : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle star:", error);
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, isStarred: !newIsStarred } : c
        )
      );
    }
  };

  return (
    <ListDetailPage
      title={title}
      itemCount={chats.length}
      itemCountLabel={chatCountLabel}
      createButton={createButton}
      emptyState={emptyState}
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
