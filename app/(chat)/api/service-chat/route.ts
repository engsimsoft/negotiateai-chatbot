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

import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { buildBenPrompt } from "@/lib/prompts/server";
import { getUserById, saveProject } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

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
    case "ben":
    case "project-creation":
    case "project-manager": // ⚠️ Временно Gemini вместо Claude
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
 * Build project creation prompt
 */
function buildProjectCreationPrompt(options: {
  userName?: string;
  userOccupation?: string;
}): string {
  const userName = options.userName || "пользователь";

  return `Ты — Simply, AI-ассистент для создания проектов. Твоя задача — помочь ${userName} создать новый проект.

## Твои задачи

1. **Понять суть проекта** — задай 1-2 уточняющих вопроса если нужно:
   - Какая цель проекта?
   - Для кого/чего это?
   - Есть ли дедлайны или особенности?

2. **Сформулировать паспорт проекта:**
   - Название (2-5 слов, отражает суть)
   - Описание (1-2 предложения)
   - Инструкция для AI (контекст для будущей работы)

3. **Создать проект** — когда у тебя достаточно информации, вызови инструмент createProject.

## Правила

- Будь дружелюбным и кратким
- Не задавай больше 2-3 вопросов подряд
- Если пользователь сразу даёт чёткое описание — сразу создавай проект
- Говори на русском языке
- Обращайся на "ты"`;
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

    // Build system prompt
    const systemPrompt = buildSystemPrompt(context, {
      userName,
      userOccupation,
    });

    // Get model
    const modelId = getModelId(context);

    // Build tools based on context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {};

    // Add createProject tool for project-creation context
    if (context === "project-creation") {
      const createProjectSchema = z.object({
        name: z
          .string()
          .describe("Название проекта (2-5 слов, отражает суть)"),
        description: z
          .string()
          .describe("Краткое описание проекта (1-2 предложения)"),
        instruction: z
          .string()
          .describe("Системная инструкция для AI при работе с этим проектом"),
      });

      tools.createProject = tool({
        description:
          "Создать новый проект когда у тебя есть достаточно информации: название и понимание цели проекта.",
        inputSchema: createProjectSchema,
        execute: async (input: z.infer<typeof createProjectSchema>) => {
          const project = await saveProject({
            id: generateUUID(),
            userId,
            name: input.name,
            description: input.description,
            instruction: input.instruction,
          });
          return {
            success: true,
            projectId: project.id,
            projectName: project.name,
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
