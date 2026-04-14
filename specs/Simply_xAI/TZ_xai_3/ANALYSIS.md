# ТЗ-XAI-3 — ANALYSIS: KITT → Grok 4.1 Fast + R-6

**Создано:** 2026-04-15
**Автор:** Claude Code
**Статус:** Ожидает ответов Владимира перед написанием ROADMAP

> Это не SPEC. Это аудит кода + документации + открытые вопросы до старта работы. По новой схеме серии Simply_xAI (см. [SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) 2026-04-14 «Новая схема работы»).

---

## 1. Цель

Переключить основной дворецкий чат Simply (`chatMode === "simply"`, текст без вложений) с MiniMax M2.7 на Grok 4.1 Fast non-reasoning. Одновременно убрать хрупкую логику `isSimplyNonAnthropicModel` и связанные strip-функции — заменить на явный провайдер-агностичный подход через capabilities SSOT.

Принцип: убираем причину, а не симптом. После XAI-3 в коде не должно остаться костылей «если не anthropic — режь картинки».

---

## 2. Изученная документация

### Официальная — xAI (docs.x.ai/docs/models, 2026-04-15)

**grok-4-1-fast-reasoning и grok-4-1-fast-non-reasoning** (оба варианта):
- ✅ Vision: поддерживают `text, image → text`
- Context window: 2M tokens (каталог держит 128K как **архитектурный рабочий бюджет** — не менять, см. XAI-1 решение)
- Max image: 20MiB, форматы `jpg/jpeg/png`
- Pricing: $0.20 input / $0.05 cached / $0.50 output per 1M — совпадает с [model-catalog.ts:397-405](../../../lib/ai/model-catalog.ts#L397)

**Подтверждение для R-6:** Grok 4.1 Fast — мультимодальная модель. Стрипать media parts при переключении KITT на Grok архитектурно неправильно.

### Verified Grok parameters (из [SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) 2026-04-14)

- `reasoningEffort` — ❌ **Bad Request** для обоих вариантов Grok 4.1 Fast. Не передавать
- `presence_penalty` / `frequency_penalty` — ❌ для reasoning, ✅ для non-reasoning. Для KITT не нужны
- `temperature` — ✅ принимает 0-2
- Автоматические reasoning tokens — у non-reasoning варианта `reasoning_tokens = 0`, как и ожидается

### AI SDK v6 `@ai-sdk/xai`

Стандартный `@ai-sdk/xai` через `createProviderRegistry` уже инициализирован в [lib/ai/registry.ts](../../../lib/ai/registry.ts) (verified в ТЗ-1). Vision работает через стандартный UI message protocol: `{ type: "image", ...}` → SDK конвертирует в OpenAI-style `image_url` content parts. Нам на уровне route.ts ничего специально форматировать не надо — AI SDK делает это сам.

---

## 3. Аудит кода: что сейчас происходит в Simply Chat route

### 3.1. Роутинг моделей — [chat/route.ts:596-610](../../../app/(chat)/api/chat/route.ts#L596)

```ts
if (chatMode === "simply") {
  if (think) {
    activeTaskId = "simply-chat-think";
  } else if (hasAttachments(message.parts)) {
    activeTaskId = "simply-chat-vision";
  } else {
    activeTaskId = "simply-chat";
  }
}
```

`hasAttachments` — [chat/route.ts:245-250](../../../app/(chat)/api/chat/route.ts#L245):
```ts
function hasAttachments(parts: any[]): boolean {
  return parts.some((p: any) =>
    p.type === "image" ||
    (p.type === "file" && p.mediaType !== "text/plain")
  );
}
```

**Важно:** `text/plain` не считается attachment → идёт через `simply-chat`, не через `simply-chat-vision`.

### 3.2. Текущие defaults — [task-assignments.ts:86-88](../../../lib/ai/task-assignments.ts#L86)

```ts
"simply-chat":              "MiniMax-M2.7",
"simply-chat-think":        "claude-sonnet-4-6",
"simply-chat-vision":       "claude-haiku-4-5-20251001",
```

Dev overrides в `.simply-dev-overrides.json` сейчас:
```json
{"simply-chat":"grok-4-1-fast-non-reasoning","simply-chat-think":"grok-4-1-fast-reasoning"}
```

Это **временный эксперимент**, не финальный выбор. Цель XAI-3: `simply-chat` default → Grok 4.1 Fast. `simply-chat-think` остаётся на Sonnet до ТЗ-XAI-5 (где отдельно уедет на Grok 4.20 — см. Roadmap серии).

### 3.3. Strip-функции — [chat/route.ts:257-325](../../../app/(chat)/api/chat/route.ts#L257)

**`stripMediaPartsForTextModel`** (L257-284): заменяет image/file parts на текстовые плейсхолдеры (`[изображение]`, `[файл]`, для `text/plain` — инлайнит содержимое `--- Файл: ... ---\n{text}\n---`). Нужна только когда модель не поддерживает vision. Grok 4.1 Fast умеет vision → логика умирает.

**`stripLegacyOpenAICompatToolParts`** (L286-325): фильтрует orphan tool-call parts с `toolCallId.startsWith('call_function_')`. Это MiniMax-специфичный формат, оставшийся от OpenAI-compat режима (до ТЗ-CacheAudit) + текущего Anthropic-compat режима (MiniMax всё ещё эмитит тот же формат).

**`isSimplyNonAnthropicModel`** (L919-920): флаг `chatMode === "simply" && effectiveProvider !== "anthropic"`. Управляет:
1. **Выбором stripMediaPartsForTextModel** (L961-963) — ломает vision при переключении на Grok
2. **Temperature** `0.7 : 1.0` (L1031) — MiniMax требовал ≤1.0, Grok принимает 0-2

### 3.4. Сборка `preparedHistory` — [chat/route.ts:958-967](../../../app/(chat)/api/chat/route.ts#L958)

Текущий код:
```ts
const cleanedHistory = stripIncompleteToolParts(uiMessages);
const preparedHistory =
  chatMode === "simply"
    ? isSimplyNonAnthropicModel
      ? stripMediaPartsForTextModel(stripLegacyOpenAICompatToolParts(cleanedHistory))
      : stripLegacyOpenAICompatToolParts(cleanedHistory)
    : cleanedHistory;
```

Три вложенных тернарника, две функции, один флаг. После R-6 это должно схлопнуться.

### 3.5. Prompt caching и Compaction — уже провайдер-aware

- `isAnthropicProtocolModel = anthropic || minimax` (L929-930) — под Grok становится `false`, cache breakpoints / `providerOptions.anthropic.cacheControl` не ставятся. **No-op, ничего не трогаем.**
- `supportsCompaction` (L900-901) читает `effectiveCatalogEntry.capabilities.supportsCompaction` — у Grok `false` → блок `compactionOptions = undefined` → `providerOptions` в `streamText` получает `undefined`. **Уже no-op под Grok.**

### 3.6. SQL audit dev БД (2026-04-15)

```sql
SELECT
  COUNT(*) FILTER (WHERE parts::text LIKE '%call_function_%') AS legacy_minimax,
  COUNT(*) FILTER (WHERE parts::text LIKE '%"type":"image"%' OR parts::text LIKE '%"type":"file"%') AS media,
  COUNT(*) AS total
FROM "Message_v2"
WHERE "chatId" IN (SELECT id FROM "Chat" WHERE "chatMode" = 'simply');
```

Результат:
```
legacy_minimax_tool_parts: 0
messages_with_media:       0
total_messages:            20
```

**Но:** dev БД была очищена `TRUNCATE CASCADE` в ТЗ-XAI-2 smoke test. Production БД может содержать legacy parts. Этот аудит — только для dev. Нужно повторить SQL против prod-коннекшена перед удалением `stripLegacyOpenAICompatToolParts` — либо принять решение что функция остаётся «тихим часовым» без флагов.

### 3.7. Другие consumers strip-функций

Grep показал: `stripMediaPartsForTextModel` / `stripLegacyOpenAICompatToolParts` / `isSimplyNonAnthropicModel` — используются **только в [chat/route.ts](../../../app/(chat)/api/chat/route.ts)**. Нигде больше. Удаление ограниченного радиуса.

---

## 4. Предлагаемый план изменений (черновик)

### 4.1. task-assignments.ts — одна строка

```diff
- "simply-chat":              "MiniMax-M2.7",
+ "simply-chat":              "grok-4-1-fast-non-reasoning",
```

`simply-chat-think` и `simply-chat-vision` **не трогаем** (XAI-5 и vision на Haiku — отдельные решения).

### 4.2. chat/route.ts — удаление `isSimplyNonAnthropicModel` + strip-функций

**Удалить:**
- `stripMediaPartsForTextModel` (функция L257-284)
- `isSimplyNonAnthropicModel` флаг (L919-920)

**Решить по `stripLegacyOpenAICompatToolParts`:** зависит от ответа на Q1 ниже.

**Упростить `preparedHistory`:**
```ts
// Вариант A — самый чистый (если Q1 = удалить strip legacy):
const preparedHistory = stripIncompleteToolParts(uiMessages);

// Вариант B — defense-in-depth (если Q1 = оставить):
const preparedHistory = chatMode === "simply"
  ? stripLegacyOpenAICompatToolParts(stripIncompleteToolParts(uiMessages))
  : stripIncompleteToolParts(uiMessages);
```

**Temperature:** заменить `isSimplyNonAnthropicModel ? 0.7 : 1.0` на что-то из Q2.

### 4.3. Что точно не трогаем

- `providerOptions.anthropic.cacheControl` + `isAnthropicProtocolModel` — уже gracefully no-op под Grok
- `compactionOptions` — уже gracefully no-op (capabilities-driven)
- Vision routing (`simply-chat-vision` → Haiku) — остаётся
- Sliding window / Extract-on-compression — архитектурные константы серии
- MIND memory transplant на последний user message — работает для Anthropic-protocol; под Grok MIND идёт как system message (legacy path), это уже учтено в L990-1024
- Tools (`getStandardTools` + `getActiveToolNames`) — function calling работает в xAI через Chat Completions (verified в XAI-2)
- `sanitizeCoreMessages` — универсальная санитация, не трогаем
- `stripIncompleteToolParts` — универсальная, не трогаем
- `hasAttachments` — не трогаем

---

## 5. Открытые вопросы для Владимира

### Q1 — `stripLegacyOpenAICompatToolParts`: удалить или оставить?

**Контекст:**
- В **dev БД** 0 legacy parts (очищена в XAI-2)
- В **prod БД** — неизвестно. Могут быть сообщения от MiniMax эры (до v3.90.0) с `call_function_*` в `toolCallId`
- Функция применяется **только** в Simply chatMode, применена к истории перед конверсией в CoreMessages
- Grok через `@ai-sdk/xai` не использует `call_function_` формат — если такие parts попадут в запрос, AI SDK конвертер либо их проигнорирует, либо сломается

**Три варианта:**

**A. Удалить полностью.** Чисто, меньше кода. Риск: первый prod-юзер с legacy parts в истории может получить 400. Можно провериться SQL по prod перед коммитом.

**B. Оставить как тихий часовой, убрать `chatMode === "simply"` гейт.** Применять всегда — она no-op когда нечего чистить. Стоит O(n) итерации по parts, по факту бесплатно. Docstring поправить: убрать упоминание MiniMax, назвать «orphan legacy tool-call sanitizer для миграционных данных». Функция станет универсальной.

**C. Оставить в текущем виде (только simply), удалить только `stripMediaPartsForTextModel` + `isSimplyNonAnthropicModel`.** Минимальный delta. Не самый чистый код, но безопасно.

**Моя рекомендация:** **B**. Причина — защита реального пользовательского опыта на миграционный период стоит 10 строк безобидного кода. Переименовать функцию — `sanitizeOrphanLegacyToolCalls`, снять simply-гейт, поставить до `stripIncompleteToolParts` как второй универсальный санитайзер. В ТЗ-XAI-6 окончательно убрать когда убедимся что данных нет.

**Что ты скажешь?**

---

### Q2 — Temperature для KITT на Grok

**Контекст:**
- Сейчас `isSimplyNonAnthropicModel ? 0.7 : 1.0`
- MiniMax требовал ≤1.0 → 0.7 был компромиссом креативности
- Claude Sonnet/Haiku получали 1.0 (дефолт)
- Grok 4.1 Fast принимает 0-2 (verified)

**Варианты:**

**A. Убрать параметр вообще.** AI SDK / провайдер используют свой дефолт (для xAI обычно 1.0). Меньше кода, но теряем явный контроль.

**B. `temperature: 1.0` хардкодом.** Единое значение для всех провайдеров KITT (Grok, Haiku при vision). Явный, читаемый.

**C. `temperature: 0.7`.** Консервативнее — ответы меньше варьируются. Может подойти дворецкому-KITT, который должен быть последовательным.

**Моя рекомендация:** **B (1.0)**. Причина — 0.7 был MiniMax-специфичным компромиссом (их дефолт креативности на верхней границе их допустимого диапазона), это не было продуктовое решение «нам нужен именно 0.7 для KITT». 1.0 — стандартный дефолт, читаемый.

**Что ты скажешь?**

---

### Q3 — text/plain файлы после R-6

**Контекст:**
- `hasAttachments` **не считает** text/plain аттачментом → идёт на `simply-chat` (Grok), не на `simply-chat-vision` (Haiku)
- Сейчас `stripMediaPartsForTextModel` имеет спец-обработку для `p.mediaType === "text/plain"` — извлекает `.text` и инлайнит как `--- Файл: ... ---\n{text}\n--- Конец файла ---`
- После удаления `stripMediaPartsForTextModel` — что будет с text/plain? Ответ зависит от того как AI SDK конвертирует `FilePart { mediaType: "text/plain", text?: string }` в xAI content

**Риск:** если `.text` — это Simply-specific поле, AI SDK его не увидит, а `url` (стандартное поле для base64) может быть пустым → text/plain файлы сломаются на Grok.

**Гипотеза:** нужно либо (а) проверить как Simply UI сейчас формирует FilePart для text/plain (куда кладётся содержимое — в `.text` или `.url`), либо (б) добавить text/plain в `hasAttachments` и отправлять их на vision-route (Haiku умеет text/plain нативно), либо (в) сохранить конвертацию text/plain в inline text как отдельную маленькую функцию `inlineTextFileParts` — провайдер-агностичную.

**Моя рекомендация:** до ответа на этот вопрос **не удаляю** `stripMediaPartsForTextModel` полностью — оставляю только text/plain inline branch как `inlineTextFileParts(messages)`, применяю всегда (Claude тоже выигрывает от inline text вместо base64 blob). Image/file branches удаляю.

**Уточнение для тебя:** можешь подтвердить что текущее поведение «пользователь загружает .txt → содержимое инлайнится в сообщение» — важное для UX и не должно сломаться? Или text/plain файлы реально редко используются и проще добавить в `hasAttachments`?

---

### Q4 — SQL audit prod перед удалением

**Контекст:**
- Вариант A из Q1 требует проверки prod БД на legacy `call_function_*` parts
- MCP `mcp__postgres__query` сейчас подключен к dev-БД (предполагаю)
- Для prod нужен отдельный запрос или временное переключение коннекшена

**Вопрос:** у тебя есть доступ к prod БД через MCP, или нужно подключить через Neon dashboard / SQL руками? Если несложно — давай сделаем SQL аудит prod до финального решения по Q1.

---

### Q5 — Подтверждение scope XAI-3

**Что ВХОДИТ в XAI-3 (по моему пониманию):**
1. ✅ `simply-chat` default → Grok 4.1 Fast non-reasoning
2. ✅ R-6: удалить `isSimplyNonAnthropicModel` + упростить preparedHistory
3. ✅ Удалить `stripMediaPartsForTextModel` (кроме возможно text/plain inline branch — Q3)
4. ✅ Решение по `stripLegacyOpenAICompatToolParts` (Q1)
5. ✅ Temperature решение (Q2)
6. ✅ Снять dev overrides через `/dev/models` перед smoke-тестом
7. ✅ Smoke-тест: отправить текст → проверить логи Model selection + живой ответ Grok
8. ✅ Smoke-тест: отправить фото → проверить что ушло на Haiku (simply-chat-vision, не Grok)
9. ✅ Smoke-тест: отправить фото с think → проверить что simply-chat-think работает на текущем default (Sonnet пока что, до XAI-5)
10. ✅ `npx tsc --noEmit` — 0 ошибок
11. ✅ `npm run build` — успешен
12. ✅ Обновить CHANGELOG серии + NOTES + ROADMAP прогресс + bump версии v3.90.0

**Что НЕ ВХОДИТ:**
- ❌ `simply-chat-think` миграция на Grok 4.20 (это XAI-5)
- ❌ Удаление MiniMax namespace из registry (это XAI-6)
- ❌ Удаление `vercel-minimax-ai-provider` package (XAI-6)
- ❌ Briefing/podcast/meeting pipelines (XAI-4)
- ❌ Compaction API cleanup (осталось до XAI-6, уже no-op)

**Подтверди scope или скажи что добавить/убрать.**

---

## 6. Риски

| Риск | Тяжесть | Митигация |
|---|---|---|
| Vision маршрут сломается — current message с фото попадёт на Grok вместо Haiku | Средний | Smoke-тест шаг 8 перед коммитом. Если `hasAttachments` вернёт true — routing в L602 уже отправит на `simply-chat-vision`. Это не изменяется R-6 |
| Prod users с legacy `call_function_*` parts получат 400 после коммита | Средний | Q1 решить вариантом B (тихий часовой) или Q4 SQL prod |
| text/plain файлы перестанут инлайниться | Средний | Q3 выше, не удалять inline branch без подтверждения |
| Grok 4.1 Fast 128K лимит каталога vs реальный 2M → что-то будет считать не так | Низкий | Каталог — рабочий бюджет (per XAI-1 decisions), sliding window 140K сама по себе ниже. Ничего не сломается |
| `@ai-sdk/xai` не передаст image parts в правильном формате | Низкий | AI SDK v6 стандартизирован, изображения — стандартный UI protocol. Но проверится при smoke-тесте с фото (если в simply-chat-vision вдруг упадём на Grok) |
| Regression в Simply Chat MIND extract timing | Низкий | Extract-on-compression сохраняется, threshold-based триггер не зависит от провайдера |

---

## 7. Что делаю дальше

**Жду твои ответы на Q1, Q2, Q3, Q4, Q5.** После этого:
1. Пишу `ROADMAP.md` с пошаговым планом (Этапы: task-assignments → strip cleanup → smoke tests → validation → finalization)
2. Согласую ROADMAP с тобой перед началом кода
3. Поэтапно реализую + мануальный тест на каждом этапе (правило CLAUDE.md)
4. Финализация: bump версии, CHANGELOG серии, обновление NOTES и ROADMAP прогресса

**Никакого кода до согласования ROADMAP.**
