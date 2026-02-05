"use client";

import { ChatListItem } from "./chat-list-item";
import type { ChatWithStats } from "./chats-page-content";

interface ChatListProps {
  chats: ChatWithStats[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onToggleStar: (chatId: string) => void;
}

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  onDeleteChat,
  onToggleStar,
}: ChatListProps) {
  // Sort: starred first, then by date
  const sortedChats = [...chats].sort((a, b) => {
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {sortedChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isSelected={chat.id === selectedChatId}
            onSelect={() => onSelectChat(chat.id)}
            onDelete={() => onDeleteChat(chat.id)}
            onToggleStar={() => onToggleStar(chat.id)}
          />
        ))}
      </div>
    </div>
  );
}
