/**
 * Debug script: reproduce the orphan tool_use bug in chat d441f9b0.
 *
 * Takes the exact parts stored in Message_v2 for the poisoned chat,
 * runs them through the same sanitizer chain as chat/route.ts, and
 * dumps the resulting ModelMessage[] so we can see why Anthropic sees
 * `tool_use` without a matching `tool_result`.
 *
 * Run: npx tsx scripts/debug-orphan-tool-use.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { convertToModelMessages, streamText, type UIMessage, type ModelMessage } from "ai";
import { stripIncompleteToolParts, sanitizeCoreMessages } from "../lib/utils";
import { getModel } from "../lib/ai/getModel";

// ---- Exact data from the DB (chatId d441f9b0, messages 97f49cec → 9b57e05c) ----

const uiMessages: UIMessage[] = [
  {
    id: "97f49cec-77b0-4c2d-93ca-8b5860f7396d",
    role: "user",
    parts: [
      {
        type: "file",
        url: "https://i843zshoplwfl9an.public.blob.vercel-storage.com/screenshot-12-26-11-Aq5SduNwTaBcvSWy0iyyf27RzzvRq8.png",
        name: "screenshot-12-26-11.png",
        mediaType: "image/png",
      } as any,
      { type: "text", text: "$22.96 - панели провайдера,\nЗафиксируйте данные\n" },
    ],
  },
  {
    id: "42957d28-e032-4035-aae0-78968f635a0e",
    role: "assistant",
    parts: [
      { type: "step-start" } as any,
      {
        type: "tool-createSnapshot",
        input: {
          artifacts: ["Таблица расходов по моделям и провайдерам (screenshot)"],
          decisions: ["d1", "d2", "d3"],
          nextSteps: ["n1", "n2", "n3"],
          currentState: "state text",
          shortSummary: "short summary",
          openQuestions: ["q1", "q2"],
        },
        state: "output-available",
        output: {
          status: "snapshot_created",
          message: "Итог зафиксирован",
          fullMarkdown: "## Итог\nfull markdown here",
          shortSummary: "short",
        },
        toolCallId: "toolu_01A2TGLmYibTnppMybtdDbue",
        callProviderMetadata: { anthropic: { caller: { type: "direct" } } },
      } as any,
      { type: "text", text: "Зафиксирую текущее состояние отладки.", state: "done" } as any,
      { type: "step-start" } as any,
      { type: "text", text: "Готово. Данные по панелям провайдеров ($22.96) зафиксированы.", state: "done" } as any,
    ],
  },
  {
    id: "86e8b740-17e2-482c-bbb6-d7645daf00dc",
    role: "user",
    parts: [{ type: "text", text: "Тест" }],
  },
  {
    id: "4862ea20-7a17-4365-87e8-a638ac6987ec",
    role: "assistant",
    parts: [
      { type: "step-start" } as any,
      { type: "text", text: "Привет. Готов к тесту.", state: "done" } as any,
    ],
  },
  {
    id: "e1a3e2ee-515c-455c-8408-7437f143f208",
    role: "user",
    parts: [{ type: "text", text: "Проверки работоспособности." }],
  },
  {
    id: "2ba593e4-2948-4efd-9872-b7a5f1ada3b8",
    role: "user",
    parts: [{ type: "text", text: "Тестом вот что мы будем делать" }],
  },
  {
    id: "3d3accd0-cd90-4f59-b39e-fd3c0eb12fd3",
    role: "assistant",
    parts: [
      { type: "step-start" } as any,
      { type: "text", text: "Понял контекст.", state: "done" } as any,
    ],
  },
  {
    id: "9b57e05c-5344-4d51-8740-71cb3ae00fe3",
    role: "user",
    // Use the SAME reachable blob URL as in the first user message to isolate tool_use bug from file download
    parts: [
      {
        type: "file",
        url: "https://i843zshoplwfl9an.public.blob.vercel-storage.com/screenshot-12-26-11-Aq5SduNwTaBcvSWy0iyyf27RzzvRq8.png",
        name: "screenshot.png",
        mediaType: "image/png",
      } as any,
      { type: "text", text: "Вот панель разработчика" },
    ],
  },
];

async function main() {
  console.log("=".repeat(80));
  console.log("STAGE 1: After stripIncompleteToolParts");
  console.log("=".repeat(80));
  const stripped = stripIncompleteToolParts(uiMessages as any);
  for (let i = 0; i < stripped.length; i++) {
    const m = stripped[i];
    console.log(`\n[${i}] role=${m.role} parts:`);
    console.log(JSON.stringify(m.parts, null, 2));
  }

  console.log("\n" + "=".repeat(80));
  console.log("STAGE 2: After convertToModelMessages");
  console.log("=".repeat(80));
  const converted = await convertToModelMessages(stripped as any);
  for (let i = 0; i < converted.length; i++) {
    console.log(`\n[${i}] role=${converted[i].role}:`);
    console.log(JSON.stringify(converted[i], null, 2));
  }

  console.log("\n" + "=".repeat(80));
  console.log("STAGE 3: After sanitizeCoreMessages");
  console.log("=".repeat(80));
  const sanitized = sanitizeCoreMessages(converted);
  for (let i = 0; i < sanitized.length; i++) {
    console.log(`\n[${i}] role=${sanitized[i].role}:`);
    console.log(JSON.stringify(sanitized[i], null, 2));
  }

  console.log("\n" + "=".repeat(80));
  console.log("FINAL: messages as sent to Anthropic (index, role, content types)");
  console.log("=".repeat(80));
  for (let i = 0; i < sanitized.length; i++) {
    const m = sanitized[i];
    const types = Array.isArray(m.content)
      ? m.content.map((p: any) => p.type + (p.toolCallId ? `(${p.toolCallId})` : "")).join(", ")
      : "string";
    console.log(`[${i}] ${m.role}: ${types}`);
  }

  // -------- VARIANT TESTS: try real Anthropic call with different mutations --------

  async function tryVariant(
    label: string,
    messages: ModelMessage[],
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = streamText({
        model: getModel("chat-vision"),
        messages: [
          { role: "system", content: "Ты ассистент. Отвечай кратко." },
          ...messages,
        ],
        maxRetries: 0,
      });
      // Await final usage — this throws if the stream had an error
      await res.usage;
      return { ok: true };
    } catch (e: any) {
      const body = e?.responseBody ?? e?.data?.error?.message ?? e?.message ?? String(e);
      return { ok: false, error: String(body).slice(0, 300) };
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("LIVE TEST: sending variants to real Anthropic Haiku 4.5");
  console.log("=".repeat(80));

  // Variant A — exactly what route.ts produces (baseline reproduction)
  console.log("\n[A] BASELINE (exact sanitized output)");
  const a = await tryVariant("A", sanitized);
  console.log("   result:", a.ok ? "✓ SUCCESS" : "✗ FAIL\n   " + a.error);

  // Variant B — remove `providerOptions` from tool-call and tool-result
  console.log("\n[B] STRIP providerOptions (kills caller: direct)");
  const b_msgs: ModelMessage[] = sanitized.map((m) => {
    if (!Array.isArray(m.content)) return m;
    const newContent = (m.content as any[]).map((p) => {
      if (p.type === "tool-call" || p.type === "tool-result") {
        const { providerOptions, ...rest } = p;
        return rest;
      }
      return p;
    });
    return { ...m, content: newContent } as ModelMessage;
  });
  const b = await tryVariant("B", b_msgs);
  console.log("   result:", b.ok ? "✓ SUCCESS" : "✗ FAIL\n   " + b.error);

  // Variant D — strip trailing text after tool-call in assistant message [1]
  console.log("\n[D] REMOVE text AFTER tool-call in assistant message");
  const d_msgs: ModelMessage[] = sanitized.map((m, idx) => {
    if (m.role !== "assistant" || !Array.isArray(m.content)) return m;
    const content = m.content as any[];
    const toolCallIdx = content.findIndex((p) => p.type === "tool-call");
    if (toolCallIdx === -1) return m;
    // Keep only content up to (and including) tool-call
    return { ...m, content: content.slice(0, toolCallIdx + 1) } as ModelMessage;
  });
  const d = await tryVariant("D", d_msgs);
  console.log("   result:", d.ok ? "✓ SUCCESS" : "✗ FAIL\n   " + d.error);

  // Variant E — split assistant [tool-call, text] into two messages
  console.log("\n[E] SPLIT assistant [tool-call, text] into two assistant messages");
  const e_msgs: ModelMessage[] = [];
  for (const m of sanitized) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) {
      e_msgs.push(m);
      continue;
    }
    const content = m.content as any[];
    const hasBoth = content.some((p) => p.type === "tool-call") &&
      content.some((p) => p.type === "text");
    if (!hasBoth) {
      e_msgs.push(m);
      continue;
    }
    const toolParts = content.filter((p) => p.type === "tool-call");
    const otherParts = content.filter((p) => p.type !== "tool-call");
    // Emit assistant with tool-call first, then assistant with text
    e_msgs.push({ ...m, content: toolParts } as ModelMessage);
    e_msgs.push({ ...m, content: otherParts } as ModelMessage);
  }
  // But now assistant [tool-call] + assistant [text] breaks tool_result ordering.
  // We need: assistant [tool-call] → tool [tool-result] → assistant [text]
  // Reorder: find tool-call assistant, check next tool message, then keep the text
  const e_reordered: ModelMessage[] = [];
  for (let i = 0; i < e_msgs.length; i++) {
    const m = e_msgs[i];
    e_reordered.push(m);
    if (
      m.role === "assistant" &&
      Array.isArray(m.content) &&
      (m.content as any[]).some((p) => p.type === "tool-call") &&
      i + 1 < e_msgs.length &&
      e_msgs[i + 1].role === "assistant" &&
      Array.isArray(e_msgs[i + 1].content) &&
      !(e_msgs[i + 1].content as any[]).some((p) => p.type === "tool-call")
    ) {
      // Look for the tool-result message after the text message
      const toolIdx = e_msgs.findIndex(
        (mm, idx) => idx > i && mm.role === "tool",
      );
      if (toolIdx !== -1) {
        e_reordered.push(e_msgs[toolIdx]);
        e_msgs[toolIdx] = { ...e_msgs[toolIdx], __consumed: true } as any;
      }
    }
  }
  // Filter out consumed tool messages and append non-consumed content
  const e_final = e_reordered.filter((m) => !(m as any).__consumed);
  // Append the text that was split off (if not already in sequence)
  const e = await tryVariant("E", e_final);
  console.log("   result:", e.ok ? "✓ SUCCESS" : "✗ FAIL\n   " + e.error);

  // Variant F — reorder content so tool-call is LAST in assistant content
  console.log("\n[F] REORDER: move tool-call to end of assistant content");
  const f_msgs: ModelMessage[] = sanitized.map((m) => {
    if (m.role !== "assistant" || !Array.isArray(m.content)) return m;
    const content = m.content as any[];
    if (!content.some((p) => p.type === "tool-call")) return m;
    const toolCalls = content.filter((p) => p.type === "tool-call");
    const others = content.filter((p) => p.type !== "tool-call");
    return { ...m, content: [...others, ...toolCalls] } as ModelMessage;
  });
  const f = await tryVariant("F", f_msgs);
  console.log("   result:", f.ok ? "✓ SUCCESS" : "✗ FAIL\n   " + f.error);
}

main().catch((e) => {
  console.error("DEBUG SCRIPT FAILED:", e);
  process.exit(1);
});
