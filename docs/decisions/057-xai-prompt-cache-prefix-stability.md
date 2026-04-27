# ADR 057: xAI prompt cache — два условия стабильности префикса

**Дата:** 2026-04-27
**Статус:** Принято
**Версия проекта:** 3.100.1

---

## Контекст

После v3.100.0 (`TZ_FixSimplyMemory`) Simply Chat начал грузить полную историю (~80K токенов вместо 7K раньше). DevPanel показал что **xAI prompt cache hit-rate ≈ 7%** — `cache_read` стабильно ~6K при input 80K. Cost / turn ₽1.73 вместо потенциальных ₽0.40-0.50.

Через побайтный diff HTTP request body двух соседних turns одного чата:
- Префикс совпадал ровно до **27 244 байта** (= system prompt + tools)
- Сразу после — **первое сообщение в массиве `messages`** разное между turns

Корни (два, обоих было):
1. **`getMessagesByChatId` имел `LIMIT 200`** при чате с 242 сообщениями — каждый turn хвост сдвигался на 2 (user+assistant), первое сообщение в выборке менялось
2. **xAI cache хранится per-server**, без header `x-grok-conv-id` запросы балансируются на разные машины — даже стабильный префикс не находит свой кэш

До v3.100.0 проблема была **невидима**: Simply грузил `excludeExtracted=true` (≤2 сообщений), `LIMIT 200` никогда не срабатывал, кэш был не критичен по объёму.

---

## Решение

**Для использования xAI prompt cache нужны ОДНОВРЕМЕННО два условия:**

### 1. Sticky routing per-conversation

Каждый HTTP запрос к xAI шлётся с header `x-grok-conv-id: <chatId>`. Это отправляет все запросы одного чата на тот же физический сервер, где живёт его кэш.

**Реализация:**
- [route.ts](../../app/(chat)/api/chat/route.ts) — `streamText({ headers: { "x-grok-conv-id": id } })` условно для `effectiveProvider === "xai"`
- [extract.ts](../../lib/ai/memory/extract.ts) — то же в `generateObject` для `batchExtractFacts` (chatId из input)
- AI SDK v6 поддерживает `headers: Record<string, string>` per-request на уровне `streamText` / `generateObject` — это работает для всех HTTP-based провайдеров

### 2. Стабильный байтовый префикс messages array

Каждый запрос к xAI шлёт `[system, ...messages, latest_user_message]`. xAI matcher сравнивает по **prefix bytes** — любой сдвиг внутри messages ломает кэш на этом байте и далее.

