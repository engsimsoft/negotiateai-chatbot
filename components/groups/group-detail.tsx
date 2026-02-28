"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Hash,
  Loader2,
  Power,
  PowerOff,
  Image as ImageIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GroupMessageList } from "./group-message-list";
import type { GroupClient } from "./groups-page";

interface TopicClient {
  id: string;
  groupId: string;
  telegramTopicId: number;
  name: string;
  createdAt: string;
  messageCount: number;
}

interface MessageClient {
  id: string;
  groupId: string;
  topicId: string | null;
  telegramMessageId: number;
  fromUserId: number;
  fromUsername: string | null;
  fromFirstName: string | null;
  text: string;
  hasMedia: boolean;
  mediaType: string | null;
  fileName: string | null;
  fileSize: number | null;
  blobUrl: string | null;
  sentAt: string;
  createdAt: string;
}

interface MessagesResponse {
  messages: MessageClient[];
  nextCursor: string | null;
  topics: TopicClient[];
  group: {
    id: string;
    title: string;
    type: string;
    isForum: boolean;
    isActive: boolean;
  };
}

interface GroupDetailProps {
  group: GroupClient | null;
  onDeactivate: (groupId: string) => void;
}

export function GroupDetail({ group, onDeactivate }: GroupDetailProps) {
  const [messages, setMessages] = useState<MessageClient[]>([]);
  const [topics, setTopics] = useState<TopicClient[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchMessages = useCallback(
    async (groupId: string, topicId: string | null, cursor?: string) => {
      const params = new URLSearchParams();
      if (topicId) params.set("topicId", topicId);
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "50");

      const res = await fetch(
        `/api/telegram/groups/${groupId}/messages?${params}`,
      );
      if (!res.ok) throw new Error("Failed to fetch messages");
      return (await res.json()) as MessagesResponse;
    },
    [],
  );

  // Load messages when group or topic changes
  useEffect(() => {
    if (!group) return;

    setIsLoading(true);
    setMessages([]);
    setNextCursor(null);

    fetchMessages(group.id, selectedTopicId)
      .then((data) => {
        setMessages(data.messages);
        setNextCursor(data.nextCursor);
        setTopics(data.topics);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [group?.id, selectedTopicId, fetchMessages, group]);

  // Reset topic when group changes
  useEffect(() => {
    setSelectedTopicId(null);
  }, [group?.id]);

  const handleDeleteMessage = async (messageId: string) => {
    if (!group) return;
    try {
      const res = await fetch(
        `/api/telegram/groups/${group.id}/messages/${messageId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadMore = async () => {
    if (!group || !nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const data = await fetchMessages(group.id, selectedTopicId, nextCursor);
      setMessages((prev) => [...prev, ...data.messages]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (!group) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Выберите группу для просмотра сообщений
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="truncate font-semibold">{group.title}</h2>
          {group.isActive ? (
            <Power className="size-4 shrink-0 text-green-500" />
          ) : (
            <PowerOff className="size-4 shrink-0 text-muted-foreground" />
          )}
          {group.isForum && (
            <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              <Hash className="size-3" />
              Форум
            </span>
          )}
        </div>
        {group.isActive && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onDeactivate(group.id)}
          >
            Отключить
          </Button>
        )}
      </div>

      {/* Topics filter (for forums) */}
      {group.isForum && topics.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b px-4 py-2">
          <Button
            variant={selectedTopicId === null ? "secondary" : "ghost"}
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={() => setSelectedTopicId(null)}
          >
            Все ({group.messageCount})
          </Button>
          {topics.map((topic) => (
            <Button
              key={topic.id}
              variant={selectedTopicId === topic.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 shrink-0 text-xs"
              onClick={() => setSelectedTopicId(topic.id)}
            >
              {topic.name} ({topic.messageCount})
            </Button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Нет сообщений
              {selectedTopicId ? " в этом топике" : " в этой группе"}
            </p>
          </div>
        ) : (
          <GroupMessageList messages={messages} onDeleteMessage={handleDeleteMessage} />
        )}

        {/* Load more */}
        {nextCursor && !isLoading && (
          <div className="flex justify-center border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-1 size-3 animate-spin" />
                  Загрузка...
                </>
              ) : (
                "Загрузить ещё"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
