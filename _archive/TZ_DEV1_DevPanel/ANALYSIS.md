# Анализ ТЗ-DEV1: Developer Panel

## Резюме

Создание единой Developer Panel для отладки AI-взаимодействий. Заменяет текущие разрозненные dev-инструменты ([DEV] badge, model badge) одной панелью с полной картиной: модель, токены, стоимость, tool calls, Guardian, system prompt.

Архитектурно — проброс серверных данных через transient `data-*` events в клиентский UI. Никаких новых зависимостей, никаких внешних сервисов.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.

### Согласен со SPEC

- Архитектура `onStepFinish → data-debug-* events → React Context → UI` — правильный подход, совпадает с паттернами уже используемыми в проекте (`data-context-usage`, `data-model-info`, `data-research-progress`)
- Использование transient events — обязательно, чтобы debug данные не засоряли историю сообщений
- Удаление `dev-mode-inject.ts` и `dev-mode.md` — безопасно, это standalone утилита с единственной точкой вызова (composer.ts:217)
- Условная эмиссия events (`if SIMPLY_DEV_MODE`) — правильно, нулевой overhead в production
- `isSimplyDevMode` из `lib/constants.ts` — уже есть и корректно работает как SSOT

### Рекомендую изменить

| # | Было (SPEC) | Рекомендация | Обоснование из кода |
|---|-------------|--------------|---------------------|
| 1 | DevPanel Drawer как отдельный компонент | Использовать `components/right-sidebar.tsx` как shell | Уже есть готовый RightSidebar (push-layout для desktop, Sheet для mobile). Не нужно дублировать drawer-логику |
| 2 | `data-debug-prompt` отправляется "если панель expanded" | Отправлять ВСЕГДА при `SIMPLY_DEV_MODE=true`, не зависимо от UI state | Сервер не знает о состоянии UI. Overhead минимален (1 event per message). Клиент просто игнорирует если drawer закрыт |
| 3 | `lib/ai/model-pricing.ts` — новый файл | Расширить существующий `lib/ai/providers.ts` секцией pricing | В `providers.ts` уже определены все модели. Держать pricing рядом с моделями — SSOT |
| 4 | `contextWindowPercent` в `data-debug-finish` | Уже есть `data-context-usage` event в `chat/route.ts:513` — переиспользовать | Не дублировать. DevPanel подхватит существующий `data-context-usage` через тот же data stream |
| 5 | Overlay drawer (не push-layout) | Согласен с SPEC — использовать overlay | RightSidebar поддерживает оба режима. Для DevPanel overlay лучше — не сдвигает чат |

### Требует уточнения

- **Service chat route** — в `service-chat/route.ts` Guardian работает иначе (полная буферизация + blocking). DevPanel events нужно эмитить ДО буферизации или в обход. Потребуется аккуратная интеграция — изучу при разработке Этапа 2.
- **Briefing onboarding bypass** — при `context === "briefing-onboarding"` Guardian не блокирует. DevPanel должен показывать `action: 'bypassed'` для таких steps.

---

## Анализ затрагиваемых файлов

### Серверная сторона (эмиссия events)

| Файл | Строки | Что делаем | Риск |
|------|--------|-----------|------|
| `app/(chat)/api/chat/route.ts` | 397-831 | Добавляем `data-debug-step` в onStepFinish, `data-debug-finish` в onFinish, `data-debug-guardian` в instrumentedStream, `data-debug-prompt` при старте | ВЫСОКИЙ — основной route, Guardian buffering |
| `app/(chat)/api/service-chat/route.ts` | 774-920 | Заменяем `data-model-info` на `data-debug-*` events, интеграция с Guardian bypass | СРЕДНИЙ |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | — | Добавляем `data-debug-*` events | СРЕДНИЙ |
| `lib/prompts/builder/composer.ts` | 217 | Удаляем вызов `injectDevMode()` | НИЗКИЙ |
| `lib/prompts/builder/dev-mode-inject.ts` | весь файл | Удаляем | НИЗКИЙ |
| `lib/prompts/core/dev-mode.md` | весь файл | Удаляем | НИЗКИЙ |

### Клиентская сторона (UI)

| Файл | Что делаем | Риск |
|------|-----------|------|
| `components/dev-panel/` (новая папка) | Создаём DevPanelProvider, Footer, Drawer, секции | НИЗКИЙ — изолированные компоненты |
| `components/message.tsx` | Удаляем devModelName (211-216, 259-263), добавляем DevPanelFooter | СРЕДНИЙ — центральный компонент |
| `components/chat.tsx` | Оборачиваем в DevPanelProvider (если dev mode) | НИЗКИЙ |

### Удаление

| Файл | Действие |
|------|---------|
| `lib/prompts/builder/dev-mode-inject.ts` | Удалить файл |
| `lib/prompts/core/dev-mode.md` | Удалить файл |

---

## Потенциальные риски

### 1. Guardian + DevPanel timing (ВЫСОКИЙ)
**Проблема:** Guardian буферизирует text-delta events и анализирует на finish-step. DevPanel events (`data-debug-step`) тоже нужно эмитить на finish-step. Порядок: сначала Guardian анализ → потом DevPanel event (чтобы включить Guardian результат в step data).

**Митигация:** Эмитить `data-debug-step` ПОСЛЕ `tracker.analyze()` в finish-step handler.

### 2. Timing расчёт (СРЕДНИЙ)
**Проблема:** AI SDK `onStepFinish` не предоставляет `durationMs` напрямую. Нужно считать самостоятельно.

**Митигация:** Засекать `Date.now()` при `start-step` event, вычислять delta при `finish-step`.

### 3. Production leak (СРЕДНИЙ)
**Проблема:** Если `SIMPLY_DEV_MODE` случайно установлен в production, debug events будут эмититься.

**Митигация:** Двойная проверка — `isSimplyDevMode && !isProductionEnvironment`. Но это может быть избыточно — dev mode на staging/preview нужен. Решение: оставить только `isSimplyDevMode`, документировать что в production env var должен быть `false`.

### 4. Bundle size (НИЗКИЙ)
**Проблема:** DevPanel компоненты могут попасть в production bundle.

**Митигация:** `next/dynamic` с `ssr: false` + проверка `isSimplyDevMode` перед импортом. Webpack tree-shaking удалит неиспользуемые imports.

---

## Зависимости

- **Существующие:** AI SDK 5 (onStepFinish, onFinish, data-* events, transient), shadcn/ui (Sheet, Collapsible, ScrollArea), RightSidebar shell
- **Новые npm:** Нет
- **Новые таблицы БД:** Нет
- **Миграции:** Нет

---

## Оценка сложности

- [x] Среднее (3-5 сессий)

**Обоснование:**
- Этап 1 (серверная эмиссия для main chat) — 1 сессия
- Этап 2 (UI компоненты) — 1-2 сессии
- Этап 3 (service chat + project tasks + удаление старого) — 1 сессия
- Этап 4 (финализация) — 0.5 сессии
