import {
  convertToCoreMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { buildTaskExpertPrompt } from "@/lib/prompts/build-task-expert-prompt";
import { getProjectModel, isValidModelTier, DEFAULT_PROJECT_MODEL } from "@/lib/ai/model-tiers";
import { getStandardTools, getActiveToolNames } from "@/lib/ai/tools/chat-tools";
import { isProductionEnvironment } from "@/lib/constants";
import {
  addChatSnapshot,
  createStreamId,
  getCompletedTaskSummaries,
  getChatWithSnapshotState,
  getMessagesByChatId,
  getProjectById,
  getProjectTaskById,
  resetChatContextState,
  saveMessages,
  updateChatContextState,
} from "@/lib/db/queries";
import { calcUsagePercent, SNAPSHOT_THRESHOLD, FALLBACK_MESSAGE_PAIRS } from "@/lib/ai/context-limits";
import { createFallbackSnapshot } from "@/lib/ai/clerks/snapshot-creator";
import { ChatSDKError } from "@/lib/errors";
import { convertToUIMessages, estimateMessageTokens, generateUUID, sanitizeCoreMessages } from "@/lib/utils";

export const maxDuration = 180;

// Task chat schema
const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    "image/jpeg",
    "image/png",
    "application/pdf",
    "text/plain",
  ]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const taskChatRequestSchema = z.object({
  id: z.string().uuid(), // chatId
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  projectModelTier: z.enum(["executor", "expert", "professor"]).optional(),
});

