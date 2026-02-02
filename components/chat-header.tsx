"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useState, useEffect } from "react";
import { useWindowSize } from "usehooks-ts";
import { ChevronRight, FolderOpen, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import {
  PromptAgentTrigger,
  PromptAgentDrawer,
  BenTrigger,
  BenDrawer,
  BenIntroBubble,
} from "@/components/modal-assistants";

interface ChatHeaderProps {
  /** Callback to insert text into main chat input */
  onInsertToChat?: (text: string) => void;
  /** Project ID if this is a project chat */
  projectId?: string;
  /** Project name if this is a project chat */
  projectName?: string;
}

function PureChatHeader({ onInsertToChat, projectId, projectName }: ChatHeaderProps) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  // Modal assistants state
  const [promptAgentOpen, setPromptAgentOpen] = useState(false);
  const [benOpen, setBenOpen] = useState(false);

  // Ben intro bubble state
  const [showBenIntro, setShowBenIntro] = useState(false);

  // Check if user has seen Ben intro on mount
  useEffect(() => {
    const checkBenIntro = async () => {
      try {
        const res = await fetch("/api/user/ben-intro");
        if (res.ok) {
          const data = await res.json();
          if (!data.hasSeenBenIntro) {
            // Small delay so bubble appears after page loads
            setTimeout(() => setShowBenIntro(true), 500);
          }
        }
      } catch {
        // Silently fail - not critical
      }
    };
    checkBenIntro();
  }, []);

  // Dismiss Ben intro and update API
  const dismissBenIntro = async () => {
    setShowBenIntro(false);
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
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1 text-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="size-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>

        {/* Project breadcrumb */}
        {projectId && projectName && (
          <>
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
            <Link
              href={`/projects/${projectId}`}
              className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <FolderOpen className="size-3.5" />
              <span className="max-w-[120px] truncate sm:max-w-[200px]">{projectName}</span>
            </Link>
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">Чат</span>
          </>
        )}
      </div>

      {/* New Chat button - always visible when sidebar closed or on mobile */}
      {(!open || windowWidth < 768) && (
        <Button
          className="ml-auto h-8 px-2 md:h-fit md:px-2"
          onClick={() => {
            router.push("/chat");
            router.refresh();
          }}
          variant="outline"
        >
          <PlusIcon />
          <span className="md:sr-only">Новый чат</span>
        </Button>
      )}

      {/* Modal assistant triggers */}
      <div className={`flex items-center gap-1 ${open && windowWidth >= 768 ? "ml-auto" : ""}`}>
        <PromptAgentTrigger onClick={() => setPromptAgentOpen(true)} />
        <div className="relative">
          <BenTrigger onClick={() => {
            setBenOpen(true);
            if (showBenIntro) dismissBenIntro();
          }} />
          <BenIntroBubble show={showBenIntro} onDismiss={dismissBenIntro} />
        </div>
      </div>

      {/* Modal assistant drawers */}
      <PromptAgentDrawer
        open={promptAgentOpen}
        onOpenChange={setPromptAgentOpen}
        onInsertToChat={onInsertToChat}
      />
      <BenDrawer
        open={benOpen}
        onOpenChange={setBenOpen}
      />
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader);
