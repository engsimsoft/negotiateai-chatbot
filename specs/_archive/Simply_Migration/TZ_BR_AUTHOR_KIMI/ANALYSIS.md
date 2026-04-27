# Анализ ТЗ-BR-AUTHOR-KIMI

**Дата анализа:** 2026-04-27
**Версия SPEC:** финал от владельца, без правок

---

## Резюме

Миграция трёх taskId briefing pipeline (`briefing:author`, `briefing:section`, `briefing:podcast-script`) с MiniMax на Kimi K2.6 через официальный пакет `@ai-sdk/moonshotai`. Закрывает silent hang в production (с 23.04.2026 после апгрейда `ai@6.0.168`). Полная зачистка MiniMax из проекта.

---

## Изученная документация (Правило 1 WORKFLOW)

### `@ai-sdk/moonshotai` — официальный Vercel-пакет

- **Источник:** [npm registry](https://registry.npmjs.org/@ai-sdk/moonshotai), [vercel/ai/tree/main/packages/moonshotai](https://github.com/vercel/ai/tree/main/packages/moonshotai), [ai-sdk.dev/providers/ai-sdk-providers/moonshotai](https://ai-sdk.dev/providers/ai-sdk-providers/moonshotai)
- **Версия для нашего AI SDK v6 (`ai@^6.0.168`):** `@ai-sdk/moonshotai@2.0.11` (dist-tag `ai-v6`). Latest stable 2.0.16, beta 3.0.0-beta.31 — но они для AI SDK v7. **Нужно ставить через `@ai-v6` тег**, иначе peer mismatch.
- **Factory:** `createMoonshotAI({ apiKey })` (точное имя, не `createMoonshot`).
- **Базовый URL по умолчанию:** `https://api.moonshot.ai/v1` (Global, как и в SPEC).
- **Поддерживает:** `streamText`, `generateText`. `generateObject` — open issue [#12871](https://github.com/vercel/ai/issues?q=is%3Aissue+moonshotai+in%3Atitle) (`supportsStructuredOutputs` не включён). Нам не критично — все 3 briefing call-sites используют `generateText`/`streamText` + JSON.parse + Zod, не `generateObject`.
- **providerOptions схема (из исходника `moonshotai-chat-options.ts`):**
  ```ts
  providerOptions: {
    moonshotai: {
      thinking: { type: 'enabled' | 'disabled', budgetTokens?: number },
      reasoningHistory: 'disabled' | 'interleaved' | 'preserved'
    }
  }
  ```
- **ENV convention:** `MOONSHOT_API_KEY` — да, это официальная переменная. Совпадает с SPEC.

### Kimi K2.6 — модель

- **Дата релиза:** 2026-04-20.
- **Точный model id:** `kimi-k2.6` (lowercase, точка). Источник: [platform.kimi.ai/docs/guide/kimi-k2-6-quickstart](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart), [vercel.com/changelog/kimi-k2.6-on-ai-gateway](https://vercel.com/changelog/kimi-k2.6-on-ai-gateway).
- ⚠ **`kimi-k2.6` НЕ в типе `MoonshotAIChatModelId` пакета 2.0.11.** Список в исходнике: `moonshot-v1-{8k,32k,128k}`, `kimi-k2`, `kimi-k2-0905`, `kimi-k2-thinking`, `kimi-k2-thinking-turbo`, `kimi-k2-turbo`, `kimi-k2.5`. Передача строкой работает (under hood — openai-compatible), но при прямом вызове провайдера потребуется `as` cast или `string` тип. Для caталога это не проблема — `modelId: string`.
- **Pricing:** **$0.95 / 1M input, $4.00 / 1M output** (Moonshot Platform, без cache). С prompt-cache hit: **$0.16 / 1M input** (-83%), output без изменений. Источники: [progressiverobot.com](https://www.progressiverobot.com/2026/04/21/kimi-k2-6/), [langcopilot.com/llm-pricing/moonshot/kimi-k2.6](https://langcopilot.com/llm-pricing/moonshot/kimi-k2.6).
  → SPEC указывал «$1.71 blended» — это среднее по их формуле. В catalog нужно записать раздельно input/output.
- **Context window:** 256K tokens. Max output: 32_768 (по официальному API spec).

### Параметры Instant mode (без reasoning)

Из [platform.kimi.ai/docs/guide/kimi-k2-6-quickstart](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart):

| Параметр | Значение | Жёсткость |
|---|---|---|
| `temperature` | **0.6** для non-thinking, 1.0 для thinking | Quickstart явно говорит «другие значения дают ошибку» |
| `top_p` | **0.95** | Жёсткое требование quickstart |
| `max_completion_tokens` (новое имя в API) | default 32_768 | через `@ai-sdk/moonshotai` абстрагируется как `maxOutputTokens` |
| `stream` | да, поддерживается | — |
| Thinking off | `providerOptions.moonshotai.thinking = { type: 'disabled' }` | подтверждён |

**Расхождение с текущим кодом:** во всех 3 briefing call-sites сейчас `temperature: 0.7`. После миграции — обязательно 0.6 + явный `topP: 0.95`. Без этого Kimi возвращает ошибку.

### Известные баги (релевантные)

- **Streaming bug `<|tool_calls_section_begin|>` в reasoning_delta** — затрагивает только `kimi-k2-thinking`, **не k2.6**. Нам не релевантно.
- **Multi-turn tool calling с reasoning_content** — Moonshot stateless, требует возврата reasoning_content в next turn. Нам не релевантно: briefing single-turn без tools.
- **`generateObject` ограничен** (issue #12871, open). Нам не релевантно: используем `generateText` + JSON.parse + Zod.

---

## Состояние кода (из глубокой разведки)

### Текущие call-sites — параметры

| call-site | метод | temp | topP | maxOutputTokens | providerOptions |
|---|---|---|---|---|---|
| `lib/briefing/briefing-author.ts:210` | `streamText` | 0.7 | (не передаётся) | `MAX_TOKENS_BY_VOLUME[volume]` 8192/16384/32768 | нет |
| `lib/briefing/briefing-section-author.ts:189` | `streamText` | 0.7 | (не передаётся) | `getMaxOutputTokensForTask("briefing:section")` = 8192 | нет |
| `lib/podcast/script-generator.ts:123` | `generateText` | 0.7 | (не передаётся) | `getMaxOutputTokensForTask("briefing:podcast-script")` = 4096 | **`{ anthropic: { cacheControl: { type: "ephemeral" } } }` на system + user (line 132, 137)** |

### Catalog / registry — что удаляется

| Локация | Что |
|---|---|
| `lib/ai/registry.ts:14-46` | `import { createMinimax }`, `const minimax = createMinimax(...)`, `const minimaxLong = createMinimax(...)`, registration `{ minimax, minimaxLong }` |
| `lib/ai/registry.ts:71-76` | `RegistryProviderId` тип — удалить `"minimax" \| "minimaxLong"` |
| `lib/ai/getModel.ts:103,115,121-126` | special case `MiniMax-M2.7-long` → `minimaxLong:MiniMax-M2.7` в `buildRegistryId` |
| `lib/ai/model-catalog.ts:21,125-135,297-320` | provider tag `"minimax"`, `CAPS_MINIMAX`, две catalog entries (`MiniMax-M2.7`, `MiniMax-M2.7-long`) |
| `lib/ai/usage-utils.ts:128` | `if (modelId.startsWith("MiniMax")) return "minimax";` — обновить на startsWith("kimi") |
| `app/(dashboard)/dev/models/page.tsx:40` | `{ provider: "minimax", envVar: "MINIMAX_API_KEY", isLlmRegistry: true }` — удалить, добавить `moonshotai` |
| `components/dev-panel/sections/{model-section,timeline-section}.tsx`, `dev-panel-footer.tsx` | display names hardcoded `"MiniMax-M2.7"`, `"MiniMax·L"` — удалить или заменить |
| `scripts/test-minimax-via-registry.ts` | переписать как `test-kimi-via-registry.ts` |
| `scripts/test-minimax-anthropic-compat.ts` | удалить (Anthropic-compat больше не используется) |
| `package.json` dependencies | `vercel-minimax-ai-provider: ^0.0.2` → удалить, добавить `@ai-sdk/moonshotai@ai-v6` |

### Только в комментариях (тоже под зачистку)

- `lib/briefing/briefing-author.ts:1, 160` — `// ТЗ-Briefing-1: ... using MiniMax M2.7`
- `lib/briefing/briefing-section-author.ts:1, 141, 177` — комментарии
- `lib/briefing/briefing-filter.ts:1` — `// ТЗ-Briefing-1: Stage 1 — Filter & deduplicate using MiniMax M2.7` (filter уже на Grok, комментарий устарел)
- `lib/podcast/script-generator.ts:2` — комментарий
- `lib/ai/task-assignments.ts:11, 105, 185-189` — комментарии
- `app/(chat)/api/chat/route.ts:668, 1029-1034, 1223-1224` — комментарии (chat не использует MiniMax с ТЗ-XAI-4, только old comments)
- `app/(chat)/api/briefing/generate/route.ts:10` (`maxDuration = 240; // ТЗ-Briefing-1: MiniMax M2.7 thinking model needs more time`)
- `app/(chat)/api/briefing/refresh-section/route.ts:25` (`maxDuration = 180`)
- `lib/utils.ts:160` — общий комментарий о MiniMax/Anthropic edge case (можно оставить — описывает паттерн)
- `app/api/dev/set-override/route.ts:57` — пример URL `?task=simply-chat&model=MiniMax-M2.7`

### MINIMAX_API_KEY usage

- `lib/ai/registry.ts:35, 42` — две фабрики
- `scripts/test-minimax-*.ts` — debug logs
- `app/(dashboard)/dev/models/page.tsx:40` — provider env map

→ После миграции `MINIMAX_API_KEY` нигде в production не используется. Можно удалить из ENV (Vercel + локальный `.env.local`).
**В `.env.example` ключа изначально не было** (пропуск документации). Добавляем только `MOONSHOT_API_KEY`.

### Lockfile

- `package-lock.json` — 2026-04-23 (свежее)
- `pnpm-lock.yaml` — 2026-04-14
- `package.json` → `"packageManager": "pnpm@9.12.3"`
- CLAUDE.md команды — `npm install`, `npm run build`
- SPEC команды — `pnpm tsc --noEmit`, `pnpm tsx ...`

**Конфликт.** Нужно прояснить с владельцем (см. вопрос Q1).

---

## Рекомендации разработчика (Код-ревью SPEC)

> Ниже — технические замечания на основе кода и официальной доки. Каждое требует согласования.

### ✅ Согласен с SPEC

- `@ai-sdk/moonshotai` (не `@ai-sdk/openai-compatible`) — нативный пакет от Vercel, официально поддерживается, инкапсулирует thinking control. Альтернатива `openai-compatible` потребует ручной отправки `thinking` через body
- Mode = Instant (`thinking: { type: 'disabled' }`) — для длинного связного текста briefing reasoning не даёт качества, только увеличивает latency и цену
- 180s timeout наследуется от `minimaxLong`
- Скрипт `test-kimi-via-registry.ts` по паттерну `test-minimax-via-registry.ts`
- Dev-панель: карточка `moonshotai` + регистрация `kimi-k2.6` в dropdown
- ENV `MOONSHOT_API_KEY` — соответствует официальной convention

### ⚠️ Рекомендую дополнить SPEC

| # | Что | Обоснование из кода/доки |
|---|---|---|
| 1 | **temperature 0.7 → 0.6 + добавить topP 0.95 в трёх call-sites** | Все 3 файла сейчас передают `temperature: 0.7`. Quickstart Kimi: «иные значения дают ошибку». Без правки запросы упадут. SPEC говорит про 0.6/0.95 в общем виде, но не указывает что это правка трёх конкретных файлов |
| 2 | **Удалить `providerOptions.anthropic.cacheControl` из `script-generator.ts:132,137`** | После миграции это зомби-параметр (Moonshot его игнорирует, Anthropic-обёртка не используется). Moonshot имеет автоматическое prompt-caching ($0.16/$0.95 = -83% при cache hit), не требует ручного управления. Также проверить `extractUsageForPricing` ([lib/ai/usage-utils.ts:128](lib/ai/usage-utils.ts#L128)) — он сейчас детектит MiniMax по `startsWith("MiniMax")` и читает usage в anthropic-формате. Для Kimi нужен openai-формат (`prompt_tokens_details.cached_tokens`) |
| 3 | **Один namespace `moonshotai` с 180s timeout** | SPEC уже говорит «Namespace `moonshotai` с timeout 180 сек» — подтверждаю. Не делаем `moonshotai` + `moonshotaiLong` отдельно, все 3 briefing-задачи long. Это упростит `getModel.ts` (убираем special case `buildRegistryId`) |
| 4 | **Default temperature/top_p вынести в `defaultParams` catalog entry** | Поле уже поддерживается ([model-catalog.ts:82-101](lib/ai/model-catalog.ts#L82-L101)). Запись `kimi-k2.6` в catalog с `defaultParams: { temperature: 0.6, topP: 0.95 }` — тогда правки в трёх call-sites сводятся к удалению локальных hard-coded значений. Меньше дублирования, единое место правки если Moonshot relax-нёт ограничения в будущем. **Но:** нужно проверить, применяются ли `defaultParams` через AI SDK автоматически или их надо явно прокидывать. Если автоматически нет — оставляем явные значения в трёх файлах |
| 5 | **`kimi-k2.6` тип-кастинг** | В пакете 2.0.11 типа `MoonshotAIChatModelId` нет нашей модели. В catalog `modelId: string` — норм. Если где-то нужен прямой вызов `provider.chat("kimi-k2.6")` — `as MoonshotAIChatModelId` cast (не блокер, но указать в коде комментарием со ссылкой на upstream issue, чтобы при обновлении пакета можно было убрать) |
| 6 | **Удалить `scripts/test-minimax-anthropic-compat.ts` целиком** | После миграции тест Anthropic-compat обвязки не нужен (обвязки больше нет). SPEC об этом не говорит — добавить в «Что удаляем» |
| 7 | **Обновить `lib/ai/usage-utils.ts:128`** | `if (modelId.startsWith("MiniMax")) return "minimax"` → заменить на детект Kimi (или удалить целиком если функция больше нигде не использует minimax). Это влияет на pricing-расчёты в логах |
| 8 | **Обновить комментарии в `route.ts`** в briefing endpoints с `maxDuration` — упоминание «MiniMax M2.7 thinking model needs more time» устарело | Косметика, но в scope зачистки SPEC «MiniMax уходит из проекта полностью» |
| 9 | **`MAX_TOKENS_BY_VOLUME` совпадает с capability Kimi** | 32768 = ровно потолок Kimi maxOutput. С `thinking: disabled` весь output чистый, runaway risk минимальный. Замечаний нет, документирую как факт |

### ❓ Требует уточнения от владельца

(см. секцию «Вопросы»)

---

## Вопросы для уточнения

1. **Lockfile / packageManager.** В репо одновременно `package-lock.json` (2026-04-23) и `pnpm-lock.yaml` (2026-04-14). `package.json` → `packageManager: pnpm@9.12.3`. CLAUDE.md → `npm install`. SPEC → `pnpm tsc`. Какой реально используется? Удалить `package-lock.json` если pnpm — правильный? Я не буду делать это без подтверждения.

2. **Cache breakpoints в `script-generator.ts`.** Удаляем `providerOptions: { anthropic: { cacheControl: ... } }` (Moonshot имеет автоматический prompt-cache, ручное управление в openai-compatible пакете не предусмотрено)? Или оставить и попробовать прокинуть аналог через `providerOptions.moonshotai.cacheControl` (этого ключа в схеме нет, отвалится)?

3. **`extractUsageForPricing` / `lib/ai/usage-utils.ts:128`.** Подтверждаешь что для Kimi заводим новый бранч (или универсальный openai-формат cached_tokens)? Это часть зачистки usage detection.

4. **Удаление `MINIMAX_API_KEY` из Vercel ENV** — после деплоя миграции делаем сами или нужно сохранить ключ ещё какое-то время на случай отката?

5. **`defaultParams` через catalog vs hard-code в call-sites.** Поле `defaultParams` уже есть в `ModelEntry`. Я не уверен что AI SDK v6 автоматически применяет его (возможно нужно прокидывать явно через `getModel`-обвязку). Делаем явно в трёх файлах (надёжно, локально-видно) или копаем подход через catalog (DRY, но требует доработки `getModel.ts`)?

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Pnpm/npm lockfile конфликт ломает install | Средняя | Высокое (build падает) | Ответ на вопрос Q1 + удаление лишнего lockfile в первом этапе |
| Kimi отвергает `temperature` ≠ 0.6 на старте | Высокая (без правки) | Высокое (production briefing падает) | Этап 2 — обязательная правка трёх call-sites + явный verification через `test-kimi-via-registry.ts` |
| `extractUsageForPricing` ломается для Kimi (NaN в pricing-логах) | Высокая (без правки) | Среднее (логи неточные, биллинг косвенно) | Покрыть в этапе 2 — обновить `usage-utils.ts:128` |
| Cache hit rate Moonshot ниже Anthropic — рост стоимости подкаста | Низкая | Низкое (~$0.05 / запуск) | Не митигируем в этом ТЗ. Если станет видно в production — отдельный follow-up |
| `kimi-k2.6` упадёт в типизации `MoonshotAIChatModelId` | Низкая | Низкое (TS падает в одном месте) | `as MoonshotAIChatModelId` cast с TODO-комментом + ссылкой на upstream |
| 32768 потолок не хватит при volume `detailed` | Низкая | Среднее (briefing обрезан) | Совпадает с Kimi maxOutput. Если упрёмся — снизить detailed до 28K |
| Vercel maxDuration `240` сек недостаточен | Низкая | Среднее (504 timeout) | Kimi K2.6 без thinking быстрее MiniMax thinking. Если нет — поднять до 300 |

---

## Зависимости

**Что нужно до начала:**
- [ ] Ответы владельца на 5 вопросов выше
- [ ] `MOONSHOT_API_KEY` в локальном `.env.local` (для `test-kimi-via-registry.ts`)
- [ ] `MOONSHOT_API_KEY` в Vercel ENV (для production deploy) — SPEC говорит «уже добавлен»

**Затронутые компоненты:**
- `package.json` (+ lockfile) — добавить `@ai-sdk/moonshotai@ai-v6`, удалить `vercel-minimax-ai-provider`
- `lib/ai/registry.ts` — заменить minimax/minimaxLong на moonshotai (180s timeout)
- `lib/ai/model-catalog.ts` — удалить MiniMax записи, добавить `kimi-k2.6` (физическая запись)
- `lib/ai/task-assignments.ts` — обновить 3 строки briefing taskId
- `lib/ai/getModel.ts` — удалить special case для `MiniMax-M2.7-long`
- `lib/ai/usage-utils.ts:128` — обновить детект провайдера
- `lib/briefing/briefing-author.ts` — temperature 0.7→0.6, +topP 0.95, обновить comment
- `lib/briefing/briefing-section-author.ts` — то же
- `lib/podcast/script-generator.ts` — то же + удалить cacheControl
- `app/(dashboard)/dev/models/page.tsx` — обновить PROVIDER_ENV_MAP
- `components/dev-panel/sections/{model,timeline}-section.tsx`, `dev-panel-footer.tsx` — заменить display names
- `app/(chat)/api/briefing/{generate,refresh-section}/route.ts` — комментарий
- `.env.example` — добавить `MOONSHOT_API_KEY` (новая запись)
- `scripts/test-kimi-via-registry.ts` — новый файл
- `scripts/test-minimax-via-registry.ts` — удалить (или оставить как archive в `_archive/`?)
- `scripts/test-minimax-anthropic-compat.ts` — удалить
- `docs/ai-chats-map.md` — обновить (SSOT)
- `docs/ai-providers.md` — обновить (SSOT)
- `docs/ai-minimax.md` — оставить с архивным баннером, не обновлять

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** scope большой (~20 файлов), но изменения механические по понятному паттерну. Сложность — в верификации (smoke на трёх таскId, сверка cache-метрик, lockfile вопрос). Realistic 2-3 сессии: 1 — Этапы 1-2 (registry+catalog+call-sites), 2 — Этап 3-4 (тесты+зачистка), 3 — Этап 5 (документация+финализация).

---

## Ответы архитектора (2026-04-27)

1. **Lockfile — pnpm.** Удалить `package-lock.json`. `packageManager: pnpm` в `package.json` — единственный SSOT. CLAUDE.md обновить: `npm` → `pnpm` в командах.
2. **Cache breakpoints в `script-generator.ts` — удаляем.** Moonshot имеет автоматический prompt cache (cached input $0.16 vs $0.95 — кэш на стороне провайдера, без явных breakpoints). Удалить обе строки `providerOptions.anthropic.cacheControl` (line 132, 137) в этом ТЗ.
3. **`extractUsageForPricing` — обновляем детект.** Заменить `startsWith("MiniMax")` на детект openai-формата usage. Использовать `prompt_tokens_details.cached_tokens` для расчёта cache-hit billing ($0.16). Критично — без правки pricing-логи поедут с первого дня.
4. **`MINIMAX_API_KEY` — удалить вместе с кодом.** Реальный откат = `git revert`, флипанье ENV — псевдо-страховка. Не плодим мёртвые секреты.
5. **`defaultParams` в catalog.** Hard-code в call-sites — антипаттерн (Блок 9 концепта: замена модели = одна строка). Положить `temperature: 0.6, topP: 0.95` в catalog entry `kimi-k2.6`. Call-site может override если нужно. Реализация: добавить getter `getDefaultParamsForTask(taskId)` или расширить обвязку `getModel` — детали в Этапе 2.

### Дополнительные уточнения архитектора

- **Pricing раздельно:** input $0.95 / output $4.00 / cached input $0.16 за 1M tokens. Не «$1.71 blended».
- **Type cast `kimi-k2.6 as MoonshotAIChatModelId`** — приемлем как временный костыль с TODO-комментом до обновления типа в SDK.
- **Версия SDK фиксируется явно через тег:** `pnpm add @ai-sdk/moonshotai@ai-v6` — иначе latest 2.0.16 потянет AI SDK v7 и сломает наш v6.
- **`MINIMAX_API_KEY` в `.env.example`:** не добавлять (документация исчезающего провайдера бессмысленна). `MOONSHOT_API_KEY` добавить — как документация текущего рабочего ключа.
- **Temperature 0.6:** не hard limit (API spec говорит диапазон 0–1), но рекомендация Moonshot для Instant. Меняем безусловно. Риск падения при 0.7 — низкий, не средний/высокий как изначально оценил.

### Risk matrix correction

- Риск «Kimi отвергает temperature ≠ 0.6» — понижен с **Высокая→Низкая** (это рекомендация API spec, не hard limit).
