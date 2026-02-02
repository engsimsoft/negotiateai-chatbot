"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { SidebarHistory, getChatHistoryPaginationKey } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { SidebarTabs, type SidebarTab } from "@/components/sidebar-tabs";
import { SidebarSearch } from "@/components/sidebar-search";
import { SidebarProjects } from "@/components/sidebar-projects";
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

interface AppSidebarProps {
  user: User | undefined;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export function AppSidebar({ user, activeTab, onTabChange }: AppSidebarProps) {
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

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

  return (
    <>
      <Sidebar className="group-data-[side=left]:border-r-0">
        <div className="flex h-full">
          {/* Vertical tabs - only show in mobile (Sheet), desktop tabs are in SidebarLayout */}
          {isMobile && (
            <SidebarTabs activeTab={activeTab} onTabChange={onTabChange} />
          )}

          {/* Main sidebar content */}
          <div className="flex min-w-0 flex-1 flex-col">
            <SidebarHeader>
              <SidebarMenu>
                <div className="flex flex-row items-center justify-between">
                  <Link
                    className="flex flex-row items-center gap-3"
                    href="/dashboard"
                    onClick={() => {
                      setOpenMobile(false);
                    }}
                  >
                    <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                      Simply
                    </span>
                  </Link>
                  {activeTab === "chats" && (
                    <div className="flex flex-row gap-1">
                      {user && (
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="h-8 p-1 md:h-fit md:p-2"
                            onClick={() => {
                              setOpenMobile(false);
                              router.push("/chat");
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
                  )}
                </div>
              </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
              {activeTab === "search" && <SidebarSearch />}
              {activeTab === "chats" && <SidebarHistory user={user} />}
              {activeTab === "projects" && <SidebarProjects />}
            </SidebarContent>

            <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
          </div>
        </div>
      </Sidebar>

      <AlertDialog onOpenChange={setShowDeleteAllDialog} open={showDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить все чаты?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все ваши чаты будут удалены.
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
