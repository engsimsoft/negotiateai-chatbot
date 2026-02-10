"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useArtifactSelector } from "@/hooks/use-artifact";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "@/components/artifact";
import { useDataStream } from "@/components/data-stream-provider";
import { Messages } from "@/components/messages";
import { MultimodalInput } from "@/components/multimodal-input";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/components/toast";
import { TaskCompletionCard } from "@/components/projects/task-completion-card";
import type { ProjectTask } from "@/lib/db/schema";
import type { TaskSummary, ProfessorVerdict } from "@/lib/ai/task-completion-types";

interface TaskChatProps {
  chatId: string;
  projectId: string;
  taskId: string;
  task: ProjectTask;
  allTasks: ProjectTask[];
  initialMessages: ChatMessage[];
  isReadonly: boolean;
}

export function TaskChat({
  chatId,
  projectId,
  taskId,
  task,
  allTasks,
  initialMessages,
  isReadonly,
}: TaskChatProps) {
  const { setDataStream } = useDataStream();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Completion state
  const [currentStatus, setCurrentStatus] = useState(task.status);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [completionData, setCompletionData] = useState<{
    outputSummary: TaskSummary | null;
    professorVerdict: ProfessorVerdict | null;
  }>(() => {
    let outputSummary: TaskSummary | null = null;
    let professorVerdict: ProfessorVerdict | null = null;

    if (task.outputSummary) {
      try {
        outputSummary = JSON.parse(task.outputSummary) as TaskSummary;
      } catch {}
    }
    if (task.professorVerdict) {
      professorVerdict = task.professorVerdict as ProfessorVerdict;
    }

    return { outputSummary, professorVerdict };
  });

  // Next task: first pending by orderIndex
  const nextTaskId = useMemo(() => {
    const pending = allTasks
      .filter((t) => t.status === "pending")
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return pending[0]?.id;
  }, [allTasks]);

  const showCompletionCard = currentStatus === "done" || currentStatus === "issues";
  const canComplete = currentStatus === "in_progress" && !isCompleting;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/projects/${projectId}/tasks/${taskId}/chat`,
        fetch: fetchWithErrorHandlers,
        prepareSendMessagesRequest(request) {
          return {
            body: {
              id: chatId,
              message: request.messages.at(-1),
              projectId,
              taskId,
            },
          };
        },
      }),
    [chatId, projectId, taskId]
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport,
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart as typeof ds[number]] : []));
    },
    onError: (error) => {
      toast({
        type: "error",
        description: error.message || "Ошибка при отправке сообщения",
      });
    },
  });

  // Auto-trigger: Expert starts first on new task (no messages)
  const hasTriggeredRef = useRef(false);
  useEffect(() => {
    if (
      initialMessages.length === 0 &&
      !hasTriggeredRef.current &&
      !isReadonly
    ) {
      hasTriggeredRef.current = true;
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: "[SYSTEM: Задача открыта. Начни работу.]" }],
      });
    }
  }, [initialMessages.length, isReadonly, sendMessage]);

  async function handleComplete() {
    setShowConfirmDialog(false);
    setIsCompleting(true);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/complete`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete task");
      }

      const result = await res.json();

      setCurrentStatus(result.status);
      setCompletionData({
        outputSummary: result.outputSummary,
        professorVerdict: result.professorVerdict,
      });

      if (result.projectCompleted) {
        toast({ type: "success", description: "Проект завершён!" });
      }
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Ошибка при завершении задачи",
      });
    } finally {
      setIsCompleting(false);
    }
  }

  function handleReopened() {
    setCurrentStatus("in_progress");
    setCompletionData({ outputSummary: null, professorVerdict: null });
  }

  function handleAccepted() {
    setCurrentStatus("done");
  }

  return (
    <>
      <div className="flex h-dvh min-w-0 flex-col bg-background">
        {/* Task header */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
              {task.orderIndex}
            </span>
            <h1 className="text-sm font-medium truncate">{task.title}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {isCompleting && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Обработка...
              </span>
            )}

            {canComplete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirmDialog(true)}
                disabled={status === "streaming"}
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Завершить задачу
              </Button>
            )}

            {currentStatus === "done" && !isCompleting && (
              <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600">
                Завершена
              </span>
            )}

            {currentStatus === "issues" && !isCompleting && (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                Замечания
              </span>
            )}
          </div>
        </div>

        <Messages
          chatId={chatId}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly || isCompleting}
          messages={messages}
          regenerate={regenerate}
          selectedModelId="gemini-3-pro"
          setMessages={setMessages}
          status={status}
          votes={undefined}
        />

        {/* Completion card — between messages and input */}
        {showCompletionCard && !isCompleting && (
          <div className="mx-auto w-full max-w-4xl px-2 md:px-4">
            <TaskCompletionCard
              projectId={projectId}
              taskId={taskId}
              taskStatus={currentStatus as "done" | "issues"}
              outputSummary={completionData.outputSummary}
              professorVerdict={completionData.professorVerdict}
              nextTaskId={nextTaskId}
              onReopened={handleReopened}
              onAccepted={handleAccepted}
            />
          </div>
        )}

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && !isCompleting && currentStatus === "in_progress" && (
            <MultimodalInput
              attachments={attachments}
              chatId={chatId}
              input={input}
              messages={messages}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              selectedModelId="gemini-3-pro"
              selectedVisibilityType="private"
              isProjectChat
            />
          )}
        </div>
      </div>

      {/* AlertDialog for completion confirmation */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Завершить задачу &laquo;{task.title}&raquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Результаты будут сохранены
              {task.needsReview ? " и проверены Профессором" : ""}.
              {task.needsReview ? " Это может занять до минуты." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Завершить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Artifact
        attachments={attachments}
        chatId={chatId}
        input={input}
        isReadonly={isReadonly || isCompleting}
        messages={messages}
        regenerate={regenerate}
        selectedModelId="gemini-3-pro"
        selectedVisibilityType="private"
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={undefined}
      />
    </>
  );
}
