"use client";

/**
 * ServiceChat Drawer
 *
 * Right-side drawer shell for service chat (Project Manager).
 * - Desktop: right drawer (420px width)
 * - Mobile: bottom sheet
 *
 * ТЗ-09: ServiceChat унификация
 */

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ServiceChatCore } from "./service-chat-core";
import type { ServiceChatDrawerProps } from "./types";

/**
 * Desktop right drawer
 */
function DesktopDrawer({
  config,
  open,
  onOpenChange,
  context,
  messages,
  onMessagesChange,
}: ServiceChatDrawerProps) {
  const prevOpen = useRef(open);

  // Track previous open state for return focus
  useEffect(() => {
    prevOpen.current = open;
  }, [open]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="right"
      modal={true}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-y-0 right-0 z-50 flex w-[420px] flex-col border-l rounded-l-2xl bg-background">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between border-b px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{config.icon}</span>
              <div>
                <Drawer.Title className="font-semibold">
                  {config.title}
                </Drawer.Title>
                {config.subtitle && (
                  <Drawer.Description className="text-xs text-muted-foreground">
                    {config.subtitle}
                  </Drawer.Description>
                )}
              </div>
            </div>
            <Drawer.Close asChild>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-full p-2 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Закрыть</span>
              </motion.button>
            </Drawer.Close>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex-1 overflow-hidden"
          >
            <ServiceChatCore
              config={config}
              context={context}
              messages={messages}
              onMessagesChange={onMessagesChange}
            />
          </motion.div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * Mobile bottom sheet
 */
function MobileDrawer({
  config,
  open,
  onOpenChange,
  context,
  messages,
  onMessagesChange,
}: ServiceChatDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-2xl border-t bg-background">
          {/* Handle */}
          <div className="mx-auto mt-3 h-1.5 w-12 flex-shrink-0 rounded-full bg-muted-foreground/20" />

          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{config.icon}</span>
              <div>
                <Drawer.Title className="font-semibold">
                  {config.title}
                </Drawer.Title>
                {config.subtitle && (
                  <Drawer.Description className="text-xs text-muted-foreground">
                    {config.subtitle}
                  </Drawer.Description>
                )}
              </div>
            </div>
            <Drawer.Close asChild>
              <button className="rounded-full p-2 hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
                <span className="sr-only">Закрыть</span>
              </button>
            </Drawer.Close>
          </div>

          {/* Content */}
          <ServiceChatCore
            config={config}
            context={context}
            messages={messages}
            onMessagesChange={onMessagesChange}
            className="flex-1"
          />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * ServiceChat Drawer
 *
 * Automatically switches between desktop right drawer and mobile bottom sheet.
 */
export function ServiceChatDrawer(props: ServiceChatDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Don't render until we know the device type
  if (isDesktop === null) return null;

  return isDesktop ? <DesktopDrawer {...props} /> : <MobileDrawer {...props} />;
}
