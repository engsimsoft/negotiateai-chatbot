# Roadmap ТЗ-2: Dev Switchboard UI

**Создан:** 2026-04-12
**Версия проекта:** 3.83.0 → 3.84.0
**Статус:** 🔄 В работе — Этапы 0–2 завершены, Этап 3 следующий

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 3 (следующий) |
| Сессий (факт) | 2 (Этапы 0–2 закрыты) |
| Затронуто call-sites `getModel()` | 0 (threading не потребовался — file-based + ALS callback) |

---

## Архитектурный каркас (итог после Этапа 2)

**Финальная версия (rev3, file-based) — НЕ cookie:**

```
.simply-dev-overrides.json  (dotfile в корне, .gitignore)
        │
        ▼ fs.readFileSync (sync, server-only)
model-overrides-node.ts → registerOverridesReader() → getActiveOverrides()
        │
        ▼
lookupOverride(taskId) в getModel.ts
  ├─ dev-gate (SIMPLY_DEV_MODE)
  ├─ getActiveOverrides() — synchronous file read per getModel() call
  └─ return overrides[taskId] ?? null
        │
        ▼
DEFAULT_TASK_MODELS[taskId]  → catalog id → registry → LanguageModel

UI слои:
  1. /dev/models (Server Component + Client islands) — полная карта
  2. Server Actions: setOverride/deleteOverride/resetAll/getStatus
  3. API: GET /api/dev/env-status (redacted ✅/❌ + last4)
  4. components/dev-panel/sections/switchboard-section.tsx — per-message
  5. components/dev-panel/dev-panel-footer.tsx — badge OVERRIDE
```

---

## Этап 0: Baseline

**Статус:** ✅ Завершён
**Цель:** Убедиться что master текущий, сборка зелёная до начала работы.

**Задачи:**
- [x] Убедиться что ТЗ-1 в master (`lib/ai/getModel.ts` с stub `lookupOverride`)
- [x] `npm run build` — baseline успешен
- [x] `npx tsc --noEmit` — 0 ошибок

**Критерий готовности:** Baseline зелёный, можно начинать.

---

## Этап 1: Backend overrides + Footer badge

**Статус:** ✅ Завершён (2026-04-12) — мануальный тест пройден, OVERRIDE видно в footer

**Финальная архитектура (rev 3 — file-based):**
После двух неудачных попыток (next/headers → AsyncLocalStorage → **file**) остановились на плоском JSON-файле `.simply-dev-overrides.json` в корне проекта.
- `model-overrides.ts` — client-safe: dev-gate, parse, serialize, reader-callback
- `model-overrides-node.ts` — server-only (import "server-only"): `fs.readFileSync` reader, `writeOverridesFile`
- `/api/dev/set-override` — GET endpoint: `?task=<id>&model=<catalogId>` или `?clear=1`
- middleware добавлено исключение для `/api/dev/*` (защита на уровне isSimplyDevMode внутри)

Почему не cookies: Chrome devtools манипуляции ненадёжны (значения с `{}`/`"` стрипаются), Next 15 async cookies API, hot-reload путает path/domain. Файл — простое SSOT.

**Цель:** Реализовать механику overrides на сервере + показать пользователю факт override в footer. Этап не требует UI — проверяем через ручную правку cookie в DevTools.

**Задачи:**
- [x] Создать `lib/ai/model-overrides.ts`:
  - Константа `OVERRIDES_COOKIE_NAME = "x-model-overrides"`
  - `parseOverrides`, `serializeOverrides`
  - `isOverridesAllowed()` — dev-gate SSOT
  - `OVERRIDES_COOKIE_OPTIONS` — для Server Actions (ТЗ-2 Этап 2)
- [x] Обновить `lib/ai/getModel.ts`:
  - `lookupOverride()` через `next/headers.cookies()` (exotic sync API Next 15) + try/catch + dev-gate
  - Сигнатура `GetModelContext` не меняется (задел на будущее)
  - Новые публичные хелперы: `isTaskOverridden(taskId)`, `getCurrentOverrides()`
- [x] Расширить `DebugPromptData` в `lib/ai/debug-events.ts`:
  - `taskId?`, `overrideActive?`, `defaultModelId?`, `effectiveModelId?`
- [x] Обновить `app/(chat)/api/chat/route.ts`:
  - Хоистить `activeTaskId: TaskId | null` до роутинга
  - Передавать override-info в `emitDebugPrompt`
  - Переиспользовать `activeTaskId` в onFinish (устраняет дублирование 17 строк логики)
