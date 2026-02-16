/**
 * Professor Pipeline (ТЗ-03, Фаза 7)
 *
 * Multi-step reasoning pipeline:
 * 1. Analyze (Opus): Break down task into 3-7 subtasks
 * 2. Execute (Haiku): Execute each subtask sequentially
 * 3. Synthesize (Opus): Combine results into final response
 *
 * Streaming events:
 * - professor-phase: Phase change (analyze, execute, synthesize)
 * - professor-subtasks: List of subtasks after analysis
 * - professor-subtask-update: Status update for a subtask
 * - professor-content: Final content chunks
 * - professor-complete: Pipeline finished
 * - professor-error: Error occurred
 */

import { generateText, streamText, type CoreMessage } from "ai";
import { myProvider } from "./providers";

const analyzeModel = myProvider.languageModel("claude-opus");
const executeModel = myProvider.languageModel("claude-haiku");
const synthesizeModel = myProvider.languageModel("claude-opus");

/**
 * Pipeline phases
 */
export type PipelinePhase = "analyze" | "execute" | "synthesize";

/**
 * Subtask status
 */
export type SubtaskStatus = "pending" | "in_progress" | "completed" | "error";

/**
 * Subtask definition
 */
export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: SubtaskStatus;
  result?: string;
  error?: string;
  attempts: number;
}

/**
 * Pipeline streaming events
 */
export type PipelineEvent =
  | { type: "professor-phase"; phase: PipelinePhase }
  | { type: "professor-subtasks"; subtasks: Subtask[] }
  | { type: "professor-subtask-update"; subtask: Subtask }
  | { type: "professor-content"; content: string }
  | { type: "professor-complete" }
  | { type: "professor-error"; error: string };

/**
 * Pipeline options
 */
