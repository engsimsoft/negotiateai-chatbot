"use client";

import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import {
  PromptAgentTrigger,
  PromptAgentDrawer,
  BenTrigger,
  BenDrawer,
} from "@/components/modal-assistants";

interface ChatHeaderProps {
  /** Callback to insert text into main chat input */
  onInsertToChat?: (text: string) => void;
}

function PureChatHeader({ onInsertToChat }: ChatHeaderProps) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  // Modal assistants state
  const [promptAgentOpen, setPromptAgentOpen] = useState(false);
  const [benOpen, setBenOpen] = useState(false);

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {/* Logo */}
      <span className="text-lg font-semibold tracking-tight">Simply</span>

      {/* New Chat button - always visible when sidebar closed or on mobile */}
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
          <span className="md:sr-only">Новый чат</span>
        </Button>
      )}

      {/* Modal assistant triggers */}
      <div className={`flex items-center gap-1 ${open && windowWidth >= 768 ? "ml-auto" : ""}`}>
        <PromptAgentTrigger onClick={() => setPromptAgentOpen(true)} />
        <BenTrigger onClick={() => setBenOpen(true)} />
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
