"use client";

import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useWindowSize } from "usehooks-ts";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";
import { chatModels } from "@/lib/ai/models";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  agentId,
  selectedModelId,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  agentId?: string;
  selectedModelId: string;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const [isChangingAgent, setIsChangingAgent] = useState(false);

  // Fetch agent info from API
  const { data: agents } = useSWR<
    Array<{ id: string; slug: string; name: string; icon: string; defaultModel: string; type: string }>
  >("/api/agents", fetcher);

  // Find current agent
  const agent = agents?.find((a) => a.id === agentId);

  // Filter catalog agents for switching (exclude system agents like helper)
  const catalogAgents = agents?.filter((a) => a.type === "catalog") || [];

  // Handle agent change
  const handleAgentChange = async (newAgentId: string) => {
    if (newAgentId === agentId || isChangingAgent) return;

    setIsChangingAgent(true);
    try {
      const response = await fetch(`/api/chats/${chatId}/agent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: newAgentId }),
      });

      if (!response.ok) {
        throw new Error("Failed to change agent");
      }

      toast.success("Агент изменён");
      router.refresh();
    } catch {
      toast.error("Не удалось сменить агента");
    } finally {
      setIsChangingAgent(false);
    }
  };

  // Determine actual model being used
  const actualModelId =
    selectedModelId === "auto" && agent ? agent.defaultModel : selectedModelId;

  // Get model display name
  const modelInfo = chatModels.find((m) => m.id === actualModelId);
  const modelDisplayName = modelInfo?.name || "Unknown";

  // Tooltip text
  const tooltipText =
    selectedModelId === "auto"
      ? `Авто: ${modelDisplayName} (оптимально для этого агента)`
      : `Выбрано вручную: ${modelDisplayName}`;

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {agent && !isReadonly && catalogAgents.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 text-lg font-medium rounded-md px-2 py-1 hover:bg-muted transition-colors disabled:opacity-50"
              disabled={isChangingAgent}
            >
              <span className="text-2xl" aria-hidden="true">
                {agent.icon}
              </span>
              <span className="hidden md:inline">{agent.name}</span>
              <span className="text-xs text-muted-foreground">▼</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {catalogAgents.map((a) => (
              <DropdownMenuItem
                key={a.id}
                onClick={() => handleAgentChange(a.id)}
                className={a.id === agentId ? "bg-muted" : ""}
              >
                <span className="mr-2">{a.icon}</span>
                {a.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : agent ? (
        <div className="flex items-center gap-2 text-lg font-medium">
          <span className="text-2xl" aria-hidden="true">
            {agent.icon}
          </span>
          <span className="hidden md:inline">{agent.name}</span>
        </div>
      ) : null}

      {/* Model indicator badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              <span className="hidden sm:inline">🤖</span>
              <span className="hidden lg:inline">{modelDisplayName}</span>
              <span className="lg:hidden">
                {selectedModelId === "auto" ? "Авто" : modelDisplayName.split(" ")[0]}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {(!open || windowWidth < 768) && (
        <Button
          className="ml-auto h-8 px-2 md:h-fit md:px-2"
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
          variant="outline"
        >
          <PlusIcon />
          <span className="md:sr-only">New Chat</span>
        </Button>
      )}

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          className="md:ml-auto"
          selectedVisibilityType={selectedVisibilityType}
        />
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.agentId === nextProps.agentId &&
    prevProps.selectedModelId === nextProps.selectedModelId
  );
});