**Что обязательно:**
- **Не использовать `LIMIT N` для `getMessagesByChatId` без понимания**: при росте чата >N хвост сдвигается, первое сообщение меняется, префикс расходится. Сейчас лимит 10000 — заведомо недостижимо для одного чата. Реальный budget задаётся `maxTokens` через token-aware sliding window.
- **Если token-aware window отсекает старшие сообщения** (history > maxTokens) — это тоже нестабильность: какие именно сообщения отрезаются, зависит от размера новых сообщений. Решение: пороги `Soft 100K / Hard 170K` для Compaction должны срабатывать **до** того как sliding window начнёт обрезать. Сейчас maxTokens=140K, Hard=170K — окно sliding режет раньше Compaction. Это второй риск, watch-list.
- **MIND блок инжектится в конец последнего user-сообщения** ([route.ts:1180-1191](../../app/(chat)/api/chat/route.ts#L1180-L1191)) — НЕ в начало, не как отдельный system message. Если нарушить — каждый turn префикс расходится на динамическом MIND блоке.
- **Не ставить динамические значения в system prompt начале** (timestamps, currentDate, request id). Geo от Vercel сейчас стабилен — не трогать без проверки.
- **Tools schemas должны быть стабильны** при одинаковом chatMode. Если `getActiveToolNames(...)` возвращает разный список → кэш ломается на tools блоке.

---

## Причины

1. **xAI документация требует обоих условий явно** ([Maximizing Cache Hits](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/maximizing-cache-hits), [What Breaks Caching](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/multi-turn))
2. **Подтверждено эмпирически**: побайтный diff HTTP body показал что префикс расходится ровно на смене первого user-сообщения в array. После фикса — `cache_read` 70-80K на 2+ turns
3. **Token budget — единственно правильное ограничение**, лимит на количество сообщений (`maxMessages`) — anti-pattern (произвольное число вместо connected к context window провайдера)
4. **Cost-impact значительный**: для активного Simply chat без фикса — ₽1.73/turn × N запросов в день, с фиксом — ~₽0.40-0.50/turn

---

## Последствия

### Плюсы

- xAI cache работает на длинных историях (cache_read 70-80K стабильно)
- Cost / turn падает в 3-4× на 2+ turns в одном чате
- Token-aware sliding window становится единственным регулятором — простая ментальная модель
- Поведение единообразно для всех chatMode (`simply`, `expertise`, `create`, `project`)

### Минусы

- При истории >140K (ниже maxTokens) — sliding window начинает обрезать старшие, первое сообщение становится плавающим → cache ломается на этом окне. Митигация: Compaction Soft=100K срабатывает ДО — синтетический summary message стабилизирует префикс, пока state не меняется. Но если Compaction срабатывает заново (cumulative count>=trigger) — summary меняется, префикс ломается. Это **acceptable trade-off**: на 100K+ историях cache всё равно был бы критически нестабильным, Compaction решает важнее (не teppasing context limit модели).
- `LIMIT 10000` теоретически грузит больше сообщений из БД при очень длинных чатах. На практике 10K сообщений = десятки MB JSON в Node memory — приемлемо. Если когда-нибудь дойдёт до сотен тысяч — пересмотреть.

### Что НЕЛЬЗЯ делать в будущих изменениях

- ⛔ Добавлять `.limit(N)` в `getMessagesByChatId` без secondary `ORDER BY` ключа и без понимания что N будет недостижимым
- ⛔ Менять MIND блок в начало messages array (или отдельным system message — мы это **уже делали** до v3.95.0, кэш не работал; см. историю в [route.ts:1180-1191](../../app/(chat)/api/chat/route.ts#L1180-L1191))
- ⛔ Добавлять динамические значения (currentDate, requestId) в system prompt в первые ~6K токенов — оно гарантированно убьёт cache
- ⛔ Удалять / менять / переупорядочивать **уже существующие** сообщения в истории (xAI docs: «Only append new messages at the end»)
- ⛔ Переключать xAI на reasoning модель без передачи `reasoning_content` в истории или `previous_response_id` — для reasoning моделей cache требует специальной обработки

### Как проверять регрессии (диагностика)

Если DevPanel показывает `cache_read` сильно меньше ожидаемого на 2+ turn в одном чате:

1. Временно добавить `fetch` wrapper в [registry.ts](../../lib/ai/registry.ts) для xAI — дамп `init.body` в `console.log`:
   ```ts
   const xai = createXai({
     apiKey: process.env.XAI_API_KEY,
     fetch: async (url, init) => {
       if (init?.body && typeof init.body === "string") {
         const ts = Date.now();
         console.log(`[xAI-DEBUG-BEGIN ${ts}]`);
         console.log(init.body);
         console.log(`[xAI-DEBUG-END ${ts}]`);
       }
       return fetch(url, init);
     },
   });
   ```
2. Сделать 2 turn'а подряд в одном чате
3. Из dev лога вытащить два body, сохранить как файлы
4. `cmp file1 file2` → `differ: char NNN` — это смещение байтового расхождения
5. `dd if=file1 bs=1 skip=$((NNN-200)) count=400` показать контекст вокруг
6. **После диагностики ВЕРНУТЬ `xai = createXai({ apiKey })` без wrapper-а** (production не должен дампить body — там есть API ключи в headers)

---

## Альтернативы

### Альтернатива 1: secondary ORDER BY ключ вместо `LIMIT 10000`

**Что это:** оставить `LIMIT 200`, добавить `desc(message.id)` как secondary key для детерминированной сортировки.

**Почему отклонили:** не решает корневую проблему. При росте чата >200 хвост всё равно сдвигается — первое сообщение в выборке меняется turn-to-turn, независимо от стабильности порядка. Secondary key решает только коллизии createdAt (а в нашей БД их и нет — проверено SQL).

### Альтернатива 2: cursor-based pagination через oldest message ID

**Что это:** грузить «всё начиная с самого старого сообщения чата» — `WHERE chatId = ? ORDER BY createdAt ASC LIMIT 10000`.

**Почему отклонили:** функционально эквивалентно текущему дефолту `LIMIT 10000`, но более многословно. Sliding window ниже всё равно отрегулирует.

### Альтернатива 3: вообще не использовать LIMIT, грузить все сообщения

**Что это:** убрать `.limit(...)` из SQL.

**Почему отклонили:** `10000` оставлен как safety против случайного raw load миллионов записей (если кто-то когда-то завезёт спам-чат). Drizzle без `.limit()` не запрещает, но безопаснее explicit cap.

---

## Ссылки и ресурсы

- [xAI Docs — How Prompt Caching Works](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/how-it-works)
- [xAI Docs — Maximizing Cache Hits](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/maximizing-cache-hits)
- [xAI Docs — What Breaks Caching](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/multi-turn)
- [AI SDK v6 — streamText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — `headers: Record<string, string>` per-request
- [ADR 050 — Cache breakpoints strategy](./050-cache-breakpoints-strategy.md) — Anthropic-protocol cache_control breakpoints (другая тема, не xAI)
- [ADR 052 — Context management per provider](./052-context-management-strategy-per-provider.md) — провайдерные различия
- [ADR 054 — Single-strategy compaction](./054-single-strategy-compaction.md) — provider-agnostic Compaction (упоминание выше)
- Коммиты: [`b17b932`](../../app/(chat)/api/chat/route.ts) (v3.100.0 удалил `excludeExtracted` для Simply), [`3b1fcff`](../../lib/db/queries.ts) (v3.100.1 этот ADR)

---

## Примечания

**Урок процесса (Claude Code → Claude Code):** при изменениях, которые меняют **что грузит история чата** (token budgets, фильтры, лимиты загрузки сообщений) — **обязательно** проверять стабильность HTTP-префикса. Самый прямой способ — побайтный diff request body на 2 соседних turn'ах одного чата. Не угадывать.

**Когда задеть этот ADR в будущих ТЗ:**
- Изменение в `lib/db/queries.ts` функции `getMessagesByChatId` (особенно `.limit(...)`, `.orderBy(...)`, `excludeExtracted`)
- Изменение в `app/(chat)/api/chat/route.ts` — порядок сборки `messagesForRequest`, ин жекция MIND, headers для streamText
- Добавление любого dynamic content в system prompt (особенно в начало)
- Миграция с/на xAI любых call-sites (streamText, generateObject)
- Изменение `getActiveToolNames` или composer tools schemas
- Любая смена `effectiveModelId` ↔ `effectiveProvider` логики

---

## История изменений

- **2026-04-27** — Документ создан (Claude Opus 4.7 после диагностики через побайтный diff в рамках hotfix v3.100.1)
