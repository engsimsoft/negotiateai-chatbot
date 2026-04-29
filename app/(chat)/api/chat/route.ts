import { after } from "next/server";
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  generateObject,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
  type UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import { calcStepCostRub } from "@/lib/ai/tokenlens-catalog";
import { extractUsageFields, extractUsageForPricing, logUsage } from "@/lib/ai/usage-utils";
import { auth } from "@/app/(auth)/auth";
import { userEntitlements } from "@/lib/ai/entitlements";
import { resolveActiveTaskId } from "@/lib/ai/routing";
import {
  buildResponsesInput,
  streamXaiResponses,
  type ResponsesUsage,
} from "@/lib/ai/files/xai-responses";
import { buildChatPrompt, buildExpertisePrompt, buildCreatePrompt, buildLibraryDocumentPrompt } from "@/lib/prompts/server";
import { getLibraryDocumentById } from "@/lib/ai/library/db";
import type { BuildContext } from "@/lib/prompts";
import { buildProjectContext } from "@/lib/prompts/contexts";
import {
  getMaxOutputTokensForTask,
  getModel,
  getModelIdForTask,
  getProviderForTask,
  isTaskOverridden,
} from "@/lib/ai/getModel";
import { getModelEntry, type ModelCapabilities } from "@/lib/ai/model-catalog";
import { prepareMessagesWithCompaction } from "@/lib/ai/compaction/prepare-messages";
import { emitCompactionEvent } from "@/lib/ai/compaction/events";
import type { CompactionEvent } from "@/lib/ai/compaction/types";
import type { TaskId } from "@/lib/ai/task-assignments";
import { DEFAULT_TASK_MODELS } from "@/lib/ai/task-assignments";
import {
  getProjectModel,
  isValidModelTier,
  DEFAULT_PROJECT_MODEL,
  type ProjectModelTier,
} from "@/lib/ai/model-tiers";
// ТЗ-COMPACTION-UNIFY: context-limits больше не нужен в этом handler —
// Simply Compaction middleware (prepareMessagesWithCompaction) сам читает
// пороги из context-limits.ts.
import { executeProfessorPipeline } from "@/lib/ai/professor-pipeline";
import { computeToolsTokens, getStandardTools, getActiveToolNames, withCacheControlOnLastTool } from "@/lib/ai/tools/chat-tools";
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
  emitDebugError,
  emitDebugWarning,
  emitToolDebugStep,
  truncateForDebug,
  DEBUG_EVENT_SCHEMA_VERSION,
  type DebugStepData,
} from "@/lib/ai/debug-events";
import { retrieveMemoryContext } from "@/lib/ai/memory/retrieve";
import { getProfileBlock } from "@/lib/ai/memory/profile";
import { processStaleFactsOnVisit, type OnVisitSourceType } from "@/lib/ai/memory/on-visit";
import {
  listCollectionsOwnedByUser,
  listDocumentsOwnedByUser,
  listLibraryCollectionsSummaryByUser,
} from "@/lib/ai/library/db";
// ТЗ-COMPACTION-UNIFY: extract вызывается внутри prepareMessagesWithCompaction —
// main handler больше не импортирует extract функции.
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getFilesByProjectId,
  getMessageCountByUserId,
  getMessagesByChatId,
  getProjectById,
  getUserById,
  saveAiUsageLog,
  saveChat,
  saveMessages,
  saveChatAttachmentsFromMessage,
  getChatAttachmentsByChatId,
  updateChatLastContextById,
  updateChatTitleAndSummary,
  updateChatTaskStatus,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { buildAppUsage, mergeAppUsage, normalizeStoredAppUsage, type AppUsage } from "@/lib/usage";
import { convertToUIMessages, estimateMessageTokens, generateUUID, sanitizeCoreMessages, stripIncompleteToolParts } from "@/lib/utils";
// ТЗ-07A: generateTitleFromUserMessage больше не используется здесь
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 180; // 3 minutes - increased for complex document generation

/**
 * ТЗ-07A: Server-side auto-naming after messages are saved.
 * Eliminates race condition where client calls generate-title
 * before assistant messages are persisted to DB.
 */
async function autoNameChat(
  chatId: string,
  userId: string,
  dataStream?: UIMessageStreamWriter,
  generatedAssistantText?: string,
): Promise<void> {
  const chat = await getChatById({ id: chatId });
  if (!chat || chat.isRenamed) return;

  // ТЗ-KITT: Simply chat is never auto-named
  if (chat.chatMode === "simply") return;

  // ТЗ-LegacyChatCleanup: дефолтные title теперь mode-aware («Новый запрос», «Новое задание»,
  // «Новый чат» как fallback). Пропускаем autoNaming только если title уже изменился
  // (либо пользователем, либо предыдущим autoName).
  const DEFAULT_TITLES = new Set(["Новый чат", "Новый запрос", "Новое задание", "Чат проекта"]);
  if (!DEFAULT_TITLES.has(chat.title)) return;

  const dbMessages = await getMessagesByChatId({ id: chatId });
  // Called from streamText.onFinish — the assistant message being generated
  // is not yet saved to DB. Count it via generatedAssistantText so the
  // min-message-count gate fires on the same turn as before (4th message).
  const totalCount = dbMessages.length + (generatedAssistantText ? 1 : 0);
  if (totalCount < 4) return;

  const contextMessages = generatedAssistantText
    ? [
        ...dbMessages,
        {
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: generatedAssistantText }],
        },
      ].slice(0, 4)
    : dbMessages.slice(0, 4);
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

  // ТЗ-1 CoreRegistry: auto-naming via task-assignments
  const resolvedModelId = getModelIdForTask("util:title");
  const autoNameStartedAt = Date.now();

  // ТЗ-COMPACTION-1 fix #3: try/catch — graceful fallback при NoObjectGeneratedError
  // (модель обрывает JSON, сетевые сбои, и т.д.). Default title уже mode-aware
  // («Новый запрос», «Новое задание»), пользователь видит штатное поведение.
  try {
    const { object, usage } = await generateObject({
      model: getModel("util:title"),
      maxOutputTokens: getMaxOutputTokensForTask("util:title"),
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
      provider: getProviderForTask("util:title"),
      chatMode: "util:auto-naming",
      chatId,
    });

    // Emit sub-call step to DevPanel so footer aggregates auto-naming model/cost
    if (dataStream) {
      emitToolDebugStep(dataStream, {
        taskId: "util:title",
        modelId: resolvedModelId,
        usage,
        toolName: "util:auto-naming",
        durationMs: Date.now() - autoNameStartedAt,
      });
    }

    console.log(`[generate-title] Server-side success for ${chatId}: "${cleanTitle}"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[generate-title] Failed for chat ${chatId} — keeping default title: ${message}`,
    );
  }
}

