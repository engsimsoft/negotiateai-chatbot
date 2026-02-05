"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { History } from "lucide-react";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { SidebarHistory, getChatHistoryPaginationKey } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { useThemeSync } from "@/hooks/use-theme-sync";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

// Типы контекста sidebar (ТЗ-07A)
export type SidebarContext =
  | { type: "general" }
  | { type: "project"; projectId: string }
  | { type: "helper"; helperId: string };

/**
 * Определить контекст sidebar на основе URL
 */
function getSidebarContext(pathname: string): SidebarContext {
  // /projects/[id]/chat/* → проект
  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/chat/);
  if (projectMatch) {
    return { type: "project", projectId: projectMatch[1] };
  }

  // /helpers/[id]/* → помощник
  const helperMatch = pathname.match(/^\/helpers\/([^/]+)/);
  if (helperMatch) {
    return { type: "helper", helperId: helperMatch[1] };
  }

  // /chat/* → общие чаты
  return { type: "general" };
}

interface AppSidebarProps {
  user: User | undefined;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  // ТЗ-07A: Определить контекст на основе URL
  const context = getSidebarContext(pathname);

  // ТЗ-3A: Sync theme preference from DB
  useThemeSync();

  const handleDeleteAll = () => {
    const deletePromise = fetch("/api/history", {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Удаление чатов...",
      success: () => {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        router.push("/chat");
        setShowDeleteAllDialog(false);
        return "Все чаты удалены";
      },
      error: "Ошибка при удалении чатов",
    });
  };

  // Определить URL для кнопки "Новый чат" в зависимости от контекста
  const getNewChatUrl = () => {
    switch (context.type) {
      case "project":
        return `/projects/${context.projectId}/chat`;
      case "helper":
        return `/helpers/${context.helperId}/chat`;
      default:
        return "/chat";
    }
  };

  // Заголовок для контекста
  const getContextTitle = () => {
    switch (context.type) {
      case "project":
        return "Чаты проекта";
      case "helper":
        return "Чаты помощника";
      default:
        return "Чаты";
    }
  };

  return (
    <>
      <Sidebar className="group-data-[side=left]:border-r-0">
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row items-center justify-between">
              <Link
                className="flex flex-row items-center gap-3"
                href="/dashboard"
                onClick={() => setOpenMobile(false)}
              >
                <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                  Simply
                </span>
              </Link>
              <div className="flex flex-row gap-1">
                {/* Удалить все — только для общих чатов */}
                {user && context.type === "general" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="h-8 p-1 md:h-fit md:p-2"
                        onClick={() => setShowDeleteAllDialog(true)}
                        type="button"
                        variant="ghost"
                      >
                        <TrashIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="end" className="hidden md:block">
                      Удалить все чаты
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* Новый чат */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="h-8 p-1 md:h-fit md:p-2"
                      onClick={() => {
                        setOpenMobile(false);
                        router.push(getNewChatUrl());
                        router.refresh();
                      }}
                      type="button"
                      variant="ghost"
                    >
                      <PlusIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent align="end" className="hidden md:block">
                    Новый чат
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* Заголовок контекста + кнопка истории */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              {getContextTitle()}
            </span>
            {/* Кнопка "История чатов" — только для общих чатов */}
            {context.type === "general" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    className="h-6 px-2 text-xs"
                    size="sm"
                    variant="ghost"
                  >
                    <Link href="/chats" onClick={() => setOpenMobile(false)}>
                      <History className="mr-1 size-3" />
                      История
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Все чаты с подробностями</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* История чатов с контекстом */}
          <SidebarHistory user={user} context={context} />
        </SidebarContent>

        <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
      </Sidebar>

      <AlertDialog onOpenChange={setShowDeleteAllDialog} open={showDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить все чаты?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все ваши общие чаты будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              Удалить все
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
