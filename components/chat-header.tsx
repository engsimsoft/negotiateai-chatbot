"use client";

import Link from "next/link";
import { memo, useState, useEffect } from "react";
import useSWR from "swr";
import { ChevronRight, FolderOpen, HelpCircle, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarToggle } from "@/components/sidebar-toggle";
import {
  ServiceChatTrigger,
  ServiceChatFloating,
  BenIntroBubble,
  BEN_CONFIG,
} from "@/components/service-chat";

// SWR fetcher for JSON endpoints
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Type for Ben intro API response
interface BenIntroResponse {
  hasSeenBenIntro: boolean;
}

interface ChatHeaderProps {
  /** Callback to insert text into main chat input */
  onInsertToChat?: (text: string) => void;
  /** Project ID if this is a project chat */
  projectId?: string;
  /** Project name if this is a project chat */
  projectName?: string;
  /** ТЗ-08: Toggle chat sidebar */
  onToggleSidebar?: () => void;
  /** ТЗ-08: Whether chat sidebar is open */
  isSidebarOpen?: boolean;
}

function PureChatHeader({
  onInsertToChat,
  projectId,
  projectName,
  onToggleSidebar,
  isSidebarOpen,
}: ChatHeaderProps) {
  // Modal assistants state
  const [benOpen, setBenOpen] = useState(false);

  // Ben intro bubble state - using SWR for deduplication and caching
  const { data: benIntroData, mutate: mutateBenIntro } = useSWR<BenIntroResponse>(
    "/api/user/ben-intro",
    fetcher
  );
  const [showBenIntro, setShowBenIntro] = useState(false);

  // Show Ben intro bubble after data loads (with delay for UX)
  useEffect(() => {
    if (benIntroData && !benIntroData.hasSeenBenIntro && !showBenIntro) {
      const timer = setTimeout(() => setShowBenIntro(true), 500);
      return () => clearTimeout(timer);
    }
  }, [benIntroData, showBenIntro]);

  // Dismiss Ben intro and update API
  const dismissBenIntro = async () => {
    setShowBenIntro(false);
    // Optimistic update
    mutateBenIntro({ hasSeenBenIntro: true }, false);
    try {
      await fetch("/api/user/ben-intro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasSeenBenIntro: true }),
      });
    } catch {
      // Silently fail - not critical
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
      <SidebarToggle />

      {/* Контекстные breadcrumbs — только для проектов/помощников */}
      {projectId && projectName && (
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderOpen className="size-3.5" />
            <span className="max-w-[120px] truncate sm:max-w-[200px]">{projectName}</span>
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/50" />
          <span className="font-medium text-foreground">Чат</span>
        </div>
      )}

      {/* Right-aligned actions */}
      <div className="ml-auto flex items-center gap-1">
        {/* ТЗ-08: Chat sidebar toggle */}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className={cn("size-7", isSidebarOpen && "bg-muted")}
            title="Материалы чата"
          >
            <PanelRight className="size-4" />
            <span className="sr-only">Материалы чата</span>
          </Button>
        )}

        <div className="relative">
          <ServiceChatTrigger
            icon={<HelpCircle className="h-5 w-5" />}
            tooltip="Бен, help"
            onClick={() => {
              setBenOpen(true);
              if (showBenIntro) dismissBenIntro();
            }}
          />
          <BenIntroBubble show={showBenIntro} onDismiss={dismissBenIntro} />
        </div>
      </div>

      {/* Modal assistant drawers */}
      <ServiceChatFloating
        config={BEN_CONFIG}
        open={benOpen}
        onOpenChange={setBenOpen}
      />
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
