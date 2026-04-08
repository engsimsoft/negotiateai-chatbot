import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  generateObject,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { z } from "zod";
import { calcStepCostRub } from "@/lib/ai/tokenlens-catalog";
import { extractUsageFields, extractUsageForPricing, logUsage } from "@/lib/ai/usage-utils";
import { auth } from "@/app/(auth)/auth";
import { userEntitlements } from "@/lib/ai/entitlements";
import { getModelForChatMode } from "@/lib/ai/chat-mode-config";
import { buildChatPrompt, buildExpertisePrompt, buildCreatePrompt } from "@/lib/prompts/server";
import type { BuildContext } from "@/lib/prompts";
import { buildProjectContext } from "@/lib/prompts/contexts";
import { myProvider } from "@/lib/ai/providers";
import { createMinimaxOpenAI } from "vercel-minimax-ai-provider";

// MiniMax OpenAI provider with includeUsage enabled for streaming usage data
// (reasoning tokens, cache tokens). Default provider doesn't set this.
const minimaxProvider = createMinimaxOpenAI();
function minimaxModel(modelId: string) {
  const model = minimaxProvider(modelId) as any;
  model.config = { ...model.config, includeUsage: true };
  return model;
}
import { google } from "@ai-sdk/google";
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
  SIMPLY_CONTEXT_LIMIT,
  EXTRACT_THRESHOLD_SOFT,
  EXTRACT_THRESHOLD_HARD,
  EXTRACT_PAUSE_MS,
  calcUsagePercent,
} from "@/lib/ai/context-limits";
import { executeProfessorPipeline } from "@/lib/ai/professor-pipeline";
import { getStandardTools, getActiveToolNames } from "@/lib/ai/tools/chat-tools";
import { isProductionEnvironment, isSimplyDevMode } from "@/lib/constants";
import { createStepTracker, type GuardianFlags } from "@/lib/ai/tool-call-guardian";
import { calculateCostRub, RUB_PER_USD } from "@/lib/ai/providers";
import {
  emitDebugStep,
  emitDebugGuardian,
  emitDebugFinish,
  emitDebugPrompt,
  emitDebugRag,
  emitDebugCompaction,
  truncateForDebug,
  DEBUG_EVENT_SCHEMA_VERSION,
  type DebugStepData,
} from "@/lib/ai/debug-events";
import { retrieveMemoryContext } from "@/lib/ai/memory/retrieve";
import { getProfileBlock } from "@/lib/ai/memory/profile";
import { extractAndStoreFacts, batchExtractFacts } from "@/lib/ai/memory/extract";
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
import { buildAppUsage, mergeAppUsage, normalizeStoredAppUsage, type AppUsage } from "@/lib/usage";
import { convertToUIMessages, estimateMessageTokens, generateUUID, sanitizeCoreMessages } from "@/lib/utils";
// ТЗ-07A: generateTitleFromUserMessage больше не используется здесь
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 180; // 3 minutes - increased for complex document generation

/**
 * ТЗ-07A: Server-side auto-naming after messages are saved.
 * Eliminates race condition where client calls generate-title
 * before assistant messages are persisted to DB.
 */
