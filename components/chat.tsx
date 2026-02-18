"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
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

import { useSidebar } from "@/components/ui/sidebar";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import {
  ChatSDKError,
  categorizeClientError,
  clientErrorMessages,
} from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn, fetcher, fetchWithErrorHandlers, generateUUID, getChatUrl } from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatSidebar } from "./chat-sidebar";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { ContextIndicator } from "./projects/context-indicator";
import { ProfessorProgress } from "./projects/professor-progress";
import { makeChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";
import type { PipelinePhase, Subtask } from "@/lib/ai/professor-pipeline";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialChatMode = "chat",
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
  projectId,
  projectName,
  projectModelTier,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialChatMode?: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
  projectId?: string;
  projectName?: string;
  projectModelTier?: string;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
    chatMode: initialChatMode as "chat" | "expertise" | "create",
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const [currentChatMode, setCurrentChatMode] = useState(initialChatMode);
  const currentChatModeRef = useRef(currentChatMode);
  const [currentProjectTier, setCurrentProjectTier] = useState(projectModelTier || "expert");
  const currentProjectTierRef = useRef(currentProjectTier);
  const [retryState, setRetryState] = useState({ count: 0, maxRetries: 3 });
  const [delayState, setDelayState] = useState<"normal" | "slow" | "timeout">(
    "normal"
  );

  // ТЗ-C3: Context usage indicator
  const [contextPercent, setContextPercent] = useState(0);

  // ТЗ-03 Фаза 7: Professor Pipeline state
  const [professorPhase, setProfessorPhase] = useState<PipelinePhase | null>(null);
  const [professorSubtasks, setProfessorSubtasks] = useState<Subtask[]>([]);
  const [professorComplete, setProfessorComplete] = useState(false);
  const [professorError, setProfessorError] = useState<string | undefined>();
  const isProfessorMode = currentProjectTier === "professor";
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    currentChatModeRef.current = currentChatMode;
  }, [currentChatMode]);

  useEffect(() => {
    currentProjectTierRef.current = currentProjectTier;
  }, [currentProjectTier]);

  const clearDelayTimers = useCallback(() => {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  const isRetryableError = useCallback((error: unknown) => {
    return (
      error instanceof ChatSDKError &&
      (error.type === "offline" || error.type === "rate_limit")
    );
  }, []);

  const retryableFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      let attempt = 0;
      const maxRetries = retryState.maxRetries;

      while (attempt <= maxRetries) {
        try {
          if (attempt > 0) {
            setRetryState({ count: attempt, maxRetries });
          }
          const response = await fetchWithErrorHandlers(input, init);
          if (attempt > 0) {
            toast({
              type: "success",
              description: "Соединение восстановлено",
            });
          }
          setRetryState({ count: 0, maxRetries });
          return response;
        } catch (error) {
          if (!isRetryableError(error) || attempt === maxRetries) {
            setRetryState({ count: 0, maxRetries });
            throw error;
          }

          const delayMs = 1000 * Math.pow(2, attempt);
          toast({
            type: "error",
            description: `Проблемы с сетью. Повтор ${attempt + 1}/${
              maxRetries
            } через ${Math.round(delayMs / 1000)}с`,
          });

          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempt += 1;
        }
      }

      return fetchWithErrorHandlers(input, init);
    },
    [isRetryableError, retryState.maxRetries]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: retryableFetch,
        prepareSendMessagesRequest(request) {
          return {
            body: {
              id: request.id,
              message: request.messages.at(-1),
              // ТЗ-DV2: chatMode replaces selectedChatModel
              chatMode: currentChatModeRef.current,
              selectedVisibilityType: visibilityType,
              // ТЗ-03: Project chat support
              ...(projectId && { projectId }),
              ...(projectId && { projectModelTier: currentProjectTierRef.current }),
              ...request.body,
            },
          };
        },
      }),
    [retryableFetch, visibilityType, projectId]
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport,
    onData: (dataPart) => {
      // Cast dataPart to match expected type
      setDataStream((ds) => (ds ? [...ds, dataPart as typeof ds[number]] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data as AppUsage);
      }

      // ТЗ-C3: Handle context usage indicator
      if (dataPart.type === "data-context-usage") {
        const data = dataPart.data as { percent: number };
        setContextPercent(data.percent);
      }

      // ТЗ-03 Фаза 7: Handle Professor Pipeline events
      if (dataPart.type.startsWith("data-professor-") && dataPart.data) {
        const event = dataPart.data as {
          type: string;
          phase?: PipelinePhase;
          subtasks?: Subtask[];
          subtask?: Subtask;
          error?: string;
        };
        switch (event.type) {
          case "professor-phase":
            if (event.phase) {
              setProfessorPhase(event.phase);
              setProfessorComplete(false);
              setProfessorError(undefined);
            }
            break;
          case "professor-subtasks":
            if (event.subtasks) {
              setProfessorSubtasks(event.subtasks);
            }
            break;
          case "professor-subtask-update":
            if (event.subtask) {
              const updatedSubtask = event.subtask;
              setProfessorSubtasks((prev) =>
                prev.map((st) =>
                  st.id === updatedSubtask.id ? updatedSubtask : st
                )
              );
            }
            break;
          case "professor-complete":
            setProfessorComplete(true);
            break;
          case "professor-error":
            setProfessorError(event.error);
            break;
        }
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(makeChatHistoryPaginationKey(initialChatMode as "chat" | "expertise" | "create")));
      setRetryState({ count: 0, maxRetries: retryState.maxRetries });
      setDelayState("normal");
      // ТЗ-07: Clear tool-activity events from data stream to prevent stale indicators
      setDataStream((prev) => prev.filter((p) => p.type !== "data-tool-activity"));
      // Reset professor state after completion (with delay to show completion)
      if (isProfessorMode) {
        setTimeout(() => {
          setProfessorPhase(null);
          setProfessorSubtasks([]);
          setProfessorComplete(false);
          setProfessorError(undefined);
        }, 3000);
      }

      // ТЗ-07A: Автонейминг теперь происходит server-side (chat/route.ts onFinish)
      // Sidebar обновится через mutate выше (line 270)
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          const category = categorizeClientError(error);
          toast({
            type: "error",
            description:
              clientErrorMessages[category] ?? error.message,
          });
        }
        setDelayState("normal");
      }
    },
  });

  useEffect(() => {
    if (status === "submitted") {
      slowTimerRef.current = setTimeout(() => {
        setDelayState("slow");
      }, 30_000);

      timeoutTimerRef.current = setTimeout(() => {
        setDelayState("timeout");
        toast({
          type: "error",
          description: "Запрос занял слишком много времени. Попробуйте снова.",
        });
        stop();
      }, 60_000);
    } else {
      setDelayState("normal");
      clearDelayTimers();
    }

    return () => {
      clearDelayTimers();
    };
  }, [status, stop, clearDelayTimers]);

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const hasAppendedQueryRef = useRef(false);

  useEffect(() => {
    if (query && !hasAppendedQueryRef.current) {
      hasAppendedQueryRef.current = true;
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
      // ТЗ-RG: Mode-aware URL
      window.history.replaceState({}, "", getChatUrl(id, currentChatModeRef.current, projectId));
    }
  }, [query, sendMessage, id, projectId]);

  // ТЗ-07A: Обновляем URL при первом сообщении в чате проекта (без query параметра)
  const hasUpdatedUrlRef = useRef(false);
  useEffect(() => {
    if (projectId && messages.length > 0 && !hasUpdatedUrlRef.current) {
      hasUpdatedUrlRef.current = true;
      const expectedUrl = getChatUrl(id, currentChatModeRef.current, projectId);
      // Проверяем, что URL ещё не содержит chatId
      if (!window.location.pathname.includes(id)) {
        window.history.replaceState({}, "", expectedUrl);
      }
    }
  }, [projectId, messages.length, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  // ТЗ-08: Chat sidebar state + push-layout
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const { setOpen: setLeftSidebarOpen, open: leftSidebarOpen } = useSidebar();

  // Toggle right sidebar
  const handleToggleChatSidebar = useCallback(() => {
    setIsChatSidebarOpen((prev) => !prev);
  }, []);

  // Auto-close: right opens → left closes
  useEffect(() => {
    if (isChatSidebarOpen) {
      setLeftSidebarOpen(false);
    }
  }, [isChatSidebarOpen, setLeftSidebarOpen]);

  // Auto-close: left opens → right closes
  useEffect(() => {
    if (leftSidebarOpen && isChatSidebarOpen) {
      setIsChatSidebarOpen(false);
    }
  }, [leftSidebarOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle action button clicks (send payload as user message)
  const handleActionButton = useCallback(
    (payload: string) => {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: payload }],
      });
    },
    [sendMessage]
  );

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className={cn(
        "overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background",
        "transition-[margin] duration-200 ease-linear",
        isChatSidebarOpen && "md:mr-[380px]"
      )}>
        <ChatHeader
          chatMode={currentChatMode}
          onInsertToChat={setInput}
          projectId={projectId}
          projectName={projectName}
          onToggleSidebar={handleToggleChatSidebar}
          isSidebarOpen={isChatSidebarOpen}
        />

        {/* ТЗ-03 Фаза 7: Professor Pipeline Progress */}
        {isProfessorMode && (professorPhase || professorSubtasks.length > 0 || professorError) && (
          <div className="mx-auto w-full max-w-4xl px-2 md:px-4">
            <ProfessorProgress
              phase={professorPhase}
              subtasks={professorSubtasks}
              isComplete={professorComplete}
              error={professorError}
            />
          </div>
        )}

        <Messages
          chatId={id}
          isReadonly={isReadonly}
          messages={messages}
          onActionButton={handleActionButton}
          regenerate={regenerate}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl flex-col gap-0 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
            {/* ТЗ-C3: Context usage indicator */}
            <ContextIndicator percent={contextPercent} />
            {!isReadonly && (
              <MultimodalInput
                attachments={attachments}
                chatId={id}
                chatMode={currentChatMode}
                input={input}
                messages={messages}
                retryState={retryState}
                delayState={delayState}
                onModelChange={setCurrentModelId}
                selectedModelId={currentModelId}
                selectedVisibilityType={visibilityType}
                sendMessage={sendMessage}
                setAttachments={setAttachments}
                setInput={setInput}
                setMessages={setMessages}
                status={status}
                stop={stop}
                usage={usage}
                isProjectChat={!!projectId}
                projectModelTier={currentProjectTier}
                onProjectModelChange={setCurrentProjectTier}
              />
            )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      {/* ТЗ-08: Chat sidebar (materials panel) */}
      <ChatSidebar
        open={isChatSidebarOpen}
        onClose={() => setIsChatSidebarOpen(false)}
        messages={messages}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
