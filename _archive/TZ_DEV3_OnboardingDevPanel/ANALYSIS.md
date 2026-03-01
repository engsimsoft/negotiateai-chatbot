# Анализ ТЗ-DEV3: Developer Panel для Onboarding

**Дата анализа:** 2026-03-01

---

## Резюме

Нужно интегрировать панель разработчика (DEV1) в онбординг брифинга и добавить расширенную секцию "Tools" с детализацией tool calls и предупреждениями по источникам. Сервер уже эмитит все необходимые debug events — основная работа на клиенте.

---

## Вопросы для уточнения

> Ответь на эти вопросы перед началом разработки

1. **[Scope]:** Нужен ли счётчик warnings в footer (например `· 2⚠`) или достаточно показывать их только в drawer?
2. **[UX]:** При большом количестве tool calls (20+ steps в онбординге) — показывать footer под КАЖДЫМ ответом ассистента, или только под последним?
3. **[Persistence]:** Нужно ли сохранять debug данные онбординга (как DEV2 сохраняет trace в metadata), или достаточно in-session visibility?

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.

### ✅ Согласен с ТЗ

- **Формат Drawer** — переиспользуем `DevPanelDrawer` из DEV1. Добавляем секции "Tools" и "Cost Breakdown". Без дублирования.
- **Не использовать TraceCollector** — он для пайплайнов с последовательными стадиями. Онбординг — это чат с tool calls, паттерн DEV1 подходит лучше.
- **Cost Breakdown** — per-step стоимость уже вычисляется в `DebugStepData` (tokens + modelId → `calculateCostRub()`). Для bar chart используем паттерн из `PipelineTraceDrawer`.
- **Zero overhead** — все guard-ы уже на месте (`isSimplyDevMode` на сервере, `NEXT_PUBLIC_SIMPLY_DEV_MODE` на клиенте).

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | "Использовать существующий `data-debug-step`, расширив для tool calls" | **НЕ расширять** `DebugStepData` — он уже содержит `toolCalls[]` и `toolResults[]`. Вместо этого добавить **клиентскую аналитику** tool results (парсинг полей `isValid`, `rssUrl`, `content.length` и т.д.) | `service-chat/route.ts:800-810` — `DebugStepData` уже записывает `toolCalls` и `toolResults` в каждый step. Менять серверный формат не нужно. |
| 2 | Не упомянуто | Нужна **smart truncation** для tool results в онбординге. Текущий `truncateForDebug()` обрезает весь JSON до 500 символов — теряются метаданные (`rssUrl`, `source`, `isValid`) если `content` длинный. Предлагаю: обрезать `content`/`text` внутри объекта, сохраняя остальные поля | `debug-events.ts:142-152` — `truncateForDebug` обрезает весь JSON, а не отдельные поля. Для fetchUrl результат `{content: "5000 chars...", title: "...", source: "readability", rssUrl: "..."}` — после truncation потеряем rssUrl |
| 3 | "DevPanelProvider переиспользовать" | Создать **легковесный `OnboardingDebugProvider`** вместо переиспользования полного `DevPanelProvider`. Причина: `DevPanelProvider` читает из `DataStreamContext` (предоставляется `DataStreamProvider` в chat layout). Онбординг использует свой `useChat` с `onData` — другой data flow. Но provider должен экспонировать тот же `DevPanelContext`, чтобы `DevPanelFooter` и `DevPanelDrawer` работали без изменений | `dev-panel-provider.tsx` — зависит от `DataStreamContext`. `briefing-setup-client.tsx` — не имеет `DataStreamProvider` в layout tree |
| 4 | Не упомянуто | **Расширить `onData` в `briefing-setup-client.tsx`** для сбора debug events. Уже есть обработка `data-research-progress` — добавить `data-debug-step`, `data-debug-guardian`, `data-debug-finish`, `data-debug-prompt` по аналогии | `briefing-setup-client.tsx:180-197` — `onData` callback уже обрабатывает custom events |

### ❓ Требует уточнения

- **Footer под greeting message** — первое сообщение ("Привет, ...") — статическое, без debug данных. Footer не должен рендериться для него. Нужен guard: `if (!debugData) return null`.
- **DevPanelDrawer модификация** — добавление секции "Tools" в существующий drawer означает модификацию общего компонента. Нужно сделать через условный рендер (показывать только если есть tool calls), чтобы в основном чате drawer не менялся.

---

