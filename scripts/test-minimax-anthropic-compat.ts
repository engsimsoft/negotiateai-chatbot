/**
 * ТЗ-CacheAudit: Независимый тест MiniMax Anthropic-compatible провайдера
 *
 * Цель: с нуля, без опоры на предыдущие тесты и проектную документацию,
 * проверить реальное поведение `createMinimax()` из `vercel-minimax-ai-provider@0.0.2`.
 *
 * Предыдущий агент (ТЗ-MinimaxCleanup v3.76) заявлял:
 *  - textDelta не работает
 *  - Tool params передаются пустым {}
 *  - generateObject не работает
 *  - cacheTokens не возвращаются
 * Это расходится с официальной документацией MiniMax и с исходником пакета,
 * где Anthropic-compat — это прокси через `AnthropicMessagesLanguageModel`
 * из `@ai-sdk/anthropic/internal`. Этот тест установит правду.
 *
 * Запуск: npx tsx scripts/test-minimax-anthropic-compat.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { streamText, generateObject } from "ai";
import { createMinimax } from "vercel-minimax-ai-provider";
import { z } from "zod";

const minimax = createMinimax();
const model = minimax("MiniMax-M2.7");

const DIVIDER = "\n" + "=".repeat(60) + "\n";

function summarizeResult(label: string, pass: boolean, details?: string) {
  const mark = pass ? "✅ PASS" : "❌ FAIL";
  console.log(`${mark}  ${label}${details ? " — " + details : ""}`);
}

// ─── TEST 1: Basic streamText (русский текст) ──────────────────────────────

async function test1_basicStream() {
  console.log(DIVIDER + "TEST 1: streamText basic (русский)" + DIVIDER);

  const result = streamText({
    model,
    system: "Ты помощник. Отвечай кратко на русском.",
    messages: [{ role: "user", content: "Что такое квантовый компьютер? Два предложения." }],
    temperature: 0.7,
  });

  const partTypes = new Set<string>();
  let textChunks = 0;
  let fullText = "";
  let reasoningText = "";

  for await (const part of result.fullStream) {
    partTypes.add(part.type);
    if (part.type === "text-delta") {
      textChunks++;
      fullText += (part as any).textDelta ?? (part as any).text ?? "";
    } else if (part.type === "reasoning-delta") {
      reasoningText += (part as any).text || (part as any).textDelta || "";
    }
  }

  const usage = await result.usage;
  const response = await result.response;

  console.log("\n--- Ответ ---");
  console.log(fullText || "(ПУСТОЙ ОТВЕТ)");
  if (reasoningText) {
    console.log("\n--- Reasoning ---");
    console.log(reasoningText.slice(0, 200) + (reasoningText.length > 200 ? "..." : ""));
  }
  console.log("\nText chunks:", textChunks);
  console.log("Part types:", [...partTypes].join(", "));
  console.log("Usage:", JSON.stringify(usage, null, 2));
  console.log("Response modelId:", response.modelId);

  const pass = textChunks > 0 && fullText.length > 20 && !fullText.includes("undefined");
  return { pass, textChunks, fullTextLength: fullText.length, usage, partTypes: [...partTypes] };
}

// ─── TEST 2: Tool calling с Zod схемой ─────────────────────────────────────

async function test2_toolCalling() {
  console.log(DIVIDER + "TEST 2: Tool calling (Zod schema с параметрами)" + DIVIDER);

  let executeInput: any = null;

  const result = streamText({
    model,
    system: "Ты помощник. Используй доступные инструменты когда нужно.",
    messages: [{ role: "user", content: 'Вызови testTool с сообщением "привет"' }],
    tools: {
      testTool: {
        description: "Тестовый инструмент для отправки сообщений",
        inputSchema: z.object({ message: z.string() }),
        execute: async (input: { message: string }) => {
          executeInput = input;
          return `Получено: ${input.message}`;
        },
      },
    },
  });

  const toolCalls: any[] = [];
  const toolResults: any[] = [];
  let fullText = "";

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      fullText += (part as any).textDelta ?? (part as any).text ?? "";
    } else if (part.type === "tool-call") {
      toolCalls.push(part);
    } else if (part.type === "tool-result") {
      toolResults.push(part);
    }
  }

  const usage = await result.usage;

  console.log("Tool calls:", toolCalls.length);
  console.log("Tool results:", toolResults.length);
  console.log("Execute received:", JSON.stringify(executeInput));
  console.log("Text:", fullText || "(нет текста — ok для чистого tool call)");
  console.log("Usage:", JSON.stringify(usage, null, 2));

  const paramsWorked = executeInput?.message === "привет";
  return {
    pass: toolCalls.length > 0 && paramsWorked,
    toolCalls: toolCalls.length,
    paramsWorked,
    executeInput,
    usage,
  };
}

// ─── TEST 3: generateObject через mode:"tool" ──────────────────────────────

async function test3_generateObject() {
  console.log(DIVIDER + "TEST 3: generateObject (mode: tool) — критично для MIND extract" + DIVIDER);

  try {
    const result = await generateObject({
      model,
      schema: z.object({
        facts: z.array(
          z.object({
            content: z.string(),
            category: z.enum(["fact", "task", "preference", "calendar", "person", "decision", "idea"]),
            confidence: z.number().min(0).max(1),
          }),
        ),
      }),
      mode: "tool",
      prompt: `Извлеки факты из диалога:

Пользователь: Завтра в 15:00 встреча с Григорием Александровичем, он стоматолог. Надо обсудить концепцию медицинского ассистента.
Ассистент: Записал. Встреча завтра в 15:00 с Григорием Александровичем.`,
    });

    console.log("Object:", JSON.stringify(result.object, null, 2));
    console.log("Usage:", JSON.stringify(result.usage, null, 2));

    const pass = Array.isArray(result.object.facts) && result.object.facts.length > 0;
    return { pass, factsCount: result.object.facts.length, usage: result.usage };
  } catch (err: any) {
    console.log("❌ ERROR:", err.message);
    console.log("Stack:", err.stack?.split("\n").slice(0, 3).join("\n"));
    return { pass: false, error: err.message };
  }
}

// ─── TEST 4: Explicit cacheControl — двойной запрос для cache read ──────────

async function test4_cacheControl() {
  console.log(DIVIDER + "TEST 4: Explicit cacheControl (2 запроса подряд)" + DIVIDER);

  // Минимум для Anthropic-compat MiniMax — по аналогии с Anthropic Sonnet 4.6 = 2048 токенов.
  // Генерируем большой system prompt (~3000 токенов = ~12000 символов русского текста).
  const longBlock =
    "Ты — эксперт по истории российской литературы XIX века. Твоя задача — давать развёрнутые, академически точные ответы на вопросы о писателях, их произведениях, биографических фактах, литературных направлениях и взаимосвязях между авторами. ".repeat(
      30,
    );

  console.log(`System prompt длина: ${longBlock.length} символов (~${Math.round(longBlock.length / 4)} токенов)`);

  async function ask(question: string, label: string) {
    const result = streamText({
      model,
      messages: [
        {
          role: "system",
          content: longBlock,
          providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
        },
        { role: "user", content: question },
      ],
      temperature: 0.7,
    });

    let fullText = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        fullText += (part as any).textDelta ?? (part as any).text ?? "";
      }
    }

    const usage = await result.usage;
    console.log(`\n[${label}] ответ (первые 100 символов):`, fullText.slice(0, 100));
    console.log(`[${label}] usage:`, JSON.stringify(usage, null, 2));
    return { usage, fullText };
  }

  const r1 = await ask("Расскажи про Пушкина в одном предложении.", "Запрос 1 (cacheWrite ожидается)");
  // Небольшая пауза чтобы кэш успел установиться
  await new Promise((r) => setTimeout(r, 500));
  const r2 = await ask("А про Лермонтова?", "Запрос 2 (cacheRead ожидается)");

  const r1CacheWrite = (r1.usage as any)?.inputTokenDetails?.cacheWriteTokens ?? 0;
  const r1CacheRead = (r1.usage as any)?.inputTokenDetails?.cacheReadTokens ?? 0;
  const r2CacheWrite = (r2.usage as any)?.inputTokenDetails?.cacheWriteTokens ?? 0;
  const r2CacheRead = (r2.usage as any)?.inputTokenDetails?.cacheReadTokens ?? 0;

  console.log("\n--- Анализ cache ---");
  console.log(`Запрос 1: cacheWrite=${r1CacheWrite}, cacheRead=${r1CacheRead}`);
  console.log(`Запрос 2: cacheWrite=${r2CacheWrite}, cacheRead=${r2CacheRead}`);
  console.log(`Ожидание: Запрос 2 cacheRead > 0 — префикс system кэшируется`);

  const pass = r2CacheRead > 0;
  return { pass, r1: { cacheWrite: r1CacheWrite, cacheRead: r1CacheRead }, r2: { cacheWrite: r2CacheWrite, cacheRead: r2CacheRead } };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("MiniMax M2.7 — Anthropic-compat mode test suite");
  console.log("Provider: createMinimax() (Anthropic-compatible, через api.minimax.io/anthropic/v1)");
  console.log("API key:", process.env.MINIMAX_API_KEY ? `${process.env.MINIMAX_API_KEY.slice(0, 12)}...` : "❌ missing");

  const results: Record<string, any> = {};

  try {
    results.test1 = await test1_basicStream();
  } catch (err: any) {
    console.log("❌ TEST 1 THREW:", err.message);
    results.test1 = { pass: false, error: err.message };
  }

  try {
    results.test2 = await test2_toolCalling();
  } catch (err: any) {
    console.log("❌ TEST 2 THREW:", err.message);
    results.test2 = { pass: false, error: err.message };
  }

  try {
    results.test3 = await test3_generateObject();
  } catch (err: any) {
    console.log("❌ TEST 3 THREW:", err.message);
    results.test3 = { pass: false, error: err.message };
  }

  try {
    results.test4 = await test4_cacheControl();
  } catch (err: any) {
    console.log("❌ TEST 4 THREW:", err.message);
    results.test4 = { pass: false, error: err.message };
  }

  console.log(DIVIDER + "SUMMARY" + DIVIDER);
  summarizeResult("Test 1: streamText basic (русский)", results.test1.pass, `textChunks=${results.test1.textChunks}`);
  summarizeResult("Test 2: Tool calling с параметрами", results.test2.pass, `toolCalls=${results.test2.toolCalls}, paramsWorked=${results.test2.paramsWorked}`);
  summarizeResult("Test 3: generateObject (mode:tool)", results.test3.pass, results.test3.factsCount ? `facts=${results.test3.factsCount}` : results.test3.error);
  summarizeResult("Test 4: Explicit cacheControl", results.test4.pass, `r1.write=${results.test4.r1?.cacheWrite}, r2.read=${results.test4.r2?.cacheRead}`);

  const allPass = Object.values(results).every((r: any) => r.pass);
  console.log(DIVIDER + (allPass ? "🎉 ВСЁ РАБОТАЕТ — переход безопасен" : "⚠️ ЕСТЬ ПРОБЛЕМЫ — см. детали выше") + DIVIDER);

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
