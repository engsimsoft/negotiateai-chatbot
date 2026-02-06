"use client";

/**
 * Project Creation Client Component
 *
 * Wraps ServiceChatFloating for project creation.
 * Handles tool results and redirects after project creation.
 *
 * ТЗ-09: ServiceChat унификация
 * v3.8.1: Unified Input System integration
 */

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ServiceChatInput } from "@/components/input";
import { PROJECT_CREATION_CONFIG, type QuickAction } from "@/components/service-chat";
import { cn, generateUUID } from "@/lib/utils";

interface UserProfile {
  displayName?: string | null;
  occupation?: string | null;
  bio?: string | null;
}

interface ProjectCreationClientProps {
  userProfile?: UserProfile;
}

// Project result from tool
interface ProjectResult {
  id: string;
  name: string;
  description?: string;
}

// Message type
interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
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
 * Check for createProject tool result in message parts
 */
function findProjectResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: Array<{ type: string; toolName?: string; result?: any }>
): ProjectResult | null {
  for (const part of parts) {
    if (
      part.type === "tool-result" &&
      part.toolName === "createProject" &&
      part.result?.success &&
      part.result?.projectId
    ) {
      return {
        id: part.result.projectId,
        name: part.result.projectName || "Новый проект",
        description: part.result.projectDescription,
      };
    }
  }
  return null;
}

export function ProjectCreationClient({ userProfile }: ProjectCreationClientProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [projectResult, setProjectResult] = useState<ProjectResult | null>(null);

  const config = PROJECT_CREATION_CONFIG;

  // Create transport for the chat API
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/service-chat",
        body: {
          context: "project-creation",
          userProfile,
        },
      }),
    [userProfile]
  );

  // Initial greeting message
  const greetingWithName = userProfile?.displayName
    ? `Привет, ${userProfile.displayName}! 👋 Расскажите о проекте, который хотите создать.`
    : (config.greeting || "Расскажите о проекте, который хотите создать.");

  const initialMessages = [
    {
      id: "greeting",
      role: "assistant" as "user" | "assistant",
      parts: [{ type: "text" as const, text: greetingWithName }],
    },
  ];

  const { messages: chatMessages, sendMessage, status } = useChat({
    generateId: generateUUID,
    transport,
    messages: initialMessages,
    onError: (err) => setError(err),
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Convert chat messages to display format and check for project creation
  const displayMessages: DisplayMessage[] = useMemo(() => {
    const msgs: DisplayMessage[] = [];

    for (const m of chatMessages) {
      // Check for project result in this message
      if (!projectResult) {
        const result = findProjectResult(m.parts);
        if (result) {
          setProjectResult(result);
        }
      }

      const text = getMessageText(m.parts);
      if (text) {
        msgs.push({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: text,
        });
      }
    }

    return msgs;
  }, [chatMessages, projectResult]);

  // Handle send message (for ServiceChatInput)
  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;

    setError(null);
    setHasInteracted(true);
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input.trim() }],
    });
    setInput("");
  }, [input, isLoading, sendMessage]);

  // Handle quick action click
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (isLoading) return;

      setError(null);
      setHasInteracted(true);
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: action.prompt }],
      });
    },
    [isLoading, sendMessage]
  );

  // Show quick actions only before first interaction
  const showQuickActions = !hasInteracted && config.quickActions && config.quickActions.length > 0;

  // Success card after project creation
  if (projectResult) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
        >
          <div className="mb-4 text-center">
            <div className="mb-2 text-4xl">🎉</div>
            <h2 className="text-xl font-semibold">Проект создан!</h2>
          </div>

          <div className="mb-6 space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Название
              </div>
              <div className="text-lg font-medium">{projectResult.name}</div>
            </div>

            {projectResult.description && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Описание
                </div>
                <div className="text-sm text-muted-foreground">
                  {projectResult.description}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => router.push(`/projects/${projectResult.id}`)}
            >
              Открыть проект →
            </Button>
            <Button
              className="w-full"
              onClick={() => router.push("/dashboard")}
              variant="outline"
            >
              На Главную
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Link href="/dashboard">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <div>
            <h1 className="font-semibold">{config.title}</h1>
            <p className="text-xs text-muted-foreground">
              {config.subtitle}
            </p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <AnimatePresence mode="popLayout">
            {displayMessages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}
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
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
        </div>
      </ScrollArea>

      {/* Quick actions */}
      {showQuickActions && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-2 p-4"
        >
          {config.quickActions!.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickAction(action)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors",
                "hover:bg-muted/50 hover:border-primary/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <span className="text-xl">{action.icon}</span>
              <span className="text-xs font-medium text-center">{action.label}</span>
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
            className="mx-4 mb-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center"
          >
            Произошла ошибка. Попробуйте ещё раз.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input — Unified Input System */}
      <div className="sticky bottom-0 bg-background p-4">
        <div className="mx-auto max-w-2xl">
          <ServiceChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            isLoading={isLoading}
            placeholder="Опишите ваш проект..."
            showVoice={true}
            showVoiceMode={false}
            autoFocus={false}
          />
        </div>
      </div>
    </div>
  );
}
