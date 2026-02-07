/**
 * ServiceChat API Endpoint
 *
 * Unified streaming chat endpoint for all service assistants:
 * - ben: Help assistant
 * - project-creation: AI-assisted project creation
 * - project-manager: Project management tasks
 *
 * ТЗ-09: ServiceChat унификация
 */

import fs from "fs";
import path from "path";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { buildBenPrompt } from "@/lib/prompts/server";
import { getUserById } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

// Load Secretary prompt template from .md file (ТЗ-12)
const SECRETARY_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "service-chats",
  "project-creation.md"
);
const SECRETARY_PROMPT_TEMPLATE = fs.readFileSync(
  SECRETARY_PROMPT_PATH,
  "utf-8"
);

export const maxDuration = 60;

// Supported service chat contexts
type ServiceChatContext = "ben" | "project-creation" | "project-manager";

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
  context: z.enum(["ben", "project-creation", "project-manager"]),
  projectId: z.string().optional(), // For project-manager
  isFirstTime: z.boolean().optional(), // For ben onboarding
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
 *
 * ⚠️ ВРЕМЕННО (v3.7.1): Все на Gemini, Claude отключён
 * См. ADR 011: docs/decisions/011-temporary-gemini-for-projects.md
 */
function getModelId(context: ServiceChatContext): string {
  switch (context) {
    case "project-creation":
      return "gemini-3-pro"; // ТЗ-12: Секретарь — нужна Pro модель для качественного интервью
    case "ben":
    case "project-manager":
      return "gemini-2.5-flash";
    default:
      return "gemini-2.5-flash";
  }
}

/**
 * Build system prompt based on context
 */
function buildSystemPrompt(
  context: ServiceChatContext,
  options: {
    userName?: string;
    userOccupation?: string;
    userPronouns?: string;
    userBio?: string;
    projectName?: string;
  } = {}
): string {
  switch (context) {
    case "ben":
      // Use existing Ben prompt builder
      const benPrompt = buildBenPrompt({}, false);
      return benPrompt.systemPrompt;

    case "project-creation":
      return buildProjectCreationPrompt(options);

    case "project-manager":
      return buildProjectManagerPrompt(options);

    default:
      return "Ты — AI-помощник Simply.";
  }
}

/**
 * Build project creation prompt — Secretary (ТЗ-12)
 *
 * Загружает XML-промпт из .md файла, подставляет динамический <user_context>.
 * Пустые поля профиля не включаются в промпт.
 */
function buildProjectCreationPrompt(options: {
  userName?: string;
  userOccupation?: string;
  userPronouns?: string;
  userBio?: string;
}): string {
  // Динамический <user_context> — пустые поля не включать
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

/**
 * Build project manager prompt
 */
function buildProjectManagerPrompt(options: {
  userName?: string;
  projectName?: string;
}): string {
  const projectName = options.projectName || "этот проект";

  return `Ты — менеджер проекта "${projectName}" в Simply. Помогаешь пользователю организовать работу.

## Твои возможности

- Разобрать файлы по папкам
- Подвести итог по проекту
- Обновить инструкцию проекта
- Разбить цель на конкретные задачи
- Ответить на вопросы о проекте

## Правила

- Будь конкретным и действенным
- Предлагай конкретные шаги
- Говори на русском языке
- Обращайся на "ты"

## Примечание

В текущей версии у тебя пока нет доступа к инструментам для модификации проекта.
Ты можешь давать советы и рекомендации, которые пользователь применит вручную.`;
}

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

    const { messages, context, projectId, isFirstTime } = parsed.data;
    const userId = session.user.id!;

    // Get user profile
    const user = await getUserById(userId);
    const userName = user?.displayName || undefined;
    const userOccupation = user?.occupation || undefined;
    const userPronouns = user?.pronouns || undefined;
    const userBio = user?.bio || undefined;

    // Build system prompt
    const systemPrompt = buildSystemPrompt(context, {
      userName,
      userOccupation,
      userPronouns,
      userBio,
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
          // Не создаём проект — просто возвращаем данные для frontend
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

    // Transform messages to content format for streamText
    const transformedMessages = messages.map((msg) => ({
      role: msg.role,
      content: extractMessageContent(msg),
    }));

    // Stream response
    const result = streamText({
      model: myProvider.languageModel(modelId),
      system: systemPrompt,
      messages: transformedMessages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      stopWhen: stepCountIs(3), // Allow tool execution and follow-up response
      temperature: 1.0,
    });

    return result.toUIMessageStreamResponse();
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
