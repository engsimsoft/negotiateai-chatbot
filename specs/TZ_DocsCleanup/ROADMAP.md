# Roadmap: TZ_DocsCleanup

**Создан:** 2026-04-15
**Версия проекта:** 3.91.0 (не меняется — docs/chore)
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 5 |
| Текущий этап | 1 |
| Сессий (оценка) | 4-5 (одна сессия ≤ 1 этап, кроме мелких 4-5 можно вместе) |

---

## Этап 1: Hot fix `docs/ai-chats-map.md`

**Статус:** 🔄 В работе

**Цель:** SSOT карты моделей больше не врёт — MiniMax убран из активных таблиц, xAI Grok отражён для всех trong Simply taskId.

**Задачи:**

- [ ] Прочитать `lib/ai/task-assignments.ts` — точные current `getModel(taskId)` для `simply-chat`, `simply-chat-think`, `simply-chat-vision`, + поймать какие ещё taskId используют xAI на сегодня.
- [ ] Прочитать `docs/ai-chats-map.md` целиком, карта секций, найти все места с MiniMax (grep `MiniMax\|minimax` → ~62 hits).
- [ ] Убрать MiniMax как активного провайдера из таблиц статуса моделей. Если нужно сохранить исторический контекст — одна строка в сноске со ссылкой на `CHANGELOG.md` и `docs/ai-minimax.md` (banner в этап 5).
- [ ] Добавить xAI Grok строки в таблицу моделей: какие taskId на каких моделях (`grok-4-1-fast-non-reasoning`, `grok-4.20-0309-non-reasoning`, + `claude-haiku-4-5` для `simply-chat-vision`).
- [ ] Убрать / сократить 62 версионных тега (`v3.xx`) где это CHANGELOG-стиль. Оставить только там где версия реально информативна (например, «Claude Sonnet 4.6 поддерживает Compaction API с v3.73»).
- [ ] Убрать / сократить 8 ТЗ-пометок (`ТЗ-XAI-1`, …).

**Файлы:**
- `docs/ai-chats-map.md` — редактирование
- `lib/ai/task-assignments.ts` — только чтение (источник правды)
- `lib/ai/model-catalog.ts` — только чтение (верификация моделей)

**Валидация этапа:**

- [ ] `grep -c 'MiniMax\|minimax' docs/ai-chats-map.md` → только в историческом контексте (сноска / legacy-раздел), не в активных таблицах.
- [ ] `grep -c 'grok' docs/ai-chats-map.md` → ≥ 3 (три taskId).
- [ ] `grep -c 'v3\.' docs/ai-chats-map.md` → существенно меньше 62 (целевой потолок: 10).
- [ ] Каждая строка в таблице моделей ссылается на taskId, который **реально существует** в `task-assignments.ts` (ручная сверка).
- [ ] `npx tsc --noEmit` — не применимо (только markdown).
- [ ] 🧪 **Мануальная проверка Владимиром:** открой `docs/ai-chats-map.md`, убедись что таблица отражает реальность сегодня.

**Git (после валидации):**
```bash
git add docs/ai-chats-map.md
git commit -m "docs(ai-chats-map): hot fix — remove MiniMax, add xAI Grok taskId (TZ_DocsCleanup Этап 1)"
```

**Критерий готовности:** таблица моделей соответствует `task-assignments.ts`, MiniMax отсутствует как активный провайдер, Владимир одобрил diff.

---

## Этап 2: `docs/architecture.md` trim версионных тегов

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1.

**Цель:** Архитектурный документ становится чистой архитектурой, а не CHANGELOG-стилем. CLAUDE.md перенаправляет туда пофайловую карту — документ должен быть безопасным местом для ссылок.

**Задачи:**

- [ ] Прочитать `docs/architecture.md` целиком (366 строк), карта секций.
- [ ] Убрать 21 версионный тег (v3.83, v3.58, v3.69, v3.43, v3.52, …) из ASCII-диаграммы слоёв и описаний модулей. Пример: `ai/getModel.ts - SSOT getModel(taskId) (v3.83, ТЗ-1)` → `ai/getModel.ts - SSOT getModel(taskId)`.
- [ ] Убрать 5 ТЗ-пометок.
- [ ] Проверить что описание слоёв (Presentation / Auth / Business / Data / External) отражает реальность. Сверить с `app/`, `lib/`, `components/` через `ls`.
- [ ] Если секции устарели по сути (например, MiniMax как external service) — обновить.
- [ ] Проверить что документ может служить «пофайловой картой», куда перенаправляет CLAUDE.md. Если не хватает — добавить недостающее **одной таблицей**, не эссе.

**Файлы:**
- `docs/architecture.md` — редактирование

**Валидация этапа:**