async function autoNameChat(chatId: string, userId: string): Promise<void> {
  const chat = await getChatById({ id: chatId });
  if (!chat || chat.isRenamed) return;

  // ТЗ-KITT: Simply chat is never auto-named
  if (chat.chatMode === "simply") return;

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

  const resolvedModelId = myProvider.languageModel("title-model").modelId;

  const { object, usage } = await generateObject({
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

  // ТЗ-CACHE2: Usage logging
  logUsage({
    userId,
    usage,
    modelId: resolvedModelId,
    chatMode: "util:auto-naming",
    chatId,
  });

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


/**
 * ТЗ-MinimaxCleanup: Check if user message contains non-text attachments
 * (images, PDFs, documents — but NOT text/plain which is already converted to text parts)
 */
function hasAttachments(parts: any[]): boolean {
  return parts.some((p: any) =>
    p.type === "image" ||
    (p.type === "file" && p.mediaType !== "text/plain")
  );
}

/**
 * ТЗ-SimplyToolsMinimax: Strip non-text file/image parts from messages for text-only models (MiniMax).
 * MiniMax doesn't support images — AI SDK tries to download them and fails with timeout.
 * Replaces image/file parts with a text placeholder so context is preserved.
 */
function stripMediaPartsForTextModel(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => {
    if (!msg.parts || !Array.isArray(msg.parts)) return msg;
    const hasMedia = msg.parts.some((p: any) =>
      p.type === "image" || (p.type === "file" && p.mediaType !== "text/plain")
    );
    if (!hasMedia) return msg;

    const filteredParts = msg.parts
      .map((p: any) => {
        if (p.type === "image") {
          return { type: "text" as const, text: "[изображение]" };
        }
        if (p.type === "file" && p.mediaType !== "text/plain") {
          const name = p.name || "файл";
          return { type: "text" as const, text: `[${name}]` };
        }
        return p;
      });

    return { ...msg, parts: filteredParts } as ChatMessage;
  });
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
      think,
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
    // ТЗ-ExtractCompression: simply загружает только extractedAt IS NULL (safety-cap 180K)
    // Остальные chatMode: maxTokens = 140K, оставляем ~60K для system prompt (10K) + response (50K)
    const isSimplyChat = chatMode === "simply";
    const messagesFromDb = await getMessagesByChatId({
      id,
      maxTokens: isSimplyChat ? 180000 - newMessageTokens : 140000 - newMessageTokens,
      minMessages: 20,
      maxMessages: 200,
      excludeExtracted: isSimplyChat,
    });

    // ТЗ-C3/RAG3: Snapshot context management — only for Haiku chats (chatMode="chat"/"simply")
    // Sonnet/Opus use Anthropic Compaction API instead
    let snapshotContext: string | undefined;
    let messagesForModel = messagesFromDb;

    // contextState is used later in threshold checking for Haiku
    let contextState: { suggestionActive: boolean; messagesSinceSuggestion: number } | null = null;

    // Snapshot context management: only for chatMode="chat" (Haiku)
    // Simply uses MiniMax/Gemini — no snapshot, no compaction (будет Extract при сжатии)
    const isHaikuChat = chatMode === "chat";
    if (isHaikuChat) {
      const chatWithState = await getChatWithSnapshotState({ chatId: id });
      const snapshots = chatWithState?.snapshots || [];
      contextState = chatWithState?.contextState || null;

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
          extractedAt: null,
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;
    let guardianFlags: GuardianFlags | null = null;
    let usageLogMeta: {
      modelId: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      thinkingTokens: number;
      costUsd: number | null;
      chatMode: string;
      durationMs: number;
    } | null = null;

    // ТЗ-RAG2: Shared flag for memory gate (used in both execute and onFinish)
    let isMemoryEnabled = ["chat", "simply", "expertise", "create"].includes(chatMode);

    const stream = createUIMessageStream({
      originalMessages: uiMessages,
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
          // ТЗ-MinimaxCleanup: Model routing for Simply Chat
          // Priority: think → Sonnet, attachments → Gemini 3 Flash, default → MiniMax M2.7
          if (chatMode === "simply") {
            if (think) {
              modelToUse = myProvider.languageModel("claude-sonnet");
              console.log(`[Chat API] Model selection: chatMode=simply, think=true, model=claude-sonnet`);
            } else if (hasAttachments(message.parts)) {
              modelToUse = google("gemini-3-flash-preview");
              console.log(`[Chat API] Model selection: chatMode=simply, attachments=true, model=gemini-3-flash-preview`);
            } else {
              modelToUse = minimaxModel("MiniMax-M2.7");
              console.log(`[Chat API] Model selection: chatMode=simply, model=MiniMax-M2.7`);
            }
          } else {
            const chatModelId = getModelForChatMode(chatMode);
            console.log(`[Chat API] Model selection: chatMode=${chatMode}, model=${chatModelId}`);
            modelToUse = myProvider.languageModel(chatModelId);
          }
        }

        // ТЗ-C3: Inject previous snapshot context into system prompt
        if (snapshotContext) {
          systemPromptText += `\n\n<previous_context>\n${snapshotContext}\n</previous_context>`;
        }

        // ТЗ-RAG1/RAG2: MIND memory — profile + retrieval
        // Scope: chat, expertise, create (not service chats, not professor pipeline)
        // Gate: check user's memoryEnabled setting (isMemoryEnabled hoisted above createUIMessageStream)
        if (isMemoryEnabled) {
          try {
            const { getMemorySettings } = await import("@/lib/db/queries");
            const memSettings = await getMemorySettings({ userId: session.user.id });
            isMemoryEnabled = memSettings.memoryEnabled;
          } catch {
            // If settings check fails, default to enabled
          }
        }
        let memoryDebugData: Parameters<typeof emitDebugRag>[1] | null = null;
        // ТЗ-KITT/CACHE: MIND memory split into stable (profile → system prompt, cached)
        // and dynamic (retrieved facts → separate message, NOT cached) to preserve prompt caching
        let mindDynamicBlock = "";
        if (isMemoryEnabled) {
          // ТЗ-RAG2: Inject Opus profile (stable "who is this person" context)
          // Profile changes only on nightly cron → safe to cache with system prompt
          try {
            const profileBlock = await getProfileBlock(session.user.id);
            if (profileBlock) {
              systemPromptText += `\n\n${profileBlock}`;
            }
          } catch (error) {
            console.warn("[MIND] Profile load failed (non-blocking):", error instanceof Error ? error.message : error);
          }

          // ТЗ-RAG1: Retrieve relevant facts for current query
          // Facts change per query → kept OUTSIDE system prompt to preserve cache
          try {
            const userQueryText = message.parts
              .filter((p: any): p is { type: "text"; text: string } => p.type === "text")
              .map((p: any) => p.text)
              .join("\n");

            if (userQueryText.length >= 5) {
              const memoryResult = await retrieveMemoryContext(
                session.user.id,
                userQueryText,
                { chatId: id },
              );

              if (memoryResult.promptBlock) {
                mindDynamicBlock = memoryResult.promptBlock;
              }

              // Save for debug emit (after emitDebugPrompt creates the batch)
              memoryDebugData = {
                query: userQueryText.slice(0, 200),
                facts: memoryResult.facts.map((f) => ({
                  content: f.entry.content,
                  category: f.entry.category,
                  similarity: f.similarity,
                  confidence: Number(f.entry.confidence ?? 1),
                })),
                factsInjected: memoryResult.facts.length,
                voyageTokens: memoryResult.voyageTokens,
                searchDurationMs: memoryResult.durationMs,
              };
            }
          } catch (error) {
            // Graceful degradation: memory unavailable — chat continues without it
            console.warn("[MIND] Retrieve failed (non-blocking):", error instanceof Error ? error.message : error);
          }
        }

        // ТЗ-ExtractCompression: threshold-based batch extraction for simply
        if (isSimplyChat && isMemoryEnabled) {
          const systemPromptTokensForExtract = estimateMessageTokens([
            { type: "text", text: systemPromptText },
          ]);
          const mindTokens = mindDynamicBlock
            ? estimateMessageTokens([{ type: "text", text: mindDynamicBlock }])
            : 0;
          const totalContext = systemPromptTokensForExtract + mindTokens + totalHistoryTokens + newMessageTokens;
          const usagePercent = calcUsagePercent(totalContext, SIMPLY_CONTEXT_LIMIT);

          // Determine pause since last message
          const lastMessageTime = messagesFromDb.length > 0
            ? messagesFromDb[messagesFromDb.length - 1].createdAt.getTime()
            : 0;
          const pauseMs = lastMessageTime > 0 ? Date.now() - lastMessageTime : 0;

          const shouldExtract =
            usagePercent >= EXTRACT_THRESHOLD_HARD * 100 ||
            (usagePercent >= EXTRACT_THRESHOLD_SOFT * 100 && pauseMs >= EXTRACT_PAUSE_MS);

          if (shouldExtract) {
            console.log(
              `[MIND] Batch extract triggered: ${usagePercent}% of context used (${totalContext} tokens), pause=${Math.round(pauseMs / 1000)}s`,
            );
            void batchExtractFacts({
              userId: session.user.id,
              chatId: id,
              messages: messagesFromDb,
            }).catch((err) =>
              console.warn(
                "[MIND] Batch extract failed (non-blocking):",
                err instanceof Error ? err.message : err,
              ),
            );
          }
        }

        // ТЗ-C3/RAG3: Snapshot context management — only for Haiku chats (chat/simply)
        // Sonnet/Opus use Compaction API (providerOptions.anthropic.contextManagement)
        if (isHaikuChat) {
          const systemPromptTokens = estimateMessageTokens([
            { type: "text", text: systemPromptText },
          ]);
          const estimatedPercent = calcUsagePercent(
            totalHistoryTokens + systemPromptTokens + newMessageTokens
          );

          // Context suggestion injection
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
              console.log(
                `[ContextMgmt] Chat ${id}: fallback triggered (${newCount} messages since suggestion)`
              );
              const fallbackResult = await createFallbackSnapshot({
                chatTitle: chat?.title || undefined,
                chatMessages: messagesFromDb,
                userId: session.user.id,
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

          // Emit context usage to client (for ContextIndicator)
          dataStream.write({
            type: "data-context-usage",
            data: { percent: Math.round(estimatedPercent), tokens: totalHistoryTokens + systemPromptTokens },
          });
        }

        // ТЗ-PX: Emit research depth override for dev UI
        if (researchDepth) {
          dataStream.write({ type: "data-research-depth", data: { depth: researchDepth } });
        }

        // ТЗ-DEV1: Emit debug prompt info
        {
          const agentName = isProjectChat
            ? `Проект (${tier})`
            : chatMode === "expertise"
              ? "Экспертиза"
              : chatMode === "create"
                ? "Создать"
                : "Simply Chat";
          const injections: string[] = [];
          if (userProfile?.displayName || userProfile?.bio) injections.push("user-profile");
          if (snapshotContext) injections.push("snapshot-context");
          if (isProjectChat) injections.push("project-context");
          if (systemPromptText.includes("<memory>")) injections.push("mind-memory");
          emitDebugPrompt(dataStream, {
            systemPromptPreview: systemPromptText.slice(0, 500),
            systemPromptLength: systemPromptText.length,
            activeAgent: agentName,
            chatMode,
            isProjectChat,
            projectTier: isProjectChat ? tier : undefined,
            hasSnapshotContext: !!snapshotContext,
            contextInjections: injections,
          });
        }

        // ТЗ-RAG1: Emit debug rag AFTER prompt (so parseBatches has an active batch)
        if (memoryDebugData) {
          emitDebugRag(dataStream, memoryDebugData);
        }

        // ТЗ-C3: Generate assistant message ID upfront (needed for snapshot tool)
        const assistantMessageId = generateUUID();

        const startTime = Date.now();
        let firstTokenTime: number | null = null;

        // ТЗ-DEV1: Debug step tracking state
        let debugStepIndex = 0;
        const debugStepDataQueue: DebugStepData[] = [];
        // TOKENS1 Этап 7.5: cost uses hardcoded MODEL_PRICING_RUB (SSOT), no TokenLens catalog needed.

        // ТЗ-03 Фаза 7: Professor Pipeline Mode
        if (isProfessorMode) {
          console.log(`[Professor] Starting pipeline mode for chat ${id}`);

          // Extract user message text
          const userMessageText = message.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n");

          // Convert UI messages to CoreMessage format for pipeline
          const coreMessages = sanitizeCoreMessages(await convertToModelMessages(uiMessages.slice(0, -1))); // Exclude current message

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
                (dataStream as any).write({
                  type: `data-${event.type}`,
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

        // ТЗ-RAG3: Compaction only for Anthropic models that support it (Sonnet/Opus, NOT Haiku)
        // ТЗ-MinimaxCleanup: Simply uses MiniMax/Gemini — no compaction
        const isAnthropicModel = chatMode !== "simply" || think;
        const supportsCompaction = isAnthropicModel && (!isHaikuChat || isProjectChat);
        const compactionOptions = supportsCompaction ? {
          anthropic: {
            contextManagement: {
              edits: [{
                type: 'compact_20260112' as const,
                trigger: { type: 'input_tokens' as const, value: 100_000 },
                pauseAfterCompaction: false,
                instructions: 'Сохрани обязательно: имена людей и организаций, даты и дедлайны, принятые решения и обоснования, числа и суммы, контекст текущего проекта/задачи, незавершённые задачи и открытые вопросы, предпочтения пользователя. Удали: повторяющиеся приветствия, промежуточные рассуждения если итог зафиксирован, дублирующуюся информацию, технические детали tool calls если результат уже в контексте.',
              }]
            }
          }
        } : undefined;

        // ТЗ-MinimaxCleanup: Simply with MiniMax/Gemini — no tools, no Anthropic cacheControl
        const isSimplyNonAnthropicModel = chatMode === "simply" && !think;

        // Standard streaming mode (non-professor)
        const result = streamText({
          model: modelToUse,
          messages: [
            // System prompt — with Anthropic cacheControl only for Anthropic models
            {
              role: 'system' as const,
              content: systemPromptText,
              ...(isAnthropicModel ? { providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } } : {}),
            },
            // ТЗ-KITT/CACHE: MIND retrieved facts (dynamic per query) — NOT cached
            ...(mindDynamicBlock ? [{ role: 'system' as const, content: mindDynamicBlock }] : []),
            // ТЗ-SimplyToolsMinimax: strip images/files from history for text-only MiniMax
            ...sanitizeCoreMessages(await convertToModelMessages(
              isSimplyNonAnthropicModel ? stripMediaPartsForTextModel(uiMessages) : uiMessages
            )),
          ],
          providerOptions: compactionOptions,
          temperature: isSimplyNonAnthropicModel ? 0.7 : 1.0,
          stopWhen: stepCountIs(5),
          // ТЗ-SimplyToolsMinimax: Tools enabled for all models including MiniMax.
          // deepResearch filtered for simply (MiniMax) via SIMPLY_MODE_EXCLUDED_TOOLS in chat-tools.ts
          experimental_activeTools: getActiveToolNames(isProjectChat, chatMode, think),
          tools: getStandardTools({ session, dataStream, isProjectChat, projectId: projectId || undefined, chatId: id, messageId: assistantMessageId, chatMode, researchDepth }),
          experimental_transform: smoothStream({ chunking: "word" }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
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
                stepCostRub: calcStepCostRub(stepModelId, stepUsage),
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
              `[Performance] Chat ${id}: TTFT = ${firstTokenTime}ms, Total = ${totalTime}ms`
            );
            // ТЗ-TOKENS1 Этап 7.5: build AppUsage via SSOT (calculateCostBreakdownRub),
            // no more tokenlens additive-formula cost (was overcounting cache tokens 5×).
            let resolvedModelId: string | undefined;
            let costUsd: number | null = null;
            try {
              // ТЗ-MinimaxCleanup: Resolve model ID matching selection logic above
              if (chatMode === "simply") {
                if (think) {
                  resolvedModelId = myProvider.languageModel("claude-sonnet").modelId;
                } else if (hasAttachments(message.parts)) {
                  resolvedModelId = "gemini-3-flash-preview";
                } else {
                  resolvedModelId = "MiniMax-M2.7";
                }
              } else {
                const chatModelId = getModelForChatMode(chatMode);
                resolvedModelId = myProvider.languageModel(chatModelId).modelId;
              }
              const effectiveModelId =
                resolvedModelId ?? (isProjectChat ? `project:${tier}` : chatMode);

              finalMergedUsage = buildAppUsage(effectiveModelId, totalUsage);
              // costUsd for DB audit (AiUsageLog) — derived from costRub / RUB_PER_USD
              costUsd =
                finalMergedUsage.costRub.totalRub > 0
                  ? Math.round(
                      (finalMergedUsage.costRub.totalRub / RUB_PER_USD) * 1_000_000,
                    ) / 1_000_000
                  : null;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("AppUsage build failed", err);
              // Never break the stream — emit a minimal placeholder so client
              // state doesn't get stuck waiting.
              const fallbackModelId =
                resolvedModelId ?? (isProjectChat ? `project:${tier}` : chatMode);
              finalMergedUsage = buildAppUsage(fallbackModelId, totalUsage);
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }

            // ТЗ-OPT1+FIX1+CACHE2: Store usage data for logging after guardian analysis completes
            const logModelId = resolvedModelId || (isProjectChat ? `project:${tier}` : chatMode);
            const logChatMode = isProjectChat ? `project:${tier}` : chatMode;
            const usageFields = extractUsageFields(totalUsage);
            usageLogMeta = {
              modelId: logModelId,
              ...usageFields,
              costUsd,
              chatMode: logChatMode,
              durationMs: totalTime,
            };

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
              estimatedCostRub: calculateCostRub(
                resolvedModelId || logModelId,
                finishUsage,
              ),
              modelId: resolvedModelId || logModelId,
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
                  `[Compaction] Chat ${id}: compaction triggered — ${iterations.length} iterations`
                );
              }
            }
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
            const guardianContext = isProjectChat ? `project:${tier}` : chatMode;

            // ТЗ-FIX1.2: Buffer text-delta events within step, flush or block on step-finish
            let stepTextBuffer: Array<unknown> = [];
            let consecutiveHallucinations = 0;

            // ТЗ-DEV1: Per-step timing
            let stepStartTime = Date.now();
            let debugStreamStepIndex = 0;

            // ТЗ-FIX1.2: Text-related events to buffer (text-start/delta/end must stay in order)
            const textBufferTypes = new Set([
              "text-start", "text-delta", "text-end",
              "reasoning-start", "reasoning-delta", "reasoning-end",
            ]);

            try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) {
                // ТЗ-FIX1.2: Flush any remaining buffer on stream end
                for (const buffered of stepTextBuffer) {
                  controller.enqueue(buffered);
                }
                stepTextBuffer = [];

                // ТЗ-FIX1: Collect guardian flags after stream ends
                guardianFlags = guardianTracker.getAllDetections();
                controller.close();
                break;
              }

              // Diagnostic logging for tool events
              if (value && typeof value === "object" && "type" in value) {
                const eventType = (value as any).type;

                // ТЗ-FIX1.2: Guardian — track step boundaries (UI stream uses start-step/finish-step)
                if (eventType === "start-step") {
                  guardianTracker.reset();
                  stepStartTime = Date.now(); // ТЗ-DEV1: timing
                }

                // ТЗ-FIX1.2: Buffer text-related events (text-start/delta/end must arrive in order)
                if (textBufferTypes.has(eventType)) {
                  // Track text for Guardian (UI stream uses .delta, not .textDelta)
                  if (eventType === "text-delta") {
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
                    console.warn(`[Guardian:${guardianContext}] Blocked hallucinated step (${stepTextBuffer.length} chunks suppressed)`);
                    stepTextBuffer = [];
                    consecutiveHallucinations++;

                    if (consecutiveHallucinations >= 2) {
                      console.warn(`[Guardian:${guardianContext}] Max retries exceeded, showing error to user`);
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
                    if (pendingStep) {
                      emitDebugStep(dataStream, pendingStep);
                    }
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

                // tool-input-start = tool call begins (has toolName, toolCallId)
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

                // tool-output-available = tool result ready
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

              // Enqueue all non-buffered events immediately
              controller.enqueue(value);
            }
            } catch (err) {
              console.error(`[Guardian:${guardianContext}] Stream error in instrumentedStream:`, err);
              // Flush any remaining buffer so user sees partial text
              for (const buffered of stepTextBuffer) {
                try { controller.enqueue(buffered); } catch { /* controller may be closed */ }
              }
              controller.close();
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
            extractedAt: null,
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
          void autoNameChat(id, session.user.id!).catch((err) =>
            console.error("[generate-title] Background error:", err)
          );
        }

        // ТЗ-RAG1: Extract facts from conversation (fire-and-forget)
        // ТЗ-RAG2: Respects memoryEnabled setting (checked earlier in execute)
        // ТЗ-MinimaxCleanup: Skip extract for simply — will be replaced by Extract-on-compaction
        if (isMemoryEnabled && chatMode !== "simply") {
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
              sourceType: chatMode as "chat" | "simply" | "expertise" | "create",
              sourceChatId: id,
            }).catch((err) =>
              console.warn("[MIND] Extract failed (non-blocking):", err instanceof Error ? err.message : err)
            );
          }
        }

        if (finalMergedUsage) {
          try {
            // Merge with previous session usage so reload shows cumulative total
            const prevUsage = normalizeStoredAppUsage(chat?.lastContext as AppUsage | null | undefined);
            const cumulativeUsage = prevUsage
              ? mergeAppUsage(prevUsage, finalMergedUsage)
              : finalMergedUsage;
            await updateChatLastContextById({
              chatId: id,
              context: cumulativeUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }

        // ТЗ-FIX1: Save usage log with guardian flags (after instrumentedStream is fully consumed)
        if (usageLogMeta) {
          saveAiUsageLog({
            chatId: id,
            userId: session.user.id,
            ...usageLogMeta,
            guardianFlags: guardianFlags as Record<string, unknown> | null,
          }).catch(() => {});
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
