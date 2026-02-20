"use client";

/**
 * Briefing Setup Client Component
 *
 * Split layout: Preview (left) + Chat (right)
 * Preview shows briefing profile updated by AI in real-time.
 *
 * ТЗ-A2: Briefing Onboarding
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
import { generateUUID } from "@/lib/utils";
import { useBriefingGeneration } from "@/hooks/use-briefing-generation";
import { BriefingGenerationProgress } from "@/components/briefing/briefing-generation-progress";
import {
  BriefingProfilePreview,
  type BriefingProfile,
} from "./components/briefing-profile-preview";
import { BriefingChatPanel } from "./components/briefing-chat-panel";

interface UserProfile {
  displayName?: string | null;
  occupation?: string | null;
  bio?: string | null;
  pronouns?: string | null;
}

interface BriefingSetupClientProps {
  briefingMode: "create" | "edit";
  userProfile?: UserProfile;
  initialProfile?: BriefingProfile;
}

// Message type for display
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
 * Extract briefing preview updates from updateBriefingPreview or saveBriefingProfile tool results
 */
function extractPreviewUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: Array<{ type: string; output?: any; state?: string }>
): BriefingProfile | null {
  for (const part of parts) {
    if (
      (part.type === "tool-updateBriefingPreview" ||
        part.type === "tool-saveBriefingProfile") &&
      part.state === "output-available" &&
      part.output?.success
    ) {
      // updateBriefingPreview returns { success, preview }
      // saveBriefingProfile returns { success, topicsCount, sourcesCount }
      const data = part.output.preview || part.output;

      // For saveBriefingProfile, we don't have full preview data
      if (part.type === "tool-saveBriefingProfile") {
        return null; // Signal save completed separately
      }

      if (data.topics && data.sources) {
        return {
          topics: data.topics,
          sources: data.sources,
          settings: data.settings,
        };
      }
    }
  }
  return null;
}

/**
 * Check if saveBriefingProfile was called successfully
 */
function checkSaveComplete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: Array<{ type: string; output?: any; state?: string }>
): boolean {
  return parts.some(
    (p) =>
      p.type === "tool-saveBriefingProfile" &&
      p.state === "output-available" &&
      p.output?.success
  );
}

export function BriefingSetupClient({
  briefingMode,
  userProfile,
  initialProfile,
}: BriefingSetupClientProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // ТЗ-А5: streaming generation progress
  const generation = useBriefingGeneration();

  // Briefing profile state for live preview (edit mode: pre-loaded from DB)
  const [preview, setPreview] = useState<BriefingProfile>(
    initialProfile ?? { topics: [], sources: [], settings: undefined },
  );

  // Create transport for the chat API
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/service-chat",
        body: {
          context: "briefing-onboarding",
          briefingMode,
          userProfile,
        },
      }),
    [briefingMode, userProfile]
  );

  // Initial greeting (different for create vs edit)
  const isInformal = userProfile?.pronouns === "ты";
  const greetingText =
    briefingMode === "edit"
      ? userProfile?.displayName
        ? isInformal
          ? `С возвращением, ${userProfile.displayName}! Вижу твой текущий профиль — ${initialProfile?.topics.length ?? 0} тем, ${initialProfile?.sources.length ?? 0} источников. Что хочешь изменить?`
          : `С возвращением, ${userProfile.displayName}! Вижу ваш текущий профиль — ${initialProfile?.topics.length ?? 0} тем, ${initialProfile?.sources.length ?? 0} источников. Что хотите изменить?`
        : `С возвращением! Вижу ваш текущий профиль — ${initialProfile?.topics.length ?? 0} тем, ${initialProfile?.sources.length ?? 0} источников. Что хотите изменить?`
      : userProfile?.displayName
        ? isInformal
          ? `Привет, ${userProfile.displayName}! Давай настроим твой утренний брифинг. Чем ты занимаешься и что важно знать каждое утро?`
          : `Привет, ${userProfile.displayName}! Давайте настроим ваш утренний брифинг. Чем вы занимаетесь и что важно знать каждое утро?`
        : "Привет! Давайте настроим ваш утренний брифинг. Чем вы занимаетесь и что важно знать каждое утро?";

  const initialMessages = [
    {
      id: "greeting",
      role: "assistant" as "user" | "assistant",
      parts: [{ type: "text" as const, text: greetingText }],
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

  // Parse tool results and update preview in real-time
  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const m of chatMessages) {
      if (processedIdsRef.current.has(m.id)) continue;

      // Check for preview updates
      const previewUpdate = extractPreviewUpdate(m.parts);
      if (previewUpdate) {
        setPreview(previewUpdate);
        processedIdsRef.current.add(m.id);
      }

      // Check for save completion
      if (checkSaveComplete(m.parts)) {
        setIsSaved(true);
        processedIdsRef.current.add(m.id);
      }
    }
  }, [chatMessages]);

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

  // ТЗ-А5: auto-navigate on generation complete
  useEffect(() => {
    if (!generation.redirectUrl) return;
    const timer = setTimeout(() => {
      router.push(generation.redirectUrl!);
    }, 1000);
    return () => clearTimeout(timer);
  }, [generation.redirectUrl, router]);

  // Success card after save — show progress or card
  if (isSaved) {
    // Show progress when generating
    if (generation.isGenerating || generation.steps.length > 0) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
          <BriefingGenerationProgress
            steps={generation.steps}
            isGenerating={generation.isGenerating}
            error={generation.error}
            onRetry={generation.startGeneration}
          />
        </div>
      );
    }

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
        >
          <div className="mb-4 text-center">
            <div className="mb-2 text-4xl">{"\u{2600}\u{FE0F}"}</div>
            <h2 className="text-xl font-semibold">Брифинг настроен!</h2>
          </div>

          <div className="mb-6 space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              {preview.topics.length > 0
                ? `${preview.topics.length} тем, ${preview.sources.length} источников`
                : "Профиль сохранён"}
            </p>
            <p className="text-sm text-muted-foreground">
              Сгенерируйте первый выпуск прямо сейчас!
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={generation.startGeneration}
            >
              {"\u{2600}\u{FE0F}"} Сгенерировать первый брифинг
            </Button>
            <Button
              className="w-full"
              onClick={() => router.push("/briefing")}
              variant="outline"
            >
              Позже
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Left: Preview (desktop only) */}
      <aside className="hidden w-[400px] flex-shrink-0 overflow-auto border-r p-6 lg:block">
        <BriefingProfilePreview profile={preview} />
      </aside>

      {/* Right: Chat */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Link href="/briefing">
              <Button size="icon" variant="ghost">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-lg">☀️</span>
              <div>
                <h1 className="font-semibold">Настройка брифинга</h1>
                <p className="text-xs text-muted-foreground">
                  {briefingMode === "edit"
                    ? "Изменение тем и источников"
                    : "Расскажите о ваших интересах"}
                </p>
              </div>
            </div>
          </div>
          <UserMenu />
        </header>

        {/* Chat panel */}
        <BriefingChatPanel
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
