"use client";

/**
 * ТЗ-A1 + ТЗ-A3: ManagerDrawer
 *
 * Push-drawer Менеджера проекта с живым AI-диалогом.
 * - Desktop (lg+): фиксированная панель справа (400px), WorkArea сжимается
 * - Mobile: bottom sheet через vaul
 * - ТЗ-A3: ServiceChatCore + серверная персистенция сообщений
 */

import { useState, useEffect } from "react";
import { User, X, Loader2 } from "lucide-react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ServiceChatCore } from "@/components/service-chat/service-chat-core";
import { PROJECT_MANAGER_CONFIG } from "@/components/service-chat/configs/project-manager";

interface ManagerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

/**
 * Chat content with message loading from server
 */
function ManagerChatContent({ projectId }: { projectId: string }) {
  const [loadedMessages, setLoadedMessages] = useState<
    Array<{ id: string; role: string; parts: unknown }> | null
  >(null);

  useEffect(() => {
    fetch(
      `/api/service-chat?context=project-manager&projectId=${encodeURIComponent(projectId)}`
    )
      .then((res) => res.json())
      .then((data) => setLoadedMessages(data.messages || []))
      .catch(() => setLoadedMessages([]));
  }, [projectId]);

  if (loadedMessages === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ServiceChatCore
      config={PROJECT_MANAGER_CONFIG}
      context={{ projectId }}
      loadedMessages={loadedMessages}
    />
  );
}

function DesktopManagerDrawer({
  open,
  onOpenChange,
  projectId,
}: ManagerDrawerProps) {
  // Lazy mount: render chat content only after first open, then keep mounted
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (open && !hasOpened) setHasOpened(true);
  }, [open, hasOpened]);

  return (
    <div
      className={cn(
        "fixed right-0 top-[3.5rem] bottom-0 z-30 w-[400px] flex flex-col border-l bg-background shadow-xl",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <User className="size-4 text-primary" />
          </div>
          <span className="font-semibold">Менеджер проекта</span>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="rounded-full p-2 hover:bg-muted transition-colors"
        >
          <X className="size-4" />
          <span className="sr-only">Закрыть</span>
        </button>
      </div>

      {/* Chat content — lazy mounted, persists after first open */}
      {hasOpened && (
        <div className="flex-1 overflow-hidden">
          <ManagerChatContent projectId={projectId} />
        </div>
      )}
    </div>
  );
}

function MobileManagerDrawer({
  open,
  onOpenChange,
  projectId,
}: ManagerDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-2xl border-t bg-background">
          {/* Handle */}
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/20" />

          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <User className="size-4 text-primary" />
              </div>
              <Drawer.Title className="font-semibold">
                Менеджер проекта
              </Drawer.Title>
            </div>
            <Drawer.Close asChild>
              <button className="rounded-full p-2 hover:bg-muted transition-colors">
                <X className="size-4" />
                <span className="sr-only">Закрыть</span>
              </button>
            </Drawer.Close>
          </div>

          {/* Chat content — re-mounts each time drawer opens (mobile) */}
          <div className="flex-1 overflow-hidden">
            <ManagerChatContent projectId={projectId} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function ManagerDrawer(props: ManagerDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (isDesktop === null) return null;

  return isDesktop ? (
    <DesktopManagerDrawer {...props} />
  ) : (
    <MobileManagerDrawer {...props} />
  );
}