- [x] `components/dev-panel/dev-panel-footer.tsx`:
  - Badge «⚙ OVERRIDE» жёлтым когда `data.prompt?.overrideActive`
  - Tooltip с `default → effective`
- [x] `components/dev-panel/sections/model-section.tsx`:
  - Строка «Task ID» + строка «Override: default → effective»

**Файлы:**
- `lib/ai/model-overrides.ts` — новый
- `lib/ai/getModel.ts` — обновить lookupOverride
- `lib/ai/debug-events.ts` — новое поле
- `lib/ai/retry-with-logging.ts` или `lib/ai/usage-utils.ts` — пометить overrideActive (TBD после изучения)
- `components/dev-panel/dev-panel-footer.tsx` — badge
- `components/dev-panel/sections/model-section.tsx` — строка

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Ручная проверка: в DevTools → Application → Cookies → добавить `x-model-overrides={"simply-chat":"claude-opus-4-6"}` → отправить сообщение в Simply → в footer видна OPUS + badge OVERRIDE
- [ ] Ручная проверка: `SIMPLY_DEV_MODE=false` (или временно выключить) → override игнорируется, дефолтная модель
- [ ] Background pipelines (briefing, memory cron) не падают — `lookupOverride` в них silent null fallback
- [ ] 🧪 Мануальный тест пользователем: Simply Chat с ручным cookie → другая модель в footer

**Git:** `git commit -m "feat(tz-2): backend overrides + footer badge"`

**Критерий готовности:** Ручная правка cookie влияет на выбор модели в Simply Chat, footer показывает OVERRIDE badge, prod-поведение не изменилось.

---

## Этап 2: Страница /dev/models — полная карта

**Статус:** ✅ Завершён — код написан, протестирован end-to-end, цены в каталоге верифицированы через WebFetch

**Итог:**
- `/dev/models` работает, все 4 секции рендерятся (LLM/Raw providers, Task Assignments, Model Catalog)
- Server Actions `setOverride/clearTaskOverride/resetAllOverrides` работают, revalidatePath обновляет UI мгновенно
- Пользователь подтвердил переключение на Grok 4.1 Fast через dropdown — override применяется к следующему запросу в Simply Chat
- Grok 4.1 Fast vision протестирован на картинке — работает
- Cache read подтверждён (`Cache read: 16315` в DevPanel) — фикс `isAnthropicModel` через catalog flag работает
- Каталог обновлён через WebFetch: 5 OpenRouter моделей (включая 2 vision), 6 xAI Grok, verified pricing

**НЕЗАПЛАНИРОВАННЫЙ бонусный рефакторинг (коммит 882b525):** в процессе тестов обнаружилось что `chat/route.ts` угадывал провайдера из chatMode/think/attachments — это ломало cache при override. Решение: добавлен флаг `supportsCompaction: boolean` в `ModelCapabilities`, все флаги в route.ts теперь читают catalog entry для `activeTaskId`. Полностью убрано угадывание, заменено на SSOT через каталог.

**Коммиты Этапа 2:**
- `d716d61` — /dev/models page
- `882b525` — SSOT cache/compaction flag refactor (kardinal)
- `1a98c64` — catalog refresh (verified pricing + vision models)

**Цель:** Показать разработчику всю систему — все ~40 задач, каталог моделей, провайдеры, статусы ENV-ключей — с возможностью переключать модели.

**Задачи:**

**Серверная часть:**
- [ ] Создать `app/(dev)/dev/models/page.tsx` (Server Component)
  - Dev-gate: `if (!isSimplyDevMode) notFound()`
  - Auth check: session required (как в dashboard)
  - Загружает: task-assignments, model-catalog, registry list, current overrides из cookie, env-key status
  - Передаёт в client component сериализуемые данные
- [ ] Создать route group `app/(dev)/layout.tsx` (минимальный layout — без sidebar, только auth + dev-gate на уровне layout)
- [ ] Создать `app/(dev)/dev/models/actions.ts` — Server Actions:
  - `setOverride(taskId, catalogId)` — записывает в cookie, revalidatePath
  - `deleteOverride(taskId)` — удаляет из cookie
  - `resetAllOverrides()` — очищает cookie
  - Все 3 — с dev-gate (throw в prod)
