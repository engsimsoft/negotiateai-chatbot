import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { getUserById, saveProject } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

export const maxDuration = 60;

// Схема сообщения
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

// Схема запроса
const requestSchema = z.object({
  id: z.string(),
  messages: z.array(messageSchema),
  context: z.object({
    type: z.literal("create-project"),
    userProfile: z
      .object({
        displayName: z.string().nullish(),
        occupation: z.string().nullish(),
        bio: z.string().nullish(),
      })
      .optional(),
  }),
});

/**
 * POST /api/universal-dialog
 *
 * ТЗ-07A: Universal Dialog для создания проектов
 *
 * Simply ведёт диалог с пользователем, задаёт уточняющие вопросы,
 * и когда получает достаточно информации — создаёт проект.
 */
export async function POST(request: Request) {
  // Флаг для отладки — возвращает детали ошибки в ответе
  const DEBUG = true;

  try {
    console.log("[Universal Dialog] POST request received");

    const session = await auth();
    console.log("[Universal Dialog] Session:", session?.user?.id ? "authenticated" : "not authenticated");

    if (!session?.user) {
      console.log("[Universal Dialog] Unauthorized - no session");
      if (DEBUG) {
        return Response.json({ error: "Unauthorized - no session" }, { status: 401 });
      }
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    let body;
    let rawJson;
    try {
      rawJson = await request.json();
      console.log("[Universal Dialog] Raw JSON received:", JSON.stringify(rawJson, null, 2).slice(0, 500));
    } catch (parseError) {
      console.error("[Universal Dialog] JSON parse error:", parseError);
      if (DEBUG) {
        return Response.json({
          error: "JSON parse error",
          details: String(parseError)
        }, { status: 400 });
      }
      return new ChatSDKError("bad_request:api").toResponse();
    }

    try {
      body = requestSchema.parse(rawJson);
      console.log("[Universal Dialog] Validation passed");
    } catch (validationError) {
      console.error("[Universal Dialog] Validation error:", validationError);
      if (DEBUG) {
        return Response.json({
          error: "Validation error",
          details: validationError instanceof Error ? validationError.message : String(validationError),
          received: rawJson
        }, { status: 400 });
      }
      return new ChatSDKError("bad_request:api").toResponse();
    }

  const { messages, context } = body;
  const userId = session.user.id!;

  // Получить профиль пользователя если не передан
  let userProfile = context.userProfile;
  if (!userProfile) {
    const user = await getUserById(userId);
    if (user) {
      userProfile = {
        displayName: user.displayName,
        occupation: user.occupation,
        bio: user.bio,
      };
    }
  }

  // Построить системный промпт
  const systemPrompt = buildSimplySystemPrompt(userProfile);

  // Tool для создания проекта
  const createProjectSchema = z.object({
    name: z
      .string()
      .describe("Название проекта (2-5 слов, отражает суть)"),
    description: z
      .string()
      .describe("Краткое описание проекта (1-2 предложения)"),
    instruction: z
      .string()
      .describe(
        "Системная инструкция для AI при работе с этим проектом. Опиши контекст, цели, особенности."
      ),
  });

  const createProjectTool = tool({
    description:
      "Создать новый проект когда у тебя есть достаточно информации: название и понимание цели проекта. Вызови этот инструмент когда пользователь подтвердил что хочет создать проект.",
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
        projectDescription: project.description,
      };
    },
  });

  // Стрим ответа
  try {
    console.log("[Universal Dialog] Starting streamText with model gemini-2.5-flash");
    const result = streamText({
      model: myProvider.languageModel("gemini-2.5-flash"),
      system: systemPrompt,
      messages: messages,
      tools: {
        createProject: createProjectTool,
      },
      stopWhen: stepCountIs(3), // Разрешить выполнение инструментов
    });

    return result.toTextStreamResponse();
  } catch (streamError) {
    console.error("[Universal Dialog] Error in streamText:", streamError);
    return new ChatSDKError("bad_request:api", "Failed to start dialog").toResponse();
  }
  } catch (outerError) {
    // Глобальный catch для отладки
    console.error("[Universal Dialog] Unexpected error:", outerError);
    return Response.json({
      error: "Unexpected error",
      details: outerError instanceof Error ? outerError.message : String(outerError)
    }, { status: 500 });
  }
}

/**
 * Построить системный промпт для Simply
 */
function buildSimplySystemPrompt(
  userProfile?: {
    displayName?: string | null;
    occupation?: string | null;
    bio?: string | null;
  } | null
): string {
  const userName = userProfile?.displayName || "пользователь";
  const userOccupation = userProfile?.occupation;
  const userBio = userProfile?.bio;

  return `Ты — Simply, AI-ассистент для создания проектов. Твоя задача — помочь ${userName} создать новый проект.

## Контекст о пользователе
${userOccupation ? `- Род деятельности: ${userOccupation}` : ""}
${userBio ? `- О себе: ${userBio}` : ""}

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
- Обращайся на "ты"
- **ВАЖНО:** После создания проекта ОБЯЗАТЕЛЬНО напиши ID проекта в формате: "ID: [uuid]" — это необходимо для работы приложения

## Примеры диалога

Пользователь: "Хочу создать курс по программированию"
Simply: "Отлично! Для кого этот курс — для начинающих или уже опытных разработчиков?"

Пользователь: "Для начинающих, по Python"
Simply: *вызывает createProject* → "Проект создан! ID: abc123-def456-..."`;  // ID берётся из результата инструмента
}