type TaskChatRequest = z.infer<typeof taskChatRequestSchema>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  let requestBody: TaskChatRequest;

  try {
    const json = await request.json();
    requestBody = taskChatRequestSchema.parse(json);
  } catch (_error) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id: chatId, message, projectId, taskId, projectModelTier } = requestBody;
    const { id: paramProjectId, taskId: paramTaskId } = await params;

    // Verify URL params match body
    if (projectId !== paramProjectId || taskId !== paramTaskId) {
      return new ChatSDKError("bad_request:api", "URL params mismatch").toResponse();
    }

    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // Parallel: load project + task
    const [project, task] = await Promise.all([
      getProjectById({ id: projectId }),
      getProjectTaskById({ taskId, projectId }),
    ]);

    // Guards
    if (!project || project.userId !== session.user.id) {
      return new ChatSDKError("forbidden:chat", "Project not found or access denied").toResponse();
    }

    if (!task) {
      return new ChatSDKError("not_found:chat", "Task not found").toResponse();
    }

    if (task.chatId !== chatId) {
      return new ChatSDKError("forbidden:chat", "Chat does not belong to this task").toResponse();
    }

    // Load messages + completed tasks + snapshot state in parallel
    const newMessageTokens = estimateMessageTokens(message.parts);
    const [messagesFromDb, completedTasks, chatWithState] = await Promise.all([
      getMessagesByChatId({
        id: chatId,
        maxTokens: 140000 - newMessageTokens,
        minMessages: 20,
      }),
      getCompletedTaskSummaries({ projectId }),
      getChatWithSnapshotState({ chatId }),
    ]);

    // ТЗ-C1.5: Snapshot-aware message trimming
    const snapshots = chatWithState?.snapshots || [];
    const contextState = chatWithState?.contextState || null;
    let snapshotContext: string | undefined;
    let messagesForModel = messagesFromDb;

    if (snapshots.length > 0) {
      const lastSnapshot = snapshots[snapshots.length - 1];
      const snapshotMsgIndex = messagesFromDb.findIndex(
        (m) => m.id === lastSnapshot.messageId
      );

      if (snapshotMsgIndex >= 0) {
        // Extract fullMarkdown from the snapshot message's tool-createSnapshot part
        const snapshotMsg = messagesFromDb[snapshotMsgIndex];
        const snapshotPart = (snapshotMsg.parts as any[])?.find(
          (p: any) =>
            p.type === "tool-createSnapshot" && p.output?.fullMarkdown
        );
        snapshotContext =
          snapshotPart?.output?.fullMarkdown ||
          `## Итог\n${lastSnapshot.summary}`;
        // Only send messages after the snapshot to the model
        messagesForModel = messagesFromDb.slice(snapshotMsgIndex + 1);
      } else {
        // Snapshot message not in loaded set — use fullMarkdown (clerk) or summary
        snapshotContext =
          lastSnapshot.fullMarkdown || `## Итог\n${lastSnapshot.summary}`;
      }

      console.log(
        `[TaskExpert] Task ${taskId}: snapshot found, trimmed ${messagesFromDb.length - messagesForModel.length} messages, snapshotContext = ${snapshotContext!.length} chars`
      );
    }

    const uiMessages = [...convertToUIMessages(messagesForModel), message as any];

    // Build expert prompt (with snapshotContext if available)
    const systemPromptText = buildTaskExpertPrompt({
      project,
      task,
      completedTasks,
      manifest: project.manifestJson,
      snapshotContext,
    });

    // ТЗ-C1.5: Estimated usage BEFORE streaming
    const messagesTokens = messagesForModel.reduce(
      (sum, m) => sum + (m.tokenCount || estimateMessageTokens(m.parts as any)),
      0
    );
    const systemPromptTokens = estimateMessageTokens([
      { type: "text", text: systemPromptText },
    ]);
    const estimatedPercent = calcUsagePercent(
      messagesTokens + systemPromptTokens + newMessageTokens
    );

    // ТЗ-C1.5: System signal injection at threshold
    let finalSystemPrompt = systemPromptText;
    if (
      estimatedPercent >= SNAPSHOT_THRESHOLD * 100 &&
      !contextState?.suggestionActive
    ) {
      finalSystemPrompt += `\n\n[SYSTEM: Контекстное окно заполнено на ${estimatedPercent}%. Мягко предложи пользователю зафиксировать прогресс. Если пользователь согласится, вызови tool createSnapshot.]`;
      await updateChatContextState({
        chatId,
        contextState: { suggestionActive: true, messagesSinceSuggestion: 0 },
      });
    } else if (contextState?.suggestionActive) {
      const newCount = (contextState.messagesSinceSuggestion || 0) + 1;

      if (newCount >= FALLBACK_MESSAGE_PAIRS) {
        // ТЗ-C1.5: Fallback — model ignored suggestion, clerk creates snapshot
        console.log(
          `[TaskExpert] Task ${taskId}: fallback triggered (${newCount} messages since suggestion)`
        );
        const fallbackResult = await createFallbackSnapshot({
          taskTitle: task.title,
          taskGoal: task.goal || "",
          chatMessages: messagesFromDb,
        });

        if (fallbackResult) {
          await addChatSnapshot({
            chatId,
            messageId: `fallback-${generateUUID()}`,
            summary: fallbackResult.shortSummary,
            fullMarkdown: fallbackResult.fullMarkdown,
          });
          await resetChatContextState({ chatId });
          console.log(
            `[TaskExpert] Task ${taskId}: fallback snapshot saved — will apply on next request`
          );
        } else {
          // Clerk failed — reset state to avoid infinite retries
          await resetChatContextState({ chatId });
          console.warn(
            `[TaskExpert] Task ${taskId}: fallback clerk failed — contextState reset`
          );
        }
      } else {
        // Increment messagesSinceSuggestion counter
        await updateChatContextState({
          chatId,
          contextState: {
            ...contextState,
            messagesSinceSuggestion: newCount,
          },
        });
      }
    }

    // Save user message before streaming
    await saveMessages({
      messages: [
        {
          chatId,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
          tokenCount: estimateMessageTokens(message.parts),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId });

    // ТЗ-C1.5: Generate assistant message ID upfront (needed for snapshot tool)
    const assistantMessageId = generateUUID();

    // Model: use selected tier (Исполнитель/Эксперт/Профессор)
    const tier = projectModelTier && isValidModelTier(projectModelTier)
      ? projectModelTier
      : DEFAULT_PROJECT_MODEL;
    const projectModelConfig = getProjectModel(tier);
    const modelToUse = projectModelConfig.model;
    const isProjectChat = true;

    const startTime = Date.now();
    let firstTokenTime: number | null = null;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        // ТЗ-C1.5: Send usage annotation BEFORE streaming starts
        dataStream.write({
          type: "data-context-usage",
          data: { percent: estimatedPercent, tokens: messagesTokens + systemPromptTokens },
        });

        // Dev: emit model info for UI badge
        {
          const TIER_MODEL: Record<string, string> = { executor: "claude-haiku", expert: "claude-sonnet", professor: "claude-opus" };
          const mid = TIER_MODEL[tier] || "claude-sonnet";
          const DISPLAY: Record<string, string> = { "claude-haiku": "Haiku", "claude-sonnet": "Sonnet", "claude-opus": "Opus" };
          dataStream.write({ type: "data-model-info", data: { modelId: mid, modelName: DISPLAY[mid] || mid } });
        }

        const result = streamText({
          model: modelToUse,
          system: finalSystemPrompt,
          messages: sanitizeCoreMessages(convertToCoreMessages(uiMessages)),
          temperature: 1.0,
          stopWhen: stepCountIs(5),
          experimental_activeTools: getActiveToolNames(isProjectChat),
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: getStandardTools({ session, dataStream, isProjectChat, projectId, chatId, messageId: assistantMessageId }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-task-expert",
          },
          onFinish: async ({ usage }) => {
            const totalTime = Date.now() - startTime;
            if (firstTokenTime === null) {
              firstTokenTime = totalTime;
            }
            console.log(
              `[TaskExpert] Task ${taskId}: TTFT = ${firstTokenTime}ms, Total = ${totalTime}ms, Usage = ${JSON.stringify(usage)}`
            );
          },
        });

        result.consumeStream();

        const baseStream = result.toUIMessageStream({
          sendReasoning: true,
        });

        // Instrumented stream with TTFT tracking
        const instrumentedStream = new ReadableStream({
          async start(controller) {
            const reader = baseStream.getReader();
            const ignoredTypes = new Set([
              "response-metadata",
              "data-usage",
              "tool-call",
              "tool-result",
              "tool-error",
            ]);

            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                controller.close();
                break;
              }

              if (
                firstTokenTime === null &&
                value &&
                typeof value === "object" &&
                "type" in value &&
                !ignoredTypes.has((value as any).type)
              ) {
                firstTokenTime = Date.now() - startTime;
                console.log(
                  `[TaskExpert] Task ${taskId}: first chunk = ${firstTokenTime}ms`
                );
              }

              // ТЗ-07: Notify client when tool execution starts (AI SDK v5 event type)
              if (
                value &&
                typeof value === "object" &&
                "type" in value &&
                (value as any).type === "tool-input-start"
              ) {
                const toolName = (value as any).toolName || "unknown";
                const toolCallId = (value as any).toolCallId || "unknown";
                dataStream.write({
                  type: "data-tool-activity",
                  data: { toolName, toolCallId },
                });
              }

              controller.enqueue(value);
            }
          },
        });

        dataStream.merge(instrumentedStream);
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        const messagesToSave = messages.map((currentMessage) => {
          const filteredParts = currentMessage.parts.filter((part: any) => {
            const type = part.type;
            if (type === "text" || type === "step-start" || type === "step-finish") {
              return true;
            }
            if (type === "tool-createDocument" || type === "tool-updateDocument" || type === "tool-createSnapshot") {
              return true;
            }
            return false;
          });

          return {
            id: currentMessage.id,
            role: currentMessage.role,
            parts: filteredParts,
            createdAt: new Date(),
            attachments: [],
            chatId,
            tokenCount: estimateMessageTokens(filteredParts),
          };
        }).filter((msg) => {
          // Don't save empty assistant messages (no useful content after filtering)
          if (msg.role === "assistant") {
            const hasContent = msg.parts.some(
              (p: any) => p.type === "text" && p.text?.trim()
            );
            const hasTools = msg.parts.some(
              (p: any) => p.type?.startsWith("tool-")
            );
            return hasContent || hasTools;
          }
          return true;
        });

        if (messagesToSave.length > 0) {
          await saveMessages({ messages: messagesToSave });
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error("[TaskExpert] Unhandled error:", error);
    return new ChatSDKError("offline:chat").toResponse();
  }
}
