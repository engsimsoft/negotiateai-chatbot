"use client";

/**
 * Project Creation Client Component
 *
 * Split layout: Preview (left) + Chat (right)
 * Preview shows draft state updated by AI in real-time.
 *
 * ТЗ-10: Live Preview
 * v3.9.0: Split layout + Draft state
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { PROJECT_CREATION_CONFIG } from "@/components/service-chat";
import { generateUUID } from "@/lib/utils";
import {
  ProjectDraftPreview,
  type ProjectDraft,
} from "./components/project-draft-preview";
import { ProjectChatPanel } from "./components/project-chat-panel";

interface UserProfile {
  displayName?: string | null;
  occupation?: string | null;
  bio?: string | null;
  pronouns?: string | null;
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
 * Extract draft updates from updateProjectDraft tool results
 * Returns partial draft with only the fields that were updated
 *
 * Note: Tool results have type "tool-{toolName}" and data in "output" field
 */
function extractDraftUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: Array<{ type: string; output?: any; state?: string }>
): Partial<ProjectDraft> | null {
  for (const part of parts) {
    // Tool results have type "tool-{toolName}" format
    if (
      part.type === "tool-updateProjectDraft" &&
      part.state === "output-available" &&
      part.output?.success &&
      part.output?.draft
    ) {
      const draft = part.output.draft;
      const update: Partial<ProjectDraft> = {};

      // Only include non-null fields
      if (draft.name) update.name = draft.name;
      if (draft.description) update.description = draft.description;
      if (draft.context) update.context = draft.context;

      return Object.keys(update).length > 0 ? update : null;
    }
  }
  return null;
}

export function ProjectCreationClient({ userProfile }: ProjectCreationClientProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [projectResult, setProjectResult] = useState<ProjectResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Draft state for live preview
  const [draft, setDraft] = useState<ProjectDraft>({
    name: "",
    description: "",
    context: "",
  });

  const isComplete = draft.name.trim() !== "" && draft.description.trim() !== "";

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

  // Initial greeting message — respect pronouns (ты/вы)
  const isInformal = userProfile?.pronouns === "ты";
  const greetingWithName = userProfile?.displayName
    ? isInformal
      ? `Привет, ${userProfile.displayName}! Расскажи, какой проект хочешь создать?`
      : `Привет, ${userProfile.displayName}! Расскажите, какой проект хотите создать?`
    : "Привет! Расскажите, какой проект хотите создать?";

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

  // Convert chat messages to display format
  const displayMessages: DisplayMessage[] = useMemo(() => {
    const msgs: DisplayMessage[] = [];

    for (const m of chatMessages) {
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
  }, [chatMessages]);

  // Parse tool results and update draft in real-time
  // Track processed message IDs to avoid duplicate updates
  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const m of chatMessages) {
      // Skip already processed messages
      if (processedIdsRef.current.has(m.id)) continue;

      const draftUpdate = extractDraftUpdate(m.parts);
      if (draftUpdate) {
        setDraft((prev) => ({
          ...prev,
          ...draftUpdate,
        }));
        processedIdsRef.current.add(m.id);
      }
    }
  }, [chatMessages]);

  // Handle create project
  const handleCreateProject = useCallback(async () => {
    if (!isComplete || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          context: draft.context || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const project = await response.json();
      setProjectResult({
        id: project.id,
        name: project.name,
        description: project.description,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsCreating(false);
    }
  }, [draft, isComplete, isCreating]);

  // Handle send message
  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;

    setError(null);
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input.trim() }],
    });
    setInput("");
  }, [input, isLoading, sendMessage]);

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
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Left: Preview (desktop only) - sticky */}
      <aside className="hidden w-[400px] flex-shrink-0 border-r p-6 lg:block overflow-auto">
        <ProjectDraftPreview
          draft={draft}
          onDraftChange={setDraft}
          isComplete={isComplete}
          onCreateProject={handleCreateProject}
          isCreating={isCreating}
        />
      </aside>

      {/* Right: Chat */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button size="icon" variant="ghost">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-lg">{config.icon}</span>
              <div>
                <h1 className="font-semibold">{config.title}</h1>
                <p className="text-xs text-muted-foreground">{config.subtitle}</p>
              </div>
            </div>
          </div>
          <UserMenu />
        </header>

        {/* Chat panel */}
        <ProjectChatPanel
          messages={displayMessages}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          error={error}
        />
      </main>
    </div>
  );
}
