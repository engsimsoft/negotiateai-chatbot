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
import { useArtifactSelector } from "@/hooks/use-artifact";
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
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { ProfessorProgress } from "./projects/professor-progress";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";
import type { PipelinePhase, Subtask } from "@/lib/ai/professor-pipeline";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
  projectId,
  projectName,
  projectModelTier,
  helperId,
  helperName,
  helperEmoji,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
  projectId?: string;
  projectName?: string;
  projectModelTier?: string;
  // ТЗ-07A: Helper chat support
  helperId?: string;
  helperName?: string;
  helperEmoji?: string;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const [currentProjectTier, setCurrentProjectTier] = useState(projectModelTier || "expert");
  const currentProjectTierRef = useRef(currentProjectTier);
  const [retryState, setRetryState] = useState({ count: 0, maxRetries: 3 });
  const [delayState, setDelayState] = useState<"normal" | "slow" | "timeout">(
    "normal"
  );

  // ТЗ-03 Фаза 7: Professor Pipeline state
  const [professorPhase, setProfessorPhase] = useState<PipelinePhase | null>(null);
  const [professorSubtasks, setProfessorSubtasks] = useState<Subtask[]>([]);
  const [professorComplete, setProfessorComplete] = useState(false);
  const [professorError, setProfessorError] = useState<string | undefined>();
  const isProfessorMode = currentProjectTier === "professor";
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ТЗ-07A: Автонейминг — флаг чтобы вызвать только один раз
  const hasTriggeredAutonaming = useRef(false);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

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
              selectedChatModel: currentModelIdRef.current,
              selectedVisibilityType: visibilityType,
              // ТЗ-03: Project chat support
              ...(projectId && { projectId }),
              ...(projectId && { projectModelTier: currentProjectTierRef.current }),
              // ТЗ-07A: Helper chat support
              ...(helperId && { helperId }),
              ...request.body,
            },
          };
        },
      }),
    [retryableFetch, visibilityType, projectId, helperId]
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
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
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
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      setRetryState({ count: 0, maxRetries: retryState.maxRetries });
      setDelayState("normal");
      // Reset professor state after completion (with delay to show completion)
      if (isProfessorMode) {
        setTimeout(() => {
          setProfessorPhase(null);
          setProfessorSubtasks([]);
          setProfessorComplete(false);
          setProfessorError(undefined);
        }, 3000);
      }

      // ТЗ-07A: Автонейминг после 2-го ответа AI (4 сообщения = 2 обмена)
      // API проверяет: >= 4 сообщений И isRenamed === false
      if (!hasTriggeredAutonaming.current) {
        fetch(`/api/chat/${id}/generate-title`, { method: "POST" })
          .then((res) => res.json())
          .then((data) => {
            if (data.generated) {
              // Название сгенерировано — больше не вызываем
              hasTriggeredAutonaming.current = true;
              // Обновляем sidebar чтобы новое название отобразилось
              mutate(unstable_serialize(getChatHistoryPaginationKey));
            }
            // Если skipped — попробуем ещё раз после следующего ответа AI
          })
          .catch((err) => console.warn("[Autonaming] Failed:", err));
      }
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

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

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
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          onInsertToChat={setInput}
          projectId={projectId}
          projectName={projectName}
          helperId={helperId}
          helperName={helperName}
          helperEmoji={helperEmoji}
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
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          onActionButton={handleActionButton}
          regenerate={regenerate}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
            {!isReadonly && (
              <MultimodalInput
                attachments={attachments}
                chatId={id}
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
