"use client";

/**
 * Project Chat Panel
 *
 * Chat interface for project creation dialog.
 * Handles messages, quick actions, input.
 *
 * ТЗ-10: Live Preview
 */

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ServiceChatInput } from "@/components/input";
import { type QuickAction } from "@/components/service-chat";
import { cn } from "@/lib/utils";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ProjectChatPanelProps {
  messages: DisplayMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  quickActions?: QuickAction[];
  showQuickActions: boolean;
  onQuickAction: (action: QuickAction) => void;
  error?: Error | null;
}

export function ProjectChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  isLoading,
  quickActions,
  showQuickActions,
  onQuickAction,
  error,
}: ProjectChatPanelProps) {
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages area */}
      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                  "flex gap-3",
                  message.role === "user" && "flex-row-reverse"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    S
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "rounded-tr-none bg-primary text-primary-foreground"
                      : "rounded-tl-none bg-muted"
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  S
                </div>
                <div className="rounded-2xl rounded-tl-none bg-muted px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scroll anchor */}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      {/* Quick actions */}
      {showQuickActions && quickActions && quickActions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto grid max-w-2xl grid-cols-2 gap-2 p-4 sm:grid-cols-4"
        >
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={isLoading}
              onClick={() => onQuickAction(action)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors",
                "hover:border-primary/30 hover:bg-muted/50",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              <span className="text-xl">{action.icon}</span>
              <span className="text-center text-xs font-medium">
                {action.label}
              </span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mx-4 mb-2 rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive"
          >
            Произошла ошибка. Попробуйте ещё раз.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="sticky bottom-0 bg-background p-4">
        <div className="mx-auto max-w-2xl">
          <ServiceChatInput
            value={input}
            onChange={onInputChange}
            onSubmit={onSend}
            isLoading={isLoading}
            placeholder="Опишите ваш проект..."
            autoFocus={false}
          />
        </div>
      </div>
    </div>
  );
}
