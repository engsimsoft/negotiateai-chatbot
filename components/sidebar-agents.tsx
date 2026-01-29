"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "next-auth";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import useSWR from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { PersonalizationDialog } from "@/components/personalization-dialog";
import { DeleteAgentDialog } from "@/components/delete-agent-dialog";
import { fetcher, generateUUID } from "@/lib/utils";
import type { AgentCustomizations } from "@/lib/db/schema";

interface Agent {
  id: string;
  slug: string;
  type: string;
  name: string;
  icon: string;
  description: string;
}

interface UserAgentWithSource {
  id: string;
  userId: string;
  sourceAgentId: string;
  name: string;
  customizations: AgentCustomizations | null;
  isActive: boolean;
  sourceAgent: {
    icon: string;
    name: string;
    slug: string;
  };
}

export function SidebarAgents({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const [editingAgent, setEditingAgent] = useState<UserAgentWithSource | null>(
    null
  );
  const [deletingAgent, setDeletingAgent] = useState<UserAgentWithSource | null>(
    null
  );

  // Fetch all agents to find the helper agent
  const { data: agents } = useSWR<Agent[]>(user ? "/api/agents" : null, fetcher);

  // Fetch user's personal agents
  const { data: userAgents, mutate: mutateUserAgents } = useSWR<
    UserAgentWithSource[]
  >(user ? "/api/user-agents" : null, fetcher);

  const helperAgent = agents?.find((a) => a.slug === "helper");

  const handleStartHelperChat = () => {
    if (!helperAgent) return;
    const newChatId = generateUUID();
    router.push(`/chat/${newChatId}?agentId=${helperAgent.id}`);
    setOpenMobile(false);
  };

  const handleStartUserAgentChat = (userAgent: UserAgentWithSource) => {
    const newChatId = generateUUID();
    router.push(`/chat/${newChatId}?agentId=${userAgent.id}`);
    setOpenMobile(false);
  };

  const handleEditSuccess = () => {
    mutateUserAgents();
    setEditingAgent(null);
  };

  const handleDeleteSuccess = () => {
    mutateUserAgents();
    setDeletingAgent(null);
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Helper Agent Button */}
      <SidebarGroup className="py-0">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleStartHelperChat}
                disabled={!helperAgent}
                className="h-10"
              >
                <span className="text-lg">{helperAgent?.icon || "🤝"}</span>
                <span className="font-medium">
                  {helperAgent?.name || "Агент-Помощник"}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Catalog Link */}
      <SidebarGroup className="py-0">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/agents"
                  onClick={() => setOpenMobile(false)}
                  className="h-10"
                >
                  <span className="text-lg">📂</span>
                  <span>Каталог агентов</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* My Agents Section */}
      <SidebarGroup className="py-0">
        <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs">
          Мои агенты
        </SidebarGroupLabel>
        <SidebarGroupContent>
          {!userAgents || userAgents.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Пока пусто
            </div>
          ) : (
            <SidebarMenu>
              {userAgents.map((ua) => (
                <SidebarMenuItem key={ua.id}>
                  <SidebarMenuButton
                    onClick={() => handleStartUserAgentChat(ua)}
                    className="h-9"
                  >
                    <span className="text-base">{ua.sourceAgent.icon}</span>
                    <span className="truncate">{ua.name}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Меню</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem onClick={() => setEditingAgent(ua)}>
                        <Pencil className="mr-2 size-4" />
                        Редактировать
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingAgent(ua)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Edit Dialog */}
      {editingAgent && (
        <PersonalizationDialog
          agent={{
            id: editingAgent.sourceAgentId,
            name: editingAgent.sourceAgent.name,
            icon: editingAgent.sourceAgent.icon,
          }}
          onClose={() => setEditingAgent(null)}
          onSuccess={handleEditSuccess}
          editMode
          existingData={{
            id: editingAgent.id,
            name: editingAgent.name,
            customizations: editingAgent.customizations,
          }}
        />
      )}

      {/* Delete Dialog */}
      {deletingAgent && (
        <DeleteAgentDialog
          agentName={deletingAgent.name}
          onClose={() => setDeletingAgent(null)}
          onConfirm={async () => {
            await fetch(`/api/user-agents/${deletingAgent.id}`, {
              method: "DELETE",
            });
            handleDeleteSuccess();
          }}
        />
      )}
    </>
  );
}
