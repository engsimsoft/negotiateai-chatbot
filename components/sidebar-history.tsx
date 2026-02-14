"use client";

import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Chat } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { ChatItem } from "./sidebar-history-item";
import type { SidebarContext } from "./app-sidebar";

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats
  );
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `/api/history?limit=${PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({
  user,
  context = { type: "general" },
}: {
  user: User | undefined;
  context?: SidebarContext;
}) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();

  // ТЗ-07A: Определить API endpoint на основе контекста
  const getApiUrl = () => {
    switch (context.type) {
      case "project":
        return `/api/projects/${context.projectId}/chats`;
      case "helper":
        return `/api/helpers/${context.helperId}/chats`;
      default:
        return null; // Use pagination for general
    }
  };

  const contextApiUrl = getApiUrl();
  const isContextual = contextApiUrl !== null;

  // Для контекстных чатов (проект/помощник) используем простой useSWR
  const {
    data: contextualChats,
    isLoading: isContextualLoading,
    mutate: mutateContextual,
  } = useSWRInfinite<ChatHistory>(
    isContextual ? () => contextApiUrl : getChatHistoryPaginationKey,
    fetcher,
    { fallbackData: [] }
  );

  // Для общих чатов используем пагинацию
  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(
    isContextual ? () => null : getChatHistoryPaginationKey,
    fetcher,
    { fallbackData: [] }
  );

  // Выбираем нужные данные в зависимости от контекста
  const chatHistories = isContextual ? contextualChats : paginatedChatHistories;
  const chatMutate = isContextual ? mutateContextual : mutate;
  const chatIsLoading = isContextual ? isContextualLoading : isLoading;

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasReachedEnd = isContextual
    ? true // Контекстные чаты загружаются сразу все
    : chatHistories
      ? chatHistories.some((page) => page.hasMore === false)
      : false;

  const hasEmptyChatHistory = chatHistories
    ? chatHistories.every((page) => !page?.chats || page.chats.length === 0)
    : false;

  const handleDelete = () => {
    const deletePromise = fetch(`/api/chat?id=${deleteId}`, {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Удаление чата...",
      success: () => {
        chatMutate((histories) => {
          if (histories) {
            return histories.map((history) => ({
              ...history,
              chats: history.chats.filter((chat) => chat.id !== deleteId),
            }));
          }
        });

        return "Чат удалён";
      },
      error: "Ошибка при удалении чата",
    });

    setShowDeleteDialog(false);

    if (deleteId === id) {
      router.push("/");
    }
  };

  // ТЗ-07B: Toggle star
  const handleToggleStar = async (chatId: string) => {
    // Найти текущий чат для определения нового состояния
    const currentChat = chatHistories
      ?.flatMap((h) => h?.chats || [])
      .find((c) => c.id === chatId);

    if (!currentChat) return;

    const newIsStarred = !currentChat.isStarred;

    try {
      const response = await fetch(`/api/chat?id=${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: newIsStarred }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle star");
      }

      // Обновить в локальном кэше
      chatMutate((histories) => {
        if (histories) {
          return histories.map((history) => ({
            ...history,
            chats: history.chats.map((chat) =>
              chat.id === chatId ? { ...chat, isStarred: newIsStarred } : chat
            ),
          }));
        }
      });

      toast.success(newIsStarred ? "Чат отмечен" : "Отметка снята");
    } catch {
      toast.error("Ошибка при изменении отметки");
    }
  };

  // ТЗ-07A: Переименование чата
  const handleRename = async (chatId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/chat?id=${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename chat");
      }

      // Обновить в локальном кэше
      chatMutate((histories) => {
        if (histories) {
          return histories.map((history) => ({
            ...history,
            chats: history.chats.map((chat) =>
              chat.id === chatId ? { ...chat, title: newTitle } : chat
            ),
          }));
        }
      });

      toast.success("Чат переименован");
    } catch {
      toast.error("Ошибка при переименовании чата");
    }
  };

  if (!user) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-muted-foreground">
            Войдите, чтобы сохранять историю чатов
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (chatIsLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
          Today
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-md px-2"
                key={item}
              >
                <div
                  className="h-4 max-w-(--skeleton-width) flex-1 rounded-md bg-sidebar-accent-foreground/10"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-muted-foreground">
            Ваши чаты появятся здесь
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {chatHistories &&
              (() => {
                const chatsFromHistory = chatHistories.flatMap(
                  (chatHistory) => chatHistory?.chats || []
                );

                const groupedChats = groupChatsByDate(chatsFromHistory);

                return (
                  <div className="flex flex-col gap-6">
                    {groupedChats.today.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                          Сегодня
                        </div>
                        {groupedChats.today.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={handleRename}
                            onToggleStar={handleToggleStar}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.yesterday.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                          Вчера
                        </div>
                        {groupedChats.yesterday.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={handleRename}
                            onToggleStar={handleToggleStar}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastWeek.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                          За 7 дней
                        </div>
                        {groupedChats.lastWeek.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={handleRename}
                            onToggleStar={handleToggleStar}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastMonth.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                          За 30 дней
                        </div>
                        {groupedChats.lastMonth.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={handleRename}
                            onToggleStar={handleToggleStar}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.older.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                          Старше месяца
                        </div>
                        {groupedChats.older.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={handleRename}
                            onToggleStar={handleToggleStar}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
          </SidebarMenu>

          {/* Пагинация — только для общих чатов */}
          {!isContextual && (
            <motion.div
              onViewportEnter={() => {
                if (!isValidating && !hasReachedEnd) {
                  setSize((size) => size + 1);
                }
              }}
            />
          )}

          {/* Индикатор загрузки/конца — только для общих чатов */}
          {!isContextual && (
            hasReachedEnd ? (
              <div className="mt-8 flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-muted-foreground">
                Вы достигли конца истории чатов.
              </div>
            ) : (
              <div className="mt-8 flex flex-row items-center gap-2 p-2 text-muted-foreground dark:text-muted-foreground">
                <div className="animate-spin">
                  <LoaderIcon />
                </div>
                <div>Загрузка чатов...</div>
              </div>
            )
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Чат будет удалён навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
