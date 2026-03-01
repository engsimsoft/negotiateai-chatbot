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
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserMenu } from "@/components/user-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generateUUID } from "@/lib/utils";
import { useBriefingGeneration } from "@/hooks/use-briefing-generation";
import { BriefingGenerationProgress } from "@/components/briefing/briefing-generation-progress";
import {
  BriefingProfilePreview,
  type BriefingProfile,
} from "./components/briefing-profile-preview";
import { BriefingChatPanel } from "./components/briefing-chat-panel";
import { BriefingDeliverySettings } from "@/components/briefing/briefing-delivery-settings";
import type { TopicProgress } from "./components/research-progress-card";

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
 * Extract briefing preview updates from updateBriefingPreview tool results
 */
function extractPreviewUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: Array<{ type: string; output?: any; state?: string }>
): BriefingProfile | null {
  for (const part of parts) {
    if (
      part.type === "tool-updateBriefingPreview" &&
      part.state === "output-available" &&
      part.output?.success
    ) {
      const data = part.output.preview || part.output;

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


export function BriefingSetupClient({
  briefingMode,
  userProfile,
  initialProfile,
}: BriefingSetupClientProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<Error | null>(null);
  // ТЗ-FIX3: Save via UI button, not AI tool
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // ТЗ-FIX2 Этап 3: research progress state (data-research-progress events)
  const [researchProgress, setResearchProgress] = useState<Map<string, TopicProgress>>(new Map());

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
    // ТЗ-FIX2: Consume data stream events (research progress + model info)
    onData: (part) => {
      if (part.type === "data-research-progress") {
        const event = part.data as {
          topicId: string;
          topicName: string;
          emoji: string;
          phase: "searching" | "verifying" | "done" | "error";
          found?: number;
          verified?: number;
          error?: string;
        };
        setResearchProgress((prev) => {
          const next = new Map(prev);
          next.set(event.topicId, event);
          return next;
        });
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // ТЗ-FIX2: Derive active research progress (show only while researching)
  const activeResearchTopics = useMemo(() => {
    if (researchProgress.size === 0) return [];
    const topics = Array.from(researchProgress.values());
    // All done/error → research complete, hide progress
    const allFinished = topics.every((t) => t.phase === "done" || t.phase === "error");
    if (allFinished && !isLoading) return [];
    return topics;
  }, [researchProgress, isLoading]);

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

      // ТЗ-FIX3: saveBriefingProfile tool removed — save via UI button
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

  // ТЗ-FIX3: Save button — enabled when ≥1 topic + ≥1 source
  const canSave = preview.topics.length >= 1 && preview.sources.length >= 1;
  const hasUnsavedData = preview.topics.length > 0 || preview.sources.length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/briefing/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: preview.topics,
          sources: preview.sources,
          settings: preview.settings,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setIsSaved(true);
    } catch (err) {
      console.error("[BriefingSetup] Save error:", err);
      setError(err instanceof Error ? err : new Error("Save failed"));
      setIsSaving(false);
    }
  }, [canSave, isSaving, preview]);

  // ТЗ-FIX3: Back button — show leave dialog if unsaved
  const handleBack = useCallback(() => {
    if (hasUnsavedData && !isSaved) {
      setShowLeaveDialog(true);
    } else {
      router.push("/briefing");
    }
  }, [hasUnsavedData, isSaved, router]);

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
            traceStages={generation.traceStages}
            traceSummary={generation.traceSummary}
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
      <aside className="hidden w-100 shrink-0 overflow-auto border-r p-6 lg:block">
        <BriefingProfilePreview profile={preview} />
      </aside>

      {/* Right: Chat */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
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
          <div className="flex items-center gap-2">
            {/* ТЗ-TG4a: Delivery settings popover */}
            <TooltipProvider delayDuration={300}>
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="relative h-9 w-9"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Доставка</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-80 p-4">
                  <BriefingDeliverySettings />
                </PopoverContent>
              </Popover>
            </TooltipProvider>
            <Button
              size="sm"
              disabled={!canSave || isSaving}
              onClick={handleSave}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {briefingMode === "edit" ? "Сохранить изменения" : "Сохранить"}
            </Button>
            <UserMenu />
          </div>
        </header>

        {/* Chat panel */}
        <BriefingChatPanel
          messages={displayMessages}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
          error={error}
          researchTopics={activeResearchTopics}
        />
      </main>

      {/* ТЗ-FIX3: Unsaved changes guard */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выйти без сохранения?</AlertDialogTitle>
            <AlertDialogDescription>
              {briefingMode === "edit"
                ? "Изменения не сохранены. Всё вернётся к прежним настройкам."
                : "Настройки брифинга не сохранены. При выходе все изменения будут потеряны."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => router.push("/briefing")}
            >
              Выйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