- [ ] `grep -c 'v3\.' docs/architecture.md` → 0 (или только в необходимом историческом контексте).
- [ ] `grep -c 'ТЗ-' docs/architecture.md` → 0.
- [ ] Структура слоёв (Presentation / Auth / Business / Data / External) сверена с реальностью через `ls app/ lib/ components/`.
- [ ] 🧪 **Мануальная проверка Владимиром.**

**Git:**
```bash
git add docs/architecture.md
git commit -m "docs(architecture): remove version tags and TZ markers from layer diagrams (TZ_DocsCleanup Этап 2)"
```

**Критерий готовности:** `grep 'v3\.' docs/architecture.md` → пусто в структурных разделах.

---

## Этап 3: `SIMPLY_STATUS.md` переписать как snapshot

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2.

**Цель:** Файл становится snapshot'ом текущего состояния (~300 строк), отвечающим на вопрос **«ЧТО РАБОТАЕТ»**, а не «что было сделано».

**⛔ Золотой критерий (Владимир, 2026-04-15):**
- STATUS = **настоящее время**. «Simply Chat работает на Grok 4.1 Fast» — да. «В v3.88 переключили на Grok» — **нет, это CHANGELOG**.
- Ни одного глагола в прошедшем времени в описаниях компонентов.
- Ни одной даты, ни одного `v3.xx`, ни одного `ТЗ-XXX` в теле (кроме разве что ссылки на активную серию).
- STATUS — **не source of truth для кода**, не описывает детали реализации. Это паспорт для **чтения**.
- Сиротные факты (что-то из старого STATUS, чего нет ни в CHANGELOG ни в SPEC какого-либо ТЗ) — **выкидываем** (вариант A). Git сохранит старый файл навсегда.

**Задачи:**

- [ ] Прочитать текущий SIMPLY_STATUS.md целиком (2323 строки) — найти блок «живого статуса» (строки 1-338 по аудиту) который сохранится.
- [ ] Прочитать `package.json` → текущая версия (должна быть 3.91.0).
- [ ] Прочитать `lib/ai/task-assignments.ts` → актуальный состав моделей.
- [ ] Прочитать `lib/db/schema.ts` → посчитать таблицы БД.
- [ ] Прочитать `specs/_backlog/README.md` → открытые баги.
- [ ] Написать новый SIMPLY_STATUS.md в структуре:
  - Шапка (версия, дата, статус, URL)
  - Таблица компонентов (Simply Chat / Проекты / Briefing / Podcast / Meeting / Telegram Bot / MIND / Artifacts / Auth / Billing) со статусом + примечание
  - Активная серия ТЗ (Simply_xAI) — 3-5 строк, ссылка на SIMPLY_XAI_ROADMAP
  - Метрики кода (маршруты API, промпты, агенты, таблицы БД, AI-моделей интегрировано)
  - Известные проблемы (из backlog)
  - Инфраструктура (Next.js, PostgreSQL, AI SDK версии)
  - Ссылки на PRODUCT_VISION, CHANGELOG, docs/
- [ ] **Полностью удалить** старый массив 65 ТЗ-описаний — они в CHANGELOG.
- [ ] Целевой размер: ≤ 400 строк.

**Файлы:**
- `SIMPLY_STATUS.md` — полная перезапись

**Валидация этапа:**

- [ ] `wc -l SIMPLY_STATUS.md` → ≤ 400.
- [ ] `grep -c 'ТЗ-' SIMPLY_STATUS.md` → ≤ 5 (только активная серия + открытые баги backlog).
- [ ] Версия в шапке = `package.json` version.
- [ ] Таблица компонентов вручную сверена с `lib/ai/task-assignments.ts` + `app/` маршрутами.
- [ ] 🧪 **Мануальная проверка Владимиром** — самый важный этап, требует финального одобрения.

**Git:**
```bash
git add SIMPLY_STATUS.md
git commit -m "docs(simply-status): rewrite as snapshot (2323 → ~350 lines), remove 65 TZ history duplicates (TZ_DocsCleanup Этап 3)"
```

**Критерий готовности:** Владимир, открыв SIMPLY_STATUS.md, за 30 секунд видит реальное состояние проекта.

---

## Этап 4: Процессный фикс `specs/WORKFLOW.md`

**Статус:** 🟡 Частично выполнено — mini-extension к Этапу 1 (2026-04-15). Полный этап (13 docs/ файлов с триггерами) остаётся на свою очередь.

⛔ Полный Этап 4 — НЕ НАЧИНАТЬ без подтверждения Этапа 3.

### Mini-extension (выполнено в Сессии 1, 2026-04-15)

По инициативе Владимира — узкая защита для `ai-chats-map.md` **немедленно**, не ждать Этапа 4. Причина: мы сейчас в миграции xAI, каждый ТЗ трогает `task-assignments.ts`, документ должен обновляться при каждом изменении. Ждать 3 сессии = снова деградация.

