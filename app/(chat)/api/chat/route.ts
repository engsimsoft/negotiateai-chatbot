import { geolocation } from "@vercel/functions";
import {
  convertToCoreMessages,
  createUIMessageStream,
  generateObject,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { z } from "zod";
import { getTokenlensCatalog, getUsage } from "@/lib/ai/tokenlens-catalog";
import { auth } from "@/app/(auth)/auth";
import { userEntitlements } from "@/lib/ai/entitlements";
import { getModelForChatMode } from "@/lib/ai/chat-mode-config";
import { buildChatPrompt, buildExpertisePrompt, buildCreatePrompt } from "@/lib/prompts/server";
import type { BuildContext } from "@/lib/prompts";
import { buildProjectContext } from "@/lib/prompts/contexts";
import { myProvider } from "@/lib/ai/providers";
import {
  getProjectModel,
  isValidModelTier,
  DEFAULT_PROJECT_MODEL,
  type ProjectModelTier,
} from "@/lib/ai/model-tiers";
import { createFallbackSnapshot } from "@/lib/ai/clerks/snapshot-creator";
import {
  SNAPSHOT_THRESHOLD,
  FALLBACK_MESSAGE_PAIRS,
  calcUsagePercent,
} from "@/lib/ai/context-limits";
import { executeProfessorPipeline } from "@/lib/ai/professor-pipeline";
import { getStandardTools, getActiveToolNames } from "@/lib/ai/tools/chat-tools";
import { isProductionEnvironment } from "@/lib/constants";
import { createStepTracker, type GuardianFlags } from "@/lib/ai/tool-call-guardian";
import {
  addChatSnapshot,
  createStreamId,
  deleteChatById,
  getChatById,
  getChatWithSnapshotState,
  getFilesByProjectId,
  getMessageCountByUserId,
  getMessagesByChatId,
  getProjectById,
  getUserById,
  resetChatContextState,
  saveAiUsageLog,
  saveChat,
  saveMessages,
  updateChatContextState,
  updateChatLastContextById,
  updateChatTitleAndSummary,
  updateChatTaskStatus,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, estimateMessageTokens, generateUUID, sanitizeCoreMessages } from "@/lib/utils";
// ТЗ-07A: generateTitleFromUserMessage больше не используется здесь
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 180; // 3 minutes - increased for complex document generation

/**
 * ТЗ-07A: Server-side auto-naming after messages are saved.
 * Eliminates race condition where client calls generate-title
 * before assistant messages are persisted to DB.
 */
async function autoNameChat(chatId: string): Promise<void> {
  const chat = await getChatById({ id: chatId });
  if (!chat || chat.isRenamed) return;

  // Skip if already auto-named (title changed from default)
  if (chat.title !== "Новый чат") return;

  const messages = await getMessagesByChatId({ id: chatId });
  if (messages.length < 4) return;

  const contextMessages = messages.slice(0, 4);
  const contextSummary = contextMessages
    .map((m) => {
      const role = m.role === "user" ? "Пользователь" : "Ассистент";
      const text = Array.isArray(m.parts)
        ? (m.parts as { type: string; text?: string }[])
            .filter((p) => p.type === "text")
            .map((p) => p.text || "")
            .join(" ")
        : "";
      const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
      return `${role}: ${truncated}`;
    })
    .join("\n");

  const { object } = await generateObject({
    model: myProvider.languageModel("title-model"),
    schema: z.object({
      title: z.string().describe("Короткое название чата (2-4 слова)"),
      summary: z.string().describe("Краткое описание темы разговора (1-2 предложения)"),
    }),
    system: `Ты анализируешь чаты и генерируешь для них название и краткое описание на русском языке.

Правила для title (названия):
- 2-4 слова максимум
- Используй существительные или именные группы
- НЕ используй глаголы (не "Написать текст", а "Текст для сайта")
- НЕ используй кавычки, двоеточия, точки
- Отражай суть разговора, не первое сообщение

Примеры хороших названий:
- Маркетинг кофейни
- Перевод договора
- Анализ конкурентов

Правила для summary (описания):
- 1-2 коротких предложения
- Опиши о чём конкретно шёл разговор
- Используй нейтральный тон`,
    prompt: `Проанализируй этот чат и сгенерируй название и краткое описание:\n\n${contextSummary}`,
  });

  const cleanTitle = object.title
    .replace(/["«»:]/g, "")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, 80);
  const cleanSummary = object.summary
    .replace(/^\s+|\s+$/g, "")
    .slice(0, 300);

  await updateChatTitleAndSummary({ chatId, title: cleanTitle, summary: cleanSummary });
  console.log(`[generate-title] Server-side success for ${chatId}: "${cleanTitle}"`);
}

/**
 * Convert text/plain file parts to text parts in a single message
 * Claude API via OpenRouter doesn't support text files as attachments - only images
 * So we need to fetch the file content and include it as text
 */
async function convertTextFilePartsInMessage(
  message: ChatMessage
): Promise<ChatMessage> {
  const processedParts = await Promise.all(
    message.parts.map(async (part: any) => {
      // Only process file parts with text/plain mediaType
      if (part.type === "file" && part.mediaType === "text/plain") {
        const fileName = part.name || part.url?.split("/").pop() || "unknown";
        try {
          // Fetch the file content from the URL
          const response = await fetch(part.url);
          if (!response.ok) {
            console.warn(`[Chat API] Failed to fetch text file: ${part.url}`);
            return {
              type: "text" as const,
              text: `📄 Файл: ${fileName} (не удалось загрузить)`,
            };
          }
          const textContent = await response.text();
          console.log(`[Chat API] Converted text file to text part: ${fileName} (${textContent.length} chars)`);

          return {
            type: "text" as const,
            text: `📄 **Файл: ${fileName}**\n\`\`\`\n${textContent}\n\`\`\``,
          };
        } catch (error) {
          console.warn(`[Chat API] Error processing text file ${fileName}:`, error);
          return {
            type: "text" as const,
            text: `📄 Файл: ${fileName} (ошибка обработки)`,
          };
        }
      }
      return part;
    })
  );

  return {
    ...message,
    parts: processedParts,
  } as ChatMessage;
}

/**
 * Convert text/plain file parts to text parts in all messages
 * This handles both new messages and history from DB
 */
async function convertTextFilesInAllMessages(
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  return Promise.all(messages.map(convertTextFilePartsInMessage));
}


export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    console.log("[Chat API] Received request:", JSON.stringify(json, null, 2).slice(0, 1000));
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    // Log Zod validation errors in detail
    const zodError = error as any;
    console.error("[Chat API] Schema validation failed:", {
      message: zodError?.message || "Unknown error",
      issues: zodError?.issues?.map((i: any) => ({
        path: i.path?.join("."),
        message: i.message,
        received: i.received,
      })) || [],
    });
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      chatMode,
      selectedVisibilityType,
      projectId,
      projectModelTier,
      researchDepth,
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // Performance: Parallelize independent DB queries
    const [userProfile, messageCount, chat] = await Promise.all([
      getUserById(session.user.id),
      getMessageCountByUserId({ id: session.user.id, differenceInHours: 24 }),
      getChatById({ id }),
    ]);

    // ТЗ-03: Fetch project data if projectId is provided
    let project = null;
    let projectFiles: Awaited<ReturnType<typeof getFilesByProjectId>> = [];

    if (projectId) {
      [project, projectFiles] = await Promise.all([
        getProjectById({ id: projectId }),
        getFilesByProjectId({ projectId }),
      ]);

      // Verify project exists and belongs to user
      if (!project || project.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat", "Project not found or access denied").toResponse();
      }
    }

    // User profile will be passed to buildChatPrompt later

    if (messageCount > userEntitlements.maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }

      // ТЗ-07C2: Auto-transition taskStatus from not_started to in_progress
      // when user sends first message to a project task
      if (chat.projectId && chat.taskStatus === "not_started") {
        // Fire and forget - don't block the response
        updateChatTaskStatus({ chatId: id, taskStatus: "in_progress" }).catch(
          (err) => console.error("[Chat API] Failed to update taskStatus:", err)
        );
      }
    } else {
      // Performance: Save chat with temporary title, generate real title in background
      await saveChat({
        id,
        userId: session.user.id,
        title: projectId ? `Чат проекта` : "Новый чат",
        visibility: selectedVisibilityType,
        projectId: projectId || undefined,
        chatMode,
      });

      // ТЗ-07C2: For new project tasks, immediately set status to in_progress
      // since user is sending their first message right now
      if (projectId) {
        updateChatTaskStatus({ chatId: id, taskStatus: "in_progress" }).catch(
          (err) => console.error("[Chat API] Failed to set initial taskStatus:", err)
        );
      }

      // ТЗ-07A: Автонейминг теперь происходит после 2-го ответа AI (см. chat.tsx)
      // ТЗ-4: Greeting НЕ добавляется как сообщение — используем UI с заголовком + suggested actions
    }

    // Вычисляем токены нового user message
    const newMessageTokens = estimateMessageTokens(message.parts);
    console.log(
      `[Token Aware] Chat ${id}: New user message has ~${newMessageTokens} tokens`
    );

    // Загружаем сообщения с учётом токенов нового сообщения
    // maxTokens = 140K, оставляем ~60K для system prompt (10K) + response (50K)
    const messagesFromDb = await getMessagesByChatId({
      id,
      maxTokens: 140000 - newMessageTokens, // Вычитаем токены нового сообщения
      minMessages: 20,
    });

    // ТЗ-C3: Load snapshot state for context management
    const chatWithState = await getChatWithSnapshotState({ chatId: id });
    const snapshots = chatWithState?.snapshots || [];
    const contextState = chatWithState?.contextState || null;
    let snapshotContext: string | undefined;
    let messagesForModel = messagesFromDb;

    // ТЗ-C3: Snapshot-aware message trimming
    if (snapshots.length > 0) {
      const lastSnapshot = snapshots[snapshots.length - 1];
      const snapshotMsgIndex = messagesFromDb.findIndex(
        (m) => m.id === lastSnapshot.messageId
      );

      if (snapshotMsgIndex >= 0) {
        const snapshotMsg = messagesFromDb[snapshotMsgIndex];
        const snapshotPart = (snapshotMsg.parts as any[])?.find(
          (p: any) =>
            p.type === "tool-createSnapshot" && p.output?.fullMarkdown
        );
        snapshotContext =
          snapshotPart?.output?.fullMarkdown ||
          `## Итог\n${lastSnapshot.summary}`;
        messagesForModel = messagesFromDb.slice(snapshotMsgIndex + 1);
      } else {
        snapshotContext =
          lastSnapshot.fullMarkdown || `## Итог\n${lastSnapshot.summary}`;
      }

      console.log(
        `[ContextMgmt] Chat ${id}: snapshot found, trimmed ${messagesFromDb.length - messagesForModel.length} messages, snapshotContext = ${snapshotContext!.length} chars`
      );
    }

    // Claude API не поддерживает text/plain как file attachment — конвертируем в text
    const processedMessage = await convertTextFilePartsInMessage(message as ChatMessage);
    const uiMessages = [...convertToUIMessages(messagesForModel), processedMessage];

    // Подсчитываем общее количество токенов в контексте (after trimming)
    const totalHistoryTokens = messagesForModel.reduce((sum, msg) => {
      return sum + (msg.tokenCount || estimateMessageTokens(msg.parts as any));
    }, 0);

    console.log(
      `[Token Aware] Chat ${id}: Total context = ${totalHistoryTokens + newMessageTokens} tokens ` +
      `(${messagesForModel.length} history messages + 1 new message)`
    );

    const { longitude, latitude, city, country } = geolocation(request);

    // Build context for new prompt system
    const promptContext: BuildContext = {
      user: userProfile ? {
        displayName: userProfile.displayName,
        pronouns: userProfile.pronouns,
        occupation: userProfile.occupation,
        bio: userProfile.bio,
      } : undefined,
      requestHints: {
        longitude: longitude ?? undefined,
        latitude: latitude ?? undefined,
        city: city ?? undefined,
        country: country ?? undefined,
      },
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
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
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;
    let guardianFlags: GuardianFlags | null = null;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        // ТЗ-03: Build system prompt - different for project vs regular chat
        let systemPromptText: string;
        let modelToUse;
        const isProjectChat = !!(project && projectId);
        const tier = projectModelTier && isValidModelTier(projectModelTier)
          ? projectModelTier
          : DEFAULT_PROJECT_MODEL;
        const isProfessorMode = isProjectChat && tier === "professor";

        if (isProjectChat && project) {
          // Project chat: use Claude model and project context
          const projectModelConfig = getProjectModel(tier);
          modelToUse = projectModelConfig.model;

          // Diagnostic: log project files and their extractedContent status
          console.log(`[Project Chat] Files for project "${project.name}":`, {
            totalFiles: projectFiles.length,
            files: projectFiles.map(f => ({
              name: f.name,
              type: f.type,
              hasExtractedContent: !!(f.metadata as any)?.extractedContent,
              contentLength: (f.metadata as any)?.extractedContent?.length || 0,
            })),
          });

          // Build project-specific system prompt
          const projectContext = buildProjectContext({
            project,
            files: projectFiles,
          });

          // Combine base prompt with project context
          const builtPrompt = buildChatPrompt(promptContext);
          systemPromptText = `${builtPrompt.systemPrompt}\n\n${projectContext}`;

          console.log(`[Project Chat] Using ${projectModelConfig.name} (${tier}) for project ${project.name}`);
          console.log(`[Project Chat] Context length: ${projectContext.length} chars`);
        } else {
          // Regular chat: use Claude — builder and model determined by chatMode
          const builtPrompt = chatMode === 'expertise'
            ? buildExpertisePrompt(promptContext)
            : chatMode === 'create'
              ? buildCreatePrompt(promptContext)
              : buildChatPrompt(promptContext);
          systemPromptText = builtPrompt.systemPrompt;
          const chatModelId = getModelForChatMode(chatMode);
          modelToUse = myProvider.languageModel(chatModelId);
        }

        // ТЗ-C3: Inject previous snapshot context into system prompt
        if (snapshotContext) {
          systemPromptText += `\n\n<previous_context>\n${snapshotContext}\n</previous_context>`;
        }

        // ТЗ-C3: Calculate estimated usage for context management
        const systemPromptTokens = estimateMessageTokens([
          { type: "text", text: systemPromptText },
        ]);
        const estimatedPercent = calcUsagePercent(
          totalHistoryTokens + systemPromptTokens + newMessageTokens
        );

        // ТЗ-C3: Context suggestion injection
        if (
          estimatedPercent >= SNAPSHOT_THRESHOLD * 100 &&
          !contextState?.suggestionActive
        ) {
          systemPromptText += `\n\n[SYSTEM: Контекстное окно заполнено на ${Math.round(estimatedPercent)}%. Мягко предложи пользователю зафиксировать итог разговора. Если пользователь согласится, вызови tool createSnapshot.]`;
          await updateChatContextState({
            chatId: id,
            contextState: { suggestionActive: true, messagesSinceSuggestion: 0 },
          });
        } else if (contextState?.suggestionActive) {
          const newCount = (contextState.messagesSinceSuggestion || 0) + 1;

          if (newCount >= FALLBACK_MESSAGE_PAIRS) {
            // ТЗ-C3: Fallback — model ignored suggestion, clerk creates snapshot
            console.log(
              `[ContextMgmt] Chat ${id}: fallback triggered (${newCount} messages since suggestion)`
            );
            const fallbackResult = await createFallbackSnapshot({
              chatTitle: chat?.title || undefined,
              chatMessages: messagesFromDb,
            });

            if (fallbackResult) {
              await addChatSnapshot({
                chatId: id,
                messageId: `fallback-${generateUUID()}`,
                summary: fallbackResult.shortSummary,
                fullMarkdown: fallbackResult.fullMarkdown,
              });
              await resetChatContextState({ chatId: id });
              console.log(
                `[ContextMgmt] Chat ${id}: fallback snapshot saved — will apply on next request`
              );
            } else {
              await resetChatContextState({ chatId: id });
              console.warn(
                `[ContextMgmt] Chat ${id}: fallback clerk failed — contextState reset`
              );
            }
          } else {
            await updateChatContextState({
              chatId: id,
              contextState: {
                ...contextState,
                messagesSinceSuggestion: newCount,
              },
            });
          }
        }

        // ТЗ-C3: Emit context usage to client
        dataStream.write({
          type: "data-context-usage",
          data: { percent: Math.round(estimatedPercent), tokens: totalHistoryTokens + systemPromptTokens },
        });

        // Dev: emit model info for UI badge
        {
          const TIER_MODEL: Record<string, string> = { executor: "claude-haiku", expert: "claude-sonnet", professor: "claude-opus" };
          const DISPLAY: Record<string, string> = { "claude-haiku": "Haiku", "claude-sonnet": "Sonnet", "claude-opus": "Opus" };
          const mid = isProjectChat ? (TIER_MODEL[tier] || "claude-sonnet") : getModelForChatMode(chatMode);
          dataStream.write({ type: "data-model-info", data: { modelId: mid, modelName: DISPLAY[mid] || mid } });
        }

        // ТЗ-PX: Emit research depth override for dev UI
        if (researchDepth) {
          dataStream.write({ type: "data-research-depth", data: { depth: researchDepth } });
        }

        // ТЗ-C3: Generate assistant message ID upfront (needed for snapshot tool)
        const assistantMessageId = generateUUID();

        const startTime = Date.now();
        let firstTokenTime: number | null = null;

        // ТЗ-03 Фаза 7: Professor Pipeline Mode
        if (isProfessorMode) {
          console.log(`[Professor] Starting pipeline mode for chat ${id}`);

          // Extract user message text
          const userMessageText = message.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n");

          // Convert UI messages to CoreMessage format for pipeline
          const coreMessages = sanitizeCoreMessages(convertToCoreMessages(uiMessages.slice(0, -1))); // Exclude current message

          try {
            let accumulatedContent = "";

            await executeProfessorPipeline({
              systemPrompt: systemPromptText,
              userMessage: userMessageText,
              messages: coreMessages,
              chatId: id,
              userId: session.user.id,
              onEvent: (event) => {
                // Stream pipeline events to client using data- prefix for custom types
                dataStream.write({
                  type: `data-${event.type}` as const,
                  data: event,
                });

                // Track first content token and accumulate content
                if (event.type === "professor-content") {
                  if (firstTokenTime === null) {
                    firstTokenTime = Date.now() - startTime;
                    console.log(`[Performance] Chat ${id}: first professor content = ${firstTokenTime}ms`);
                  }
                  accumulatedContent += event.content;
                }
              },
            });

            const totalTime = Date.now() - startTime;
            console.log(`[Performance] Chat ${id}: Professor pipeline completed in ${totalTime}ms`);

            // Signal completion
            dataStream.write({
              type: "finish",
            });
          } catch (error) {
            console.error("[Professor] Pipeline error:", error);
            dataStream.write({
              type: "error",
              errorText: error instanceof Error ? error.message : "Pipeline error",
            });
          }

          return; // Exit execute for professor mode
        }

        // Standard streaming mode (non-professor)
        const result = streamText({
          model: modelToUse,
          system: systemPromptText,
          messages: sanitizeCoreMessages(convertToCoreMessages(uiMessages)),
          temperature: 1.0,
          stopWhen: stepCountIs(5),
          // ТЗ-C1: Tools extracted to shared module (lib/ai/tools/chat-tools.ts)
          experimental_activeTools: getActiveToolNames(isProjectChat, chatMode),
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: getStandardTools({ session, dataStream, isProjectChat, projectId: projectId || undefined, chatId: id, messageId: assistantMessageId, chatMode, researchDepth }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage }) => {
            const totalTime = Date.now() - startTime;
            if (firstTokenTime === null) {
              firstTokenTime = totalTime;
            }
            console.log(
              `[Performance] Chat ${id}: TTFT = ${firstTokenTime}ms, Total = ${totalTime}ms`
            );
            let resolvedModelId: string | undefined;
            let costUsd: number | null = null;
            try {
              const providers = await getTokenlensCatalog();
              const chatModelId = getModelForChatMode(chatMode);
              resolvedModelId =
                myProvider.languageModel(chatModelId).modelId;
              if (!resolvedModelId) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId: resolvedModelId, usage, providers });
              costUsd = summary?.costUSD?.totalUSD ?? null;
              finalMergedUsage = { ...usage, ...summary, modelId: resolvedModelId } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }

            // ТЗ-OPT1: Usage logging (fire-and-forget)
            const logModelId = resolvedModelId || (isProjectChat ? `project:${tier}` : chatMode);
            const logChatMode = isProjectChat ? `project:${tier}` : chatMode;
            saveAiUsageLog({
              chatId: id,
              userId: session.user.id,
              modelId: logModelId,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              costUsd,
              chatMode: logChatMode,
              durationMs: totalTime,
            }).catch(() => {});
          },
        });

        result.consumeStream();

        const baseStream = result.toUIMessageStream({
          sendReasoning: true,
        });

        // ТЗ-FIX1: Guardian step tracker for hallucination detection
        const guardianTracker = createStepTracker({
          context: isProjectChat ? `project:${tier}` : chatMode,
        });

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

            // Diagnostic: track tool call timing
            const toolCallTimes: Record<string, number> = {};
            const modelName = isProjectChat ? `Simply/${tier}` : "Simply";

            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                // ТЗ-FIX1: Collect guardian flags after stream ends
                guardianFlags = guardianTracker.getAllDetections();
                controller.close();
                break;
              }

              // Diagnostic logging for tool events (AI SDK v5 event types)
              if (value && typeof value === "object" && "type" in value) {
                const eventType = (value as any).type;

                // ТЗ-FIX1: Guardian — track step boundaries and text
                if (eventType === "step-start") {
                  guardianTracker.reset();
                }

                if (eventType === "text-delta") {
                  const chunk = (value as any).textDelta ?? "";
                  if (chunk) {
                    guardianTracker.addText(chunk);
                  }
                }

                if (eventType === "step-finish") {
                  guardianTracker.analyze();
                }

                // AI SDK v5: tool-input-start = tool call begins (has toolName, toolCallId)
                if (eventType === "tool-input-start") {
                  const toolName = (value as any).toolName || "unknown";
                  const toolCallId = (value as any).toolCallId || "unknown";
                  toolCallTimes[toolCallId] = Date.now();
                  console.log(`[Tool:${modelName}] 🔧 CALL started:`, {
                    toolName,
                    toolCallId,
                    timestamp: new Date().toISOString(),
                  });

                  // ТЗ-FIX1: Guardian — register tool call in step
                  guardianTracker.addToolCall(toolName);

                  // ТЗ-07: Notify client that tool execution started
                  dataStream.write({
                    type: "data-tool-activity",
                    data: { toolName, toolCallId },
                  });
                }

                // AI SDK v5: tool-output-available = tool result ready
                if (eventType === "tool-output-available") {
                  const toolCallId = (value as any).toolCallId || "unknown";
                  const duration = toolCallTimes[toolCallId]
                    ? Date.now() - toolCallTimes[toolCallId]
                    : -1;
                  console.log(`[Tool:${modelName}] ✅ RESULT received:`, {
                    toolCallId,
                    durationMs: duration,
                    timestamp: new Date().toISOString(),
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
                  `[Performance] Chat ${id}: first chunk = ${firstTokenTime}ms`
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
          // Filter out tool results to prevent context overflow
          // Tool results are needed only during response generation, not in history
          const filteredParts = currentMessage.parts.filter((part: any) => {
            const type = part.type;

            // Keep text and step markers
            if (type === 'text' || type === 'step-start' || type === 'step-finish') {
              return true;
            }

            // Keep artifact tool results (createDocument, updateDocument)
            // These are small and needed to render artifact buttons after reload
            if (type === 'tool-createDocument' || type === 'tool-updateDocument') {
              return true;
            }

            // ТЗ-C3: Keep snapshot tool results (needed for SnapshotCard after reload)
            if (type === 'tool-createSnapshot') {
              return true;
            }

            // Filter out other tool calls and results (web search, etc.)
            return false;
          });

          const tokenCount = estimateMessageTokens(filteredParts);

          return {
            id: currentMessage.id,
            role: currentMessage.role,
            parts: filteredParts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
            tokenCount,
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

        // Логируем сохранение ассистент-сообщений
        const totalTokens = messagesToSave.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0);
        console.log(
          `[Token Aware] Chat ${id}: Saving ${messagesToSave.length} assistant message(s) with ~${totalTokens} tokens`
        );

        if (messagesToSave.length > 0) {
          await saveMessages({ messages: messagesToSave });
        }

        // ТЗ-07A: Server-side auto-naming (fire-and-forget, after messages saved)
        if (!projectId) {
          void autoNameChat(id).catch((err) =>
            console.error("[generate-title] Background error:", err)
          );
        }

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}

/**
 * PATCH /api/chat?id=...
 * ТЗ-07A: Переименование чата (устанавливает isRenamed=true)
 * ТЗ-07B: Toggle isStarred
 */
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (!chat) {
    return new ChatSDKError("not_found:database", "Chat not found").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  try {
    const body = await request.json();

    // ТЗ-07B: Handle isStarred update
    if (typeof body.isStarred === "boolean") {
      const { updateChatIsStarred } = await import("@/lib/db/queries");
      await updateChatIsStarred({
        chatId: id,
        isStarred: body.isStarred,
      });
      return Response.json({ success: true, isStarred: body.isStarred });
    }

    // ТЗ-07A: Handle title update
    const { title } = body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return new ChatSDKError("bad_request:api", "Title or isStarred is required").toResponse();
    }

    const { updateChatTitleWithRenamedFlag } = await import("@/lib/db/queries");

    await updateChatTitleWithRenamedFlag({
      chatId: id,
      title: title.trim(),
      isRenamed: true, // Пометить что пользователь переименовал вручную
    });

    return Response.json({ success: true, title: title.trim() });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api", "Failed to update chat").toResponse();
  }
}
