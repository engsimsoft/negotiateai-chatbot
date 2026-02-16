"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { Home, MessageSquarePlus, History } from "lucide-react";
import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useThemeSync } from "@/hooks/use-theme-sync";

// Типы контекста sidebar (ТЗ-07A)
export type SidebarContext =
  | { type: "general" }
  | { type: "project"; projectId: string };

/**
 * Определить контекст sidebar на основе URL
 */
function getSidebarContext(pathname: string): SidebarContext {
  // /projects/[id]/chat/* → проект
  const projectMatch = pathname.match(/^\/projects\/([^/]+)\/chat/);
  if (projectMatch) {
    return { type: "project", projectId: projectMatch[1] };
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

  // ТЗ-07A: Определить контекст на основе URL
  const context = getSidebarContext(pathname);

  // ТЗ-3A: Sync theme preference from DB
  useThemeSync();

  // Определить URL для кнопки "Новый чат" в зависимости от контекста
  const getNewChatUrl = () => {
    switch (context.type) {
      case "project":
        return `/projects/${context.projectId}/chat`;
      default:
        return "/chat";
    }
  };

  // Заголовок для контекста
  const getContextTitle = () => {
    switch (context.type) {
      case "project":
        return "Чаты проекта";
      default:
        return "Чаты";
    }
  };

  return (
    <Sidebar collapsible="icon" className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Simply — Главная">
              <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-sm">
                  S
                </div>
                <span className="font-semibold text-lg">Simply</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Навигация */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Главная">
                  <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                    <Home className="size-4" />
                    <span>Главная</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Новый чат"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push(getNewChatUrl());
                    router.refresh();
                  }}
                >
                  <MessageSquarePlus className="size-4" />
                  <span>Новый чат</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {context.type === "general" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Все чаты">
                    <Link href="/chats" onClick={() => setOpenMobile(false)}>
                      <History className="size-4" />
                      <span>Все чаты</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

        {/* История чатов — скрыта в icon mode (паттерн Claude) */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>{getContextTitle()}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarHistory user={user} context={context} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