**Что сделано (5 правок + memory):**

- [x] WORKFLOW.md L122 — таблица Правила 6: две устаревшие строки про `ai-chats-map.md` объединены в одну правильную. Ссылки на мёртвый `myProvider` / `chat-mode-config.ts` / `model-tiers.ts` / `api/service-chat/route.ts` заменены на актуальные `lib/ai/task-assignments.ts` + `lib/ai/model-catalog.ts`.
- [x] WORKFLOW.md L128-132 — grep-команды «Быстрой проверки» обновлены: было `grep "anthropic\|google\|model" lib/ai/providers.ts` (мёртвая правда), стало `grep '"[a-z][a-z0-9-]*":\s*"' lib/ai/task-assignments.ts` + `grep '^\s*id:' lib/ai/model-catalog.ts`.
- [x] WORKFLOW.md L612 — чек-лист финализации: мягкая формулировка «если затронуты AI-модели» заменена на **жёсткий триггер**: «ОБЯЗАТЕЛЬНО если в diff ТЗ есть изменения `lib/ai/task-assignments.ts` или `lib/ai/model-catalog.ts`». Плюс grep-тест на правду.
- [x] WORKFLOW.md L633-636 — в разделе «Верификация docs против кода» (Правило 6) блок «Для ЛЮБОГО ТЗ: открыть `ai-chats-map.md` → код-блок myProvider» заменён на «Если в ТЗ изменился `task-assignments.ts` или `model-catalog.ts`: сверить каждую строку с SSOT + grep-тест».
- [x] WORKFLOW.md L690 — чек-лист завершения ТЗ: «ai-chats-map.md → код-блок myProvider совпадает с providers.ts» (мёртвое правило) заменено на «если в diff есть task-assignments.ts или model-catalog.ts → ОБЯЗАТЕЛЬНО сверить построчно».
- [x] Создан memory файл `feedback_ai_chats_map_sync.md` — feedback правило-привычка: «При правке task-assignments.ts/model-catalog.ts обновлять ai-chats-map в той же сессии, не откладывать». Дублирующая защита на случай если следующий Claude Code не проходит по формальному чек-листу финализации (hot fix, быстрый патч).
- [x] Добавлена ссылка в `MEMORY.md` индекс.

**Что осталось для полного Этапа 4:**

- [ ] Расширить триггеры в WORKFLOW на все 13 файлов `docs/`:
  - `setup.md` — триггер: изменения `.env.example`, `next.config.ts`
  - `deployment.md` — триггер: изменения Vercel config, env vars, миграции
  - `ai-tools.md` — триггер: изменения `lib/ai/tools/*`
  - `ai-agents.md` — триггер: изменения `lib/prompts/agents/*`, новые skills
  - `ai-artifacts.md` — триггер: изменения `artifacts/*`, `lib/ai/tools/create-document.ts`
  - `ai-providers.md` — триггер: изменения `lib/ai/registry.ts`, новый провайдер
  - `design-system.md` — триггер: новые layout-ы, route groups, UI-компоненты навигации
  - `mcp-tools.md` — триггер: изменения MCP servers
  - `model-catalog-ops.md` — триггер: workflow каталога изменился
  - `troubleshooting.md` — триггер: нет формального (обновляется при разборе incident-ов)
  - `ai-minimax.md` — будет переименован в Этапе 5
  - `ai-chats-map.md` — **уже сделано** в mini-extension ✅
  - `architecture.md` — **уже сделано** в прошлой уборке CLAUDE.md cleanup ✅

### Остальная часть Этапа 4 (при Сессии 4)

