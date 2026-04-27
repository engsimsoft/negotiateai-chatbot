# Roadmap ТЗ-BR-AUTHOR-KIMI

**Создан:** 2026-04-27
**Закрыт:** 2026-04-27 (одна сессия)
**Версия проекта:** 3.99.1 → 3.99.2 (patch — фикс silent hang через смену провайдера)
**Статус:** ✅ Все этапы завершены, ТЗ финализирован

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 7 |
| Завершено | 7/7 ✅ |
| Сессий (фактически) | 1 |
| Коммитов | 1 (Правило 7 — один коммит в финализации) |
| Найдено в FINDINGS → backlog | 1 (`TZ_BriefingScriptwriterPromptUpdate`, low impact) |

**Менеджер пакетов:** `pnpm` (по `packageManager` в package.json). Все команды в этом ROADMAP — `pnpm`.

**Smoke-тест прошёл (Этап 4):** `briefing:author` 2.6s / 77 chars · `briefing:section` 2.7s / 187 chars · `briefing:podcast-script` 1.6s / 75 chars. `reasoningTokens: 0` (thinking disabled подтверждён). Production smoke (Этап 6) — ручная проверка владельца через UI «Сгенерировать брифинг», новая генерация прошла успешно.

---

## Этап 1: Provider setup (registry + catalog + установка пакета)

**Статус:** ✅ Завершён

**Цель:** Зарегистрировать `moonshotai` в SSOT (registry + catalog), удалить MiniMax. Никаких изменений в call-sites — только инфраструктура.

**Задачи:**
- [ ] Удалить `package-lock.json` (lockfile-конфликт, SSOT — pnpm)
- [ ] `pnpm rm vercel-minimax-ai-provider`
- [ ] `pnpm add @ai-sdk/moonshotai@ai-v6` — точно через тег, не latest
- [ ] `lib/ai/registry.ts`: удалить `createMinimax` импорт + две фабрики `minimax`/`minimaxLong` + регистрации в registry + типы `RegistryProviderId`
- [ ] `lib/ai/registry.ts`: добавить `createMoonshotAI` импорт + один namespace `moonshotai` с 180s `AbortSignal.timeout` (все 3 briefing задачи long, отдельный `moonshotaiLong` не нужен)
- [ ] `lib/ai/model-catalog.ts`: удалить `provider: "minimax"` из union (line 21), `CAPS_MINIMAX` (line 125-135), две catalog entries (line 297-320)
- [ ] `lib/ai/model-catalog.ts`: добавить provider `"moonshotai"` в union, `CAPS_MOONSHOT` (streaming: true, tools: true, thinking: false, documentSupport: false), физическую запись `kimi-k2.6` (provider `"moonshotai"`, modelId `"kimi-k2.6"`, contextWindow 256_000, maxOutput 32_768, pricing `{ input: 0.95, output: 4.0, cachedInput: 0.16 }`, `defaultParams: { temperature: 0.6, topP: 0.95 }`, notes-ссылка на quickstart)
- [ ] `lib/ai/getModel.ts`: удалить special-case `MiniMax-M2.7-long` → `minimaxLong:MiniMax-M2.7` в `buildRegistryId` (line 121-126), удалить запись из `PROVIDER_TO_REGISTRY` (line 103, 115)

**Файлы:**
- `package.json` + `pnpm-lock.yaml` — зависимости
- `package-lock.json` — удалить
- `lib/ai/registry.ts`
- `lib/ai/model-catalog.ts`
- `lib/ai/getModel.ts`

**Валидация этапа:**
- [ ] `pnpm tsc --noEmit` — 0 ошибок
- [ ] `pnpm dev` запускается без ошибок импорта
- [ ] Smoke в node REPL: `import { registry } from './lib/ai/registry.ts'; registry.languageModel('moonshotai:kimi-k2.6')` не падает
- [ ] 🧪 Мануальный тест владельцем — **не требуется** на этом этапе (нет UI-эффекта)

**Критерий готовности:** Registry+catalog знают про moonshotai/kimi-k2.6, MiniMax удалён из SSOT, существующие briefing call-sites (которые ещё ссылаются на MiniMax-M2.7 через task-assignments) **временно сломаны** — это норм, чинятся в Этапе 2. Главное — TS компилируется (Этап 2 правит task-assignments одной строкой, и всё связывается).

