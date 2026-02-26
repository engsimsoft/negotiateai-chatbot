/**
 * ServiceChat API Endpoint
 *
 * Unified streaming chat endpoint for all service assistants:
 * - ben: Help assistant
 * - project-creation: AI-assisted project creation
 * - project-manager: Project management tasks (ТЗ-A3: with persistence + context injection)
 *
 * ТЗ-09: ServiceChat унификация
 * ТЗ-A3: Manager persistence + prompt from .md + mode injection
 */

import fs from "fs";
import path from "path";
import { streamText, tool, stepCountIs, createUIMessageStream, JsonToSseTransformStream } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { buildBenPrompt } from "@/lib/prompts/server";
import {
  getUserById,
  getProjectById,
  getFilesByProjectId,
  getProjectTasksByProjectId,
  getOrCreateManagerChat,
  findManagerChat,
  saveMessages,
  getMessagesByChatId,
  getBriefingSettings,
  getBriefingTopics,
  getBriefingSources,
  upsertBriefingSettings,
  addBriefingTopic,
  addBriefingSource,
  deleteAllBriefingTopicsByUser,
  deleteAllBriefingSourcesByUser,
} from "@/lib/db/queries";
import { deepResearch } from "@/lib/ai/tools/deep-research";
import { fetchUrl } from "@/lib/ai/tools/fetch-url";
import { readTelegramChannel } from "@/lib/ai/tools/read-telegram-channel";
import { createStepTracker } from "@/lib/ai/tool-call-guardian";
import { injectDevMode } from "@/lib/prompts/builder/dev-mode-inject";
import { researchTopics, type ResearchProgressEvent } from "@/lib/briefing/research-engine";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";
import type { Project } from "@/lib/db/schema";

// Load prompt templates from .md files
const PROMPTS_DIR = path.join(process.cwd(), "lib", "prompts", "service-chats");

const SECRETARY_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(PROMPTS_DIR, "project-creation.md"),
  "utf-8"
);

const MANAGER_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(PROMPTS_DIR, "project-manager.md"),
  "utf-8"
);

const BRIEFING_ONBOARDING_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(PROMPTS_DIR, "briefing-onboarding.md"),
  "utf-8"
);

export const maxDuration = 120;

// Supported service chat contexts
type ServiceChatContext = "ben" | "project-creation" | "project-manager" | "briefing-onboarding";

// Message part schema (from useChat)
const messagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
});

// Request schema - supports both formats
const requestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["user", "assistant"]),
      // Support both content string and parts array
      content: z.string().optional(),
      parts: z.array(messagePartSchema).optional(),
    })
  ),
  context: z.enum(["ben", "project-creation", "project-manager", "briefing-onboarding"]),
  projectId: z.string().optional(), // For project-manager
  isFirstTime: z.boolean().optional(), // For ben onboarding
  briefingMode: z.enum(["create", "edit"]).optional(), // For briefing-onboarding
});

/**
 * Extract text content from message (handles both formats)
 */