- [ ] Создать `app/api/dev/env-status/route.ts` — GET endpoint:
  - Dev-gate
  - Для каждого провайдера: `{ provider, hasKey: boolean, last4: string | null }`
  - Провайдеры: anthropic, minimax, xai, openrouter, voyage, deepgram, perplexity, google (TTS)
  - Ключи: `ANTHROPIC_API_KEY`, `MINIMAX_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `VOYAGE_API_KEY`, `DEEPGRAM_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY` (уточнить имена grep-ом)

**Клиентская часть:**
- [ ] Создать `app/(dev)/dev/models/dev-models-client.tsx` (Client Component)
  - Header: «Dev · Models» + «Reset all overrides» (destructive)
  - Секция 1: LLM Providers (anthropic, minimax, minimaxLong, xai, openrouter) — карточки с ENV статусом
  - Секция 2: Raw Providers (voyage, deepgram, perplexity, google) — карточки
  - Секция 3: Task Assignments — таблица всех ~40 taskId:
    - Колонки: taskId | default | current (с dropdown) | capabilities | pricing | action
    - Dropdown — все модели каталога, с warning-иконкой если capabilities не совпадают
    - Действие: Select → `setOverride` → toast «Override saved. Undo?» (5s)
    - Если override стоит → показать кнопку «Reset» рядом
  - Секция 4: Model Catalog — таблица всех записей из `listAllModels()`
- [ ] Вспомогательные компоненты:
  - `capability-badges.tsx` — иконки 6 capabilities
  - `provider-card.tsx` — карточка провайдера с ENV статусом
  - `task-row.tsx` — строка таблицы задач
  - `model-select.tsx` — dropdown с группировкой по провайдеру + warning
- [ ] Toast + undo через `sonner` (проверить что уже есть в проекте)
- [ ] localStorage зеркало (пишется при каждом setOverride, читается при монтировании для быстрого рендера — но cookie остаётся SSOT)

**Файлы:**
- `app/(dev)/layout.tsx` — новый
- `app/(dev)/dev/models/page.tsx` — новый
- `app/(dev)/dev/models/dev-models-client.tsx` — новый
- `app/(dev)/dev/models/actions.ts` — новый
- `app/(dev)/dev/models/components/capability-badges.tsx` — новый
- `app/(dev)/dev/models/components/provider-card.tsx` — новый
- `app/(dev)/dev/models/components/task-row.tsx` — новый
- `app/(dev)/dev/models/components/model-select.tsx` — новый
- `app/api/dev/env-status/route.ts` — новый
- `lib/ai/task-assignments.ts` — (опционально) добавить человекочитаемые описания задач `TASK_DESCRIPTIONS: Record<TaskId, string>`

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `http://localhost:3000/dev/models` → видна полная карта
- [ ] Переключить `simply-chat` на Opus через dropdown → toast → отправить сообщение → footer Opus + OVERRIDE badge
- [ ] Нажать «Reset» рядом с задачей → override исчезает, дефолт возвращается
- [ ] Нажать «Reset all» → все overrides уходят
- [ ] ENV статусы показывают ✅/❌ корректно
- [ ] В prod-сборке (`SIMPLY_DEV_MODE=false npm run build && npm start`) `/dev/models` → 404
- [ ] 🧪 Мануальный тест пользователем: полный сценарий переключения

**Git:** `git commit -m "feat(tz-2): /dev/models page with full switchboard"`

**Критерий готовности:** Страница работает, переключения влияют на runtime модели, prod-гейт рабочий.

---

## ⚠ OPEN QUESTIONS (вынести в отдельные ТЗ после финализации ТЗ-2)

Эти вопросы обнаружились во время тестов Этапа 2. Архитектор подтвердил: **не трогать в скоупе ТЗ-2**, вынести в отдельное ТЗ после финализации.

### 1. Кэш истории сообщений

Сейчас `cacheControl: { type: 'ephemeral' }` стоит только на system prompt. История предыдущих user/assistant сообщений не кэшируется и летит fresh каждый запрос. В длинном диалоге это съедает основную часть экономии от кэша (цифровой пример из пользовательского теста: 10k fresh из ~26k total на 3-м сообщении).

**Требует:** анализ Anthropic cache_control возможностей на content-block level, тесты на разных сценариях, возможно 2-3 отдельных ТЗ.

### 2. Grok / OpenRouter prompt caching не активирован

Каталог содержит реальные `cachedInput` цены для Grok ($0.05-0.20) и OpenRouter ($0.24-0.475 для GLM 5.1 / 5V Turbo). Но `chat/route.ts` подставляет `cacheControl` **только** в ветке `isAnthropicModel`.

