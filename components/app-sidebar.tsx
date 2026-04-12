"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { Home, MessageCircle, MessageSquarePlus, History, Settings2 } from "lucide-react";
import { generateUUID, getChatUrl } from "@/lib/utils";
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

// Типы контекста sidebar (ТЗ-07A, ТЗ-RG)
export type ChatMode = "chat" | "simply" | "expertise" | "create";

export type SidebarContext =
  | { type: "general"; chatMode: ChatMode }
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

  // ТЗ-KITT: /simply → persistent chat
  if (pathname.startsWith("/simply")) {
    return { type: "general", chatMode: "simply" };
  }

  // ТЗ-RG: Detect chatMode from route group URLs
  if (pathname.startsWith("/expertise")) {
    return { type: "general", chatMode: "expertise" };
  }
  if (pathname.startsWith("/create/")) {
    // /create/[id] — chat page (not /create which is dashboard list)
    return { type: "general", chatMode: "create" };
  }

  return { type: "general", chatMode: "chat" };
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

  // ТЗ-RG: Mode-aware navigation
  const chatMode = context.type === "general" ? context.chatMode : "chat";

  const getNewChatUrl = () => {
    if (context.type === "project") {
      return `/projects/${context.projectId}/chat`;
    }
    // Generate UUID for mode-specific routes
    const newId = generateUUID();
    return getChatUrl(newId, chatMode);
  };

  const getContextTitle = () => {
    if (context.type === "project") return "Чаты проекта";
    switch (chatMode) {
      case "expertise": return "Запросы";
      case "create": return "Задания";
      default: return "Чаты";
    }
  };

  const getNewChatLabel = () => {
    switch (chatMode) {
      case "expertise": return "Новый запрос";
      case "create": return "Новое задание";
      default: return "Новый чат";
    }
  };

  const getAllChatsHref = () => {
    switch (chatMode) {
      case "expertise": return "/expertise";
      case "create": return "/create";
      default: return "/chats";
    }
  };

  const getAllChatsLabel = () => {
    switch (chatMode) {
      case "expertise": return "Все запросы";
      case "create": return "Все задания";
      default: return "Все чаты";
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

              {/* ТЗ-KITT: Simply — persistent chat */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Simply">
                  <Link href="/simply" onClick={() => setOpenMobile(false)}>
                    <MessageCircle className="size-4" />
                    <span>Simply</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* ТЗ-KITT: Hide "New chat" and "All chats" for simply mode */}
              {chatMode !== "simply" && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={getNewChatLabel()}
                    onClick={() => {
                      setOpenMobile(false);
                      router.push(getNewChatUrl());
                      router.refresh();
                    }}
                  >
                    <MessageSquarePlus className="size-4" />
                    <span>{getNewChatLabel()}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {context.type === "general" && chatMode !== "simply" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={getAllChatsLabel()}>
                    <Link href={getAllChatsHref()} onClick={() => setOpenMobile(false)}>
                      <History className="size-4" />
                      <span>{getAllChatsLabel()}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {/* ТЗ-2: Dev Switchboard link — only in dev mode */}
              {process.env.NEXT_PUBLIC_SIMPLY_DEV_MODE === "true" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Dev Models">
                    <Link href="/dev/models" onClick={() => setOpenMobile(false)}>
                      <Settings2 className="size-4" />
                      <span>Dev Models</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ТЗ-KITT: Simply has no chat history — one persistent chat */}
        {chatMode !== "simply" && (
          <>
            <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

            {/* История чатов — скрыта в icon mode (паттерн Claude) */}
            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>{getContextTitle()}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarHistory user={user} context={context} chatMode={chatMode} />
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
