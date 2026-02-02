"use client";

/**
 * Assistant Drawer Component
 *
 * Premium drawer using Vaul (iOS-style) with Framer Motion animations.
 * - Mobile: Bottom sheet with snap points
 * - Desktop: Right side sheet
 */

import { useEffect, useRef } from "react";
import { Drawer } from "vaul";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { AssistantDrawerProps } from "./types";

export function AssistantDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: AssistantDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const prevIsDesktop = useRef<boolean | null>(null);

  // Close drawer when switching between mobile/desktop to prevent position bugs
  useEffect(() => {
    // Skip until we know the actual value
    if (isDesktop === null) return;

    // Close drawer if mode changed while open
    if (open && prevIsDesktop.current !== null && prevIsDesktop.current !== isDesktop) {
      onOpenChange(false);
    }
    prevIsDesktop.current = isDesktop;
  }, [isDesktop, open, onOpenChange]);

  // Don't render until we know if desktop or mobile
  if (isDesktop === null) return null;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={isDesktop ? "right" : "bottom"}
      modal={true}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content
          className={`
            fixed z-50 flex flex-col bg-background
            ${isDesktop
              ? "inset-y-0 right-0 w-[400px] border-l rounded-l-2xl"
              : "inset-x-0 bottom-0 h-[85vh] rounded-t-2xl border-t"
            }
          `}
        >
          {/* Handle for mobile */}
          {!isDesktop && (
            <div className="mx-auto mt-3 h-1.5 w-12 flex-shrink-0 rounded-full bg-muted-foreground/20" />
          )}

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="flex items-center justify-between border-b px-4 py-3"
          >
            <div>
              <Drawer.Title className="text-lg font-semibold">
                {title}
              </Drawer.Title>
              {description && (
                <Drawer.Description className="text-sm text-muted-foreground">
                  {description}
                </Drawer.Description>
              )}
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
            transition={{ delay: 0.15, duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            {children}
          </motion.div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
