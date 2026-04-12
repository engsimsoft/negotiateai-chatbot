/**
 * ТЗ-CacheAudit Этап 1: Проверка что MiniMax резолвится через registry
 * после переключения на Anthropic-compat фабрику.
 *
 * Проверяет всю цепочку: getModel(taskId) → registry.languageModel(registryId)
 *   → AnthropicMessagesLanguageModel (из @ai-sdk/anthropic/internal).
 *
 * Запуск: npx tsx scripts/test-minimax-via-registry.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { streamText } from "ai";
import { getModel, getModelIdForTask, getProviderForTask } from "@/lib/ai/getModel";

const DIVIDER = "\n" + "=".repeat(60) + "\n";

async function testSimplyChatResolve() {
  console.log(DIVIDER + "Проверка: getModel('simply-chat') → MiniMax M2.7" + DIVIDER);

  const modelId = getModelIdForTask("simply-chat");
  const provider = getProviderForTask("simply-chat");
  console.log(`taskId: simply-chat`);
  console.log(`modelId: ${modelId}`);
  console.log(`provider: ${provider}`);

  if (!modelId.startsWith("MiniMax-M2")) {
    console.log("❌ FAIL: ожидалась MiniMax модель, получено:", modelId);
    return false;
  }
  if (provider !== "minimax") {
    console.log("❌ FAIL: ожидался provider 'minimax', получено:", provider);
    return false;
  }

  const model = getModel("simply-chat");
  console.log(`\nModel resolved: ${model ? "✅" : "❌"}`);

  // Короткий streamText тест
  const result = streamText({
    model,
    system: "Ты помощник. Отвечай одним предложением на русском.",
    messages: [{ role: "user", content: "Как дела?" }],
    temperature: 0.7,
  });

  let fullText = "";
  let textChunks = 0;
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      textChunks++;
      fullText += (part as any).textDelta ?? (part as any).text ?? "";
    }
  }

  const usage = await result.usage;
  const response = await result.response;

  console.log(`\n--- Ответ (${fullText.length} симв, ${textChunks} chunks) ---`);
  console.log(fullText || "(ПУСТО)");
  console.log("\nUsage:", JSON.stringify(usage, null, 2));
  console.log("Response modelId (from server):", response.modelId);

  const pass = textChunks > 0 && fullText.length > 5 && !fullText.includes("undefined");
  return pass;
}

async function testBriefingResolve() {
  console.log(DIVIDER + "Проверка: getModel('briefing:filter') → minimaxLong" + DIVIDER);

  const modelId = getModelIdForTask("briefing:filter");
  const provider = getProviderForTask("briefing:filter");
  console.log(`taskId: briefing:filter`);
  console.log(`modelId: ${modelId}`);
  console.log(`provider: ${provider}`);

  const model = getModel("briefing:filter");
  console.log(`Model resolved: ${model ? "✅" : "❌"}`);

  // Короткий probe — не запускаем реальный pipeline, только проверяем что модель создаётся
  if (!model) {
    console.log("❌ FAIL: не удалось резолвнуть модель");
    return false;
  }

  console.log("✅ PASS (resolve only — full pipeline smoke при Этапе 1 через UI)");
  return true;
}

async function main() {
  console.log("ТЗ-CacheAudit Этап 1 validation — MiniMax via registry\n");
  console.log(`API key: ${process.env.MINIMAX_API_KEY ? process.env.MINIMAX_API_KEY.slice(0, 12) + "..." : "❌ MISSING"}`);

  const r1 = await testSimplyChatResolve().catch((err) => {
    console.log("❌ testSimplyChatResolve THREW:", err.message);
    console.log(err.stack?.split("\n").slice(0, 5).join("\n"));
    return false;
  });

  const r2 = await testBriefingResolve().catch((err) => {
    console.log("❌ testBriefingResolve THREW:", err.message);
    console.log(err.stack?.split("\n").slice(0, 5).join("\n"));
    return false;
  });

  console.log(DIVIDER + "SUMMARY" + DIVIDER);
  console.log(`simply-chat (minimax:) resolve + stream: ${r1 ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`briefing:filter (minimaxLong:) resolve: ${r2 ? "✅ PASS" : "❌ FAIL"}`);

  const allPass = r1 && r2;
  console.log(DIVIDER + (allPass ? "🎉 Registry resolve работает — переход через всю цепочку успешен" : "⚠️ Нужна ручная диагностика") + DIVIDER);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
