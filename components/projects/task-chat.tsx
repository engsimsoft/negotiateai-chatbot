"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useArtifactSelector } from "@/hooks/use-artifact";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "@/components/artifact";
import { useDataStream } from "@/components/data-stream-provider";
import { Messages } from "@/components/messages";
import { MultimodalInput } from "@/components/multimodal-input";
import { toast } from "@/components/toast";
import type { ProjectTask } from "@/lib/db/schema";

interface TaskChatProps {
  chatId: string;
  projectId: string;
  taskId: string;
  task: ProjectTask;
  initialMessages: ChatMessage[];
  isReadonly: boolean;
}

export function TaskChat({
  chatId,
  projectId,
  taskId,
  task,
  initialMessages,
  isReadonly,
}: TaskChatProps) {
  const { setDataStream } = useDataStream();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

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
          {isReadonly && (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              Завершена
            </span>
          )}
        </div>

        <Messages
          chatId={chatId}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId="gemini-3-pro"
          setMessages={setMessages}
          status={status}
          votes={undefined}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
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

      <Artifact
        attachments={attachments}
        chatId={chatId}
        input={input}
        isReadonly={isReadonly}
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
