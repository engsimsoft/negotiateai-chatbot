"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { memo, useMemo, useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { ActionButtons, parseActionButtons } from "./action-buttons";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { Loader } from "./elements/loader";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { SnapshotCard, SnapshotDivider } from "./projects/snapshot-card";
import type { SnapshotData } from "./projects/snapshot-card";
import { ToolActivityIndicator } from "./tool-activity-indicator";
import { TOOL_ACTIVITY_CONFIG, type ToolActivityConfig } from "@/lib/ai/tool-activity-config";
import { Weather } from "./weather";

/**
 * Helper to unwrap ToolResult structure from tool outputs
 * Some tools return data directly, others wrap it in { success, data, error }
 */
function unwrapToolResult<T>(output: any): T {
  // Check if output is wrapped in ToolResult structure
  if (output && typeof output === "object" && "success" in output) {
    // If there's an error, return the output as-is for error handling
    if (output.error) {
      return output as T;
    }
    // If there's data, unwrap it
    if (output.data !== undefined) {
      return output.data as T;
    }
  }
  // Return as-is if not wrapped
  return output as T;
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
  onActionButton,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  onActionButton?: (payload: string) => void;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  const { dataStream } = useDataStream();

  // Deduplicate document tool parts by result.id to prevent duplicate cards
  // (AI sometimes calls createDocument twice for the same document)
  const deduplicatedParts = useMemo(() => {
    if (!message.parts) return [];

    const seenDocumentIds = new Set<string>();
    return message.parts.filter((part) => {
      // Only deduplicate tool-createDocument and tool-updateDocument
      if (part.type === "tool-createDocument" || part.type === "tool-updateDocument") {
        const output = part.output as { id?: string } | undefined;
        if (output?.id) {
          if (seenDocumentIds.has(output.id)) {
            return false; // Skip duplicate
          }
          seenDocumentIds.add(output.id);
        }
      }
      return true;
    });
  }, [message.parts]);

  // ТЗ-07: Set of toolCallIds that already have a tool-* part in message.parts
  // Used to hide data-tool-activity "started" indicators once the real part appears
  const resolvedToolCallIds = useMemo(() => {
    if (!message.parts) return new Set<string>();
    const ids = new Set<string>();
    for (const part of message.parts) {
      const p = part as any;
      if (
        typeof p.type === "string" &&
        p.type.startsWith("tool-") &&
        p.toolCallId
      ) {
        ids.add(p.toolCallId);
      }
    }
    return ids;
  }, [message.parts]);

  // ТЗ-PX: Extract research depth override from data stream (inline, for groupedToolActivities)
  const _devResearchDepth = useMemo(() => {
    if (process.env.NODE_ENV !== "development") return null;
    const parts = dataStream.filter(p => p.type === "data-research-depth");
    return (parts[parts.length - 1]?.data as { depth?: string } | undefined)?.depth ?? null;
  }, [dataStream]);

  // ТЗ-07: Unified tool activity groups
  // Merges active (data stream) + completed (message.parts) indicators,
  // groups by toolName, computes aggregated summary and details.
  // Single source of truth for all tool activity rendering.
  const groupedToolActivities = useMemo(() => {
    const devResearchDepth = _devResearchDepth;
    const groups = new Map<string, {
      config: ToolActivityConfig;
      activeCount: number;
      items: Array<{ args?: any; result?: any }>;
    }>();

    // 1. Active tools from dataStream (not yet resolved in message.parts)
    if (isLoading) {
      const seen = new Set<string>();
      for (const part of dataStream) {
        if (part.type === "data-tool-activity") {
          const data = part.data as { toolName: string; toolCallId: string; args?: any } | undefined;
          if (data && !resolvedToolCallIds.has(data.toolCallId) && !seen.has(data.toolCallId)) {
            seen.add(data.toolCallId);
            const config = TOOL_ACTIVITY_CONFIG[data.toolName];
            if (!config) continue;
            const group = groups.get(data.toolName) ?? { config, activeCount: 0, items: [] };
            group.activeCount++;
            group.items.push({ args: data.args });
            groups.set(data.toolName, group);
          }
        }
      }
    }

    // 2. Completed tools from message.parts (only TOOL_ACTIVITY_CONFIG tools)
    // Skip tools with custom renderers — they handle their own completed state
    const customRendered = new Set(["createDocument", "updateDocument"]);
    for (const part of deduplicatedParts) {
      const type = (part as any).type as string;
      if (typeof type !== "string" || !type.startsWith("tool-")) continue;
      const toolName = type.replace("tool-", "");
      if (customRendered.has(toolName)) continue;
      const config = TOOL_ACTIVITY_CONFIG[toolName];
      if (!config) continue;
      const { input, output } = part as any;
      const group = groups.get(toolName) ?? { config, activeCount: 0, items: [] };
      group.items.push({ args: input, result: output });
      groups.set(toolName, group);
    }

    // 3. Build render props for each group
    return Array.from(groups.entries()).map(([toolName, { config, activeCount, items }]) => {
      const isActive = activeCount > 0;
      const completedResults = items.filter(i => i.result !== undefined).map(i => i.result);

      // Aggregated summary
      let summary: string | null = null;
      if (!isActive && completedResults.length > 0) {
        if (completedResults.length === 1) {
          summary = config.resultFormatter?.(completedResults[0]) ?? null;
        } else if (config.resultCounter) {
          const total = completedResults.reduce((sum, r) => sum + config.resultCounter!(r), 0);
          if (total > 0) summary = `${total} результатов`;
        }
      } else if (isActive && toolName === "deepResearch" && devResearchDepth) {
        // ТЗ-PX: Show actual depth override during execution (dev mode)
        summary = devResearchDepth === "deep" ? "Deep" : "Pro";
      }

      // Details for expandable list
      const details = items
        .map(i => config.argsFormatter?.(i.args))
        .filter((d): d is string => d !== null);

      return {
        toolName,
        isActive,
        config,
        count: items.length > 1 ? items.length : undefined,
        summary,
        details: details.length > 0 ? details : undefined,
      };
    });
  }, [isLoading, dataStream, resolvedToolCallIds, deduplicatedParts, _devResearchDepth]);

  // Dev: extract model name from data stream for badge (only in development)
  const devModelName = useMemo(() => {
    if (process.env.NODE_ENV !== "development") return null;
    const parts = dataStream.filter(p => p.type === "data-model-info");
    return (parts[parts.length - 1]?.data as { modelName?: string } | undefined)?.modelName ?? null;
  }, [dataStream]);

  // Hide empty assistant messages (no visible content).
  // During streaming the SDK may create an assistant message with empty parts before
  // content arrives — "double avatar" problem. After completion, a stale empty message
  // can also remain (e.g. after model switch). Hide in both cases.
  if (message.role === "assistant") {
    const hasToolParts = message.parts?.some((p) => {
      const t = (p as any).type as string;
      return typeof t === "string" && t.startsWith("tool-");
    });
    const hasText = message.parts?.some(
      (p) => p.type === "text" && p.text?.trim()
    );
    const hasReasoning = message.parts?.some(
      (p) => p.type === "reasoning" && (p as any).text?.trim()
    );

    if (!hasToolParts && !hasText && !hasReasoning && groupedToolActivities.length === 0) {
      return null;
    }
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={message.role}
      data-testid={`message-${message.role}`}
      id={`message-${message.id}`}
      initial={{ opacity: 0 }}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <div className="-mt-1 flex shrink-0 flex-col items-center gap-0.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-background ring-1 ring-border">
              <SparklesIcon size={14} />
            </div>
            {devModelName && (
              <span className="mt-0.5 font-mono text-[10px] leading-none text-muted-foreground/60">
                {devModelName}
              </span>
            )}
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
            "min-h-96": message.role === "assistant" && requiresScrollPadding && !isLoading,
            "w-full":
              (message.role === "assistant" &&
                message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                )) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: (attachment as any).name ?? attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {/* ТЗ-07: Unified tool activity indicators (grouped by toolName) */}
          {groupedToolActivities.map((group) => (
            <ToolActivityIndicator
              key={`tool-activity-${group.toolName}`}
              toolName={group.toolName}
              isActive={group.isActive}
              config={group.config}
              count={group.count}
              summary={group.summary}
              details={group.details}
            />
          ))}

          {deduplicatedParts.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning" && part.text?.trim().length > 0) {
              return (
                <MessageReasoning
                  isLoading={isLoading}
                  key={key}
                  reasoning={part.text}
                />
              );
            }

            if (type === "text") {
              if (mode === "view") {
                // ТЗ-2: Parse action buttons from assistant messages
                const sanitized = sanitizeText(part.text);
                const { buttons, cleanText } = message.role === "assistant"
                  ? parseActionButtons(sanitized)
                  : { buttons: [], cleanText: sanitized };

                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "w-fit break-words rounded-2xl bg-secondary px-3 py-2 text-secondary-foreground":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                    >
                      <Response>{cleanText}</Response>
                    </MessageContent>
                    {buttons.length > 0 && onActionButton && (
                      <ActionButtons
                        buttons={buttons}
                        onAction={onActionButton}
                      />
                    )}
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            if (type === "tool-getWeather") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-getWeather" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={<Weather weatherAtLocation={part.output} />}
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-createDocument") {
              const { toolCallId, state } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error creating document: {String(part.output.error)}
                  </div>
                );
              }

              if (state !== "output-available") {
                return (
                  <div key={toolCallId} className="my-1">
                    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm cursor-default">
                      <Loader size={16} className="shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Создаю документ...</span>
                    </div>
                  </div>
                );
              }

              return (
                <DocumentPreview
                  isReadonly={isReadonly}
                  key={toolCallId}
                  result={unwrapToolResult(part.output)}
                />
              );
            }

            if (type === "tool-updateDocument") {
              const { toolCallId, state } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error updating document: {String(part.output.error)}
                  </div>
                );
              }

              if (state !== "output-available") {
                return (
                  <div key={toolCallId} className="my-1">
                    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm cursor-default">
                      <Loader size={16} className="shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Обновляю документ...</span>
                    </div>
                  </div>
                );
              }

              const unwrappedOutput = unwrapToolResult(part.output);
              return (
                <div className="relative" key={toolCallId}>
                  <DocumentPreview
                    args={{ ...(unwrappedOutput as Record<string, any>), isUpdate: true }}
                    isReadonly={isReadonly}
                    result={unwrappedOutput}
                  />
                </div>
              );
            }

            if (type === "tool-requestSuggestions") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-requestSuggestions" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in part.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String(part.output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              isReadonly={isReadonly}
                              result={unwrapToolResult(part.output)}
                              type="request-suggestions"
                            />
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            // @ts-ignore - tool-readDocument is a custom tool not in AI SDK types
            if (type === "tool-readDocument") {
              const { toolCallId, state } = part as any;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-readDocument" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={(part as any).input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={(part as any).output?.error}
                        output={
                          (part as any).output?.success ? (
                            <div className="space-y-2 rounded border p-3 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="font-medium">📄 {(part as any).output.filepath}</span>
                                <span className="text-xs">({(part as any).output.fileSizeKB} KB)</span>
                                {(part as any).output.processingTimeMs && (
                                  <span className="text-xs">
                                    - {Math.round((part as any).output.processingTimeMs / 1000)}s
                                  </span>
                                )}
                              </div>
                              {(part as any).output.note && (
                                <div className="text-muted-foreground text-xs">
                                  {(part as any).output.note}
                                </div>
                              )}
                              <div className="max-h-40 overflow-y-auto text-muted-foreground text-xs">
                                {(part as any).output.content?.substring(0, 500)}
                                {(part as any).output.content && (part as any).output.content.length > 500 && "..."}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded border p-2 text-red-500 text-sm">
                              Error: {(part as any).output?.error || "Unknown error"}
                              {(part as any).output?.suggestion && (
                                <div className="mt-1 text-xs">💡 {(part as any).output.suggestion}</div>
                              )}
                            </div>
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            // @ts-ignore - tool-createSnapshot is a custom tool not in AI SDK types
            if (type === "tool-createSnapshot") {
              const { toolCallId, state } = part as any;
              const output = (part as any).output as SnapshotData | undefined;

              if (state === "output-available" && output?.fullMarkdown) {
                return (
                  <div key={toolCallId}>
                    <SnapshotCard data={output} />
                    <SnapshotDivider />
                  </div>
                );
              }

              // While tool is running, show minimal loading state
              if (state !== "output-available") {
                return (
                  <Tool defaultOpen={true} key={toolCallId}>
                    <ToolHeader state={state} type="tool-createSnapshot" />
                  </Tool>
                );
              }

              return null;
            }

            // ТЗ-07: Catch-all — tools with TOOL_ACTIVITY_CONFIG are rendered
            // grouped above (one indicator per toolName, not per toolCallId)
            if (typeof type === "string" && type.startsWith("tool-")) {
              const toolName = type.replace("tool-", "");
              if (TOOL_ACTIVITY_CONFIG[toolName]) {
                return null;
              }
            }

            return null;
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }

    return true;
  }
);

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={role}
      data-testid="message-assistant-loading"
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="flex items-center gap-2 p-0 text-muted-foreground text-sm">
            <Loader size={16} />
            <span>Thinking...</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

