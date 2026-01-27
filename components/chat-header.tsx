"use client";

import { useRouter } from "next/navigation";
import { memo } from "react";
import { useWindowSize } from "usehooks-ts";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";
import { getAgentById, getModelForAgent, type AgentId } from "@/lib/ai/agents";
import { chatModels } from "@/lib/ai/models";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  // Get agent info if agentId is provided
  const agent = agentId ? getAgentById(agentId as AgentId) : null;

  // Determine actual model being used
  const actualModelId =
    selectedModelId === "auto" && agentId
      ? getModelForAgent(agentId as AgentId)
      : selectedModelId;

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

      {agent && (
        <div className="flex items-center gap-2 text-lg font-medium">
          <span className="text-2xl" aria-hidden="true">
            {agent.icon}
          </span>
          <span className="hidden md:inline">{agent.name}</span>
        </div>
      )}

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
