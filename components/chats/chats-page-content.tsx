"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChatList } from "./chat-list";
import { ChatDetailPanel } from "./chat-detail-panel";
import { ChatsEmptyState } from "./chats-empty-state";

export type ChatWithStats = {
  id: string;
  createdAt: Date;
  title: string;
  summary: string | null;
  isStarred: boolean;
  isRenamed: boolean;
  messageCount: number;
};

interface ChatsPageContentProps {
  initialChats: ChatWithStats[];
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
    <div className="flex min-h-svh flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Link href="/dashboard">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-semibold">История чатов</h1>
          <p className="text-xs text-muted-foreground">
            {chats.length} {chats.length === 1 ? "чат" : chats.length < 5 ? "чата" : "чатов"}
          </p>
        </div>
      </header>

      {/* Content */}
      {chats.length === 0 ? (
        <ChatsEmptyState />
      ) : (
        <div className="flex flex-1">
          {/* Left column: Chat list */}
          <div className="w-full border-r md:w-80 lg:w-96">
            <ChatList
              chats={chats}
              selectedChatId={selectedChatId}
              onSelectChat={setSelectedChatId}
              onDeleteChat={handleDeleteChat}
              onToggleStar={handleToggleStar}
            />
          </div>

          {/* Right column: Detail panel (hidden on mobile) */}
          <div className="hidden flex-1 md:block">
            <ChatDetailPanel
              chat={selectedChat}
              onToggleStar={handleToggleStar}
            />
          </div>
        </div>
      )}
    </div>
  );
}