⚠ **Замечание:** `pnpm tsc --noEmit` может ругнуться на task-assignments который ссылается на удалённый `MiniMax-M2.7-long` каталог-id. Если так — в Этапе 1 временно поменять три briefing taskId на `kimi-k2.6` параллельно (всё равно эта правка из Этапа 2). Тогда tsc зелёный, можно идти дальше.

---

## Этап 2: Task assignments + call-sites + usage-utils

**Статус:** ✅ Завершён

**Цель:** Перевести 3 briefing taskId на Kimi, обновить параметры в call-sites через catalog `defaultParams` (DRY), починить pricing-детект.

**Задачи:**
- [ ] `lib/ai/task-assignments.ts`: три строки briefing taskId → `"kimi-k2.6"` (line 191-193). Обновить комментарии (line 11, 105, 185-189)
- [ ] **Решить вопрос автоприменения `defaultParams`** — проверить применяет ли AI SDK автоматически. Если **нет** (вероятно нет — это наше кастомное поле в `ModelEntry`):
  - Добавить getter `getDefaultParamsForTask(taskId): { temperature?: number; topP?: number }` в `lib/ai/getModel.ts`
  - В трёх call-sites: получить `params = getDefaultParamsForTask(taskId)`, спредить в `streamText/generateText` параметры (`...params`), удалить хардкод `temperature: 0.7`
- [ ] `lib/briefing/briefing-author.ts:213`: применить новый паттерн defaultParams, удалить hardcode temperature, обновить comment headline (line 1, 160) `// MiniMax M2.7` → `// Kimi K2.6`
- [ ] `lib/briefing/briefing-section-author.ts:192`: то же (комменты line 1, 141, 177)
- [ ] `lib/podcast/script-generator.ts:123-140`: то же + **удалить `providerOptions.anthropic.cacheControl` блоки** (line 132, 137 — обе строки целиком). Структура `messages` упростится до простого `{ role, content }`. Обновить комментарий line 2, line 125-127
- [ ] `lib/ai/usage-utils.ts:128`: заменить `if (modelId.startsWith("MiniMax")) return "minimax"` на детект openai-формата usage. Подтянуть чтение `prompt_tokens_details.cached_tokens` для расчёта cache-hit billing ($0.16/1M вместо $0.95/1M). Изучить структуру usage в openai-compatible пакете и адаптировать `extractUsageForPricing` под Moonshot

**Файлы:**
- `lib/ai/task-assignments.ts`
- `lib/ai/getModel.ts` — новый getter `getDefaultParamsForTask`
- `lib/briefing/briefing-author.ts`
- `lib/briefing/briefing-section-author.ts`
- `lib/podcast/script-generator.ts`
- `lib/ai/usage-utils.ts`

**Валидация этапа:**
- [ ] `pnpm tsc --noEmit` — 0 ошибок
- [ ] Все три call-sites компилируются с новым getter
- [ ] `usage-utils` детектит Moonshot и читает cached_tokens (unit-уровень — печать в консоль mock-объекта)
- [ ] 🧪 Мануальный тест **не требуется** (нет UI, проверка через скрипт в Этапе 4)

**Критерий готовности:** Три call-sites зовут Kimi через registry, температура/topP читаются из catalog defaultParams, pricing-логи знают про Kimi.

---

## Этап 3: Dev-панель

**Статус:** ✅ Завершён

**Цель:** В `/dev/models` появляется зелёная карточка `moonshotai`, исчезает MiniMax, dropdown «Active Model» предлагает `kimi-k2.6`.

**Задачи:**
- [ ] `app/(dashboard)/dev/models/page.tsx:34-47`: удалить `{ provider: "minimax", envVar: "MINIMAX_API_KEY", isLlmRegistry: true }`. Добавить `{ provider: "moonshotai", envVar: "MOONSHOT_API_KEY", isLlmRegistry: true }`
- [ ] `components/dev-panel/sections/model-section.tsx:15-16` — заменить hardcoded `"MiniMax-M2.7"`, `"MiniMax-M2.7-long"` (display name overrides). Если просто mapping для красивого рендера — заменить на `"kimi-k2.6"` → `"Kimi K2.6"`. Если нет других нужд — удалить map целиком и положиться на `displayName` из catalog
- [ ] `components/dev-panel/sections/timeline-section.tsx:16-17` — то же (короткие display names `"MiniMax"`, `"MiniMax·L"` → `"Kimi"`)
- [ ] `components/dev-panel/dev-panel-footer.tsx:20-21` — то же
- [ ] **Сброс override на `simply-chat`** (если есть): задача владельца через UI, или Claude через API `/api/dev/set-override`. SPEC указывает — счётчик «19 overrides active» уменьшится на 1