**Следствие:** для override на Grok/OpenRouter `cache_read` всегда 0 в DevPanel → отображаемая стоимость как будто cache не работает (хотя провайдер может кэшировать автоматически).

**Требует:** провайдер-специфичная активация (xAI parameter, OpenRouter usage.prompt_tokens_details.cached_tokens), возможно unified wrapper в AI SDK v6.

### 3. Grok vision — подтверждено только одно сочетание

В каталоге `CAPS_GROK.vision = true` для всех моделей. На практике проверена только `grok-4-1-fast-reasoning` с картинкой — работает. Для остальных (4.20 family, multi-agent) — доверяем каталогу, не тестировали.

**Риск:** 400 error при vision override на некорректную модель. Можно проверить в Этапе 4 polish или оставить известным ограничением.

### 4. `grok-4` отсутствует в docs.x.ai/docs/models

Запись оставлена с пометкой в `notes`, pricing взят из 4.20 tier как educated guess. При использовании может вернуть 404.

**Решение:** либо удалить в Этапе 4, либо оставить с более жирной warning в UI.

---

## Этап 3: Per-message Model Switcher в DevPanel

**Статус:** ✅ Завершён (2026-04-12) — мануальный тест пройден: override через DevPanel Switchboard + reset + default восстановлен

**Цель:** Быстрый переключатель прямо в DevPanel — не уходя из чата поменять модель для **текущей задачи** (которую ассистент использует).

**Задачи:**
- [x] Расширить `DebugPromptData` / `DebugStepData` — добавить `taskId?: string` (если ещё нет), чтобы DevPanel знал какой taskId показывать в switcher
  - ✅ Уже реализовано на Этапе 1: `DebugPromptData.taskId`, `overrideActive`, `defaultModelId`, `effectiveModelId`
- [x] Создать `components/dev-panel/sections/switchboard-section.tsx`:
  - Если `data.taskId` не определён → секция скрыта
  - Заголовок «Model Switchboard»
  - Строка: «Current task: `<taskId>`» + OVERRIDE badge
  - Dropdown — те же опции что и на `/dev/models` (все модели + warning)
  - Кнопка «Apply» → вызывает ту же Server Action `setOverride`
  - Кнопка «Reset» → clearTaskOverride
  - Ссылка «Full switchboard →» на `/dev/models`
- [x] Интегрировать в `components/dev-panel/dev-panel-drawer.tsx` — новая секция после ModelSection
- [x] Shared код для dropdown — вынесен `model-select.tsx` в `components/shared/model-select.tsx`, `/dev/models` и DevPanel используют одно

**Файлы:**
- `lib/ai/debug-events.ts` — поле taskId (если нужно)
- `app/(chat)/api/chat/route.ts` — пробросить taskId в emitDebugPrompt (если нужно)
- `components/dev-panel/sections/switchboard-section.tsx` — новый
- `components/dev-panel/dev-panel-drawer.tsx` — интеграция
- `components/shared/model-select.tsx` — перенос из dev/models/components (или alias)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Отправить сообщение в Simply Chat → открыть DevPanel → секция Switchboard показывает `simply-chat`
- [x] Сменить модель через dropdown → следующее сообщение использует новую (grok-4-1-fast-non-reasoning)
- [x] Проверить что секция скрыта если `data.taskId` неизвестен (например, в старых сообщениях из localStorage)
- [x] 🧪 Мануальный тест пользователем: переключение через DevPanel без ухода со страницы чата — ОК, reset → MiniMax-M2.7 восстановлен

**Git:** `git commit -m "feat(tz-2): per-message model switchboard in DevPanel"`

**Критерий готовности:** Разработчик переключает модель прямо в DevPanel, не уходя из чата.

---

## Этап 4: Polish + edge cases

**Статус:** ✅ Завершён (2026-04-12)

**Цель:** Отполировать UX, покрыть edge cases, убедиться что ничего не течёт в prod.

**Задачи:**
- [x] Toast + undo через sonner (5s window) — handleSet/handleClear с undo action
- [x] Warning-иконка в dropdown если capabilities модели не совпадают с категорией задачи
  - Реализовано в shared ModelSelect (taskRequiresCapability) ещё на Этапе 2