export interface ProfessorPipelineOptions {
  /** System prompt for context */
  systemPrompt: string;
  /** User message to process */
  userMessage: string;
  /** Conversation history */
  messages: CoreMessage[];
  /** Callback to emit events */
  onEvent: (event: PipelineEvent) => void;
  /** Maximum retry attempts per subtask */
  maxRetries?: number;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Generate unique subtask ID
 */
function generateSubtaskId(): string {
  return `subtask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Analyze prompt for Opus to break down the task
 */
const ANALYZE_PROMPT = `Ты — AI-координатор. Твоя задача — проанализировать запрос пользователя и разбить его на 3-7 конкретных подзадач.

ВАЖНО:
- Каждая подзадача должна быть самодостаточной
- Подзадачи должны быть последовательными (результат одной может понадобиться для другой)
- Формулируй подзадачи чётко и конкретно
- Не создавай слишком много подзадач (максимум 7)
- Не создавай слишком мало (минимум 3)

Ответь ТОЛЬКО в формате JSON (без markdown):
{
  "subtasks": [
    {
      "title": "Краткое название подзадачи",
      "description": "Детальное описание что нужно сделать"
    }
  ]
}`;

/**
 * Execute prompt for Haiku to complete a subtask
 */
const EXECUTE_PROMPT = `Ты — AI-исполнитель. Выполни указанную подзадачу качественно и полно.

Контекст предыдущих подзадач:
{previousResults}

Текущая подзадача:
Название: {title}
Описание: {description}

Выполни подзадачу и дай развёрнутый результат.`;

/**
 * Synthesize prompt for Opus to combine results
 */
const SYNTHESIZE_PROMPT = `Ты — AI-синтезатор. Объедини результаты всех подзадач в единый, связный и полный ответ.

ВАЖНО:
- Создай цельный, логичный текст
- Не просто перечисляй результаты — синтезируй их
- Убери повторения и противоречия
- Сохрани всю важную информацию
- Ответ должен быть на русском языке

Результаты подзадач:
{results}

Создай финальный ответ на исходный запрос пользователя.`;

/**
 * Parse subtasks from Opus response
 */
function parseSubtasks(response: string): Omit<Subtask, "id" | "status" | "attempts">[] {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.subtasks)) {
      throw new Error("Invalid subtasks format");
    }

    return parsed.subtasks.map((st: any) => ({
      title: String(st.title || "Подзадача"),
      description: String(st.description || ""),
    }));
  } catch (error) {
    console.error("[Professor] Failed to parse subtasks:", error);
    // Fallback: create a single subtask
    return [
      {
        title: "Выполнить задачу",
        description: "Обработать запрос пользователя целиком",
      },
    ];
  }
}

/**
 * Execute the Professor Pipeline
 *
 * @param options Pipeline options
 * @returns Final response text
 */
export async function executeProfessorPipeline(
  options: ProfessorPipelineOptions
): Promise<string> {
  const {
    systemPrompt,
    userMessage,
    messages,
    onEvent,
    maxRetries = 2,
    signal,
  } = options;

  console.log("[Professor] Starting pipeline for:", userMessage.slice(0, 100));

  // ========================================
  // Phase 1: Analyze (Opus)
  // ========================================
  onEvent({ type: "professor-phase", phase: "analyze" });
  console.log("[Professor] Phase 1: Analyze");

  let subtasks: Subtask[] = [];

  try {
    const analyzeResult = await generateText({
      model: analyzeModel,
      system: systemPrompt + "\n\n" + ANALYZE_PROMPT,
      messages: [
        ...messages,
        { role: "user", content: userMessage },
      ],
      abortSignal: signal,
    });

    const parsedSubtasks = parseSubtasks(analyzeResult.text);
    subtasks = parsedSubtasks.map((st) => ({
      ...st,
      id: generateSubtaskId(),
      status: "pending" as SubtaskStatus,
      attempts: 0,
    }));

    // Ensure 3-7 subtasks
    if (subtasks.length < 3) {
      // Pad with generic subtasks
      while (subtasks.length < 3) {
        subtasks.push({
          id: generateSubtaskId(),
          title: `Дополнительный анализ ${subtasks.length + 1}`,
          description: "Провести дополнительный анализ для полноты ответа",
          status: "pending",
          attempts: 0,
        });
      }
    } else if (subtasks.length > 7) {
      subtasks = subtasks.slice(0, 7);
    }

    console.log(`[Professor] Created ${subtasks.length} subtasks`);
    onEvent({ type: "professor-subtasks", subtasks });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Professor] Analyze phase failed:", errorMessage);
    onEvent({ type: "professor-error", error: `Ошибка анализа: ${errorMessage}` });
    throw error;
  }

  // ========================================
  // Phase 2: Execute (Haiku)
  // ========================================
  onEvent({ type: "professor-phase", phase: "execute" });
  console.log("[Professor] Phase 2: Execute");

  const results: string[] = [];

  for (let i = 0; i < subtasks.length; i++) {
    const subtask = subtasks[i];

    // Update status to in_progress
    subtask.status = "in_progress";
    onEvent({ type: "professor-subtask-update", subtask: { ...subtask } });

    let success = false;
    let lastError: string | undefined;

    while (subtask.attempts < maxRetries && !success) {
      subtask.attempts++;
      console.log(`[Professor] Executing subtask ${i + 1}/${subtasks.length}: ${subtask.title} (attempt ${subtask.attempts})`);

      try {
        // Build context from previous results
        const previousResults = results.length > 0
          ? results.map((r, idx) => `### ${subtasks[idx].title}\n${r}`).join("\n\n")
          : "Нет предыдущих результатов";

        const executePrompt = EXECUTE_PROMPT
          .replace("{previousResults}", previousResults)
          .replace("{title}", subtask.title)
          .replace("{description}", subtask.description);

        const executeResult = await generateText({
          model: executeModel,
          system: systemPrompt + "\n\n" + executePrompt,
          messages: [
            ...messages,
            { role: "user", content: userMessage },
          ],
          abortSignal: signal,
        });

        subtask.result = executeResult.text;
        subtask.status = "completed";
        results.push(executeResult.text);
        success = true;

        console.log(`[Professor] Subtask ${i + 1} completed`);
        onEvent({ type: "professor-subtask-update", subtask: { ...subtask } });
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
        console.warn(`[Professor] Subtask ${i + 1} attempt ${subtask.attempts} failed:`, lastError);

        if (subtask.attempts >= maxRetries) {
          subtask.status = "error";
          subtask.error = lastError;
          onEvent({ type: "professor-subtask-update", subtask: { ...subtask } });

          // Continue with partial results
          results.push(`[Ошибка: ${lastError}]`);
        }
      }
    }
  }

  // ========================================
  // Phase 3: Synthesize (Opus)
  // ========================================
  onEvent({ type: "professor-phase", phase: "synthesize" });
  console.log("[Professor] Phase 3: Synthesize");

  try {
    // Format results for synthesis
    const formattedResults = subtasks.map((st, idx) => {
      return `### ${st.title}\n${results[idx] || "[Не выполнено]"}`;
    }).join("\n\n---\n\n");

    const synthesizePrompt = SYNTHESIZE_PROMPT.replace("{results}", formattedResults);

    // Use streaming for final response
    const synthesizeStream = streamText({
      model: synthesizeModel,
      system: systemPrompt + "\n\n" + synthesizePrompt,
      messages: [
        ...messages,
        { role: "user", content: userMessage },
      ],
      abortSignal: signal,
    });

    let finalContent = "";

    for await (const chunk of synthesizeStream.textStream) {
      finalContent += chunk;
      onEvent({ type: "professor-content", content: chunk });
    }

    console.log("[Professor] Pipeline completed successfully");
    onEvent({ type: "professor-complete" });

    return finalContent;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Professor] Synthesize phase failed:", errorMessage);
    onEvent({ type: "professor-error", error: `Ошибка синтеза: ${errorMessage}` });

    // Return partial results on synthesis failure
    const partialResult = results.filter(r => !r.startsWith("[Ошибка")).join("\n\n");
    return partialResult || "Произошла ошибка при обработке запроса.";
  }
}