function extractMessageContent(message: {
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (message.content) {
    return message.content;
  }
  if (message.parts) {
    return message.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("");
  }
  return "";
}

/**
 * Get model ID based on context
 */
function getModelId(context: ServiceChatContext): string {
  switch (context) {
    case "project-creation":
      return "claude-sonnet";
    case "briefing-onboarding":
      return "claude-sonnet-4-6";
    case "ben":
    case "project-manager":
      return "claude-haiku";
    default:
      return "claude-haiku";
  }
}

/**
 * Build system prompt based on context
 */
async function buildSystemPrompt(
  context: ServiceChatContext,
  options: {
    userName?: string;
    userOccupation?: string;
    userPronouns?: string;
    userBio?: string;
    projectId?: string;
    briefingMode?: "create" | "edit";
    userId?: string;
  } = {}
): Promise<string> {
  switch (context) {
    case "ben": {
      const benPrompt = buildBenPrompt({}, false);
      return benPrompt.systemPrompt;
    }

    case "project-creation":
      return buildProjectCreationPrompt(options);

    case "project-manager":
      return await buildFullManagerPrompt(options.projectId);

    case "briefing-onboarding":
      return await buildBriefingOnboardingPrompt(options);

    default:
      return "Ты — AI-помощник Simply.";
  }
}

/**
 * Build project creation prompt — Secretary (ТЗ-12)
 */
function buildProjectCreationPrompt(options: {
  userName?: string;
  userOccupation?: string;
  userPronouns?: string;
  userBio?: string;
}): string {
  const contextLines: string[] = [];
  if (options.userName) contextLines.push(`Имя: ${options.userName}`);
  if (options.userPronouns) contextLines.push(`Обращение: ${options.userPronouns}`);
  if (options.userOccupation) contextLines.push(`Сфера деятельности: ${options.userOccupation}`);
  if (options.userBio) contextLines.push(`О пользователе: ${options.userBio}`);

  const userContextBlock = contextLines.length > 0
    ? `<user_context>\n${contextLines.join("\n")}\n</user_context>`
    : "";

  return SECRETARY_PROMPT_TEMPLATE.replace("{{USER_CONTEXT}}", userContextBlock);
}

// ============================================================================
// ТЗ-A2: Briefing Onboarding Prompt Builder
// ============================================================================

/**
 * Build briefing onboarding prompt: template + user context + date/year + mode injection
 */
async function buildBriefingOnboardingPrompt(options: {
  userName?: string;
  userOccupation?: string;
  userPronouns?: string;
  userBio?: string;
  briefingMode?: "create" | "edit";
  userId?: string;
}): Promise<string> {
  // 1. USER_CONTEXT — same pattern as Secretary
  const contextLines: string[] = [];
  if (options.userName) contextLines.push(`Имя: ${options.userName}`);
  if (options.userPronouns) contextLines.push(`Обращение: ${options.userPronouns}`);
  if (options.userOccupation) contextLines.push(`Профессия: ${options.userOccupation}`);
  if (options.userBio) contextLines.push(`О себе: ${options.userBio}`);

  const userContextBlock = contextLines.length > 0
    ? `<user_context>\n${contextLines.join("\n")}\n</user_context>`
    : "";

  // 2. DATE and YEAR
  const now = new Date();
  const dateISO = now.toISOString().split("T")[0]; // "2026-02-20"
  const year = now.getFullYear().toString(); // "2026"

  // 3. MODE_INJECTION — depends on briefingMode
  const mode = options.briefingMode ?? "create";
  let modeInjection: string;

  if (mode === "edit" && options.userId) {
    modeInjection = await buildBriefingEditModeInjection(options.userId);
  } else {
    // Static create mode block
    modeInjection = `<mode>
Режим: первая настройка. У пользователя нет профиля брифинга.
Начни с приветствия и открытого вопроса.
</mode>`;
  }

  // 4. Assemble prompt
  return BRIEFING_ONBOARDING_PROMPT_TEMPLATE
    .replace("{{USER_CONTEXT}}", userContextBlock)
    .replace(/\{\{DATE\}\}/g, dateISO)
    .replace(/\{\{YEAR\}\}/g, year)
    .replace("{{MODE_INJECTION}}", modeInjection);
}

/**
 * Build edit mode injection: current topics, sources, settings from DB
 */
async function buildBriefingEditModeInjection(userId: string): Promise<string> {
  const [settings, topics, sources] = await Promise.all([
    getBriefingSettings({ userId }),
    getBriefingTopics({ userId }),
    getBriefingSources({ userId }),
  ]);

  const volumeLabels: Record<string, string> = { compact: "компактный", standard: "стандартный", detailed: "подробный" };
  const settingsLines: string[] = [];
  settingsLines.push(`- Часовой пояс: ${settings?.timezone ?? "Europe/Moscow"}`);
  settingsLines.push(`- Язык источников: ${settings?.language ?? "ru"}`);
  settingsLines.push(`- Объём: ${volumeLabels[settings?.volume ?? "standard"] ?? "стандартный"}`);
  settingsLines.push(`- Количество новостей: ${settings?.maxItems ?? 15}`);

  const topicsLines = topics.length > 0
    ? topics.map(t => {
        const base = `- ${t.emoji} ${t.topicName} (id: ${t.topicId})`;
        return t.briefingStyle ? `${base}: "${t.briefingStyle}"` : base;
      }).join("\n")
    : "- (нет тем)";

  const sourcesLines = sources.length > 0
    ? sources.map(s => `- [${s.topicId}] ${s.sourceName} — ${s.sourceUrl} (${s.tier})`).join("\n")
    : "- (нет источников)";

  return `<mode>
Режим: изменение настроек. У пользователя есть профиль.

Текущие настройки:
${settingsLines.join("\n")}

Текущие темы:
${topicsLines}

Текущие источники:
${sourcesLines}

Начни с краткого показа текущих настроек и вопроса что хочет изменить.
</mode>`;
}

// ============================================================================
// ТЗ-A3: Manager Prompt Builder (from .md template + mode injection)
// ============================================================================

/**
 * Build full manager prompt: base template + mode injection based on project phase
 */
async function buildFullManagerPrompt(projectId?: string): Promise<string> {
  if (!projectId) {
    // Fallback if no projectId (shouldn't happen in normal flow)
    return MANAGER_PROMPT_TEMPLATE.replace("{{MODE_INJECTION}}", "");
  }

  // Load project data
  const projectData = await getProjectById({ id: projectId });
  if (!projectData) {
    return MANAGER_PROMPT_TEMPLATE.replace("{{MODE_INJECTION}}", "");
  }

  // Count files for context
  const files = await getFilesByProjectId({ projectId });
  const fileCount = files.length;

  // Build mode injection based on phase
  const modeInjection = await buildModeInjection(projectData, fileCount);

  return MANAGER_PROMPT_TEMPLATE.replace("{{MODE_INJECTION}}", modeInjection);
}

/**
 * Route to correct mode injection based on project phase
 */
async function buildModeInjection(project: Project, fileCount: number): Promise<string> {
  const phase = project.phase;

  if (phase === "setup" || phase === "documents" || phase === "planning") {
    return buildFirstContactMode(project, fileCount);
  } else if (phase === "approved") {
    return await buildPlanPresentationMode(project);
  } else if (phase === "execution" || phase === "completed") {
    return buildNavigationStub(project);
  }

  // Default to first_contact
  return buildFirstContactMode(project, fileCount);
}

/**
 * Mode 1: First Contact (phase = setup/documents/planning)
 * Manager greets user, shows file summary, suggests next steps
 */
function buildFirstContactMode(project: Project, fileCount: number): string {
  // Build passport section
  const passportParts = [project.name];
  if (project.description) passportParts.push(project.description);
  if (project.context) passportParts.push(project.context);

  const passport = `<project_passport>\n${passportParts.join("\n")}\n</project_passport>`;

  // Build files status section
  let filesStatus: string;
  const manifest = project.manifestJson;
  const hasManifestFiles = manifest && manifest.files && manifest.files.length > 0;

  if (fileCount === 0) {
    filesStatus = `<files_status>\n<no_files>Пользователь ещё не загружал файлы в проект.</no_files>\n</files_status>`;
  } else if (!hasManifestFiles) {
    filesStatus = `<files_status>\n<no_files>Файлы загружены (${fileCount}), но ещё не проанализированы.</no_files>\n</files_status>`;
  } else {
    const manifestFiles = manifest.files;

    // Count files per folder
    const folderCounts = new Map<string, number>();
    const unclearFiles: string[] = [];
    for (const f of manifestFiles) {
      folderCounts.set(f.folder, (folderCounts.get(f.folder) || 0) + 1);
      if (f.relevance === "unclear") {
        unclearFiles.push(f.name);
      }
    }

    const foldersStr = Array.from(folderCounts.entries())
      .map(([folder, count]) => `  ${folder}: ${count} файл(ов)`)
      .join("\n");

    const unclearStr = unclearFiles.length > 0
      ? `  Требуют уточнения: ${unclearFiles.join(", ")}`
      : "  Требуют уточнения: нет";

    filesStatus = `<files_status>
<manifest>
${JSON.stringify(manifestFiles, null, 2)}
</manifest>
<file_stats>
  Всего файлов: ${manifestFiles.length}
  Папки:
${foldersStr}
${unclearStr}
</file_stats>
</files_status>`;
  }

  // Professor plan context
  const planData = project.planJson as Record<string, unknown> | null;
  const hasPlan = planData && (planData.status === "complete" || planData.status === "partial");

  let planSection = "";
  if (hasPlan) {
    const tasks = (planData.tasks as Array<{ order: number; title: string; goal: string; tools: string[]; needsReview: boolean }>) || [];
    const risks = (planData.risks as Array<{ description: string; severity: string; mitigation: string }>) || [];
    const recommendations = (planData.recommendations as Array<{ type: string; description: string; impact: string }>) || [];

    const tasksList = tasks.map(t => `  ${t.order}. ${t.title} — ${t.goal}${t.needsReview ? " [требует проверки]" : ""} (инструменты: ${t.tools.join(", ")})`).join("\n");
    const risksList = risks.map(r => `  - [${r.severity}] ${r.description} → ${r.mitigation}`).join("\n");
    const recsList = recommendations.map(r => `  - [${r.type}] ${r.description} (${r.impact})`).join("\n");

    planSection = `<professor_plan>
<plan_status>${planData.status}</plan_status>
<tasks>
${tasksList}
</tasks>
<risks>
${risksList}
</risks>
<recommendations>
${recsList}
</recommendations>
</professor_plan>`;
  }

  return `<current_phase>first_contact</current_phase>

${passport}

${filesStatus}

<professor_enabled>${hasPlan}</professor_enabled>

${planSection}

<mode_instructions>
Это первый контакт с пользователем в проекте. Твои задачи:

1. ПОКАЖИ ЧТО ПОНЯЛ ПРОЕКТ. Упомяни 1-2 конкретные детали из паспорта. Не пересказывай весь паспорт — покажи что вник. Например: «Вижу, что проект про рекламное агентство с фокусом на SEO и брендинг. Серьёзная задача.»

2. ПОКАЖИ СОСТОЯНИЕ ФАЙЛОВ (если есть).
   - Если файлов нет: предложи загрузить. «Для серьёзного планирования пригодятся материалы — документы, данные, примеры. Загрузите что есть, я разберу.»
   - Если файлы разобраны: покажи краткую сводку. Сколько файлов, как разложены по папкам. Если есть файлы с relevance "unclear" — спроси про них конкретно: «Файл "записки.txt" — это рабочий материал или личные заметки?»
   - НЕ перечисляй каждый файл. Пользователь видит их в панели «Файлы» слева.

3. ЕСЛИ ЕСТЬ ПЛАН (professor_enabled = true):
   - Ты знаешь план проекта — задачи, риски и рекомендации. Используй их при ответах на вопросы пользователя.
   - Если пользователь спрашивает о плане — ссылайся на конкретные задачи, риски, рекомендации.
   - Если plan_status = "partial" — предупреди что план составлен с оговорками, некоторые моменты требуют уточнения.
   - НЕ пересказывай весь план целиком — пользователь видит его в рабочей области справа.

4. ПРЕДЛОЖИ СЛЕДУЮЩИЙ ШАГ.
   - Если файлов нет: «Загрузите материалы — или можем начать планирование с тем что есть.»
   - Если файлы есть и план готов: «План составлен. Посмотрите его справа — если есть вопросы, обсудим.»
   - Если файлы есть но плана нет: «Материалы разобраны. Готовы к планированию?»
   - Если есть unclear файлы: сначала уточни их, потом предложи планирование.

НЕ перечисляй все пункты как список. Это должно звучать как естественный разговор — приветствие, пара фраз о проекте, предложение.
</mode_instructions>`;
}

/**
 * Mode 2: Plan Presentation (phase = approved) — ТЗ-B2
 * Manager knows the plan is approved and sees task statuses
 */
async function buildPlanPresentationMode(project: Project): Promise<string> {
  // Load ProjectTask[] for task statuses
  const projectTasks = await getProjectTasksByProjectId({ projectId: project.id });

  const taskStatusesXml = projectTasks.length > 0
    ? projectTasks.map(t =>
        `  <task order="${t.orderIndex}" status="${t.status}">${t.title}</task>`
      ).join("\n")
    : "  <no_tasks/>";

  const statusCounts = projectTasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statsLine = Object.entries(statusCounts)
    .map(([status, count]) => `${status}: ${count}`)
    .join(", ");

  return `<current_phase>plan_presentation</current_phase>

<project_passport>
${project.name}
${project.description || ""}
</project_passport>

<task_statuses total="${projectTasks.length}" summary="${statsLine}">
${taskStatusesXml}
</task_statuses>

<mode_instructions>
План проекта утверждён. Ты видишь список задач и их статусы выше.

Твои задачи:
1. Отвечай на вопросы пользователя о плане и задачах — ссылайся на конкретные задачи по номеру.
2. Если пользователь спрашивает «что дальше» — укажи на первую задачу со статусом pending.
3. Задачи со статусом locked заблокированы зависимостями — объясняй это при вопросах.
4. Помогай пользователю понять порядок выполнения и зависимости между задачами.
5. НЕ пересказывай весь план целиком — пользователь видит его в панели «Пульс» слева и в рабочей области.
</mode_instructions>`;
}

/**
 * Mode 3: Navigation (phase = execution/completed) — stub for ТЗ-C1
 */
function buildNavigationStub(project: Project): string {
  return `<current_phase>navigation</current_phase>

<project_passport>
${project.name}
${project.description || ""}
</project_passport>

<mode_instructions>
Режим навигации будет реализован в следующем обновлении.
Пока помогай пользователю с общими вопросами о проекте и его текущем состоянии.
</mode_instructions>`;
}

// ============================================================================
// GET /api/service-chat — Load persisted messages
// ============================================================================

/**
 * GET /api/service-chat?context=project-manager&projectId=xxx
 * Returns saved messages for a persistent service chat
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const url = new URL(request.url);
    const context = url.searchParams.get("context");
    const projectId = url.searchParams.get("projectId");

    if (context === "project-manager" && projectId) {
      const managerChat = await findManagerChat({ projectId });

      if (!managerChat) {
        return Response.json({ messages: [] });
      }

      // Load messages (reuse existing function with relaxed limits for service chats)
      const dbMessages = await getMessagesByChatId({
        id: managerChat.id,
        maxTokens: 50000,
        minMessages: 50,
        maxMessages: 100,
      });

      // Convert to useChat-compatible format
      const messages = dbMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: msg.parts,
      }));

      return Response.json({ chatId: managerChat.id, messages });
    }

    return Response.json({ messages: [] });
  } catch (error) {
    console.error("[ServiceChat GET] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to load messages" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// POST /api/service-chat — Streaming chat with optional persistence
// ============================================================================

/**
 * POST /api/service-chat
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new ChatSDKError("bad_request:api").toResponse();
    }

    const { messages, context, projectId, briefingMode } = parsed.data;
    const userId = session.user.id!;

    // Get user profile
    const user = await getUserById(userId);
    const userName = user?.displayName || undefined;
    const userOccupation = user?.occupation || undefined;
    const userPronouns = user?.pronouns || undefined;
    const userBio = user?.bio || undefined;

    // Build system prompt (async for project-manager and briefing-onboarding)
    const systemPrompt = await buildSystemPrompt(context, {
      userName,
      userOccupation,
      userPronouns,
      userBio,
      projectId,
      briefingMode,
      userId,
    });

    // Get model
    const modelId = getModelId(context);

    // Build tools based on context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};

    // Add updateProjectDraft tool for project-creation context
    // v3.9.0: Live Preview — обновляет черновик, не создаёт проект
    if (context === "project-creation") {
      const updateProjectDraftSchema = z.object({
        name: z
          .string()
          .optional()
          .describe("Название проекта (2-5 слов, отражает суть)"),
        description: z
          .string()
          .optional()
          .describe("Краткое описание проекта (2-4 предложения)"),
        context: z
          .string()
          .optional()
          .describe("Контекст проекта — справка о бизнесе, аудитории, целях. Заполняется на основе интервью."),
      });

      tools.updateProjectDraft = tool({
        description:
          "Обновить черновик проекта. Вызывай по мере получения информации — не жди всех данных. Можно вызывать несколько раз для уточнения.",
        inputSchema: updateProjectDraftSchema,
        execute: async (input: z.infer<typeof updateProjectDraftSchema>) => {
          return {
            success: true,
            draft: {
              name: input.name || null,
              description: input.description || null,
              context: input.context || null,
            },
          };
        },
      });
    }

    // ТЗ-FIX2: Shared references for briefing-onboarding (closure pattern)
    // progressRef.write is set inside createUIMessageStream execute, used by startResearch
    // verifiedSourceUrls is filled by startResearch, checked by saveBriefingProfile
    const progressRef: { write: ((event: { type: `data-${string}`; data: unknown; transient?: boolean }) => void) | null } = { write: null };
    const verifiedSourceUrls = new Set<string>();

    // ТЗ-A2 + ТЗ-FIX2: Tools for briefing-onboarding context
    // Tools are split by briefingMode: create gets startResearch, edit gets deepResearch/fetchUrl/readTelegramChannel
    if (context === "briefing-onboarding") {
      const isCreateMode = briefingMode !== "edit";

      const briefingProfileSchema = z.object({
        topics: z.array(z.object({
          topicId: z.string().describe("Латиница, slug, lowercase"),
          topicName: z.string().describe("Название темы на русском"),
          emoji: z.string().describe("Одна emoji для темы"),
          briefingStyle: z.string().optional().describe("Инструкция автору: глубина, фокус, стиль подачи по этой теме (1-3 предложения)"),
        })).describe("Список тем брифинга (макс. 8)"),
        sources: z.array(z.object({
          topicId: z.string().describe("ID темы к которой относится источник"),
          sourceName: z.string().describe("Название источника"),
          sourceUrl: z.string().describe("URL источника"),
          rssUrl: z.string().nullable().optional().describe("RSS URL если найден"),
          fetchMethod: z.enum(["rss", "telegram_parse", "jina"]).describe("Метод получения контента"),
          sourceLanguage: z.enum(["ru", "en"]).describe("Язык источника"),
          tier: z.enum(["flagship", "respected", "niche", "community"]).describe("Уровень источника"),
        })).describe("Список источников (макс. 25)"),
        settings: z.object({
          timezone: z.string().default("Europe/Moscow").optional(),
          language: z.enum(["ru", "en", "both"]).default("ru").optional(),
          maxItems: z.number().min(5).max(30).default(15).optional(),
          volume: z.enum(["compact", "standard", "detailed"]).default("standard").optional().describe("Объём брифинга: compact (3-5 мин), standard (8-12 мин), detailed (15-25 мин)"),
        }).optional().describe("Настройки брифинга"),
      });

      // ТЗ-FIX2: create mode — startResearch (server-side orchestration)
      if (isCreateMode) {
        tools.startResearch = tool({
          description: `Автоматический поиск и верификация источников для брифинга. Вызывай ОДИН РАЗ когда темы определены и briefingStyle сформирован. Передай все темы одним массивом. Не описывай процесс — пользователь видит прогресс автоматически.`,
          inputSchema: z.object({
            topics: z.array(z.object({
              topicId: z.string().describe("Slug ID темы (латиница, lowercase)"),
              topicName: z.string().describe("Название темы на русском"),
              emoji: z.string().describe("Emoji темы"),
              briefingStyle: z.string().describe("Стиль подачи для темы"),
            })).describe("Темы для исследования (макс. 8)"),
          }),
          execute: async ({ topics }) => {
            console.log("[startResearch] Starting for topics:", topics.map(t => t.topicName));

            const result = await researchTopics(topics, (event: ResearchProgressEvent) => {
              // ТЗ-FIX2: Stream progress to client via shared closure
              // data- prefix required by AI SDK v5 UIMessage Stream Protocol for custom types
              // transient: true prevents saving progress events in message history (GitHub #7450)
              progressRef.write?.({ type: "data-research-progress", data: event, transient: true });
            });

            // ТЗ-FIX2: Populate verified URL set for saveBriefingProfile validation
            for (const topicResult of result.results) {
              for (const source of topicResult.sources) {
                verifiedSourceUrls.add(source.sourceUrl);
              }
            }

            console.log("[startResearch] Done:", {
              success: result.success,
              totalSources: result.totalSources,
              totalVerified: result.totalVerified,
              verifiedUrls: verifiedSourceUrls.size,
            });

            return result;
          },
        });
      }

      // ТЗ-FIX2: edit mode — individual tools for manual source management
      if (!isCreateMode) {
        // deepResearch with default depth "pro" for source discovery
        tools.deepResearch = deepResearch({ defaultDepth: "pro" });

        // fetchUrl for verifying specific sources
        tools.fetchUrl = fetchUrl;

        // ТЗ-TG2: readTelegramChannel for validating Telegram channels
        tools.readTelegramChannel = readTelegramChannel;
      }

      // Shared tools for both modes
      tools.updateBriefingPreview = tool({
        description: "Обновить превью профиля брифинга в реальном времени. Вызывай с ПОЛНЫМ текущим списком тем и источников.",
        inputSchema: briefingProfileSchema,
        execute: async (input: z.infer<typeof briefingProfileSchema>) => {
          return { success: true, preview: input };
        },
      });

      tools.saveBriefingProfile = tool({
        description: "Финальное сохранение профиля брифинга в БД. Вызывай только когда пользователь подтвердил настройки.",
        inputSchema: briefingProfileSchema,
        execute: async (input: z.infer<typeof briefingProfileSchema>) => {
          // ТЗ-FIX2: Load existing sources from DB (for edit mode — old sources are trusted)
          const existingSources = await getBriefingSources({ userId });
          const existingSourceUrls = new Set(existingSources.map(s => s.sourceUrl));

          // ТЗ-FIX2: Filter sources — accept only verified (this session) or existing (in DB)
          const acceptedSources = input.sources.filter(s => {
            const isVerified = verifiedSourceUrls.has(s.sourceUrl);
            const isExisting = existingSourceUrls.has(s.sourceUrl);
            if (!isVerified && !isExisting) {
              console.warn(`[saveBriefingProfile] Rejected unverified source: ${s.sourceUrl} (${s.sourceName})`);
              return false;
            }
            return true;
          });

          if (acceptedSources.length < input.sources.length) {
            console.warn(`[saveBriefingProfile] Filtered ${input.sources.length - acceptedSources.length} unverified sources`);
          }

          // 1. Upsert settings
          await upsertBriefingSettings({
            userId,
            isActive: true,
            timezone: input.settings?.timezone ?? "Europe/Moscow",
            language: input.settings?.language ?? "ru",
            maxItems: input.settings?.maxItems ?? 15,
            volume: input.settings?.volume ?? "standard",
          });

          // 2. Replace all topics
          await deleteAllBriefingTopicsByUser({ userId });
          for (let i = 0; i < input.topics.length; i++) {
            const t = input.topics[i];
            await addBriefingTopic({
              userId,
              topicId: t.topicId,
              topicName: t.topicName,
              emoji: t.emoji,
              orderIndex: i,
              briefingStyle: t.briefingStyle ?? null,
            });
          }

          // 3. Replace all sources (only accepted)
          await deleteAllBriefingSourcesByUser({ userId });
          for (const s of acceptedSources) {
            await addBriefingSource({
              userId,
              topicId: s.topicId,
              sourceName: s.sourceName,
              sourceUrl: s.sourceUrl,
              rssUrl: s.rssUrl ?? undefined,
              fetchMethod: s.fetchMethod,
              sourceLanguage: s.sourceLanguage,
              tier: s.tier,
            });
          }

          return {
            success: true,
            topicsCount: input.topics.length,
            sourcesCount: acceptedSources.length,
            ...(acceptedSources.length < input.sources.length ? {
              filteredCount: input.sources.length - acceptedSources.length,
            } : {}),
          };
        },
      });
    }

    // ТЗ-A3: Server persistence for project-manager
    let managerChatId: string | null = null;
    if (context === "project-manager" && projectId) {
      const managerChat = await getOrCreateManagerChat({ projectId, userId });
      managerChatId = managerChat.id;

      // Save the new user message (last in the messages array)
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        const userText = extractMessageContent(lastMessage);
        await saveMessages({
          messages: [{
            id: lastMessage.id || generateUUID(),
            chatId: managerChatId,
            role: "user",
            parts: [{ type: "text", text: userText }],
            attachments: [],
            createdAt: new Date(),
            tokenCount: 0,
          }],
        });
      }
    }

    // Transform messages to content format for streamText
    const transformedMessages = messages.map((msg) => ({
      role: msg.role,
      content: extractMessageContent(msg),
    }));

    // Dynamic step count:
    // - briefing create: ~10 steps (interview + startResearch + updatePreview + save)
    // - briefing edit: 30 steps (deepResearch + fetchUrl + readTelegramChannel per source)
    // - other contexts: 3 steps
    const maxSteps = context === "briefing-onboarding"
      ? (briefingMode === "edit" ? 30 : 10)
      : 3;

    // ТЗ-FIX2: Inject DEV mode into system prompt (no-op when SIMPLY_DEV_MODE !== 'true')
    const finalSystemPrompt = injectDevMode(systemPrompt, context);

    // Stream response
    const result = streamText({
      model: myProvider.languageModel(modelId),
      system: finalSystemPrompt,
      messages: transformedMessages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(maxSteps),
      temperature: context === "project-manager" ? 0.5 : 1.0,
      // Adaptive thinking for briefing-onboarding (Sonnet 4.6): multi-step tool calling, source evaluation
      ...(context === "briefing-onboarding" ? {
        providerOptions: {
          anthropic: {
            thinking: { type: "adaptive" as const },
            effort: "high" as const,
          },
        },
      } : {}),
    });

    // ТЗ-A3: Save assistant response after streaming completes
    if (managerChatId) {
      const chatId = managerChatId;
      result.text.then(async (fullText) => {
        if (fullText) {
          await saveMessages({
            messages: [{
              id: generateUUID(),
              chatId,
              role: "assistant",
              parts: [{ type: "text", text: fullText }],
              attachments: [],
              createdAt: new Date(),
              tokenCount: 0,
            }],
          });
        }
      }).catch((err) => {
        console.error("[ServiceChat] Failed to save assistant message:", err);
      });
    }

    // ТЗ-FIX1: Guardian step tracker for hallucination detection
    const guardianTracker = createStepTracker({ context });

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        // ТЗ-FIX2: Wire progress writer — startResearch can now stream events to client
        progressRef.write = (event) => {
          try {
            dataStream.write(event);
          } catch (err) {
            console.error("[progressRef.write] Failed to write progress event:", err);
          }
        };

        // ТЗ-FIX2: Emit model info for dev UI badge
        {
          const DISPLAY: Record<string, string> = {
            "claude-haiku": "Haiku",
            "claude-sonnet": "Sonnet",
            "claude-sonnet-4-6": "Sonnet 4.6",
            "claude-opus": "Opus",
          };
          dataStream.write({
            type: "data-model-info",
            data: { modelId, modelName: DISPLAY[modelId] || modelId },
          });
        }

        // consumeStream() must be inside execute to avoid race condition with toUIMessageStream()
        // (matches chat/route.ts pattern — consume + toUIMessageStream in same scope)
        result.consumeStream();
        const baseStream = result.toUIMessageStream();

        const instrumentedStream = new ReadableStream({
          async start(controller) {
            const reader = baseStream.getReader();

            // ТЗ-FIX1.2: Text-related events to buffer (text-start/delta/end must stay in order)
            const textBufferTypes = new Set([
              "text-start", "text-delta", "text-end",
              "reasoning-start", "reasoning-delta", "reasoning-end",
            ]);
            let stepTextBuffer: Array<unknown> = [];
            let consecutiveHallucinations = 0;

            try {
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
                  console.warn(`[Guardian:${context}] Stream ended with detections:`, {
                    count: guardianFlags.count,
                    details: guardianFlags.details.map(d => ({
                      step: d.step,
                      tool: d.toolMentioned,
                      pattern: d.pattern,
                    })),
                  });
                }
                console.log(`[InstrumentedStream:${context}] Stream completed normally`);
                controller.close();
                break;
              }

              if (value && typeof value === "object" && "type" in value) {
                const eventType = (value as any).type;

                // ТЗ-FIX1.2: Guardian — track step boundaries (UI stream uses start-step/finish-step)
                if (eventType === "start-step") {
                  guardianTracker.reset();
                }

                // ТЗ-FIX1.2: Buffer text-related events (text-start/delta/end must arrive in order)
                if (textBufferTypes.has(eventType)) {
                  if (eventType === "text-delta") {
                    const chunk = (value as any).delta ?? "";
                    if (chunk) {
                      guardianTracker.addText(chunk);
                    }
                  }
                  stepTextBuffer.push(value);
                  continue; // Do NOT enqueue — buffered until finish-step
                }

                if (eventType === "tool-input-start") {
                  const toolName = (value as any).toolName || "unknown";
                  guardianTracker.addToolCall(toolName);
                }

                if (eventType === "finish-step") {
                  const guardianResult = guardianTracker.analyze();

                  if (guardianResult.detected) {
                    // ТЗ-FIX1.2: Block — do NOT flush text buffer
                    console.warn(`[Guardian:${context}] Blocked hallucinated step (${stepTextBuffer.length} chunks suppressed)`);
                    stepTextBuffer = [];
                    consecutiveHallucinations++;

                    if (consecutiveHallucinations >= 2) {
                      console.warn(`[Guardian:${context}] Max retries exceeded, showing error to user`);
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
                }
              }

              // Enqueue all non-buffered events immediately
              controller.enqueue(value);
            }
            } catch (streamError) {
              console.error(`[InstrumentedStream:${context}] Stream error:`, streamError);
              controller.error(streamError);
            }
          },
        });

        dataStream.merge(instrumentedStream);
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    console.error("[ServiceChat] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
