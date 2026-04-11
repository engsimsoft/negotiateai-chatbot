# Roadmap ТЗ-2: Dev Switchboard UI

**Создан:** 2026-04-12
**Версия проекта:** 3.83.0 → 3.84.0
**Статус:** 🔄 В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 0 (не начат) |
| Сессий (оценка) | 3–4 |
| Затронуто call-sites `getModel()` | 0 (threading не требуется) |

---

## Архитектурный каркас

```
Cookie `x-model-overrides` (JSON: taskId → catalogId)   [dev-only]
        │
        ▼
lookupOverride() в getModel.ts
  ├─ dev-gate (SIMPLY_DEV_MODE)
  ├─ try { cookies() } catch → null (background scope)
  └─ parse JSON → overrides[taskId]
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

**Статус:** 🔄 В работе — код готов, ждёт мануальный тест

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

## Этап 3: Per-message Model Switcher в DevPanel

**Статус:** ⬜ Не начат

**Цель:** Быстрый переключатель прямо в DevPanel — не уходя из чата поменять модель для **текущей задачи** (которую ассистент использует).

**Задачи:**
- [ ] Расширить `DebugPromptData` / `DebugStepData` — добавить `taskId?: string` (если ещё нет), чтобы DevPanel знал какой taskId показывать в switcher
  - Проверить: уже ли пишется taskId в debug events. Если нет — добавить в call-sites которые зовут `getModel()` (минимум для chat/route.ts — там 3 варианта simply)
- [ ] Создать `components/dev-panel/sections/switchboard-section.tsx`:
  - Если `data.taskId` не определён → секция скрыта
  - Заголовок «Model Switchboard»
  - Строка: «Current task: `<taskId>`» + описание из TASK_DESCRIPTIONS
  - Dropdown — те же опции что и на `/dev/models` (все модели + warning)
  - Кнопка «Apply» → вызывает ту же Server Action `setOverride`
  - Ссылка «Open full switchboard →» на `/dev/models`
- [ ] Интегрировать в `components/dev-panel/dev-panel-drawer.tsx` — новая секция после ModelSection
- [ ] Shared код для dropdown — вынести `model-select.tsx` в общее место, чтобы `/dev/models` и DevPanel использовали одно

**Файлы:**
- `lib/ai/debug-events.ts` — поле taskId (если нужно)
- `app/(chat)/api/chat/route.ts` — пробросить taskId в emitDebugPrompt (если нужно)
- `components/dev-panel/sections/switchboard-section.tsx` — новый
- `components/dev-panel/dev-panel-drawer.tsx` — интеграция
- `components/shared/model-select.tsx` — перенос из dev/models/components (или alias)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Отправить сообщение в Simply Chat → открыть DevPanel → секция Switchboard показывает `simply-chat`
- [ ] Сменить модель через dropdown → следующее сообщение использует новую
- [ ] Проверить что секция скрыта если `data.taskId` неизвестен (например, в старых сообщениях из localStorage)
- [ ] 🧪 Мануальный тест пользователем: переключение через DevPanel без ухода со страницы чата

**Git:** `git commit -m "feat(tz-2): per-message model switchboard in DevPanel"`

**Критерий готовности:** Разработчик переключает модель прямо в DevPanel, не уходя из чата.

---

## Этап 4: Polish + edge cases

**Статус:** ⬜ Не начат

**Цель:** Отполировать UX, покрыть edge cases, убедиться что ничего не течёт в prod.

**Задачи:**
- [ ] Toast + undo через sonner (5s window)
- [ ] Warning-иконка в dropdown если capabilities модели не совпадают с категорией задачи
  - Простая эвристика: если taskId содержит `vision` → warning если `!capabilities.vision`
  - Если `embedding` → warning если `!embeddings`
- [ ] Keyboard shortcut: `Cmd+K` на `/dev/models` → focus на search/task filter (nice-to-have)
- [ ] Ссылка в UserMenu / Sidebar на `/dev/models` — **только** при `NEXT_PUBLIC_SIMPLY_DEV_MODE=true` (в dashboard sidebar)
- [ ] Проверить что cookie flag `httpOnly=false` чтобы localStorage-зеркало работало (или `httpOnly=true` + полагаться только на server rerender)
  - Решение: `httpOnly=false` + `SameSite=Lax` + `path=/` — cookie читается клиентом для instant feedback
- [ ] Prod smoke test: сборка + start + заход на `/dev/models` → 404
- [ ] Prod smoke test: подсунуть cookie `x-model-overrides` вручную в prod → убедиться что игнорируется

**Файлы:**
- `app/(dev)/dev/models/*` — мелкие правки
- `components/dev-panel/sections/switchboard-section.tsx` — warning
- `components/app-sidebar.tsx` или UserMenu — dev link

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Prod smoke: `SIMPLY_DEV_MODE=false npm run build && npm start` → `/dev/models` → 404
- [ ] Prod smoke: cookie подсунут вручную → дефолт используется
- [ ] Toast undo работает — ставишь override, жмёшь undo, override уходит
- [ ] 🧪 Мануальный тест пользователем: полный сценарий (dev + prod)

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
