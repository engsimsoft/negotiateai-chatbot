"use client";

/**
 * ServiceChat Floating Modal
 *
 * Floating modal shell for service chat (Ben, Project Creation).
 * - Desktop: positioned modal (center or bottom-right)
 * - Mobile: bottom sheet (Vaul)
 *
 * ТЗ-09: ServiceChat унификация
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { ServiceChatCore } from "./service-chat-core";
import type { ServiceChatFloatingProps } from "./types";

/**
 * Desktop floating modal content
 */
function DesktopFloating({
  config,
  open,
  onOpenChange,
  context,
  messages,
  onMessagesChange,
}: ServiceChatFloatingProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Default size
  const width = config.size?.width || 380;
  const height = config.size?.height || 500;

  // Position classes
  const positionClasses =
    config.position === "bottom-right"
      ? "fixed bottom-4 right-4"
      : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        open &&
        modalRef.current &&
        !modalRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              positionClasses,
              "z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-xl"
            )}
            style={{ width, height }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{config.icon}</span>
                <div>
                  <h2 className="font-semibold">{config.title}</h2>
                  {config.subtitle && (
                    <p className="text-xs text-muted-foreground">
                      {config.subtitle}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-full p-2 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Закрыть</span>
              </button>
            </div>

            {/* Content */}
            <ServiceChatCore
              config={config}
              context={context}
              messages={messages}
              onMessagesChange={onMessagesChange}
              className="flex-1"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Mobile bottom sheet using Vaul
 */
function MobileFloating({
  config,
  open,
  onOpenChange,
  context,
  messages,
  onMessagesChange,
}: ServiceChatFloatingProps) {
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
 * ServiceChat Floating Modal
 *
 * Automatically switches between desktop floating modal and mobile bottom sheet.
 */
export function ServiceChatFloating(props: ServiceChatFloatingProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Don't render until we know the device type
  if (isDesktop === null) return null;

  return isDesktop ? (
    <DesktopFloating {...props} />
  ) : (
    <MobileFloating {...props} />
  );
}