## Архитектурное решение: Data Flow

```
Server: /api/service-chat (ALREADY EXISTS)
  ↓ emitDebugPrompt, emitDebugStep, emitDebugGuardian, emitDebugFinish
  ↓
useChat onData callback (briefing-setup-client.tsx)
  ↓ accumulate debug events in state
  ↓
OnboardingDebugProvider (NEW)
  ↓ group events → Map<messageId, DevPanelMessageData>
  ↓ provide DevPanelContext (same as DEV1)
  ↓
BriefingChatPanel
  ↓ render DevPanelFooter per assistant message
  ↓
DevPanelFooter (REUSED) → DevPanelDrawer (EXTENDED with Tools section)
```

**Ключевые отличия от DEV1:**
- Data source: `onData` callback вместо `DataStreamContext`
- Provider: `OnboardingDebugProvider` (lightweight) вместо `DevPanelProvider`
- Drawer: + секция "Tools" (условная, только при наличии tool calls)
- Truncation: smart truncation для metadata preservation

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Tool results слишком большие (fetchUrl content) | Высокая | Среднее — UI lag | Smart truncation на сервере (обрезать content, сохранить meta) |
| Много steps (20-30) в одном ответе | Высокая | Низкое — длинный drawer | Collapsible tool blocks + summary counter в footer |
| onData не доставляет debug events | Низкая | Высокое | Уже работает для `data-research-progress` — тот же механизм |
| DevPanelDrawer изменения ломают основной чат | Низкая | Высокое | Условный рендер секции Tools (guard: `hasToolCalls`) |

---

## Зависимости

**Что нужно до начала:**
- [x] DEV1 (v3.57.0) — base infrastructure
- [x] DEV2 (v3.58.0) — not used directly, but patterns inform design

**Затронутые компоненты:**

| Файл | Изменение |
|------|-----------|
| `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` | +onData debug collection, +OnboardingDebugProvider wrapping |
| `app/(dashboard)/briefing/setup/components/briefing-chat-panel.tsx` | +DevPanelFooter per assistant message |
| `components/dev-panel/dev-panel-drawer.tsx` | +Tools section (conditional) |
| `components/dev-panel/sections/tools-section.tsx` | NEW — tool calls analysis & warnings |
| `components/dev-panel/sections/cost-breakdown-section.tsx` | NEW — per-step cost bar chart (pattern from PipelineTraceDrawer) |
| `hooks/use-onboarding-debug.ts` | NEW — lightweight debug event collector |
| `lib/ai/debug-events.ts` | +`truncateToolResult()` — smart truncation |
| `components/dev-panel/dev-panel-footer.tsx` | +tool count in compact display |

**НЕ затрагиваются:**
- `app/(chat)/api/service-chat/route.ts` — сервер уже эмитит всё нужное
- `components/dev-panel/dev-panel-provider.tsx` — не модифицируем, создаём отдельный
- `lib/ai/pipeline-trace.ts` — не переиспользуем

---

## Оценка

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Сервер уже готов (100%). Клиентская работа: 1 hook + 1 provider + 1 section + модификация 3 файлов. Паттерны известны из DEV1. Основная сложность — в парсинге tool results для structured display и warnings.

---

## Ответы на вопросы

1. **[Scope]:** Счётчик warnings в footer? → **НЕТ.** Warnings только в drawer. Drawer — основное окно для анализа.
2. **[UX]:** Footer под каждым или только под последним? → **Под КАЖДЫМ.** Режим разработки, важно для анализа каждого ответа.
3. **[Persistence]:** Сохранять debug данные? → **ДА.** Обязательно сохранять, чтобы видеть после перезагрузки. Потеря данных при reload — неудобно и критично для анализа.

### Решение по Persistence

**Подход:** `localStorage` с ключом `simply-dev-onboarding-debug`.

**Почему не БД:**
- Онбординг не имеет persisted chat ID (в отличие от project-manager)
- Добавлять миграцию БД ради dev-mode данных — overkill
- localStorage достаточно: переживает reload, очищается при clear storage

**Механизм:**
- При каждом `data-debug-finish` event → сериализовать накопленные данные в localStorage
- При загрузке `/briefing/setup` → восстановить из localStorage
- Key: `simply-dev-onboarding-debug` (один слот, перезаписывается при новой сессии)
- Guard: только при `NEXT_PUBLIC_SIMPLY_DEV_MODE=true`
