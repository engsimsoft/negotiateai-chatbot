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
  emitDebugCompaction,
  truncateForDebug,
  DEBUG_EVENT_SCHEMA_VERSION,
  type DebugStepData,
} from "@/lib/ai/debug-events";
import {
  createStreamId,
  getCompletedTaskSummaries,
  getMessagesByChatId,
  getProjectById,
  getProjectTaskById,
  saveAiUsageLog,
  saveMessages,
} from "@/lib/db/queries";
import { calcCostUsd, getTokenlensCatalog, calcStepCostRub } from "@/lib/ai/tokenlens-catalog";
import { extractUsageFields, extractUsageForPricing } from "@/lib/ai/usage-utils";
import { createStepTracker } from "@/lib/ai/tool-call-guardian";
import { ChatSDKError } from "@/lib/errors";
import { convertToUIMessages, estimateMessageTokens, generateUUID, sanitizeCoreMessages } from "@/lib/utils";
import { retrieveMemoryContext } from "@/lib/ai/memory/retrieve";
import { extractAndStoreFacts } from "@/lib/ai/memory/extract";

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

    // Load messages + completed tasks in parallel
    const newMessageTokens = estimateMessageTokens(message.parts);
    const [messagesFromDb, completedTasks] = await Promise.all([
      getMessagesByChatId({
        id: chatId,
        maxTokens: 140000 - newMessageTokens,
        minMessages: 20,
      }),
      getCompletedTaskSummaries({ projectId }),
    ]);

    const messagesForModel = messagesFromDb;
    const uiMessages = [...convertToUIMessages(messagesForModel), message as any];

    // Build expert prompt
    const systemPromptText = buildTaskExpertPrompt({
      project,
      task,
      completedTasks,
      manifest: project.manifestJson,
    });

    // Token counting for debug info
    const messagesTokens = messagesForModel.reduce(
      (sum, m) => sum + (m.tokenCount || estimateMessageTokens(m.parts as any)),
      0
    );
    const systemPromptTokens = estimateMessageTokens([
      { type: "text", text: systemPromptText },
    ]);

    // ТЗ-RAG1/RAG2: Retrieve MIND memory facts for project tasks
    // Gate: check user's memoryEnabled setting
    let finalSystemPrompt = systemPromptText;
    let isMemoryEnabled = true;
    {
      try {
        const { getMemorySettings } = await import("@/lib/db/queries");
        const memSettings = await getMemorySettings({ userId: session.user.id });
        isMemoryEnabled = memSettings.memoryEnabled;
      } catch {
        // Default to enabled
      }

      if (isMemoryEnabled) {
        try {
          const userQueryText = message.parts
            .filter((p: any): p is { type: "text"; text: string } => p.type === "text")
            .map((p: any) => p.text)
            .join("\n");

          if (userQueryText.length >= 5) {
            const memoryResult = await retrieveMemoryContext(
              session.user.id,
              userQueryText,
              { chatId },
            );

            if (memoryResult.promptBlock) {
              finalSystemPrompt += `\n\n${memoryResult.promptBlock}`;
            }
          }
        } catch (error) {
          console.warn("[MIND] Retrieve failed in task chat (non-blocking):", error instanceof Error ? error.message : error);
        }
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

    // Generate assistant message ID upfront
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
      originalMessages: uiMessages,
      execute: async ({ writer: dataStream }) => {
        // ТЗ-DEV1: Emit debug prompt info
        {
          const injections: string[] = ["project-context"];
          emitDebugPrompt(dataStream, {
            systemPromptPreview: finalSystemPrompt.slice(0, 500),
            systemPromptLength: finalSystemPrompt.length,
            activeAgent: `Эксперт (${tier})`,
            chatMode: `project:${tier}`,
            isProjectChat: true,
            projectTier: tier,
            hasSnapshotContext: false,
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
          // ТЗ-RAG3: Anthropic Compaction API — automatic context management
          providerOptions: {
            anthropic: {
              contextManagement: {
                edits: [{
                  type: 'compact_20260112' as const,
                  trigger: { type: 'input_tokens' as const, value: 100_000 },
                  pauseAfterCompaction: false,
                  instructions: 'Сохрани обязательно: имена людей и организаций, даты и дедлайны, принятые решения и обоснования, числа и суммы, контекст текущего проекта/задачи, незавершённые задачи и открытые вопросы, предпочтения пользователя, контекст задачи, связь с планом проекта, результаты предыдущих шагов. Удали: повторяющиеся приветствия, промежуточные рассуждения если итог зафиксирован, дублирующуюся информацию, технические детали tool calls если результат уже в контексте.',
                }]
              }
            }
          },
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
          onFinish: async ({ totalUsage, providerMetadata }) => {
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

            // ТЗ-RAG3: Emit compaction debug event if compaction occurred
            const anthropicMeta = providerMetadata?.anthropic as
              | { iterations?: Array<{ type: string; input_tokens: number; output_tokens: number }> }
              | undefined;
            const iterations = anthropicMeta?.iterations;
            if (iterations && iterations.length > 0) {
              const hasCompaction = iterations.some((it) => it.type === "compaction");
              emitDebugCompaction(dataStream, {
                triggered: hasCompaction,
                iterations: iterations.map((it) => ({
                  type: it.type as "compaction" | "message",
                  inputTokens: it.input_tokens,
                  outputTokens: it.output_tokens,
                })),
              });
              if (hasCompaction) {
                console.log(
                  `[Compaction] Task ${taskId}: compaction triggered — ${iterations.length} iterations`
                );
              }
            }
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
        // Only save NEW messages (not the original ones already in DB)
        const originalIds = new Set(uiMessages.map((m) => m.id));
        const newMessages = messages.filter((m) => !originalIds.has(m.id));
        const messagesToSave = newMessages.map((currentMessage) => {
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

        // ТЗ-RAG1: Extract facts from task conversation (fire-and-forget)
        // ТЗ-RAG2: Respects memoryEnabled setting
        if (isMemoryEnabled) {
          const userText = message.parts
            .filter((p: any): p is { type: "text"; text: string } => p.type === "text")
            .map((p: any) => p.text)
            .join("\n");

          const assistantText = messages
            .filter((m) => m.role === "assistant")
            .flatMap((m) => m.parts)
            .filter((p: any) => p.type === "text" && p.text?.trim())
            .map((p: any) => p.text)
            .join("\n");

          if (userText.length >= 10 && assistantText.length >= 10) {
            void extractAndStoreFacts({
              userId: session.user.id,
              userMessage: userText,
              assistantMessage: assistantText,
              sourceType: "project",
              sourceChatId: chatId,
              sourceProjectId: projectId,
            }).catch((err) =>
              console.warn("[MIND] Extract failed in task chat (non-blocking):", err instanceof Error ? err.message : err)
            );
          }
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
