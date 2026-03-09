# Roadmap ТЗ-CACHE3: Единый SSOT отображения стоимости

**Создан:** 2026-03-03
**Версия проекта:** 3.63.0 → 3.64.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 2 (код готов, ожидает мануального теста) |
| Сессий (оценка) | 1-2 |

---

## Этап 1: Shared pricing constant

**Статус:** ✅ Завершён

**Цель:** Вынести `RUB_PER_USD` в единый shared-файл, доступный и серверу и клиенту. Убрать дублирование.

**Задачи:**
- [x] Создать `lib/constants/pricing.ts` — `export const RUB_PER_USD = 100`
- [x] Обновить `lib/ai/providers.ts` — убрать локальный `export const RUB_PER_USD = 100` (строка 66), заменить импортом из `lib/constants/pricing`
- [x] Обновить `lib/ai/tokenlens-catalog.ts` — сменить импорт `RUB_PER_USD` с `./providers` на `@/lib/constants/pricing`
- [x] Проверить что `calculateCostRub()`, `getStepCostRub()`, `calcStepCostRub()` работают без изменений (import chain)

**Файлы:**
- `lib/constants/pricing.ts` — **НОВЫЙ**
- `lib/ai/providers.ts` — убрать локальную константу, добавить re-export
- `lib/ai/tokenlens-catalog.ts` — сменить source импорта

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (DB migration timeout из-за сети, `npx next build` ОК)
- [x] Grep: `RUB_PER_USD` определён только в `lib/constants/pricing.ts`
- [x] 🧪 Мануальный тест: DevPanel Footer показывает `₽0.22` — ОК

**Git (после валидации):**
```bash
git add lib/constants/pricing.ts lib/ai/providers.ts lib/ai/tokenlens-catalog.ts
git commit -m "refactor(tz-cache3): extract RUB_PER_USD to shared pricing constant"
```

**Критерий готовности:** `RUB_PER_USD` имеет единый source of truth, все импорты ведут к `lib/constants/pricing.ts`.

---

## Этап 2: Pipeline Trace → TokenLens

**Статус:** ✅ Завершён

**Цель:** Все pipeline-стадии используют `calcStepCostRub()` (TokenLens SSOT → fallback hardcoded) вместо `calculateCostRub()` (только hardcoded). Catalog пробрасывается один раз при старте pipeline.

**Задачи:**

**2a — Обновить `pipeline-trace.ts`:**
- [x] `buildAiCallTrace()` — добавить 2-й параметр `catalog?: ModelCatalog`. Использовать `calcStepCostRub(modelId, usage, catalog)` вместо `calculateCostRub(modelId, usage)`
- [x] `TraceCollector` — добавить `catalog?: ModelCatalog` в конструктор, хранить как `private catalog`
- [x] Импортировать `ModelCatalog` из `tokenlens/core`, `calcStepCostRub` из `./tokenlens-catalog`

**2b — Briefing pipeline chain:**
- [x] `lib/briefing/briefing-pipeline.ts` — в `runBriefingPipeline()`: fetch `catalog = await getTokenlensCatalog()`, передать в `new TraceCollector("briefing", catalog)`, передать в `filterContent()` и `generateArticle()`
- [x] `lib/briefing/briefing-filter.ts` — `filterContent()`: добавить опциональный param `catalog?: ModelCatalog`, заменить `calculateCostRub(FILTER_MODEL, usage)` → `calcStepCostRub(FILTER_MODEL, usage, catalog)`
- [x] `lib/briefing/briefing-author.ts` — `generateArticle()`: добавить `catalog?: ModelCatalog` в `AuthorInput`, заменить `calculateCostRub(usedModel, usage)` → `calcStepCostRub(usedModel, usage, catalog)`

**2c — Podcast pipeline chain:**
- [x] `lib/podcast/podcast-pipeline.ts` — в `runPodcastPipeline()`: fetch catalog, передать в `new TraceCollector("podcast", catalog)`, передать в `generateScript()`. TTS (`buildTtsTrace`) — НЕ трогать.
- [x] `lib/podcast/script-generator.ts` — `generateScript()`: добавить `catalog?: ModelCatalog`, заменить `calculateCostRub(SCRIPT_MODEL, usage)` → `calcStepCostRub(SCRIPT_MODEL, usage, catalog)`

**2d — Section refresh + research:**
- [x] `app/(chat)/api/briefing/refresh-section/route.ts` — fetch catalog, передать в `new TraceCollector(…, catalog)`, `filterContent(…, catalog)`, `generateSection(…, catalog)`
- [x] `lib/briefing/briefing-section-author.ts` — `generateSection()`: добавить `catalog?: ModelCatalog` в `SectionAuthorInput`, заменить `calculateCostRub()` → `calcStepCostRub()`
- [x] `lib/briefing/research-engine.ts` — `researchSingleTopic()` (inner function): добавить `catalog` через замыкание от `researchTopics()`, заменить `calculateCostRub("sonar-pro", usage)` → `calcStepCostRub("sonar-pro", usage, catalog)`

**2e — Route callers (пробросить catalog):**
- [x] `app/(chat)/api/briefing/generate/route.ts` — pipeline сам fetch-ит catalog внутри `runBriefingPipeline()`
- [x] `app/(chat)/api/briefing/podcast/generate/route.ts` — pipeline сам fetch-ит catalog внутри `runPodcastPipeline()`

