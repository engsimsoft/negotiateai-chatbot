"use client";

/**
 * Briefing Chat Panel
 *
 * Chat interface for briefing onboarding dialog.
 * Handles messages, typing indicator, input.
 * Pattern: ProjectChatPanel
 *
 * ТЗ-A2: Briefing Onboarding
 */

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ServiceChatInput } from "@/components/input";
import { cn } from "@/lib/utils";
import { ResearchProgressCard, type TopicProgress } from "./research-progress-card";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface BriefingChatPanelProps {
  messages: DisplayMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  error?: Error | null;
  /** ТЗ-FIX2: Live research progress per topic */
  researchTopics?: TopicProgress[];
}

export function BriefingChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  isLoading,
  error,
  researchTopics,
}: BriefingChatPanelProps) {
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
                  <p className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* ТЗ-FIX2: Research progress or typing indicator */}
          <AnimatePresence>
            {isLoading && researchTopics && researchTopics.length > 0 ? (
              <ResearchProgressCard key="research-progress" topics={researchTopics} />
            ) : isLoading ? (
              <motion.div
                key="typing-indicator"
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
            ) : null}
          </AnimatePresence>

          {/* Scroll anchor */}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

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
            placeholder="Расскажите о ваших интересах..."
            autoFocus={false}
          />
        </div>
      </div>
    </div>
  );
}
