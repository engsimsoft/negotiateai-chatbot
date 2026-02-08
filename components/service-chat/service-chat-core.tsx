"use client";

/**
 * ServiceChat Core Component
 *
 * Headless chat component that handles:
 * - Message state management
 * - Streaming responses
 * - Quick actions
 * - Auto-scroll
 *
 * Used by floating modal and drawer shells.
 * ТЗ-09: ServiceChat унификация
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, generateUUID } from "@/lib/utils";
import type { ServiceChatCoreProps, ServiceChatMessage, QuickAction } from "./types";

/**
 * Message bubble component
 */
function MessageBubble({ message }: { message: ServiceChatMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}

/**
 * Typing indicator with animated dots
 */
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex justify-start"
    >
      <div className="bg-muted rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 bg-muted-foreground/50 rounded-full"
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Quick action cards grid
 */
function QuickActionsGrid({
  actions,
  onSelect,
  disabled,
}: {
  actions: QuickAction[];
  onSelect: (action: QuickAction) => void;
  disabled?: boolean;
}) {
  if (!actions.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 gap-2 p-4"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(action)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-left transition-colors",
            "hover:bg-muted/50 hover:border-primary/30",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <span className="text-xl">{action.icon}</span>
          <span className="text-xs font-medium text-center">{action.label}</span>
        </button>
      ))}
    </motion.div>
  );
}

/**
 * Extract text from message parts
 */
function getMessageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof p.text === "string"
    )
    .map((p) => p.text)
    .join("");
}

/**
 * Main ServiceChat Core Component
 */
export function ServiceChatCore({
  config,
  context,
  messages: externalMessages,
  onMessagesChange,
  onQuickAction,
  className,
  loadedMessages,
}: ServiceChatCoreProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<Error | null>(null);

  // ТЗ-A3: If server messages exist, user has already interacted
  const hasServerMessages = loadedMessages && loadedMessages.length > 0;
  const [hasInteracted, setHasInteracted] = useState(!!hasServerMessages);

  // Determine API endpoint
  const apiEndpoint = config.apiEndpoint || "/api/service-chat";

  // Create transport for the chat API
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        body: {
          context: config.id,
          ...context,
        },
      }),
    [apiEndpoint, config.id, context]
  );

  // ТЗ-A3: Build initial messages — greeting + loaded server messages
  const initialMessages = useMemo(() => {
    const greeting = config.greeting
      ? [{
          id: "greeting",
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: config.greeting }],
        }]
      : [];

    if (hasServerMessages) {
      // Prepend greeting, then server messages
      const serverMsgs = loadedMessages.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        // Cast parts to text-only format for useChat compatibility
        parts: (msg.parts as Array<{ type: string; text?: string }>).map((p) => ({
          type: "text" as const,
          text: p.text || "",
        })),
      }));
      return [...greeting, ...serverMsgs];
    }

    return greeting;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally static

  const { messages: chatMessages, sendMessage, status } = useChat({
    generateId: generateUUID,
    transport,
    messages: initialMessages,
    onError: (err) => setError(err),
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Convert chat messages to ServiceChatMessage format
  const displayMessages: ServiceChatMessage[] = useMemo(
    () =>
      chatMessages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: getMessageText(m.parts),
      })),
    [chatMessages]
  );

  // Sync with external messages if provided
  useEffect(() => {
    if (onMessagesChange && displayMessages.length > 0) {
      onMessagesChange(displayMessages);
    }
  }, [displayMessages, onMessagesChange]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle form submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      setError(null);
      setHasInteracted(true);
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: input.trim() }],
      });
      setInput("");
    },
    [input, isLoading, sendMessage]
  );

  // Handle quick action click
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (isLoading) return;

      setError(null);
      setHasInteracted(true);
      onQuickAction?.(action);

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: action.prompt }],
      });
    },
    [isLoading, onQuickAction, sendMessage]
  );

  // Handle Enter key (without Shift)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  // Show quick actions only before first interaction
  const showQuickActions =
    !hasInteracted && config.quickActions && config.quickActions.length > 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {displayMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isLoading && <TypingIndicator />}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Quick actions (before first message) */}
      {showQuickActions && (
        <QuickActionsGrid
          actions={config.quickActions!}
          onSelect={handleQuickAction}
          disabled={isLoading}
        />
      )}

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mx-4 mb-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
          >
            Произошла ошибка. Попробуйте ещё раз.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onSubmit={handleSubmit}
        className="border-t p-4"
      >
        <div className="flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите сообщение..."
            className="min-h-[44px] max-h-[120px] resize-none rounded-xl"
            rows={1}
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-11 w-11 rounded-xl shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </motion.div>
        </div>
      </motion.form>
    </div>
  );
}
