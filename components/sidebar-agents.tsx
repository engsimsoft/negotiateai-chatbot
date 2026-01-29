"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import useSWR from "swr";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { fetcher, generateUUID } from "@/lib/utils";

interface Agent {
  id: string;
  slug: string;
  type: string;
  name: string;
  icon: string;
  description: string;
}

export function SidebarAgents({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  // Fetch all agents to find the helper agent
  const { data: agents } = useSWR<Agent[]>(user ? "/api/agents" : null, fetcher);

  const helperAgent = agents?.find((a) => a.slug === "helper");

  const handleStartHelperChat = () => {
    if (!helperAgent) return;
    const newChatId = generateUUID();
    router.push(`/chat/${newChatId}?agentId=${helperAgent.id}`);
    setOpenMobile(false);
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
    </>
  );
}