**Файлы:**
- `app/(dashboard)/dev/models/page.tsx`
- `components/dev-panel/sections/model-section.tsx`
- `components/dev-panel/sections/timeline-section.tsx`
- `components/dev-panel/dev-panel-footer.tsx`

**Валидация этапа:**
- [ ] `pnpm tsc --noEmit` — 0 ошибок
- [ ] `pnpm dev` — открыть `/dev/models` в браузере
- [ ] Карточка `moonshotai` зелёная (если `MOONSHOT_API_KEY` set) или красная (если нет)
- [ ] Карточка `minimax` отсутствует
- [ ] Три briefing-задачи в TASK ASSIGNMENTS показывают DEFAULT = `kimi-k2.6`
- [ ] Dropdown «Active Model» для `briefing:author` содержит `kimi-k2.6`
- [ ] На `simply-chat` нет MiniMax-override (если был — сброшен)
- [ ] 🧪 Мануальный тест владельцем по чек-листу 4 SPEC

**Критерий готовности:** SPEC «Верификация — шаг 4» полностью пройден.

---

## Этап 4: Скрипт верификации

**Статус:** ✅ Завершён

**Цель:** Локальный smoke-тест трёх briefing taskId на реальном Kimi API. Подтверждение что pipeline работает end-to-end до production.

**Задачи:**
- [ ] Создать `scripts/test-kimi-via-registry.ts` по паттерну `scripts/test-minimax-via-registry.ts`. Тестирует три taskId: `briefing:author`, `briefing:section`, `briefing:podcast-script`. Для каждого: разрешает модель через `getModel`, делает короткий streamText/generateText вызов с тестовым промптом, печатает время / токены (input + output + cached) / первые 500 символов вывода. `process.exit(0)` если все три passed
- [ ] Удалить `scripts/test-minimax-via-registry.ts`
- [ ] Удалить `scripts/test-minimax-anthropic-compat.ts`

**Файлы:**
- `scripts/test-kimi-via-registry.ts` — новый
- `scripts/test-minimax-via-registry.ts` — удалить
- `scripts/test-minimax-anthropic-compat.ts` — удалить

**Валидация этапа:**
- [ ] `pnpm tsc --noEmit` — 0 ошибок
- [ ] `pnpm tsx scripts/test-kimi-via-registry.ts` — все 3 taskId возвращают осмысленный markdown за < 180 сек
- [ ] В выводе видны cached_tokens (если повторный запуск — должен быть cache hit)
- [ ] 🧪 Мануальный тест владельцем — **запустить скрипт самостоятельно**, убедиться что цифры разумные (latency, tokens, cost-расчёт)

**Критерий готовности:** SPEC «Верификация — шаг 2» пройден.

---

## Этап 5: Зачистка комментариев + ENV + CLAUDE.md

**Статус:** ✅ Завершён

**Цель:** Удалить остатки MiniMax из комментариев, обновить документацию команд.

**Задачи:**
- [ ] `lib/briefing/briefing-filter.ts:1` — комментарий `// ТЗ-Briefing-1: Stage 1 — Filter & deduplicate using MiniMax M2.7` устарел (filter уже на Grok). Обновить
- [ ] `app/(chat)/api/chat/route.ts:668, 1029-1034, 1223-1224` — комментарии о MiniMax в chat (chat не использует MiniMax с ТЗ-XAI-4). Удалить или сократить
- [ ] `app/(chat)/api/briefing/generate/route.ts:10` — `// ТЗ-Briefing-1: MiniMax M2.7 thinking model needs more time` → `// Kimi K2.6 long-form briefing`
- [ ] `app/(chat)/api/briefing/refresh-section/route.ts:25` — то же
- [ ] `app/api/dev/set-override/route.ts:57` — пример URL `?task=simply-chat&model=MiniMax-M2.7` → пример с `kimi-k2.6` (или generic)
- [ ] `lib/utils.ts:160` — общий комментарий о MiniMax/Anthropic edge case (паттерн актуальный, можно оставить или обобщить)
- [ ] `.env.example`: добавить `MOONSHOT_API_KEY=...` (отдельная строка с описанием — для briefing pipeline). `MINIMAX_API_KEY` не было — не добавляем
- [ ] `CLAUDE.md`: команды `npm install`, `npm run dev`, `npm run build`, `npm run db:migrate`, `npm run db:studio` → `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm db:migrate`, `pnpm db:studio`. Соответствует `packageManager: pnpm` в package.json

