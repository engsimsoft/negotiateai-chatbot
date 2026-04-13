# ТЗ-GrokContextWindowAudit (Follow-up из TZ_LegacyChatCleanup, Finding #1)

**Импакт:** low · **Оценка:** 0.5 сессии · **Создано:** 2026-04-13

## Цель

Эмпирически проверить реальный context window для Grok 4.20 моделей через xAI API и обновить `lib/ai/model-catalog.ts`. Сейчас каталог говорит 256K, docs.x.ai — 2M.

## Контекст находки

В `lib/ai/model-catalog.ts:283-285` есть комментарий-признание костыля:

> **xAI Grok — pricing verified against docs.x.ai/docs/models (2026-04-12).**
> **Context window: docs.x.ai reports 2M for all models, but this may be actual API testing. Re-check at next audit.**

Предыдущий агент **намеренно занизил** значение `contextWindow` с 2M до 256K «из осторожности», оставив TODO без следа в задачах. Это классический «осторожный костыль»:
- Vendor docs говорят одно
- Наш SSOT говорит другое
- Никто не проверил эмпирически
- TODO повис в комментарии и забылся

## Что нужно

### Часть 1 — Эмпирический тест

Создать `scripts/test-grok-context-window.ts` (по образцу `scripts/test-minimax-anthropic-compat.ts`):

```ts
import { config } from "dotenv";
import { generateText } from "ai";
import { xai } from "@ai-sdk/xai"; // или через наш registry

config({ path: ".env.local" });

async function test(targetTokens: number, modelId: string) {
  // Сгенерировать prompt с примерно targetTokens токенов
  // (повторить «слово » N раз; estimate ~1 token per 4 chars)
  const prompt = ("слово ".repeat(targetTokens))
    + "\n\nQuestion: count how many times the word 'слово' appears.";

  try {
    const result = await generateText({
      model: xai(modelId),
      prompt,
      maxTokens: 50,
    });
    console.log(`✅ ${modelId} @ ${targetTokens} tokens: SUCCESS`);
    console.log(`   inputTokens: ${result.usage.inputTokens}`);
    console.log(`   response: ${result.text.slice(0, 100)}`);
    return { ok: true, inputTokens: result.usage.inputTokens };
  } catch (error) {
    console.log(`❌ ${modelId} @ ${targetTokens} tokens: FAIL`);
    console.log(`   error: ${error instanceof Error ? error.message : error}`);
    return { ok: false };
  }
}

async function main() {
  const models = [
    "grok-4.20-0309-non-reasoning",
    "grok-4.20-multi-agent-0309",
  ];
  const targets = [256_000, 512_000, 1_000_000, 2_000_000];

  for (const model of models) {
    for (const t of targets) {
      await test(t, model);
    }
  }
}

main();
```

Запустить: `npx tsx scripts/test-grok-context-window.ts`. Удалить файл после — это одноразовый аудит.

### Часть 2 — Обновить каталог

На основе результатов:
- **Если все 4 теста PASS на 2M** — обновить `contextWindow: 2_000_000` для всех `grok-4.20-*` записей в `lib/ai/model-catalog.ts`. Заменить комментарий-TODO на «verified empirically YYYY-MM-DD up to 2M tokens».
- **Если PASS только до X токенов** — выставить `contextWindow: X` и добавить комментарий с реальной планкой.
- **Если результат странный** (например, 1M PASS но 1.5M FAIL) — задокументировать аномалию, поднять issue в xAI docs если есть форум, оставить разумное значение

### Часть 3 — Обновить ADR (опционально)

Если решение нетривиальное (например, занижение контекста по соображениям стоимости) — создать ADR `docs/decisions/0XX-grok-context-window.md`.

## Definition of Done

- Эмпирические данные собраны для всех `grok-4.20-*` моделей в каталоге
- `model-catalog.ts` обновлён реальным значением, комментарий-TODO заменён на verified-метку
- `scripts/test-grok-context-window.ts` удалён после выполнения
- Если правка не тривиальная — ADR создан

## Риски

- **Стоимость теста**: отправка 2M токенов в Grok = ~$4 за вызов (input $2/1M). 4 модели × 4 размера = 16 вызовов = до **~$64**. Уменьшить через бинарный поиск: 256K → 1M → 2M, остановиться при первой ошибке. Так получится 3-6 вызовов вместо 16
- **Rate limits**: xAI может иметь TPM (tokens per minute) лимит. При FAIL смотреть код ошибки — это лимит или real context overflow
