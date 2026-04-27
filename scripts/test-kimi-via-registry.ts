/**
 * ТЗ-BR-AUTHOR-KIMI Этап 4: Smoke-тест Kimi K2.6 через registry для трёх
 * briefing taskId. Проверяет всю цепочку: getModel(taskId) → registry → Moonshot API.
 *
 * Запуск: pnpm tsx scripts/test-kimi-via-registry.ts
 * Требует: MOONSHOT_API_KEY в .env.local
 *
 * Реализация: dynamic imports после dotenv config — иначе ES module hoisting
 * инициализирует registry ДО того как process.env подгрузится из .env.local,
 * и provider клиент создаётся с пустым apiKey → 401 на каждом вызове.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

type BriefingTaskId =
  | "briefing:author"
  | "briefing:section"
  | "briefing:podcast-script";

const DIVIDER = "\n" + "=".repeat(60) + "\n";

interface TestResult {
  taskId: string;
  passed: boolean;
  modelId: string;
  provider: string;
  durationMs: number;
  outputChars: number;
  outputPreview: string;
  usage?: unknown;
  error?: string;
}

async function main() {
  console.log("ТЗ-BR-AUTHOR-KIMI Этап 4 — smoke Kimi K2.6 через registry");
  const apiKey = process.env.MOONSHOT_API_KEY;
  console.log(`MOONSHOT_API_KEY: ${apiKey ? apiKey.slice(0, 12) + "…" : "❌ MISSING"}`);
  if (!apiKey) {
    process.exit(1);
  }

  // Dynamic imports — после dotenv config, чтобы provider client получил ключ.
  const { streamText, generateText } = await import("ai");
  const {
    getDefaultParamsForTask,
    getModel,
    getModelIdForTask,
    getProviderForTask,
  } = await import("@/lib/ai/getModel");

  function checkResolve(taskId: BriefingTaskId): { ok: true } | { ok: false; reason: string } {
    const modelId = getModelIdForTask(taskId);
    const provider = getProviderForTask(taskId);
    if (modelId !== "kimi-k2.6") {
      return { ok: false, reason: `Expected modelId 'kimi-k2.6', got '${modelId}'` };
    }
    if (provider !== "moonshotai") {
      return { ok: false, reason: `Expected provider 'moonshotai', got '${provider}'` };
    }
    return { ok: true };
  }

  async function testStreamingTask(
    taskId: BriefingTaskId,
    system: string,
    prompt: string,
  ): Promise<TestResult> {
    const start = Date.now();
    const modelId = getModelIdForTask(taskId);
    const provider = getProviderForTask(taskId);
    const params = getDefaultParamsForTask(taskId);

    console.log(DIVIDER + `streamText: ${taskId}` + DIVIDER);
    console.log(`modelId:        ${modelId}`);
    console.log(`provider:       ${provider}`);
    console.log(`defaultParams:  ${JSON.stringify(params)}`);

    const check = checkResolve(taskId);
    if (!check.ok) {
      return {
        taskId, passed: false, modelId, provider, durationMs: 0,
        outputChars: 0, outputPreview: "", error: check.reason,
      };
    }

    const model = getModel(taskId);
    const res = streamText({
      model,
      system,
      prompt,
      maxOutputTokens: 200,
      ...params,
      maxRetries: 0,
    });

    let fullText = "";
    let textChunks = 0;
    for await (const part of res.fullStream) {
      if (part.type === "text-delta") {
        textChunks++;
        const delta = (part as { textDelta?: string; text?: string }).textDelta
          ?? (part as { text?: string }).text
          ?? "";
        fullText += delta;
      }
    }

    const usage = await res.usage;
    const durationMs = Date.now() - start;

    console.log(`Duration:       ${durationMs}ms (${textChunks} chunks)`);
    console.log(`Output:         ${fullText.length} chars`);
    console.log(`Preview:        ${fullText.slice(0, 300)}`);
    console.log(`Usage:          ${JSON.stringify(usage)}`);

    const pass = textChunks > 0 && fullText.length > 5 && !fullText.includes("undefined");
    console.log(`Result:         ${pass ? "✅ PASS" : "❌ FAIL"}`);

    return {
      taskId, passed: pass, modelId, provider, durationMs,
      outputChars: fullText.length, outputPreview: fullText.slice(0, 200), usage,
    };
  }

  async function testGenerateTask(
    taskId: BriefingTaskId,
    system: string,
    prompt: string,
  ): Promise<TestResult> {
    const start = Date.now();
    const modelId = getModelIdForTask(taskId);
    const provider = getProviderForTask(taskId);
    const params = getDefaultParamsForTask(taskId);

    console.log(DIVIDER + `generateText: ${taskId}` + DIVIDER);
    console.log(`modelId:        ${modelId}`);
    console.log(`provider:       ${provider}`);
    console.log(`defaultParams:  ${JSON.stringify(params)}`);

    const check = checkResolve(taskId);
    if (!check.ok) {
      return {
        taskId, passed: false, modelId, provider, durationMs: 0,
        outputChars: 0, outputPreview: "", error: check.reason,
      };
    }

    const model = getModel(taskId);
    const result = await generateText({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      maxOutputTokens: 200,
      ...params,
      maxRetries: 0,
    });

    const durationMs = Date.now() - start;
    const text = result.text;

    console.log(`Duration:       ${durationMs}ms`);
    console.log(`Output:         ${text.length} chars`);
    console.log(`Preview:        ${text.slice(0, 300)}`);
    console.log(`Usage:          ${JSON.stringify(result.usage)}`);
    console.log(`finishReason:   ${result.finishReason}`);

    const pass = text.length > 5 && !text.includes("undefined");
    console.log(`Result:         ${pass ? "✅ PASS" : "❌ FAIL"}`);

    return {
      taskId, passed: pass, modelId, provider, durationMs,
      outputChars: text.length, outputPreview: text.slice(0, 200), usage: result.usage,
    };
  }

  const results: TestResult[] = [];

  results.push(
    await testStreamingTask(
      "briefing:author",
      "Ты — автор кратких новостных дайджестов на русском. Пиши лаконично.",
      "Напиши одно предложение про погоду в Москве на завтра.",
    ).catch((err: Error) => ({
      taskId: "briefing:author", passed: false, modelId: "?", provider: "?",
      durationMs: 0, outputChars: 0, outputPreview: "", error: err.message,
    })),
  );

  results.push(
    await testStreamingTask(
      "briefing:section",
      "Ты пишешь секцию брифинга на русском.",
      "Сформулируй одно предложение про важность чтения новостей утром.",
    ).catch((err: Error) => ({
      taskId: "briefing:section", passed: false, modelId: "?", provider: "?",
      durationMs: 0, outputChars: 0, outputPreview: "", error: err.message,
    })),
  );

  results.push(
    await testGenerateTask(
      "briefing:podcast-script",
      "Ты сценарист подкаста.",
      "Напиши короткий диалог: Host говорит 'Привет', Expert отвечает 'И тебе привет'.",
    ).catch((err: Error) => ({
      taskId: "briefing:podcast-script", passed: false, modelId: "?", provider: "?",
      durationMs: 0, outputChars: 0, outputPreview: "", error: err.message,
    })),
  );

  console.log(DIVIDER + "SUMMARY" + DIVIDER);
  for (const r of results) {
    const icon = r.passed ? "✅ PASS" : "❌ FAIL";
    const errSuffix = r.error ? ` — ${r.error}` : "";
    console.log(
      `${icon}  ${r.taskId.padEnd(25)} ${String(r.durationMs).padStart(6)}ms  ${String(r.outputChars).padStart(4)} chars${errSuffix}`,
    );
  }

  const allPass = results.every((r) => r.passed);
  console.log(
    DIVIDER +
      (allPass
        ? "🎉 Все три briefing taskId работают через Kimi K2.6"
        : "⚠️  Один или несколько тестов упали — диагностика выше") +
      DIVIDER,
  );
  process.exit(allPass ? 0 : 1);
}

main().catch((err: Error) => {
  console.error("Fatal:", err);
  process.exit(1);
});
