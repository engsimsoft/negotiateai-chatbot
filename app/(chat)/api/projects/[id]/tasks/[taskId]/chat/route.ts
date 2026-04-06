import {
  convertToModelMessages,
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
import { myProvider } from "@/lib/ai/providers";
import { getStandardTools, getActiveToolNames } from "@/lib/ai/tools/chat-tools";
import { isProductionEnvironment, isSimplyDevMode } from "@/lib/constants";
import { calculateCostRub } from "@/lib/ai/providers";
import {
  emitDebugStep,
  emitDebugGuardian,
  emitDebugFinish,
  emitDebugPrompt,
  truncateForDebug,
  DEBUG_EVENT_SCHEMA_VERSION,
  type DebugStepData,
} from "@/lib/ai/debug-events";
import {
  addChatSnapshot,
  createStreamId,
  getCompletedTaskSummaries,
  getChatWithSnapshotState,
  getMessagesByChatId,
  getProjectById,
  getProjectTaskById,
  resetChatContextState,
  saveAiUsageLog,
  saveMessages,
  updateChatContextState,
} from "@/lib/db/queries";
import { calcUsagePercent, SNAPSHOT_THRESHOLD, FALLBACK_MESSAGE_PAIRS } from "@/lib/ai/context-limits";
import { createFallbackSnapshot } from "@/lib/ai/clerks/snapshot-creator";
import { calcCostUsd, getTokenlensCatalog, calcStepCostRub } from "@/lib/ai/tokenlens-catalog";
import { extractUsageFields, extractUsageForPricing } from "@/lib/ai/usage-utils";
import { createStepTracker } from "@/lib/ai/tool-call-guardian";
import { ChatSDKError } from "@/lib/errors";
import { convertToUIMessages, estimateMessageTokens, generateUUID, sanitizeCoreMessages } from "@/lib/utils";

export const maxDuration = 180;

// Task chat schema
const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(16000),
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
          userId: session.user.id,
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

        // ТЗ-DEV1: Emit debug prompt info
        {
          const injections: string[] = ["project-context"];
          if (snapshotContext) injections.push("snapshot-context");
          emitDebugPrompt(dataStream, {
            systemPromptPreview: finalSystemPrompt.slice(0, 500),
            systemPromptLength: finalSystemPrompt.length,
            activeAgent: `Эксперт (${tier})`,
            chatMode: `project:${tier}`,
            isProjectChat: true,
            projectTier: tier,
            hasSnapshotContext: !!snapshotContext,
            contextInjections: injections,
          });
        }

        // ТЗ-DEV1: Debug step tracking state
        let debugStepIndex = 0;
        const debugStepDataQueue: DebugStepData[] = [];
        // SSOT: prefetch TokenLens catalog for per-step cost calculation
        const tlProviders = isSimplyDevMode ? await getTokenlensCatalog() : undefined;

        const result = streamText({
          model: modelToUse,
          // ТЗ-CACHE1: system as message with per-message cacheControl (top-level providerOptions doesn't mark messages)
          messages: [
            { role: 'system' as const, content: finalSystemPrompt, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
            ...sanitizeCoreMessages(await convertToModelMessages(uiMessages)),
          ],
          temperature: 1.0,
          stopWhen: stepCountIs(5),
          experimental_activeTools: getActiveToolNames(isProjectChat),
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: getStandardTools({ session, dataStream, isProjectChat, projectId, chatId, messageId: assistantMessageId }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-task-expert",
          },
          onStepFinish: ({ usage, toolCalls, toolResults, response, finishReason }) => {
            if (isSimplyDevMode) {
              const inferredType = finishReason === "tool-calls"
                ? "tool-calls"
                : toolResults && toolResults.length > 0
                  ? "tool-result"
                  : "initial";
              const stepModelId = response?.modelId || "unknown";
              const stepUsage = extractUsageForPricing(usage);
              const stepData: DebugStepData = {
                schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
                stepIndex: debugStepIndex++,
                stepType: inferredType,
                modelId: stepModelId,
                noCacheInputTokens: stepUsage.noCacheInputTokens,
                cacheReadTokens: stepUsage.cacheReadTokens,
                cacheWriteTokens: stepUsage.cacheWriteTokens,
                outputTokens: stepUsage.outputTokens,
                reasoningTokens: stepUsage.reasoningTokens ?? 0,
                finishReason: finishReason || "unknown",
                stepCostRub: calcStepCostRub(stepModelId, stepUsage, tlProviders),
                toolCalls: (toolCalls ?? []).map((tc: any) => ({
                  toolName: tc.toolName,
                  args: (tc.input ?? tc.args) as Record<string, unknown>,
                })),
                toolResults: (toolResults ?? []).map((tr: any) => ({
                  toolName: tr.toolName,
                  result: truncateForDebug(tr.output ?? tr.result),
                })),
                timestamp: Date.now(),
              };
              debugStepDataQueue.push(stepData);
            }
          },
          // ТЗ-PIPELINE1: Use totalUsage (sum of all steps), not per-step usage
          onFinish: async ({ totalUsage }) => {
            const totalTime = Date.now() - startTime;
            if (firstTokenTime === null) {
              firstTokenTime = totalTime;
            }
            console.log(
              `[TaskExpert] Task ${taskId}: TTFT = ${firstTokenTime}ms, Total = ${totalTime}ms, Usage = ${JSON.stringify(totalUsage)}`
            );

            // ТЗ-OPT1+CACHE2: Usage logging (fire-and-forget)
            const TIER_ALIAS: Record<string, string> = { executor: "claude-haiku", expert: "claude-sonnet", professor: "claude-opus" };
            const resolvedModelId = myProvider.languageModel(TIER_ALIAS[tier] || "claude-sonnet").modelId;
            const costUsd = await calcCostUsd(resolvedModelId, totalUsage);
            const usageFields = extractUsageFields(totalUsage);
            saveAiUsageLog({
              chatId,
              userId: session.user.id,
              modelId: resolvedModelId,
              ...usageFields,
              costUsd,
              chatMode: `project:${tier}`,
              durationMs: totalTime,
            }).catch(() => {});

            // ТЗ-DEV1: Emit debug finish summary
            const finishUsage = extractUsageForPricing(totalUsage);
            emitDebugFinish(dataStream, {
              schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
              totalNoCacheInputTokens: finishUsage.noCacheInputTokens,
              totalCacheReadTokens: finishUsage.cacheReadTokens,
              totalCacheWriteTokens: finishUsage.cacheWriteTokens,
              totalOutputTokens: finishUsage.outputTokens,
              totalReasoningTokens: finishUsage.reasoningTokens ?? 0,
              totalSteps: debugStepDataQueue.length,
              totalDurationMs: totalTime,
              timeToFirstTokenMs: firstTokenTime ?? totalTime,
              estimatedCostRub: calculateCostRub(resolvedModelId, finishUsage),
              modelId: resolvedModelId,
              finishReason: "stop",
            });
          },
        });

        result.consumeStream();

        const baseStream = result.toUIMessageStream({
          sendReasoning: true,
        });

        // ТЗ-FIX1.2: Guardian step tracker for hallucination detection
        const guardianTracker = createStepTracker({
          context: `project:${tier}`,
        });

        // ТЗ-DEV1: Per-step timing
        let stepStartTime = Date.now();
        let debugStreamStepIndex = 0;

        // Instrumented stream with TTFT tracking + Guardian + buffering
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

            // ТЗ-FIX1.2: Buffer text-delta events within step, flush or block on step-finish
            let stepTextBuffer: Array<unknown> = [];
            let consecutiveHallucinations = 0;

            // ТЗ-FIX1.2: Text-related events to buffer (text-start/delta/end must stay in order)
            const textBufferTypes = new Set([
              "text-start", "text-delta", "text-end",
              "reasoning-start", "reasoning-delta", "reasoning-end",
            ]);

            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                // ТЗ-FIX1.2: Flush any remaining buffer on stream end
                for (const buffered of stepTextBuffer) {
                  controller.enqueue(buffered);
                }
                stepTextBuffer = [];

                // Collect guardian flags on EOF
                const guardianFlags = guardianTracker.getAllDetections();
                if (guardianFlags) {
                  console.warn(`[Guardian:project:${tier}] Stream ended with detections:`, {
                    count: guardianFlags.count,
                    details: guardianFlags.details.map(d => ({
                      step: d.step,
                      tool: d.toolMentioned,
                      pattern: d.pattern,
                    })),
                  });
                  // Save guardian flags to usage log (fire-and-forget)
                  const TIER_ALIAS: Record<string, string> = { executor: "claude-haiku", expert: "claude-sonnet", professor: "claude-opus" };
                  const resolvedModelId = myProvider.languageModel(TIER_ALIAS[tier] || "claude-sonnet").modelId;
                  saveAiUsageLog({
                    chatId,
                    userId: session.user.id,
                    modelId: resolvedModelId,
                    inputTokens: 0,
                    outputTokens: 0,
                    costUsd: 0,
                    chatMode: `project:${tier}:guardian`,
                    durationMs: 0,
                    guardianFlags: guardianFlags as unknown as Record<string, unknown>,
                  }).catch(() => {});
                }
                controller.close();
                break;
              }

              if (value && typeof value === "object" && "type" in value) {
                const eventType = (value as any).type;

                // ТЗ-FIX1.2: UI stream uses "start-step"/"finish-step"
                if (eventType === "start-step") {
                  guardianTracker.reset();
                  stepStartTime = Date.now(); // ТЗ-DEV1: timing
                }

                // ТЗ-FIX1.2: Buffer text-related events (text-start/delta/end must arrive in order)
                if (textBufferTypes.has(eventType)) {
                  if (eventType === "text-delta") {
                    // UI stream uses .delta (NOT .textDelta)
                    const chunk = (value as any).delta ?? "";
                    if (chunk) {
                      guardianTracker.addText(chunk);
                    }
                  }
                  stepTextBuffer.push(value);
                  continue; // Do NOT enqueue — buffered until finish-step
                }

                if (eventType === "finish-step") {
                  const guardianResult = guardianTracker.analyze();

                  if (guardianResult.detected) {
                    // ТЗ-FIX1.2: Block — do NOT flush text buffer
                    console.warn(`[Guardian:project:${tier}] Blocked hallucinated step (${stepTextBuffer.length} chunks suppressed)`);
                    stepTextBuffer = [];
                    consecutiveHallucinations++;

                    if (consecutiveHallucinations >= 2) {
                      console.warn(`[Guardian:project:${tier}] Max retries exceeded, showing error to user`);
                      controller.enqueue({
                        type: "text-delta",
                        textDelta: "Не удалось выполнить эту операцию автоматически. Попробуйте переформулировать запрос или разбить задачу на части.",
                      });
                    }
                  } else {
                    // ТЗ-FIX1.2: Clean step — flush buffered text
                    for (const buffered of stepTextBuffer) {
                      controller.enqueue(buffered);
                    }
                    stepTextBuffer = [];
                    consecutiveHallucinations = 0; // Reset on clean step
                  }

                  // ТЗ-DEV1: Emit debug step + guardian events
                  if (isSimplyDevMode) {
                    const stepDurationMs = Date.now() - stepStartTime;
                    const pendingStep = debugStepDataQueue[debugStreamStepIndex];
                    if (pendingStep) emitDebugStep(dataStream, pendingStep);
                    emitDebugGuardian(dataStream, {
                      stepIndex: debugStreamStepIndex,
                      detected: guardianResult.detected,
                      confidence: guardianResult.confidence,
                      action: guardianResult.detected ? "blocked" : "clean",
                      details: (guardianResult.details || []).map((d: any) => ({
                        toolMentioned: d.toolMentioned || "",
                        pattern: d.pattern || "",
                        snippet: d.snippet || "",
                      })),
                      durationMs: stepDurationMs,
                    });
                    debugStreamStepIndex++;
                  }
                }

                if (eventType === "tool-input-start") {
                  const toolName = (value as any).toolName || "unknown";
                  const toolCallId = (value as any).toolCallId || "unknown";

                  // ТЗ-FIX1.2: Guardian — register tool call in step
                  guardianTracker.addToolCall(toolName);

                  // ТЗ-07: Notify client when tool execution starts
                  dataStream.write({
                    type: "data-tool-activity",
                    data: { toolName, toolCallId },
                  });
                }
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