**Файлы:**
- `lib/briefing/briefing-filter.ts`
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/briefing/generate/route.ts`
- `app/(chat)/api/briefing/refresh-section/route.ts`
- `app/api/dev/set-override/route.ts`
- `lib/utils.ts` (опционально)
- `.env.example`
- `CLAUDE.md`

**Валидация этапа:**
- [ ] `pnpm tsc --noEmit` — 0 ошибок
- [ ] `grep -rn "MiniMax\|minimax\|MINIMAX" --include="*.ts" --include="*.tsx" --include="*.md" lib/ app/ components/ scripts/ .env.example CLAUDE.md` — пусто (кроме `lib/utils.ts:160` если оставили generic-комментарий)
- [ ] `wc -l CLAUDE.md` ≤ 220 (Правило финализации)
- [ ] 🧪 Мануальный тест **не требуется** (только текстовые правки)

**Критерий готовности:** Ноль упоминаний MiniMax в production-коде. CLAUDE.md команды соответствуют packageManager.

---

## Этап 6: Production smoke + документация

**Статус:** ✅ Завершён

**Цель:** Подтвердить работу briefing pipeline в production, обновить SSOT-документацию.

**Задачи:**
- [ ] `pnpm build` — успешен (внимание: `pnpm build` = `tsx lib/db/migrate && next build`. Миграции БД в этом ТЗ не меняются, накатывать не должно ничего нового — но всё равно предупредить владельца перед запуском. Альтернатива: `next build` напрямую, минуя миграции, для проверки сборки)
- [ ] Деплой в production через `vercel --prod` (запрос владельца)
- [ ] **Production smoke:** ручной запуск `/api/briefing/run` для тестового пользователя. Статья генерится за < 180 сек. В Vercel-логах нет таймаутов, нет ошибок 5xx, нет упоминаний MiniMax
- [ ] **Pricing-логи:** проверить что usage отражается корректно (input/output/cached разделены)
- [ ] Удалить `MINIMAX_API_KEY` из Vercel ENV (после успешного prod smoke, не до)
- [ ] **Документация:**
  - [ ] `docs/ai-chats-map.md` — три briefing taskId переведены на `kimi-k2.6`. Обновить таблицу моделей (моdel-row для kimi)
  - [ ] `docs/ai-providers.md` — секция MiniMax удалена / архивирована, секция moonshotai добавлена (model id, pricing, ссылки на оф. доки)
  - [ ] `docs/architecture.md` — если описывал namespace `minimax`/`minimaxLong`, обновить на `moonshotai`
  - [ ] `docs/ai-minimax.md` — оставить как архивный (banner сверху уже есть). НЕ обновлять
  - [ ] ADR — **не создаём**. Это замена провайдера в существующей архитектуре, не новый паттерн

**Файлы:**
- `docs/ai-chats-map.md`
- `docs/ai-providers.md`
- `docs/architecture.md` (опционально)
- Vercel ENV (вручную)

**Валидация этапа:**
- [ ] `pnpm build` — успешен
- [ ] Production deploy успешен
- [ ] 🧪 Мануальный тест владельцем: запуск brief-генерации для тестового user'а через UI или API. Статья появилась, разумного качества, без таймаутов
- [ ] Vercel-логи: нет ошибок Moonshot 4xx/5xx за 30 минут после деплоя
- [ ] grep тесты Правила 6 WORKFLOW: `grep "MiniMax\|kimi" docs/ai-chats-map.md` показывает только Kimi

**Критерий готовности:** SPEC «Верификация — шаг 3» пройден. Документация SSOT актуальна.

---

## Этап 7: Финализация

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Статус:** ✅ Завершён

**Цель:** Закрыть ТЗ, перенести историю в главные документы, один коммит, архивация.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать `DOCUMENTATION_GUIDE.md` → пройти «✅ Чек-лист при изменениях»
- [ ] Перенести `CHANGELOG.md` → главный `CHANGELOG.md` (одна запись о ТЗ — версия 3.99.2 или соответствующая)
- [ ] Обновить `SIMPLY_STATUS.md` (snapshot: убрать MiniMax из активных провайдеров, добавить Moonshot/Kimi K2.6 в Кухню)
- [ ] ⛔ `CLAUDE.md` — ТОЛЬКО правка команд `npm` → `pnpm` (сделана в Этапе 5). История ТЗ туда НЕ пишем. `wc -l CLAUDE.md` ≤ 220
- [ ] Обновить `package.json` — версия 3.99.1 → 3.99.2

**Документация (по чеклисту Правила 6 WORKFLOW):**
- [ ] `docs/ai-chats-map.md` — обновлено в Этапе 6
- [ ] `docs/ai-providers.md` — обновлено в Этапе 6
- [ ] `docs/architecture.md` — обновлено в Этапе 6 (если требовалось)
- [ ] ADR — не создаём (см. Этап 6)
- [ ] Остальные docs/ — нет триггеров (briefing промпты не менялись, прочая инфраструктура без изменений)

**FINDINGS → backlog (Правило 8+9):**
- [ ] Открыть `FINDINGS.md` в папке ТЗ (если создавался). Каждую medium/high находку — в `specs/_backlog/TZ_<name>.md` + обновить `specs/_backlog/README.md`
- [ ] Если файла нет — пропустить

**Единый коммит ТЗ (Правило 7):**
- [ ] `git status` — проверить, в staging только файлы ТЗ
- [ ] `git add` явно по списку файлов (без `git add -A`)
- [ ] `git commit -m "fix(tz-br-author-kimi): миграция briefing с MiniMax на Kimi K2.6 — закрытие silent hang — v3.99.2"`
- [ ] Тело коммита через HEREDOC, 3-5 строк по сути (что заменили + почему — silent hang). Без диаграмм, без портянок

**Архивация:**
- [ ] `mv specs/Simply_Migration/TZ_BR_AUTHOR_KIMI/ specs/_archive/Simply_Migration/TZ_BR_AUTHOR_KIMI/` (или просто в `specs/_archive/`, согласовать)

**Валидация этапа:**
- [ ] `pnpm tsc --noEmit` — 0 ошибок (последняя проверка)
- [ ] `pnpm build` — успешен
- [ ] Финальный мануальный тест владельцем — production briefing работает end-to-end
- [ ] `git log --oneline | head -3` — последний коммит про BR-AUTHOR-KIMI, версия 3.99.2

**Критерий готовности:** Один коммит сделан, папка ТЗ в `_archive/`, документация SSOT актуальна, production briefing на Kimi.

---

## Gate-keeping

⛔ **СТОП:** Этап N+1 не начинать без полной валидации Этапа N + явного OK владельца.

⛔ **Коммит — только в Этапе 7.** Промежуточные правки копятся в working tree (Правило 7 WORKFLOW).

⛔ **Найденный костыль/баг вне scope** → `FINDINGS.md` создаётся в момент находки (Правило 8 WORKFLOW). НЕ чинить «заодно».

---

## Сводка файлов (по затронутости)

**Production-код:**
- Provider: `lib/ai/registry.ts`, `lib/ai/model-catalog.ts`, `lib/ai/getModel.ts`, `lib/ai/task-assignments.ts`, `lib/ai/usage-utils.ts`
- Briefing call-sites: `lib/briefing/briefing-author.ts`, `lib/briefing/briefing-section-author.ts`, `lib/podcast/script-generator.ts`
- Routes: `app/(chat)/api/briefing/{generate,refresh-section}/route.ts` (только комментарии)
- Dev-панель: `app/(dashboard)/dev/models/page.tsx`, `components/dev-panel/sections/{model,timeline}-section.tsx`, `components/dev-panel/dev-panel-footer.tsx`
- Зачистка комментариев: `lib/briefing/briefing-filter.ts`, `app/(chat)/api/chat/route.ts`, `app/api/dev/set-override/route.ts`

**Скрипты:**
- Новый: `scripts/test-kimi-via-registry.ts`
- Удалить: `scripts/test-minimax-via-registry.ts`, `scripts/test-minimax-anthropic-compat.ts`

**Конфиг / документация:**
- `package.json`, `pnpm-lock.yaml`, удалить `package-lock.json`
- `.env.example` (+ MOONSHOT_API_KEY)
- `CLAUDE.md` (npm → pnpm)
- `docs/ai-chats-map.md`, `docs/ai-providers.md`, `docs/architecture.md` (по триггерам)
- `CHANGELOG.md` (главный)
- `SIMPLY_STATUS.md`

**Vercel ENV (вручную):** удалить `MINIMAX_API_KEY` после успешного prod smoke в Этапе 6.
