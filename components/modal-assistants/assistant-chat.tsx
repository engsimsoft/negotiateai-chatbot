"use client";

/**
 * Assistant Chat Component
 *
 * Reusable mini-chat for modal assistants.
 * Features:
 * - Streaming responses
 * - "Insert to chat" button
 * - Auto-scroll to bottom
 * - Loading states with animations
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { generateUUID } from "@/lib/utils";
import type { AssistantChatProps } from "./types";

/**
 * Message bubble component
 */
function MessageBubble({
  message,
  onInsert,
  showInsertButton,
}: {
  message: { role: string; content: string };
  onInsert?: (text: string) => void;
  showInsertButton?: boolean;
}) {
  const isUser = message.role === "user";

  // Extract prompt from message for "Insert to chat" button
  const extractPrompt = (text: string): string | null => {
    // Look for prompt block in markdown
    const promptMatch = text.match(/📝\s*\*\*Улучшенный промпт:\*\*\s*\n\n([\s\S]*?)(?:\n\n|$)/);
    if (promptMatch) return promptMatch[1].trim();

    // Look for code blocks
    const codeMatch = text.match(/```\s*\n?([\s\S]*?)\n?```/);
    if (codeMatch) return codeMatch[1].trim();

    return null;
  };

  const extractedPrompt = !isUser && showInsertButton ? extractPrompt(message.content) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Insert to chat button */}
        {extractedPrompt && onInsert && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 pt-3 border-t border-border/50"
          >
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onInsert(extractedPrompt)}
              className="w-full gap-2 bg-background hover:bg-background/80"
            >
              <ArrowRight className="h-4 w-4" />
              В чат
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Typing indicator
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
              animate={{
                y: [0, -4, 0],
              }}
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
 * Extract text from message parts
 */
function getMessageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

/**
 * Main chat component
 */
export function AssistantChat({
  assistantId,
  onInsertToChat,
  initialMessage,
  isFirstTime = false,
}: AssistantChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<Error | null>(null);

  // Create transport for this assistant's API
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/assistant/${assistantId}`,
        body: { isFirstTime },
      }),
    [assistantId, isFirstTime]
  );

  // Initial greeting message (shown before any API calls)
  const initialMessages = initialMessage
    ? [{
        id: "initial",
        role: "assistant" as "user" | "assistant",
        parts: [{ type: "text" as const, text: initialMessage }],
      }]
    : [];

  const {
    messages,
    sendMessage,
    status,
  } = useChat({
    generateId: generateUUID,
    transport,
    messages: initialMessages,
    onError: (err) => {
      setError(err);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle form submit
  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      setError(null);
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: input.trim() }],
      });
      setInput("");
    },
    [input, isLoading, sendMessage]
  );

  // Handle Enter key (without Shift)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit(e);
      }
    },
    [onSubmit]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={{
                  role: message.role,
                  content: getMessageText(message.parts),
                }}
                onInsert={onInsertToChat}
                showInsertButton={assistantId === "prompt-agent"}
              />
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isLoading && <TypingIndicator />}
          </AnimatePresence>
        </div>
      </ScrollArea>

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
        onSubmit={onSubmit}
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
