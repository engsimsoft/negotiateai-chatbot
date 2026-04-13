"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { useRouter } from "next/navigation";

import { ListDetailPage } from "@/components/list-detail";
import { generateUUID, getChatUrl } from "@/lib/utils";
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

/** Serializable noun forms for Russian plural rules: 1 запрос, 2 запроса, 5 запросов */
export interface CountNoun {
  one: string;
  few: string;
  many: string;
}

const DEFAULT_COUNT_NOUN: CountNoun = { one: "чат", few: "чата", many: "чатов" };

function makeCountLabel(noun: CountNoun): (count: number) => string {
  return (count: number) => {
    if (count === 1) return noun.one;
    if (count >= 2 && count <= 4) return noun.few;
    return noun.many;
  };
}

interface ModeChatsPageProps {
  title: string;
  // ТЗ-LegacyChatCleanup: href опциональный — когда передан chatMode, кнопка работает
  // через UUID-onClick (см. resolvedCreateButton ниже). href нужен только в legacy-сценарии
  // без chatMode (которого больше нет). Оставлен в типе ради backward compat вызывающих.
  createButton?: { label: string; href?: string };
  emptyState: { icon: ReactNode; title: string; description: string };
  initialChats: ChatWithStats[];
  /** chatMode for UUID-based navigation (expertise → /expertise/[uuid]) */
  chatMode?: string;
  /** Serializable noun forms for count label, e.g. { one: "запрос", few: "запроса", many: "запросов" } */
  countNoun?: CountNoun;
  /** Label for summary section in detail panel */
  summaryLabel?: string;
  /** Label for open button in detail panel */
  openLabel?: string;
}

export function ModeChatsPage({
  title,
  createButton,
  emptyState,
  initialChats,
  chatMode,
  countNoun = DEFAULT_COUNT_NOUN,
  summaryLabel,
  openLabel,
}: ModeChatsPageProps) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatWithStats[]>(initialChats);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    initialChats.length > 0 ? initialChats[0].id : null
  );

  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;

  // ТЗ-RG: Build create button — use UUID-based onClick for mode-specific routes
  // ТЗ-LegacyChatCleanup: legacy `chat` режим удалён.
  // Приоритет: (1) если есть chatMode → UUID-onClick; (2) если есть href → ссылка; (3) ничего.
  const resolvedCreateButton = createButton
    ? chatMode
      ? {
          label: createButton.label,
          onClick: () => {
            const newId = generateUUID();
            router.push(getChatUrl(newId, chatMode));
          },
        }
      : createButton.href
        ? { label: createButton.label, href: createButton.href }
        : undefined
    : undefined;

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
      itemCountLabel={makeCountLabel(countNoun)}
      createButton={resolvedCreateButton}
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
          summaryLabel={summaryLabel}
          openLabel={openLabel}
        />
      }
    />
  );
}