**Файлы:**
- `lib/ai/pipeline-trace.ts` — buildAiCallTrace + TraceCollector
- `lib/briefing/briefing-pipeline.ts` — catalog fetch + pass
- `lib/briefing/briefing-author.ts` — inline trace → calcStepCostRub
- `lib/briefing/briefing-section-author.ts` — inline trace → calcStepCostRub
- `lib/briefing/briefing-filter.ts` — inline trace → calcStepCostRub
- `lib/briefing/research-engine.ts` — inline trace → calcStepCostRub
- `lib/podcast/podcast-pipeline.ts` — catalog fetch + pass
- `lib/podcast/script-generator.ts` — inline trace → calcStepCostRub
- `app/(chat)/api/briefing/refresh-section/route.ts` — catalog fetch + pass
- `app/(chat)/api/briefing/generate/route.ts` — проверка
- `app/(chat)/api/briefing/podcast/generate/route.ts` — проверка

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (`npx next build`)
- [x] Grep: `calculateCostRub` НЕ используется в `lib/briefing/` и `lib/podcast/` (только в `providers.ts` как fallback и в `pipeline-trace.ts` для TTS)
- [ ] 🧪 Мануальный тест: в dev mode сгенерировать брифинг, проверить Pipeline Trace Footer — стоимость отображается

**Git (после валидации):**
```bash
git add lib/ai/pipeline-trace.ts lib/briefing/ lib/podcast/ app/(chat)/api/briefing/
git commit -m "feat(tz-cache3): pipeline traces use TokenLens SSOT via calcStepCostRub"
```

**Критерий готовности:** Все pipeline-стадии считают стоимость через `calcStepCostRub()` (TokenLens → fallback). `calculateCostRub()` остаётся только как internal fallback внутри `calcStepCostRub()` и в `getStepCostRub()` (client-side).

---

## Этап 3: UI — Context dropdown RUB + мелкие фиксы

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** Весь UI показывает стоимость в рублях. Мелкие баги исправлены.

**Задачи:**

**3a — Context dropdown → RUB:**
- [ ] `components/elements/context.tsx` — `InfoRow`: конвертировать `costText` (USD) → RUB через `parseFloat(costText) * RUB_PER_USD`, показывать `₽X.XX` (2 знака) вместо `$X.XXXXXX` (6 знаков)
- [ ] `components/elements/context.tsx` — Total cost: `usage.costUSD.totalUSD * RUB_PER_USD`, формат `₽X.XX`. Для `< ₽0.01` показывать `< ₽0.01`
- [ ] Импортировать `RUB_PER_USD` из `@/lib/constants/pricing`

**3b — TimelineSection reasoning tokens (P5):**
- [ ] `components/dev-panel/sections/timeline-section.tsx` — строка с `step.inputTokens + step.outputTokens`: добавить `+ (step.reasoningTokens ?? 0)`

**3c — Fallback marker ~ (P2/P6):**
- [ ] `components/dev-panel/dev-panel-footer.tsx` — если `data.steps.length === 0` и используется `finish.estimatedCostRub`, показывать `~₽X.XX`
- [ ] `components/dev-panel/sections/tokens-section.tsx` — аналогичный маркер `~` при fallback

**Файлы:**
- `components/elements/context.tsx` — USD → RUB
- `components/dev-panel/sections/timeline-section.tsx` — + reasoning tokens
- `components/dev-panel/dev-panel-footer.tsx` — fallback marker
- `components/dev-panel/sections/tokens-section.tsx` — fallback marker

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест (Context dropdown): отправить сообщение в чат → открыть Context dropdown → показывает `₽X.XX` вместо `$0.00XXXX`, per-category в рублях
- [ ] 🧪 Мануальный тест (Timeline): открыть DevPanel Drawer → Timeline, проверить что reasoning tokens включены в сумму (если thinking enabled)
- [ ] 🧪 Мануальный тест (Fallback ~): визуально, edge case — при streaming in-flight с steps=0 footer показывает `~`

**Git (после валидации):**
```bash
git add components/elements/context.tsx components/dev-panel/
git commit -m "feat(tz-cache3): unified RUB display — context dropdown, timeline reasoning, fallback marker"
```

**Критерий готовности:** Context dropdown показывает рубли. Timeline включает reasoning. Fallback помечен `~`.

---

## Этап 4: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (если менялась структура — скорее нет, только внутренние изменения)
- [ ] Обновить package.json: 3.63.0 → 3.64.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Скорее нет (не новый паттерн, а унификация существующего). Но если архитектор считает иначе — создать.
- [ ] docs/architecture.md нужно обновить? → Нет (без новых модулей)
- [ ] docs/ai-tools.md нужно обновить? → Нет
- [ ] docs/ai-chats-map.md нужно обновить? → Нет
- [ ] docs/ai-providers.md нужно обновить? → Возможно, если есть секция про cost calculation

**Верификация (Правило 5):**
- [ ] Grep: `calculateCostRub` — используется ТОЛЬКО как fallback (внутри `calcStepCostRub`, `getStepCostRub`, `buildTtsTrace`)
- [ ] Grep: `\$` + cost display — не осталось USD в UI-компонентах (кроме raw JSON в DevPanel)
- [ ] Grep: `RUB_PER_USD` — определён только в `lib/constants/pricing.ts`

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-cache3): finalization — docs, version bump"
```