- [x] Ссылка в Sidebar на `/dev/models` — **только** при `NEXT_PUBLIC_SIMPLY_DEV_MODE=true` (Settings2 icon)
- [x] Prod smoke test: `SIMPLY_DEV_MODE=false npm run build` — успешен, `/dev/models` → auth redirect (middleware) → notFound (dev gate)
- [x] Model catalog audit: docs/model-catalog-ops.md + исправлены 5 ошибок в каталоге (qwen vision, opus maxOutput, grok-4 deprecated, haiku thinking note, grok context note)
- [ ] ~~Keyboard shortcut Cmd+K~~ — отложен (nice-to-have)
- [ ] ~~cookie httpOnly check~~ — N/A (file-based overrides, не cookie)

**Файлы:**
- `app/(dev)/dev/models/*` — мелкие правки
- `components/dev-panel/sections/switchboard-section.tsx` — warning
- `components/app-sidebar.tsx` или UserMenu — dev link

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (dev + prod)
- [x] Prod smoke: `SIMPLY_DEV_MODE=false npm run build && npm start` → `/dev/models` → redirect/404
- [x] Toast undo работает — ставишь override, жмёшь undo, override уходит
- [x] 🧪 Мануальный тест пользователем: toast, undo, dev-link в sidebar, catalog fixes на /dev/models — ОК

**Git:** `git commit -m "feat(tz-2): polish, edge cases, dev-link in sidebar"`

**Критерий готовности:** Prod полностью изолирован, dev UX отполирован.

---

## Этап 5: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти «✅ Чек-лист при изменениях»
- [ ] Перенести локальный `CHANGELOG.md` → главный `CHANGELOG.md`
- [ ] Обновить `SIMPLY_STATUS.md` — отметить ТЗ-2 завершённым
- [ ] Обновить `CLAUDE.md` — секция «Структура кода» → добавить `app/(dev)/dev/models/*`
- [ ] Обновить `package.json` — 3.83.0 → 3.84.0

**Документация (по чеклисту):**
- [ ] ADR: `docs/decisions/048-dev-switchboard-ui.md` — почему cookie + `next/headers` вместо threading context
- [ ] `docs/architecture.md` — секция «Dev Tools» (если её нет — создать)
- [ ] `docs/ai-providers.md` — не трогаем (модели не менялись)
- [ ] `docs/ai-chats-map.md` — не трогаем (маршрутизация не менялась)
- [ ] `docs/design-system.md` — карта страниц → добавить `/dev/models` в раздел «dev-only»

**Верификация docs (Правило 5):**
- [ ] Код `lib/ai/getModel.ts` → описание в CLAUDE.md совпадает
- [ ] Реальные пути файлов `app/(dev)/dev/models/*` → добавлены в CLAUDE.md

**Завершение:**
- [ ] Финальный мануальный тест пользователем
- [ ] `npm run build` — финальный, успешен
- [ ] Папка `specs/TZ_2_DevSwitchboardUI/` → `_archive/`
- [ ] Git tag (опционально): `v3.84.0`

**Валидация:**
- [ ] Все этапы отмечены [x]
- [ ] Документация актуальна, сверена с кодом
- [ ] Prod работает, dev работает

**Критерий готовности:** ТЗ полностью в архиве, версия обновлена, документация синхронна с кодом.

---

## Точки риска (контрольные)

| Риск | Митигация | На каком этапе проверяем |
|------|-----------|------------------------|
| `next/headers.cookies()` бросает в background | try/catch + silent null | Этап 1 (briefing cron не падает) |
| Cookie >4KB | ~40 × 50 байт = 2KB, лимит не достигнут | Этап 2 (ручной тест с 40 overrides) |
| Stale localStorage vs cookie | Cookie = SSOT, localStorage = зеркало | Этап 4 |
| Prod утечка | Dev-gate на 3 уровнях: `lookupOverride`, `page.tsx`, Server Actions | Этап 4 (prod smoke) |
| Несовместимая модель в override | Warning в UI, toast при выборе | Этап 4 |
| Background pipelines игнорируют override | Это ожидаемое поведение (feature, not bug) | Этап 1 (задокументировать в ADR) |

---

## Критерий «Готово ТЗ-2»

1. Разработчик открывает `/dev/models` в dev → видит полную карту всех ~40 задач + провайдеры + каталог
2. Переключает модель для любой задачи → следующий AI-вызов использует новую модель
3. В DevPanel footer видит badge «OVERRIDE» когда срабатывает
4. В DevPanel drawer может быстро переключить модель для текущего сообщения
5. В prod страница 404, cookie игнорируется, поведение 100% идентично до ТЗ-2
6. Нулевое влияние на существующие call-sites `getModel()` (никаких правок сигнатур)
7. Документация обновлена, версия 3.84.0, папка в архиве
