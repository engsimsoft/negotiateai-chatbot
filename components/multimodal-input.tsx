"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { Trigger } from "@radix-ui/react-select";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { SelectItem } from "@/components/ui/select";
import { chatModels } from "@/lib/ai/models";
import { getProjectModelTiers, type ProjectModelTier } from "@/lib/ai/model-tiers";
import { myProvider } from "@/lib/ai/providers";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn, getChatUrl } from "@/lib/utils";
import { ChatHintsPanel } from "./chat-hints-panel";
import { Context } from "./elements/context";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  CpuIcon,
  PaperclipIcon,
  StopIcon,
} from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { VoiceButton } from "./voice-button";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { SuggestedActions } from "./suggested-actions";
import { Button } from "./ui/button";
import type { VisibilityType } from "./visibility-selector";

function PureMultimodalInput({
  chatId,
  chatMode,
  input,
  setInput,
  status,
  retryState,
  delayState,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  usage,
  isProjectChat,
  projectModelTier,
  onProjectModelChange,
}: {
  chatId: string;
  chatMode?: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  retryState?: { count: number; maxRetries: number };
  delayState?: "normal" | "slow" | "timeout";
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  usage?: AppUsage;
  isProjectChat?: boolean;
  projectModelTier?: string;
  onProjectModelChange?: (tier: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  // ТЗ-4: Force show hint state (for 💡 button)
  const [forceShowHint, setForceShowHint] = useState(false);

  // Voice input hook
  const {
    state: voiceState,
    isAvailable: voiceAvailable,
    startRecording,
    stopRecording,
  } = useVoiceRecorder({
    onTranscript: (text) => {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const isSubmittingRef = useRef(false);

  const submitForm = useCallback(() => {
    // Guard against double submission
    if (isSubmittingRef.current) {
      console.warn("[MultimodalInput] Prevented double submission");
      return;
    }
    isSubmittingRef.current = true;

    // Task chats have fixed URLs — don't override with getChatUrl
    if (!isProjectChat) {
      window.history.replaceState({}, "", getChatUrl(chatId, chatMode));
    }

    sendMessage({
      role: "user",
      parts: [
        ...attachments.map((attachment) => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: "text",
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }

    // Reset guard after a short delay to allow next submission
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 500);
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    chatMode,
    resetHeight,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType, originalFilename } = data;

        return {
          url,
          name: originalFilename ?? pathname,
          contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const _modelResolver = useMemo(() => {
    return myProvider.languageModel(selectedModelId);
  }, [selectedModelId]);

  const contextProps = useMemo(
    () => ({
      usage,
    }),
    [usage]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  // Handle paste from clipboard (Ctrl+V / Cmd+V)
  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            // Generate a readable filename with timestamp
            const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
            const extension = file.type.split("/")[1] || "png";
            const namedFile = new File(
              [file],
              `screenshot-${timestamp}.${extension}`,
              { type: file.type }
            );
            imageFiles.push(namedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        // Prevent default only if we have images to handle
        event.preventDefault();

        setUploadQueue((current) => [
          ...current,
          ...imageFiles.map((f) => f.name),
        ]);

        try {
          const uploadPromises = imageFiles.map((file) => uploadFile(file));
          const uploadedAttachments = await Promise.all(uploadPromises);
          const successfullyUploadedAttachments = uploadedAttachments.filter(
            (attachment) => attachment !== undefined
          );

          setAttachments((currentAttachments) => [
            ...currentAttachments,
            ...successfullyUploadedAttachments,
          ]);
        } catch (error) {
          console.error("Error uploading pasted images!", error);
          toast.error("Failed to upload pasted image");
        } finally {
          setUploadQueue((current) =>
            current.filter((name) => !imageFiles.some((f) => f.name === name))
          );
        }
      }
    },
    [uploadFile, setAttachments]
  );

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            chatId={chatId}
            chatMode={chatMode}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
          />
        )}

      <ChatHintsPanel
        messagesCount={messages.length}
        forceShow={forceShowHint}
        onDismiss={() => setForceShowHint(false)}
      />

      <input
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
        accept="image/jpeg,image/png,application/pdf,.docx,.xlsx,.xls,.xlsm,.csv,.txt,.md"
      />

      <PromptInput
        className="rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== "ready") {
            toast.error("Please wait for the model to finish its response!");
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row items-end gap-2 overflow-x-scroll"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <div className="flex flex-row items-start gap-1 sm:gap-2">
          <PromptInputTextarea
            autoFocus
            className="grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
            data-testid="multimodal-input"
            disableAutoResize={true}
            maxHeight={200}
            minHeight={44}
            onChange={handleInput}
            onPaste={handlePaste}
            placeholder="Send a message..."
            ref={textareaRef}
            rows={1}
            value={input}
          />{" "}
          <Context {...contextProps} />
        </div>
        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              selectedModelId={selectedModelId}
              status={status}
            />
            {voiceAvailable && (
              <VoiceButton
                state={voiceState}
                onStart={startRecording}
                onStop={stopRecording}
                disabled={status !== "ready"}
              />
            )}
            {isProjectChat && (
              <ModelSelectorCompact
                onModelChange={onModelChange}
                selectedModelId={selectedModelId}
                isProjectChat={isProjectChat}
                projectModelTier={projectModelTier}
                onProjectModelChange={onProjectModelChange}
              />
            )}
            {/* ТЗ-5: Hints panel button */}
            <Button
              className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
              onClick={(event) => {
                event.preventDefault();
                setForceShowHint(true);
              }}
              title="Подсказки"
              variant="ghost"
            >
              <span className="text-sm">💡</span>
            </Button>
          </PromptInputTools>

          {retryState && retryState.count > 0 && (
            <div className="text-xs text-muted-foreground px-2">
              Повторная попытка {retryState.count}/{retryState.maxRetries}...
            </div>
          )}
          {delayState === "slow" && (
            <div className="text-xs text-amber-500 px-2">
              Ответ занимает больше времени, пожалуйста подождите...
            </div>
          )}
          {delayState === "timeout" && (
            <div className="text-xs text-destructive px-2">
              Запрос остановлен. Отправьте ещё раз или измените вопрос.
            </div>
          )}

          {status === "submitted" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              disabled={!input.trim() || uploadQueue.length > 0}
              status={status}
            >
              <ArrowUpIcon size={14} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.retryState?.count !== nextProps.retryState?.count) {
      return false;
    }
    if (prevProps.delayState !== nextProps.delayState) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const isReasoningModel = selectedModelId === "chat-model-reasoning";

  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || isReasoningModel}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
  isProjectChat,
  projectModelTier,
  onProjectModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  isProjectChat?: boolean;
  projectModelTier?: string;
  onProjectModelChange?: (tier: string) => void;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);
  const [optimisticTier, setOptimisticTier] = useState<ProjectModelTier>(
    (projectModelTier as ProjectModelTier) || "expert"
  );

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    if (projectModelTier) {
      setOptimisticTier(projectModelTier as ProjectModelTier);
    }
  }, [projectModelTier]);

  // Project chat: show PROJECT_MODELS
  if (isProjectChat) {
    const projectModels = getProjectModelTiers();
    const selectedProjectModel = projectModels.find((m) => m.id === optimisticTier);

    return (
      <PromptInputModelSelect
        onValueChange={(modelName) => {
          const model = projectModels.find((m) => m.name === modelName);
          if (model) {
            setOptimisticTier(model.id);
            onProjectModelChange?.(model.id);
            // Save to cookie for persistence
            startTransition(() => {
              document.cookie = `project-model-tier=${model.id};path=/;max-age=31536000`;
            });
          }
        }}
        value={selectedProjectModel?.name}
      >
        <Trigger
          className="flex h-8 items-center gap-2 rounded-lg border-0 bg-background px-2 text-foreground shadow-none transition-colors hover:bg-accent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          type="button"
        >
          <span className="text-sm">{selectedProjectModel?.icon}</span>
          <span className="hidden font-medium text-xs sm:block">
            {selectedProjectModel?.name}
          </span>
          <ChevronDownIcon size={16} />
        </Trigger>
        <PromptInputModelSelectContent className="min-w-[260px] p-0">
          <div className="flex flex-col gap-px">
            {projectModels.map((model) => (
              <SelectItem key={model.id} value={model.name}>
                <div className="flex items-center gap-2">
                  <span>{model.icon}</span>
                  <div>
                    <div className="truncate font-medium text-xs">{model.name}</div>
                    <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                      {model.description}
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </div>
        </PromptInputModelSelectContent>
      </PromptInputModelSelect>
    );
  }

  // Regular chat: show Claude models
  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId
  );

  return (
    <PromptInputModelSelect
      onValueChange={(modelName) => {
        const model = chatModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
      value={selectedModel?.name}
    >
      <Trigger
        className="flex h-8 items-center gap-2 rounded-lg border-0 bg-background px-2 text-foreground shadow-none transition-colors hover:bg-accent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        type="button"
      >
        <CpuIcon size={16} />
        <span className="hidden font-medium text-xs sm:block">
          {selectedModel?.name}
        </span>
        <ChevronDownIcon size={16} />
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {chatModels.map((model) => (
            <SelectItem key={model.id} value={model.name}>
              <div className="truncate font-medium text-xs">{model.name}</div>
              <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                {model.description}
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
