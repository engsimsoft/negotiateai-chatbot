/**
 * ТЗ-B1: Professor Planning Endpoint
 *
 * POST /api/projects/[id]/plan
 * Calls Professor with project passport + manifest + tools,
 * parses <plan_report> and <plan_json> from response,
 * validates with Zod, saves to DB.
 */

import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
  taskSupportsThinking,
} from "@/lib/ai/getModel";
import { getProjectById, updateProjectPlan } from "@/lib/db/queries";
import { logUsage } from "@/lib/ai/usage-utils";
import {
  professorPlanJsonSchema,
  MVP_TOOLS_MANIFEST,
} from "@/lib/ai/professor-types";
// Side-effect import: регистрирует reader `.simply-dev-overrides.json` через
// `registerOverridesReader`. Без этого импорта `getActiveOverrides()` вернёт
// пусто и dev-panel overrides для `professor:planning` будут проигнорированы.
// Найдено в сессии ТЗ-XAI-4 (2026-04-16): 3 попытки планирования игнорировали
// override на Haiku, шли на Opus из task-assignments. Аналогичная проверка
// нужна всем backend routes — отдельный хвост в _backlog.
import "@/lib/ai/model-overrides-node";

// Load professor prompt from .md file
const PROFESSOR_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "professors",
  "planning.md"
);
const PROFESSOR_SYSTEM_PROMPT = fs.readFileSync(PROFESSOR_PROMPT_PATH, "utf-8");

const requestSchema = z.object({
  userAnswers: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional(),
});

/**
 * Build the user message with XML blocks for the Professor.
 */
function buildUserMessage(
  projectData: {
    context: string | null;
    manifestJson: unknown;
  },
  userAnswers?: Array<{ question: string; answer: string }>
): string {
  const passport = projectData.context || "Паспорт проекта не заполнен.";

  // Build manifest block from manifestJson
  let manifestBlock = "Файлы не загружены.";
  const manifest = projectData.manifestJson as {
    files?: Array<{
      name: string;
      description: string;
      documentType: string;
      folder: string;
      relevance: string;
      keyTopics: string[];
    }>;
  } | null;

  if (manifest?.files && manifest.files.length > 0) {
    manifestBlock = manifest.files
      .map(
        (f) =>
          `- ${f.name} (${f.documentType}, ${f.relevance}): ${f.description}. Папка: ${f.folder}. Темы: ${f.keyTopics.join(", ")}`
      )
      .join("\n");
  }

  const toolsBlock = JSON.stringify(MVP_TOOLS_MANIFEST.tools, null, 2);

  let message = `<passport>
${passport}
</passport>

<manifest>
${manifestBlock}
</manifest>

<tools>
${toolsBlock}
</tools>`;

  if (userAnswers && userAnswers.length > 0) {
    const answersBlock = userAnswers
      .map((a) => `В: ${a.question}\nО: ${a.answer}`)
      .join("\n\n");

    message += `\n\n<user_answers>\n${answersBlock}\n</user_answers>`;
  }

  return message;
}

/**
 * Extract content between XML tags from the Professor's response.
 */
function extractTag(text: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * POST /api/projects/[id]/plan
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { userAnswers } = parsed.data;

    // Verify project ownership
    const projectData = await getProjectById({ id: projectId });
    if (!projectData || projectData.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Build user message
    const userMessage = buildUserMessage(
      {
        context: projectData.context,
        manifestJson: projectData.manifestJson,
      },
      userAnswers
    );

    // ТЗ-1 CoreRegistry: model resolved via task-assignments (was process.env.PROFESSOR_MODEL)
    const resolvedModelId = getModelIdForTask("professor:planning");
    // ТЗ-1: adaptive thinking works only on models that support it (Opus/Sonnet).
    // When task-assignments routes this task to Haiku (e.g. cheap test mode),
    // thinking must be disabled — catalog.capabilities.thinking is the source of truth.
    const supportsThinking = taskSupportsThinking("professor:planning");

    // Call Professor
    // ТЗ-XAI-4 hot-fix (2026-04-16): явный maxOutputTokens:16000 обязателен
    // потому что @ai-sdk/anthropic по умолчанию подставляет model maxOutput из
    // catalog (для Opus 4.6 = 128_000 — это легальный capability, Anthropic
    // поднял 2026-04-12). Но Anthropic требует streaming для max_tokens > 21333
    // (см. docs.anthropic.com/en/api/errors#long-requests). Мы используем
    // generateText (non-streaming) → при max_tokens 128K запрос не успевает
    // вернуть response body за default fetch timeout (~60s) → socket closes →
    // UND_ERR_SOCKET → 3× retry → 500. Потеряно ~9 минут в ТЗ-XAI-4 сессии.
    // Правильный долгосрочный фикс — перевод на streamText с конкатенацией
    // в text для парсинга plan_report/plan_json. Зафиксировано в backlog как
    // TZ_ProfessorPlanStreaming. Сейчас 16K < 21333 → non-streaming safe zone,
    // 16K более чем достаточно для plan_report (~3-8K) + plan_json.
    const result = await generateText({
      model: getModel("professor:planning"),
      system: PROFESSOR_SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.2,
      maxOutputTokens: 16000,
      // Adaptive thinking only if the resolved model supports it
      ...(supportsThinking
        ? {
            providerOptions: {
              anthropic: {
                thinking: { type: "adaptive" as const },
                effort: "high" as const,
              },
            },
          }
        : {}),
    });

    // ТЗ-CACHE2: Usage logging (fire-and-forget)
    logUsage({
      userId: session.user.id!,
      usage: result.usage,
      modelId: resolvedModelId,
      provider: getProviderForTask("professor:planning"),
      chatMode: "professor:planner",
    });

    // Extract XML tags from response
    const planReport = extractTag(result.text, "plan_report");
    const planJsonRaw = extractTag(result.text, "plan_json");

    if (!planReport || !planJsonRaw) {
      console.error(
        "[ProfessorPlan] Missing tags in response. Report:",
        !!planReport,
        "JSON:",
        !!planJsonRaw
      );
      console.error("[ProfessorPlan] Raw response:", result.text.slice(0, 500));
      return NextResponse.json(
        { error: "Professor returned malformed response" },
        { status: 502 }
      );
    }

    // Parse and validate planJson
    let planJson;
    try {
      // Strip markdown code blocks if present
      let jsonText = planJsonRaw.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }
      const rawJson = JSON.parse(jsonText);
      planJson = professorPlanJsonSchema.parse(rawJson);
    } catch (parseError) {
      console.error(
        "[ProfessorPlan] Failed to parse plan_json:",
        planJsonRaw.slice(0, 500)
      );
      console.error("[ProfessorPlan] Parse error:", parseError);
      return NextResponse.json(
        { error: "Failed to parse plan JSON", raw: planJsonRaw },
        { status: 502 }
      );
    }

    // Save to DB
    await updateProjectPlan({
      id: projectId,
      planJson,
      planReport,
    });

    return NextResponse.json({
      success: true,
      planJson,
      planReport,
    });
  } catch (error) {
    console.error("[ProfessorPlan] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    );
  }
}