**Цель:** Чеклист финализации содержит явные триггеры обновления для **всех 13 файлов docs/**. Root cause «файл не в чеклисте → никогда не обновляется» закрыт.

**Задачи:**

- [ ] Расширить чеклист финализации в WORKFLOW.md (L607-616 и L682-692) списком триггеров для каждого docs/ файла:
  - Миграция провайдеров / смена моделей → `ai-chats-map.md`, `ai-providers.md`, `ai-minimax.md` (или новый `ai-<provider>.md`), `setup.md` (env vars), `deployment.md` (prod env vars).
  - Новые AI tools → `ai-tools.md`.
  - Новые агенты / клерки / эксперты → `ai-agents.md`.
  - Новые типы артефактов → `ai-artifacts.md`.
  - Новые архитектурные слои / модули → `architecture.md`.
  - Новые UI-компоненты / страницы / layout → `design-system.md`.
  - Новые MCP servers → `mcp-tools.md`.
  - Изменения каталога моделей → `model-catalog-ops.md`.
  - Известные проблемы → `troubleshooting.md`.
  - Шаги установки → `setup.md`.
  - Shipped deploy config → `deployment.md`.
- [ ] Добавить проверку: «Прогнать `git log --since='N days ago' -- docs/FILE.md` — если > 60 дней без обновления и ТЗ затрагивает тему файла → обязательно обновить».
- [ ] Обновить Правило 6 (L107-124) — добавить в таблицу все docs/ файлы с указанием что проверять.

**Файлы:**
- `specs/WORKFLOW.md` — редактирование

**Валидация этапа:**

- [ ] Все 13 docs/ файлов упомянуты в чеклисте финализации с триггером.
- [ ] 🧪 **Sanity check:** Владимир пробегает глазами секцию финализации — понимает триггеры без дополнительных вопросов.

**Git:**
```bash
git add specs/WORKFLOW.md
git commit -m "process(workflow): добавить триггеры обновления для всех 13 docs/ файлов в чеклисте финализации (TZ_DocsCleanup Этап 4)"
```

**Критерий готовности:** невозможно завершить новое ТЗ про миграцию провайдеров, не увидев пункт про `setup.md`.

---

## Этап 5: `docs/ai-minimax.md` banner + Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4.

**Цель:** MiniMax-документ помечен как архивный. Финализация ТЗ по чек-листу.

**Задачи:**

**5.1. Banner для `ai-minimax.md`:**

- [ ] Добавить в начало файла (после `# Title`) компактный banner-блок:
  ```markdown
  > ⛔ **Архивный документ.** После серии Simply_xAI (ТЗ-XAI-1, v3.88.0) MiniMax убран из Simply Chat и MIND pipeline. Актуальная карта моделей — [docs/ai-chats-map.md](ai-chats-map.md). История — [CHANGELOG.md](../CHANGELOG.md). Документ сохранён для исторической справки — содержимое **не отражает текущее состояние** проекта.
  ```
- [ ] Не переименовывать файл (избегаем grep по ссылкам во всём проекте).
- [ ] Не удалять содержимое — только banner сверху.

**5.2. Финализация ТЗ (по чек-листу ROADMAP_GUIDE):**

- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти «✅ Чек-лист при изменениях».
- [ ] Обновить главный CHANGELOG.md — добавить запись в `[Unreleased]` про этот ТЗ (5 этапов, факты).
- [ ] Обновить SIMPLY_STATUS.md — уже сделано в этапе 3, проверить актуальность.
- [ ] ⛔ CLAUDE.md — **НЕ редактировать.** `wc -l CLAUDE.md` ≤ 220. Проверить что лимит соблюдён.
- [ ] package.json — **не меняем** (docs/chore, не версия).
- [ ] `docs/ai-chats-map.md` — сверено в этапе 1.
- [ ] `docs/architecture.md` — исправлено в этапе 2.
- [ ] ADR нужен? — **Не нужен.** Это уборка, не архитектурное решение. (Если появится значимый принцип по ходу — оформим.)
- [ ] HANDOFF.md — финальная запись «ТЗ завершён, 5 этапов закрыты».
- [ ] Переместить папку: `mv specs/TZ_DocsCleanup/ specs/_archive/`.

**Валидация ТЗ:**

- [ ] `wc -l CLAUDE.md` → ≤ 220 (инвариант соблюдён).
- [ ] `wc -l SIMPLY_STATUS.md` → ≤ 400.
- [ ] `grep -c 'MiniMax' docs/ai-chats-map.md` → только в historical context.
- [ ] `grep -c 'v3\.' docs/architecture.md` → 0.
- [ ] Banner в `docs/ai-minimax.md` присутствует в первых 10 строках.
- [ ] `specs/WORKFLOW.md` чеклист упоминает все 13 docs/ файлов.
- [ ] Владимир одобрил финализацию.

**Git:**
```bash
git add docs/ai-minimax.md CHANGELOG.md
git commit -m "docs(ai-minimax): banner archival + finalize TZ_DocsCleanup (5/5 этапов)"
```

**Критерий готовности:** ТЗ в `specs/_archive/`, главный CHANGELOG содержит запись, Владимир одобрил.

---

## Gate-keeping между этапами

**НЕЛЬЗЯ начинать следующий этап пока:**

1. ✅ Все задачи текущего этапа отмечены `[x]`.
2. ✅ Manual тест Владимиром пройден.
3. ✅ Git commit сделан.
4. ✅ HANDOFF.md обновлён с фиксацией что сделано.
5. ✅ Локальный CHANGELOG.md обновлён.

---

## Заметки

- ТЗ **не продуктовое** — версия не поднимается, package.json не трогаем.
- Официальная документация FIRST (Правило 1) не применимо — внешних технологий нет.
- `.bak` файлы **не делаем** — полагаемся на git (ссылка на решение в ANALYSIS).
- Каждый этап должен умещаться в одну сессию без «обрезания углов». Если этап разрастается — остановиться, сделать HANDOFF, продолжить в следующей сессии.