/**
 * ТЗ-SimplyReadDocumentTool + R-6 correction (v3.90.2): Capability-aware history
 * adaptation.
 *
 * When sending conversation history to any model, file parts present in the
 * history may exceed what the target model can physically handle:
 *
 *   - image/png, image/jpeg, image/webp → need `capabilities.vision === true`
 *   - application/pdf → need `capabilities.documentSupport.supported === true`
 *   - text/plain → already inlined upstream by `convertTextFilesInAllMessages`
 *
 * When a file part exceeds target model capabilities, we replace it with a text
 * placeholder describing what was there. The model "knows" a file was attached
 * historically but can't re-read it. The user experience: if they ask follow-up
 * questions about a PDF while routed to Grok (no documentSupport), Grok will
 * say "ранее был прикреплён PDF '...', я не вижу его содержимое сейчас — могу
 * работать с описанием, или прикрепи файл ещё раз".
 *
 * This is the correct implementation of R-6 from ТЗ-XAI-3 (see
 * specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md line 96): "убирать причину, а не
 * симптом, через SSOT capabilities". v3.90.0 erroneously removed
 * `stripMediaPartsForTextModel` relying on "vision → Haiku routing will save
 * us" — but routing only looks at the CURRENT message, so PDFs persisted in
 * history would crash Grok on every follow-up. v3.90.2 restores correct
 * behaviour via SSOT capabilities from model-catalog.ts.
 */
/**
 * Удаляет картинки/PDF из старых сообщений истории, оставляя их только в
 * последних N user-сообщениях. Без этого xAI/Anthropic пересчитывают vision
 * tokens по всем накопленным attachment'ам в каждом turn — Simply chat вечный,
 * за месяцы накапливаются десятки картинок и каждое «привет» стоит 100K+ ткн.
 * Семантика "ранее было изображение" повторяет [adaptHistoryToCapabilities].
 */
const KEEP_ATTACHMENTS_IN_LAST_N_USER_MESSAGES = 2;

function stripOldAttachmentsFromHistory(
  messages: ChatMessage[],
  keepInLastNUser: number,
): ChatMessage[] {
  if (messages.length === 0) return messages;
  let userSeen = 0;
  let cutoff = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userSeen += 1;
      if (userSeen >= keepInLastNUser) {
        cutoff = i;
        break;
      }
    }
  }
  const cutoffApplies = userSeen >= keepInLastNUser;

  return messages.map((message, idx) => {
    const isOldMessage = cutoffApplies && idx < cutoff;
    const adaptedParts = message.parts.map((part: any) => {
      if (!isOldMessage) return part;
      if (part.type === "file") {
        const mediaType: string = part.mediaType ?? "";
        const fileName: string =
          part.name || part.url?.split("/").pop() || "файл";
        if (mediaType === "text/plain") {
          return {
            type: "text" as const,
            text: `[Ранее был прикреплён файл: ${fileName}]`,
          };
        }
        if (mediaType.startsWith("image/")) {
          return {
            type: "text" as const,
            text: `[Ранее было прикреплено изображение: ${fileName}]`,
          };
        }
        if (mediaType === "application/pdf") {
          return {
            type: "text" as const,
            text: `[Ранее был прикреплён PDF: ${fileName}]`,
          };
        }
        return part;
      }
      if (part.type === "image") {
        return {
          type: "text" as const,
          text: "[Ранее было прикреплено изображение]",
        };
      }
      return part;
    });
    return { ...message, parts: adaptedParts } as ChatMessage;
  });
}

