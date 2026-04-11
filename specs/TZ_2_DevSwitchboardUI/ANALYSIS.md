# Анализ ТЗ-2: Dev Switchboard UI

**Создан:** 2026-04-12
**Статус:** ✅ Вопросы согласованы, готов к планированию

---

## Резюме

Дать разработчику UI для runtime-переключения моделей в dev-режиме:
- Страница `/dev/models` — полная карта: ~40 taskId × каталог моделей × статусы провайдеров
- Per-message Model Switchboard внутри DevPanel для быстрого переключения без ухода из чата
- Overrides через cookie (server) + localStorage (client), dev-gate, ноль влияния на prod

ТЗ-1 уже заложил фундамент: `getModel(taskId)` + `lookupOverride()` stub + `GetModelContext`. Задача ТЗ-2 — реализовать stub и построить над ним UI.

---

## Несоответствия ТЗ с реальным кодом

| Пункт ТЗ | Реальность | Решение |
|----------|-----------|---------|
| «31 taskId» | В `DEFAULT_TASK_MODELS` **40 taskId** (Simply 3 + chat 3 + project 3 + professor 5 + clerks 3 + memory 5 + briefing 4 + meeting 1 + service-chat 4 + util 3 + artifact 5 + vision 1) | Использовать реальные 40 |
| «Реестр провайдеров (8 штук)» | `createProviderRegistry` = **5 namespaces**, `ProviderId` в каталоге = **8** (5 LLM + 3 raw) | Две отдельные секции (согласовано) |
| Capabilities иконки | В `ModelCapabilities` **6 полей** (`streaming, tools, vision, documents, thinking, embeddings`) | Показывать все 6 |

---

## Рекомендации разработчика (Код-ревью)

> Все 6 вопросов согласованы архитектором. Ключевые решения ниже.

### ✅ Согласен с ТЗ

- Cookie `x-model-overrides` как SSOT для overrides — ОК, совпадает с уже заложенной сигнатурой `GetModelContext.requestCookies` в [lib/ai/getModel.ts:41](../../lib/ai/getModel.ts#L41).
- Dev-gate через `SIMPLY_DEV_MODE` + `NEXT_PUBLIC_SIMPLY_DEV_MODE` — паттерн из [lib/constants.ts:11](../../lib/constants.ts#L11) и [components/dev-panel/dev-panel-provider.tsx:71](../../components/dev-panel/dev-panel-provider.tsx#L71).
- «Фактическая модель в footer» — уже работает из коробки: [dev-panel-footer.tsx:60-64](../../components/dev-panel/dev-panel-footer.tsx#L60-L64) читает `data.finish.modelId` из step events (это физическая модель API-вызова).

### ⚠️ Рекомендации (согласованы архитектором)

| # | Тема | Рекомендация | Обоснование |
|---|------|--------------|------------|
| 1 | Cookie threading | Читать cookies через `next/headers` **внутри** `lookupOverride()`, а не тащить `context.requestCookies` через 35+ call-sites | В коде `getModel()` вызывается из 35+ мест (pipelines, artifact handlers, briefing, memory, meeting, tools). Явный threading потребовал бы изменения сигнатур во всех этих местах. `next/headers.cookies()` работает в Route Handlers / Server Actions / RSC без изменения сигнатур. Для background-контекстов (cron, `waitUntil`) — обернуть в try/catch, вернуть null |
| 2 | Capability-фильтр | Все модели в dropdown + warning-иконка при несовместимости (вариант C) | Никакой `TASK_REQUIREMENTS` на первом шаге. Dev-tool, разработчик сам разберётся. Экономим время |
| 3 | Placement | `/dev/models` — полная карта. Per-message switcher — новая секция в существующем `DevPanelDrawer` | DevPanel уже открывается из футера каждого сообщения → там же и quick switch. Floating global drawer не нужен |
| 4 | Overrides scope | Только cookie + localStorage. БД — не трогаем | Per-browser достаточно для dev-tool. Per-user в БД = новые миграции ради ноль-пользы |
| 5 | Providers UI | Две секции: LLM (5 namespaces) + Raw (voyage, deepgram, perplexity, google) | Семантически разные: LLM через `createProviderRegistry`, raw через `fetch`. Совмещение запутает |
| 6 | Apply override UX | Сразу сохраняет → toast с undo 3–5 секунд | Стандарт shadcn/sonner. Никакого «черновик → apply all» |

### ❓ Не потребовало уточнения

Архитектор ответил на все 6 вопросов. Технических замечаний больше нет.

---

## Потенциальные риски

1. **`next/headers.cookies()` в background контекстах** — функция бросает вне request scope. Решение: try/catch в `lookupOverride`, silent null fallback. Background pipelines (cron, `waitUntil`) получат дефолты — **это ожидаемое поведение** (overrides для интерактивной разработки, не для cron).

2. **Cookie размер** — ~40 taskId × длина modelId. JSON `{ "task:id": "catalog-id" }` ≈ 50 байт на запись → ~2KB максимум. Под лимит 4KB пролезает.

3. **Race condition при сохранении** — если открыто 2 вкладки и обе пишут cookie, последняя побеждает. Приемлемо для dev-tool.

4. **Несовместимая модель в override** — разработчик вручную выбрал несовместимую модель (например `vision:ocr` → MiniMax без vision). В runtime это приведёт к ошибке от провайдера. Решение: warning-иконка в UI + toast «Modelне поддерживает X — возможны runtime ошибки». Не блокируем.

5. **Stale localStorage** — клиентский localStorage может разойтись с server cookie (например, пользователь очистил cookie через DevTools). Решение: cookie — SSOT, localStorage только зеркало для быстрого рендера UI.

6. **`/dev/models` в prod** — dev-gate через `isSimplyDevMode` + `notFound()` в Server Component. Дополнительная защита: страница в route group `(dev)` чтобы не засорять `(dashboard)`.

---

## Зависимости

- ✅ ТЗ-1 Core Registry (`registry.ts`, `model-catalog.ts`, `task-assignments.ts`, `getModel.ts`) — уже в `master`
- Существующие компоненты dev-panel ([components/dev-panel/](../../components/dev-panel/))
- shadcn/ui: `Sheet`, `Button`, `Select`, `Tooltip`, `Badge`, `Table`, `Toast` (sonner) — уже используются в проекте
- `next/headers` — built-in

---

## Оценка сложности

- [x] **Среднее (3–4 сессии)**
- Стек знаком, риски очевидны, фундамент готов.

**Декомпозиция:**
1. Сессия 1: Backend overrides (lookupOverride, persist/parse, API/Server Actions, env-key check) + Footer badge
2. Сессия 2: Страница `/dev/models` — полная таблица с dropdowns
3. Сессия 3: Per-message switcher в DevPanelDrawer + Reset all + Toast/undo
4. Сессия 4: Финализация (docs, ADR, version, тесты)

---

## Ответы архитектора (2026-04-12)

1. **Cookie через `next/headers`** — ✅ полный зелёный свет
2. **Capability-фильтр** — вариант C (все модели + warning)
3. **Placement** — вариант C (`/dev/models` + per-message в DevPanelDrawer)
4. **Overrides scope** — только cookie + localStorage
5. **Реестр провайдеров** — две секции (LLM + Raw)
6. **Apply override UX** — сразу + toast + undo 3–5 секунд