function adaptHistoryToCapabilities(
  messages: ChatMessage[],
  capabilities: ModelCapabilities | undefined,
): ChatMessage[] {
  // Conservative fallback: if we don't know capabilities, leave history as-is.
  // The model will reject unsupported parts and StreamObservability will
  // surface the error to DevPanel — better than silently stripping.
  if (!capabilities) return messages;

  const supportsVision = capabilities.vision === true;
  const supportsPdf = capabilities.documentSupport?.supported === true;

  return messages.map((message) => {
    const adaptedParts = message.parts.map((part: any) => {
      // AI SDK v6 canonical format: file part with mediaType
      if (part.type === "file") {
        const mediaType: string = part.mediaType ?? "";
        const fileName: string =
          part.name || part.url?.split("/").pop() || "файл";

        // text/plain is handled upstream by convertTextFilesInAllMessages
        if (mediaType === "text/plain") return part;

        // Image file parts
        if (mediaType.startsWith("image/")) {
          if (supportsVision) return part;
          return {
            type: "text" as const,
            text: `[Ранее было прикреплено изображение: ${fileName} — текущая модель не поддерживает изображения]`,
          };
        }

        // PDF file parts
        if (mediaType === "application/pdf") {
          if (supportsPdf) return part;
          return {
            type: "text" as const,
            text: `[Ранее был прикреплён PDF-документ: ${fileName} — текущая модель не поддерживает PDF через file part. Если нужен анализ содержимого, прикрепи файл повторно в этом сообщении.]`,
          };
        }

        // Other file types (audio, video, unknown) — conservative placeholder
        return {
          type: "text" as const,
          text: `[Ранее был прикреплён файл: ${fileName} (${mediaType})]`,
        };
      }

      // Legacy "image" part type (older AI SDK format) — same vision check
      if (part.type === "image") {
        if (supportsVision) return part;
        return {
          type: "text" as const,
          text: `[Ранее было прикреплено изображение — текущая модель не поддерживает изображения]`,
        };
      }

      return part;
    });

    return { ...message, parts: adaptedParts } as ChatMessage;
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
      lockedDocumentId,
      librarySources: librarySourcesRaw,
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    let lockedDoc: { id: string; filename: string } | null = null;
    if (chatMode === "library-document") {
      if (!lockedDocumentId) {
        return new ChatSDKError(
          "bad_request:api",
          "lockedDocumentId is required for library-document mode",
        ).toResponse();
      }
      const doc = await getLibraryDocumentById(lockedDocumentId);
      if (!doc) {
        return new ChatSDKError(
          "not_found:database",
          "Document not found",
        ).toResponse();
      }
      if (doc.userId !== session.user.id) {
        return new ChatSDKError(
          "unauthorized:chat",
          "Document not owned",
        ).toResponse();
      }
      lockedDoc = { id: doc.id, filename: doc.filename };
    }

    // A6.2: SourcePickerModal scope. Сужаем librarySearch до выбранных
    // пользователем источников. Ownership-фильтрация: невладельческие UUID
    // молча отбрасываются; пустой scope === нет ограничений.
    let librarySources:
      | {
          collectionIds?: string[];
          documentIds?: string[];
          collectionNames?: string[];
          documentNames?: string[];
        }
      | undefined;
    if (
      librarySourcesRaw &&
      ((librarySourcesRaw.collectionIds?.length ?? 0) > 0 ||
        (librarySourcesRaw.documentIds?.length ?? 0) > 0)
    ) {
      const [ownedCols, ownedDocs] = await Promise.all([
        librarySourcesRaw.collectionIds?.length
          ? listCollectionsOwnedByUser(
              session.user.id,
              librarySourcesRaw.collectionIds,
            )
          : Promise.resolve([] as Awaited<
              ReturnType<typeof listCollectionsOwnedByUser>
            >),
        librarySourcesRaw.documentIds?.length
          ? listDocumentsOwnedByUser(
              session.user.id,
              librarySourcesRaw.documentIds,
            )
          : Promise.resolve([] as Awaited<
              ReturnType<typeof listDocumentsOwnedByUser>
            >),
      ]);
      if (ownedCols.length > 0 || ownedDocs.length > 0) {
        librarySources = {
          collectionIds: ownedCols.length > 0 ? ownedCols.map((c) => c.id) : undefined,
          documentIds: ownedDocs.length > 0 ? ownedDocs.map((d) => d.id) : undefined,
          collectionNames: ownedCols.map((c) => c.name),
          documentNames: ownedDocs.map((d) => d.filename),
        };
      }
    }

    // Performance: Parallelize independent DB queries
    const [userProfile, messageCount, chat, libraryCollectionsSummary] =
      await Promise.all([
        getUserById(session.user.id),
        getMessageCountByUserId({
          id: session.user.id,
          differenceInHours: 24,
        }),
        getChatById({ id }),
        listLibraryCollectionsSummaryByUser(session.user.id).catch((err) => {
          console.warn(
            "[Chat API] library summary fetch failed:",
            err instanceof Error ? err.message : err,
          );
          return [] as Awaited<
            ReturnType<typeof listLibraryCollectionsSummaryByUser>
          >;
        }),
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
      // Performance: Save chat with temporary title, generate real title in background.
      // ТЗ-LegacyChatCleanup: дефолтный title теперь mode-aware, чтобы в sidebar list
      // свежесозданная ветка отображалась осмысленно («Новый запрос» / «Новое задание»)
      // до того, как autoNameChat сгенерирует постоянное имя через Claude.
      const defaultTitle = projectId
        ? "Чат проекта"
        : chatMode === "expertise"
          ? "Новый запрос"
          : chatMode === "create"
            ? "Новое задание"
            : "Новый чат";
      await saveChat({
        id,
        userId: session.user.id,
        title: defaultTitle,
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

    const newMessageTokens = estimateMessageTokens(message.parts);
    console.log(
      `[Token Aware] Chat ${id}: New user message has ~${newMessageTokens} tokens (post file conversion)`
    );

    // Загружаем сообщения с учётом токенов нового сообщения.
    // ТЗ-FixSimplyMemory (2026-04-27): Simply больше НЕ режет историю по
    // extractedAt — провайдер-агностичный Compaction (Soft 100K / Hard 170K)
    // сжимает старое автоматически. История = primary source, MIND = augmentation.
    // Все chatMode используют единый budget 140K — оставляем ~60K на
    // system prompt + tools + MIND блок + response.
    const isSimplyChat = chatMode === "simply";
    const messagesFromDb = await getMessagesByChatId({
      id,
      maxTokens: 140000 - newMessageTokens,
      minMessages: 20,
      // maxMessages: дефолт 10000 (см. queries.ts) — token-aware sliding window
      // ниже сама обрежет по budget. Жёсткий лимит 200 ломал prompt cache.
    });

    const uiMessages = [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    // ТЗ-FixSimplyMemory: id сообщений с уже-извлечёнными фактами. Передаётся
    // в Compaction middleware чтобы pre-compact extract step пропускал их и
    // не дублировал Grok-вызов (см. lib/ai/compaction/prepare-messages.ts).
    const alreadyExtractedIds = new Set(
      messagesFromDb
        .filter((m) => m.extractedAt !== null)
        .map((m) => m.id),
    );

    // Подсчитываем общее количество токенов в контексте
    const totalHistoryTokens = messagesFromDb.reduce((sum, msg) => {
      return sum + (msg.tokenCount || estimateMessageTokens(msg.parts as any));
    }, 0);

    console.log(
      `[Token Aware] Chat ${id}: Total context = ${totalHistoryTokens + newMessageTokens} tokens ` +
      `(${messagesFromDb.length} history messages + 1 new message)`
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
      library: libraryCollectionsSummary.map((c) => ({
        name: c.name,
        documentsCount: c.documentsCount,
        isDefault: c.isDefault,
      })),
      librarySourcesScope: librarySources
        ? {
            collectionNames: librarySources.collectionNames,
            documentNames: librarySources.documentNames,
          }
        : undefined,
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
          tokenCount: newMessageTokens,
          extractedAt: null,
        },
      ],
    });

    await saveChatAttachmentsFromMessage({
      chatId: id,
      messageId: message.id,
      parts: message.parts as any[],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;
    let guardianFlags: GuardianFlags | null = null;
    let usageLogMeta: {
      modelId: string;
      /** ТЗ-DevPanelErrors Phase 5: provider from SSOT (anthropic | moonshotai | xai | ...) */
      provider: string | null;
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
    // ТЗ-LegacyChatCleanup: chat mode removed — gate covers all three remaining modes
    let isMemoryEnabled = ["simply", "expertise", "create"].includes(chatMode);

    // ТЗ-StreamObservability: closure-capture writer so onError can emit to DevPanel
    let dataStreamRef: UIMessageStreamWriter | null = null;

    const stream = createUIMessageStream({
      originalMessages: uiMessages,
      execute: async ({ writer: dataStream }) => {
        dataStreamRef = dataStream;
        // ТЗ-03: Build system prompt - different for project vs regular chat
        let systemPromptText: string;
        let modelToUse;
        const isProjectChat = !!(project && projectId);
        const tier = projectModelTier && isValidModelTier(projectModelTier)
          ? projectModelTier
          : DEFAULT_PROJECT_MODEL;
        const isProfessorMode = isProjectChat && tier === "professor";

        // ТЗ-ExpertiseCreateVisionRouting (2026-04-21): единая SSOT-точка резолва
        // activeTaskId. Capability-driven fallback на `chat-vision` (Haiku 4.5)
        // срабатывает только когда default-модель режима не тянет тип вложения
        // (у Grok — PDF). См. lib/ai/routing.ts и ADR. До этого ТЗ routing был
        // хардкод на simply, expertise/create падали на скан-PDF, project chat
        // собирал несуществующие taskId через template string.
        const activeTaskId: TaskId = resolveActiveTaskId({
          chatMode,
          think,
          isProjectChat,
          tier: isProjectChat ? tier : undefined,
          parts: message.parts,
        });

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
          const builtPrompt = buildChatPrompt(promptContext, activeTaskId);
          systemPromptText = `${builtPrompt.systemPrompt}\n\n${projectContext}`;

          console.log(`[Project Chat] Using ${projectModelConfig.name} (${tier}) for project ${project.name}`);
          console.log(`[Project Chat] Context length: ${projectContext.length} chars`);
        } else {
          // ТЗ-LegacyChatCleanup: explicit switch по chatMode — три ветки, без fallback.
          // buildChatPrompt используется как билдер Simply (исторически общий builder чата).
          let builtPrompt;
          switch (chatMode) {
            case "expertise":
              builtPrompt = buildExpertisePrompt(promptContext, activeTaskId);
              break;
            case "create":
              builtPrompt = buildCreatePrompt(promptContext, activeTaskId);
              break;
            case "simply":
              builtPrompt = buildChatPrompt(promptContext, activeTaskId);
              break;
            case "library-document":
              builtPrompt = buildLibraryDocumentPrompt(
                lockedDoc?.filename ?? "документ",
                activeTaskId,
              );
              break;
          }
          systemPromptText = builtPrompt.systemPrompt;

          modelToUse = getModel(activeTaskId);
          console.log(`[Chat API] Model selection: chatMode=${chatMode}, task=${activeTaskId}, model=${getModelIdForTask(activeTaskId)}`);
        }

        // ТЗ-2: Resolve the catalog entry for the effective model ONCE, right
        // after activeTaskId is known. All downstream "does the model support
        // X?" checks read from these capability flags instead of guessing
        // from chatMode/think/hasAttachments. That's the SSOT fix that lets
        // dev overrides (/dev/models) correctly enable Anthropic prompt caching
        // and Compaction API on any task the developer reroutes to Claude.
        // ТЗ-COMPACTION-1: effectiveModelId — реальный physical modelId целевой
        // модели чата. Используется и для capability lookup (effectiveCatalogEntry),
        // и для compaction strategy resolution ниже (Finding #3 — убирает заплатку
        // `|| isProjectChat` через прямую передачу resolved modelId в getCompactionStrategy).
        const effectiveModelId = activeTaskId ? getModelIdForTask(activeTaskId) : undefined;
        const effectiveCatalogEntry = effectiveModelId
          ? getModelEntry(effectiveModelId)
          : undefined;
        const effectiveProvider = effectiveCatalogEntry?.provider ?? "anthropic";

        // ТЗ-RAG1/RAG2: MIND memory — profile + retrieval
        // Scope: chat, expertise, create (not service chats, not professor pipeline)
        // Gate: check user's memoryEnabled setting (isMemoryEnabled hoisted above createUIMessageStream)
        if (isMemoryEnabled) {
          try {
            const { getMemorySettings } = await import("@/lib/db/queries");
            const memSettings = await getMemorySettings({ userId: session.user.id });
            isMemoryEnabled = memSettings.memoryEnabled;
          } catch (error) {
            // ТЗ-LegacyChatCleanup: исправлен молчаливый catch — раньше глотал ошибку
            // и оставлял isMemoryEnabled=true (graceful degradation без сигнала)
            const msg = error instanceof Error ? error.message : String(error);
            console.warn("[MIND] Memory settings load failed (defaulting to enabled):", msg);
            // Note: prePromptWarnings ещё не объявлен на этом этапе — буфер создаётся ниже
          }
        }
        let memoryDebugData: Parameters<typeof emitDebugRag>[1] | null = null;
        // ТЗ-DevPanelErrors: buffer warnings captured BEFORE emitDebugPrompt runs.
        // parseBatches on the client only attaches errors/warnings to the current batch,
        // which is created by data-debug-prompt. Pre-prompt warnings would be dropped,
        // so we collect them here and flush right after prompt emission.
        const prePromptWarnings: Array<Parameters<typeof emitDebugWarning>[1]> = [];
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
            const msg = error instanceof Error ? error.message : String(error);
            console.warn("[MIND] Profile load failed (non-blocking):", msg);
            prePromptWarnings.push({
              source: "server:memory-profile",
              message: `Profile load failed (graceful degradation): ${msg}`,
              context: { userId: session.user.id },
            });
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

              // ТЗ-DevPanelErrors: retrieveMemoryContext never throws (graceful
              // degradation) — failures are signalled via `error` field on the
              // result. Surface them to DevPanel so silent Voyage outages stop
              // going unnoticed.
              if (memoryResult.error) {
                prePromptWarnings.push({
                  source: "server:memory-retrieve",
                  message: `Memory retrieval failed (graceful degradation): ${memoryResult.error}`,
                  context: {
                    userId: session.user.id,
                    chatId: id,
                    durationMs: memoryResult.durationMs,
                  },
                });
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
            // Defensive: if retrieveMemoryContext is ever changed to throw,
            // we still want to surface it. Currently unreachable because of
            // graceful degradation inside retrieveMemoryContext.
            const msg = error instanceof Error ? error.message : String(error);
            console.warn("[MIND] Retrieve failed (non-blocking):", msg);
            prePromptWarnings.push({
              source: "server:memory-retrieve",
              message: `Memory retrieval threw (unexpected): ${msg}`,
              context: { userId: session.user.id, chatId: id },
            });
          }
        }

        // ТЗ-COMPACTION-UNIFY: раздельный threshold-based batch extract для Simply
        // удалён. Extract теперь запускается внутри `prepareMessagesWithCompaction`
        // (ниже) на подмножестве сообщений `split.toCompact` — Mem0 best practice
        // 2026 «memory formation before summarization». Единый event чтобы ни
        // одно сообщение не уходило из окна без попытки извлечь факты.

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
          if (isProjectChat) injections.push("project-context");
          if (systemPromptText.includes("<memory>")) injections.push("mind-memory");
          // ТЗ-2: include task + override info for DevPanel switcher and OVERRIDE badge
          const overrideActive = activeTaskId ? isTaskOverridden(activeTaskId) : false;
          const defaultModelId = activeTaskId ? DEFAULT_TASK_MODELS[activeTaskId] : undefined;
          const effectiveModelId = activeTaskId ? getModelIdForTask(activeTaskId) : undefined;
          emitDebugPrompt(dataStream, {
            systemPromptPreview: systemPromptText.slice(0, 500),
            systemPromptLength: systemPromptText.length,
            activeAgent: agentName,
            chatMode,
            isProjectChat,
            projectTier: isProjectChat ? tier : undefined,
            contextInjections: injections,
            taskId: activeTaskId ?? undefined,
            overrideActive,
            defaultModelId,
            effectiveModelId,
          });
          // ТЗ-DevPanelErrors: flush buffered pre-prompt warnings now that a batch exists
          for (const w of prePromptWarnings) {
            emitDebugWarning(dataStream, w);
          }
        }

        // ТЗ-RAG1: Emit debug rag AFTER prompt (so parseBatches has an active batch)
        if (memoryDebugData) {
          emitDebugRag(dataStream, memoryDebugData);
        }

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
          // ТЗ-1 hotfix: stripIncompleteToolParts removes failed/in-flight tool parts
          // (state: output-error | input-streaming | input-available) before conversion
          // so downstream providers don't receive unparseable tool arguments.
          const coreMessages = sanitizeCoreMessages(
            await convertToModelMessages(
              stripIncompleteToolParts(uiMessages.slice(0, -1)),
            ),
          ); // Exclude current message

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
            emitDebugError(dataStream, {
              source: "server:professor-pipeline",
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
              context: { chatId: id, userId: session.user.id },
            });
            dataStream.write({
              type: "error",
              errorText: error instanceof Error ? error.message : "Pipeline error",
            });
          }

          return; // Exit execute for professor mode
        }

        // ТЗ-COMPACTION-UNIFY (ADR 054): capability-driven compaction strategy удалён.
        // Единая Simply Compaction middleware (`prepareMessagesWithCompaction` ниже)
        // работает для ВСЕХ chat-моделей одинаково. Anthropic `contextManagement`
        // (`compact_20260112`) больше не используется — наша логика провайдер-
        // агностична и даёт прозрачность (мы видим что сжалось, когда, какой размер).

        // Anthropic-protocol providers: для них работает `providerOptions.anthropic.*`
        // (cacheControl, reasoning parts). На сегодня — только сам Anthropic.
        const isAnthropicProtocolModel = effectiveProvider === "anthropic";

        // ─── Подготовка tools и messages для streamText ──────────────────────
        // Выносим построение messages из inline literal до вызова streamText,
        // потому что (а) convertToModelMessages async, (б) MIND transplant
        // требует мутации последнего user message content-part.

        // Tools: стандартный набор + optional cache breakpoint на последнем
        // tool для Anthropic-protocol моделей (кэширует весь блок определений).
        const standardTools = getStandardTools({
          session,
          dataStream,
          isProjectChat,
          projectId: projectId || undefined,
          chatId: id,
          chatMode,
          researchDepth,
          lockedFileId: lockedDoc?.id,
          librarySources: librarySources
            ? {
                collectionIds: librarySources.collectionIds,
                documentIds: librarySources.documentIds,
              }
            : undefined,
        });
        const toolsForRequest = isAnthropicProtocolModel
          ? withCacheControlOnLastTool(standardTools)
          : standardTools;

        const cleanedHistory = stripIncompleteToolParts(uiMessages);
        const preparedHistory = adaptHistoryToCapabilities(
          cleanedHistory,
          effectiveCatalogEntry?.capabilities,
        );

        // ТЗ-COMPACTION-UNIFY: Simply Compaction middleware — единый путь для
        // всех пользовательских chat modes (simply / expertise / create) +
        // project chat (внутри main handler когда нет task-expert). Professor
        // pipeline обрабатывается отдельно выше (executeProfessorPipeline) —
        // сюда не попадает.
        //
        // Middleware работает на ChatMessage[] ДО convertToModelMessages, пока
        // история ещё не смешана с system/MIND/cache-control метками.
        //
        // Инвариант mindTokens: учитывает ТОЛЬКО retrieved facts (mindDynamicBlock).
        // Profile block уже включён в systemPromptText (inject выше ~line 730
        // через `systemPromptText += profileBlock`), значит его токены уже
        // учтены в `systemPromptTokensForCompaction`. Двойной учёт недопустим.
        let historyForStream = preparedHistory;
        let simplyCompactionEvent: CompactionEvent | undefined;
        if (effectiveModelId && activeTaskId) {
          const systemPromptTokensForCompaction = estimateMessageTokens([
            { type: "text", text: systemPromptText },
          ]);
          const mindTokensForCompaction = mindDynamicBlock
            ? estimateMessageTokens([{ type: "text", text: mindDynamicBlock }])
            : 0;
          // Tools schemas (Zod inputSchema + description) входят в payload
          // провайдера, но не в systemPromptText. Считаем явно — свойство call site.
          const toolsTokens = computeToolsTokens(toolsForRequest);

          // sourceType определяется по приоритету: project → всё остальное по chatMode.
          // Project chat в main handler (isProjectChat && chatMode="simply|..." но без task)
          // сохраняет факты как "project" в memory_entry для корректной retrieve-фильтрации.
          const compactionSourceType = isProjectChat
            ? "project"
            : chatMode === "library-document"
              ? "simply"
              : chatMode;

          // Реальный input прошлого turn'а от API модели — точный baseline для
          // триггера Compaction (виджет контекста читает то же значение). Если
          // чат новый или legacy lastContext — undefined, middleware fallback'ом
          // считает по estimator-полям ниже.
          const prevStoredUsage = normalizeStoredAppUsage(
            chat?.lastContext as AppUsage | null | undefined,
          );
          const realLastInputTokens = prevStoredUsage?.contextWindow.used;

          const compactionResult = await prepareMessagesWithCompaction(
            activeTaskId,
            preparedHistory,
            {
              chatId: id,
              userId: session.user.id,
              modelId: effectiveModelId,
              sourceType: compactionSourceType,
              sourceProjectId: isProjectChat ? projectId : null,
              systemPromptTokens: systemPromptTokensForCompaction,
              totalHistoryTokens,
              newMessageTokens,
              mindTokens: mindTokensForCompaction,
              toolsTokens,
              alreadyExtractedIds,
              realLastInputTokens,
            },
            dataStream,
          );
          historyForStream = compactionResult.messages;
          simplyCompactionEvent = compactionResult.compactionEvent;
        }

        historyForStream = stripOldAttachmentsFromHistory(
          historyForStream,
          KEEP_ATTACHMENTS_IN_LAST_N_USER_MESSAGES,
        );

        // User-visible compaction event эмитится сразу после middleware, до
        // streamText — виджет контекста получает индикатор до начала ответа.
        if (simplyCompactionEvent) {
          emitCompactionEvent(dataStream, simplyCompactionEvent);
        }

        const coreHistory = sanitizeCoreMessages(
          await convertToModelMessages(historyForStream),
        );

        // Сборка messages с 3 cache breakpoints (только для Anthropic-protocol):
        //  [1] static system prompt (breakpoint 1)
        //  [2] ...history
        //  [3] last user message с inline breakpoint на последнем text-part (breakpoint 3)
        //      + trailing MIND block как dynamic content-part (после breakpoint → не ломает кэш)
        // Дополнительно: breakpoint 2 — на последнем tool определении через
        // `withCacheControlOnLastTool` выше.
        //
        // Для non-Anthropic-protocol (например Gemini через dev override) —
        // MIND идёт как второй system message (legacy path), breakpoints не ставятся.
        const messagesForRequest: Parameters<typeof streamText>[0]["messages"] = [
          {
            role: "system" as const,
            content: systemPromptText,
            ...(isAnthropicProtocolModel
              ? { providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } }
              : {}),
          },
          ...coreHistory,
        ];

        if (mindDynamicBlock) {
          const lastIdx = messagesForRequest.length - 1;
          const lastMsg = messagesForRequest[lastIdx];
          if (lastMsg?.role === "user") {
            // Универсально для всех провайдеров: MIND-блок инжектится как
            // trailing text-part в последнее user-сообщение. Раньше для
            // не-Anthropic-протокола он добавлялся отдельным trailing system
            // сообщением — это ломало xAI prompt-cache: каждый запрос имел
            // меняющийся блок ПОСЛЕ всей истории, и кэш обрывался на первой
            // точке расхождения, не покрывая историю.
            //
            // Теперь история между запросами идентична побайтно (статичный
            // префикс system + tools + история до текущего user message),
            // что даёт xAI Grok кэшировать растущую историю как Anthropic.
            //
            // Для Anthropic дополнительно ставим cacheControl на предыдущую
            // часть user-сообщения — явный breakpoint для prompt caching.
            const existingParts: any[] = Array.isArray(lastMsg.content)
              ? [...(lastMsg.content as unknown as any[])]
              : [{ type: "text", text: String(lastMsg.content) }];
            const lastPartIdx = existingParts.length - 1;
            const lastPart = existingParts[lastPartIdx];
            if (isAnthropicProtocolModel) {
              existingParts[lastPartIdx] = {
                ...lastPart,
                providerOptions: {
                  ...(lastPart.providerOptions ?? {}),
                  anthropic: { cacheControl: { type: "ephemeral" as const } },
                },
              };
            }
            existingParts.push({
              type: "text",
              text: `\n\n${mindDynamicBlock}`,
            });
            messagesForRequest[lastIdx] = {
              ...lastMsg,
              content: existingParts as unknown as typeof lastMsg.content,
            };
          } else {
            // Edge case: последнее сообщение не user (например, после tool-call
            // последовательности). Fallback на trailing system message.
            messagesForRequest.push({ role: "system" as const, content: mindDynamicBlock });
          }
        }

        // ─── Шаг 4 fork: xAI Responses API path для non-image file attachments ──
        // SPEC v3 §3.3, §5.2: при наличии PDF/DOCX/etc в новом сообщении ИЛИ в
        // истории чата идём через POST /v1/responses с input_file content type.
        // attachment_search активируется автоматически (Phase 1.5 R2 verified).
        // Tools на этом пути не подключаются: agentic document_search xAI делает сам.
        // Только для xAI provider — Anthropic project chats обрабатывают PDF native.
        const newMessageHasNonImageFile = (message.parts as any[]).some(
          (p) =>
            p?.type === "file" &&
            typeof p.mediaType === "string" &&
            !p.mediaType.startsWith("image/"),
        );
        const allAttachments = await getChatAttachmentsByChatId(id);
        const hasHistoryXaiFile = allAttachments.some(
          (a) =>
            a.xaiFileId !== null && !a.mimeType.startsWith("image/"),
        );
        const useResponsesApiPath =
          (newMessageHasNonImageFile || hasHistoryXaiFile) &&
          effectiveProvider === "xai";
        console.log(
          `[Files API fork CHECK] activeTaskId=${activeTaskId} newMsgFile=${newMessageHasNonImageFile} historyFile=${hasHistoryXaiFile} provider=${effectiveProvider} useResponsesApi=${useResponsesApiPath}`,
        );
        if (useResponsesApiPath) {
          console.log("[Files API fork] ENTERED — using xAI Responses API path");
          const attachmentsByUrl = new Map<string, string>(
            allAttachments
              .filter((a) => a.xaiFileId)
              .map((a) => [a.blobUrl, a.xaiFileId!] as const),
          );
          const responsesInput = buildResponsesInput({
            messages: messagesForRequest as any,
            attachmentsByUrl,
          });

          const textId = generateUUID();
          let fullText = "";
          let finalUsage: ResponsesUsage | undefined;
          let finalRespModelId: string | undefined;
          let streamError: string | null = null;

          const assistantMessageId = generateUUID();
          dataStream.write({ type: "start", messageId: assistantMessageId } as any);
          dataStream.write({ type: "start-step" });
          dataStream.write({ type: "text-start", id: textId });

          try {
            for await (const event of streamXaiResponses({
              modelId: effectiveModelId!,
              input: responsesInput,
              conversationId: id,
            })) {
              if (event.type === "text-delta") {
                fullText += event.delta;
                dataStream.write({
                  type: "text-delta",
                  id: textId,
                  delta: event.delta,
                });
              } else if (event.type === "completed") {
                finalUsage = event.usage;
                finalRespModelId = event.modelId;
              } else if (event.type === "error") {
                streamError = event.error;
                break;
              }
            }
          } catch (e) {
            streamError = e instanceof Error ? e.message : String(e);
          }

          dataStream.write({ type: "text-end", id: textId });
          dataStream.write({ type: "finish-step" } as any);
          dataStream.write({ type: "finish" } as any);

          if (streamError) {
            console.error("[xai-responses] stream error:", streamError);
            emitDebugError(dataStream, {
              source: "server:xai-responses",
              message: streamError,
            });
            dataStream.write({
              type: "error",
              errorText: streamError,
            });
            return;
          }

          if (fullText) {
            // НЕ вызываем saveMessages — createUIMessageStream onFinish сам
            // соберёт UI message из stream events (start/text-*/finish-step) и
            // сохранит ассистент-сообщение через стандартный путь. Двойной save
            // ломает onFinish (PK conflict в Message_v2).

            // DevPanel data-usage: пробрасываем AppUsage чтобы виджет показывал токены/cost.
            try {
              const totalUsageForApp = {
                inputTokens: finalUsage?.input_tokens ?? 0,
                outputTokens: finalUsage?.output_tokens ?? 0,
                cachedInputTokens:
                  finalUsage?.input_tokens_details?.cached_tokens ?? 0,
                reasoningTokens:
                  finalUsage?.output_tokens_details?.reasoning_tokens ?? 0,
                totalTokens:
                  finalUsage?.total_tokens ??
                  (finalUsage?.input_tokens ?? 0) +
                    (finalUsage?.output_tokens ?? 0),
              };
              const appUsage = buildAppUsage(
                finalRespModelId ?? effectiveModelId!,
                totalUsageForApp as any,
              );
              dataStream.write({ type: "data-usage", data: appUsage } as any);
            } catch (e) {
              console.warn("[xai-responses] AppUsage build failed:", e);
            }

            if (isSimplyDevMode) {
              const stepModelId = finalRespModelId ?? effectiveModelId!;
              const inTok = finalUsage?.input_tokens ?? 0;
              const cachedTok = finalUsage?.input_tokens_details?.cached_tokens ?? 0;
              const stepUsage = {
                noCacheInputTokens: Math.max(0, inTok - cachedTok),
                cacheReadTokens: cachedTok,
                cacheWriteTokens: 0,
                outputTokens: finalUsage?.output_tokens ?? 0,
                reasoningTokens:
                  finalUsage?.output_tokens_details?.reasoning_tokens ?? 0,
              };
              const docSearchCalls =
                finalUsage?.server_side_tool_usage_details?.document_search_calls ?? 0;
              emitDebugStep(dataStream, {
                schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
                stepIndex: 0,
                stepType: "initial",
                modelId: stepModelId,
                noCacheInputTokens: stepUsage.noCacheInputTokens,
                cacheReadTokens: stepUsage.cacheReadTokens,
                cacheWriteTokens: stepUsage.cacheWriteTokens,
                outputTokens: stepUsage.outputTokens,
                reasoningTokens: stepUsage.reasoningTokens,
                finishReason: "stop",
                stepCostRub: calcStepCostRub(stepModelId, stepUsage),
                toolCalls: [],
                toolResults:
                  docSearchCalls > 0
                    ? [{ toolName: "attachment_search", result: { calls: docSearchCalls } }]
                    : [],
                timestamp: Date.now(),
              });
              const totalDuration = Date.now() - startTime;
              emitDebugFinish(dataStream, {
                schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
                totalNoCacheInputTokens: stepUsage.noCacheInputTokens,
                totalCacheReadTokens: stepUsage.cacheReadTokens,
                totalCacheWriteTokens: stepUsage.cacheWriteTokens,
                totalOutputTokens: stepUsage.outputTokens,
                totalReasoningTokens: stepUsage.reasoningTokens,
                totalSteps: 1,
                totalDurationMs: totalDuration,
                timeToFirstTokenMs: totalDuration,
                estimatedCostRub: calculateCostRub(stepModelId, stepUsage),
                modelId: stepModelId,
                finishReason: "stop",
              });
            }

            // Phase 2.8: точный cost из response.usage.cost_in_usd_ticks (1 tick = 1e-10 USD).
            const costUsd =
              finalUsage?.cost_in_usd_ticks !== undefined
                ? finalUsage.cost_in_usd_ticks / 1e10
                : null;
            await saveAiUsageLog({
              chatId: id,
              userId: session.user.id,
              modelId: finalRespModelId ?? effectiveModelId!,
              provider: "xai",
              inputTokens: finalUsage?.input_tokens ?? 0,
              outputTokens: finalUsage?.output_tokens ?? 0,
              cacheReadTokens: finalUsage?.input_tokens_details?.cached_tokens ?? 0,
              cacheWriteTokens: 0,
              thinkingTokens:
                finalUsage?.output_tokens_details?.reasoning_tokens ?? 0,
              costUsd,
              chatMode,
              durationMs: Date.now() - startTime,
              serverSideToolCalls:
                finalUsage?.server_side_tool_usage_details ?? null,
            });
          }
          return;
        }

        // Standard streaming mode (non-professor)
        // ТЗ-FixSimplyMemory followup: x-grok-conv-id sticky-routes запросы одного
        // chatId на тот же физический сервер xAI — кэш у них per-server, без
        // header'а кэш hit-rate проседает. Применяем только для xAI; Anthropic
        // и Moonshot имеют собственные механизмы кэширования.
        const result = streamText({
          model: modelToUse,
          maxOutputTokens: getMaxOutputTokensForTask(activeTaskId),
          messages: messagesForRequest,
          temperature:
            chatMode === "simply" ? 0.7 : chatMode === "expertise" ? 0.3 : 1.0,
          stopWhen: stepCountIs(5),
          // Tools enabled for all chat models. deepResearch filtered for simply mode
          // via SIMPLY_MODE_EXCLUDED_TOOLS in chat-tools.ts.
          experimental_activeTools: getActiveToolNames(isProjectChat, chatMode, think),
          tools: toolsForRequest,
          ...(effectiveProvider === "xai" && {
            headers: { "x-grok-conv-id": id },
          }),
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
          onFinish: async ({ text: responseText, totalUsage, providerMetadata }) => {
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
            // ТЗ-DevPanelErrors Phase 5: resolve taskId once so we can pull both
            // modelId AND provider from it (previously provider was missing →
            // ai_usage_log.provider was null for fresh records — SSOT regression
            // from Этап 2 TZ-1).
            // ТЗ-2: reuse activeTaskId resolved at routing time (SSOT).
            // Kept `resolvedTaskId` as a local alias for minimal churn downstream.
            let resolvedTaskId: TaskId | null = activeTaskId;
            let costUsd: number | null = null;
            try {
              resolvedModelId = resolvedTaskId ? getModelIdForTask(resolvedTaskId) : undefined;
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
            // ТЗ-DevPanelErrors Phase 5: resolve provider via taskId (SSOT Этап 1)
            // Previously missing → ai_usage_log.provider was null for all fresh records.
            const logProvider = resolvedTaskId
              ? getProviderForTask(resolvedTaskId)
              : null;
            usageLogMeta = {
              modelId: logModelId,
              provider: logProvider,
              ...usageFields,
              costUsd,
              chatMode: logChatMode,
              durationMs: totalTime,
            };

            // Server-side auto-naming — runs here (inside streamText.onFinish)
            // because at this moment the UI message stream is still open (merged
            // stream from result.toUIMessageStream is active), so the sub-call
            // debug step emitted by autoNameChat reaches the client and lands
            // in the same DevPanel batch as the main response. By the time
            // createUIMessageStream.onFinish fires, the controller is already
            // closed (see handle-ui-message-stream-finish.ts flush) and writes
            // are silently dropped by safeEnqueue. Cost: +1-2s on the message
            // that triggers auto-naming (4th chat message); zero otherwise.
            if (!projectId) {
              try {
                await autoNameChat(
                  id,
                  session.user.id!,
                  dataStream,
                  responseText,
                );
              } catch (err) {
                console.error("[generate-title] Background error:", err);
              }
            }

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
                    // ТЗ-DevPanelErrors: surface guardian blocks in DevPanel errors section
                    emitDebugWarning(dataStream, {
                      source: "server:guardian",
                      message: `Guardian blocked hallucinated step (${stepTextBuffer.length} chunks suppressed)`,
                      context: {
                        guardianContext,
                        stepIndex: debugStreamStepIndex,
                        confidence: guardianResult.confidence,
                        details: guardianResult.details?.slice(0, 3),
                      },
                    });
                    stepTextBuffer = [];
                    consecutiveHallucinations++;

                    if (consecutiveHallucinations >= 2) {
                      console.warn(`[Guardian:${guardianContext}] Max retries exceeded, showing error to user`);
                      emitDebugError(dataStream, {
                        source: "server:guardian",
                        message: `Guardian max retries exceeded (${consecutiveHallucinations}), showing fallback error to user`,
                        context: { guardianContext, stepIndex: debugStreamStepIndex },
                      });
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
              emitDebugError(dataStream, {
                source: "server:chat-stream",
                message: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
                context: { guardianContext, chatId: id },
              });
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

        // ТЗ-07A: Auto-naming moved to streamText.onFinish (above) — stream
        // must still be open for DevPanel sub-call event to reach client.
        // See streamText.onFinish for the call site and detailed rationale.

        // ТЗ-COMPACTION-UNIFY: per-turn extractAndStoreFacts удалён.
        // Extract запускается только внутри compaction cycle через
        // `prepareMessagesWithCompaction` на подмножестве сообщений, уходящих
        // в summary (Mem0 best practice 2026). Это убирает ~12× overhead
        // per-turn вызова extract на свежих сообщениях.

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
      onError: (error: unknown) => {
        console.error("[Chat Stream onError]", error);
        if (dataStreamRef) {
          emitDebugError(dataStreamRef, {
            source: "server:chat-stream-onError",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
            context: { chatId: id, userId: session.user.id },
          });
        }
        return "Произошла ошибка при генерации ответа. Попробуйте повторить.";
      },
    });

    // ТЗ-MindOnVisit: after response — дотянуть хвосты памяти (все sourceTypes).
    // Fire-and-forget через Next.js `after()` — гарантирует завершение на Vercel
    // через waitUntil. Дебаунс и проверка стратегии — внутри processStaleFactsOnVisit.
    const onVisitSourceType: OnVisitSourceType | null = projectId
      ? "project"
      : chatMode === "simply" || chatMode === "expertise" || chatMode === "create"
        ? chatMode
        : null;
    if (onVisitSourceType && session?.user?.id) {
      const userId = session.user.id;
      after(async () => {
        await processStaleFactsOnVisit({
          userId,
          sourceType: onVisitSourceType,
          chatId: id,
        });
      });
    }

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
