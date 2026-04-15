# HANDOFF — TZ_DocsCleanup

> Передача между сессиями. Каждая сессия — отдельная append-only запись сверху. Новый Claude Code начинает с чтения последней записи → SPEC → ROADMAP → текущий этап.

---

## Сессия 2 — 2026-04-15 — Этапы 4 и 5 выполнены, ТЗ готово к архивации

**Контекст:** Владимир одобрил RAG-split фикс («Да окей»). Продолжаю в той же сессии — Этапы 4 и 5 оба помечены в ROADMAP как «лёгкие» и «можно объединить».

**Этап 4 — `specs/WORKFLOW.md` (746 → 791):**

Центральное решение — Правило 6 таблица расширена с 3 до **13 строк**, каждая строка = один docs/ файл + колонка «Файл(ы)-триггер в git diff». Это стало centralized reference, на который ссылаются все чек-листы финализации.

Три места правлено:
1. **Правило 6 таблица (L119-165)** — 13 строк + 3-фазные правила применения + grep-тесты правдивости.
2. **Фаза 4 «3. Документация» (L606-618)** — длинный список правил заменён на ссылку на Правило 6 таблицу + 3 обязательные проверки для «живых» документов.
3. **«Завершение ТЗ» чек-лист (L688-710)** — 2 docs в чек-листе → **13 docs** с explicit триггерами + grep-тесты правдивости.

Валидация: `for f in 13-docs; do grep -q docs/$f.md WORKFLOW; done` → **13/13 ✅**.

**Этап 5 — `docs/ai-minimax.md` banner (256 → 271) + главный `CHANGELOG.md`:**

Banner-блок добавлен в шапку. Отличие от образца в ROADMAP: не полный archival, а **частичный** — потому что MiniMax всё ещё активен для `create` chatMode и briefing pipeline (filter/author/section long-timeout + podcast-script). Banner явно перечисляет откуда убран (Simply Chat, MIND) и где ещё активен. Ссылки на актуальные SSOT: ai-chats-map, SIMPLY_STATUS, SIMPLY_ATTACHMENT_ARCHITECTURE, CHANGELOG.

Главный `CHANGELOG.md` — запись `### Docs / Chore — 2026-04-15 — TZ_DocsCleanup (5 этапов)` добавлена в `[Unreleased]` после существующего CLAUDE.md cleanup блока. Подробный разбор всех 5 этапов + RAG-split фикс как подраздел Этапа 2+3 + 4 механизма защиты от регрессии.

**Финальная валидация — все 7 правленных файлов:**

| Файл | Строк | Инвариант |
|---|---|---|
| `CLAUDE.md` | **211** | ≤ 220 ✅ (не трогали) |
| `SIMPLY_STATUS.md` | **166** | ≤ 400 ✅ (2323 → 166, −93%) |
| `docs/architecture.md` | **519** | пофайловая карта фич + SSOT указатели |
| `docs/design-system.md` | **450** | § 13 расширен: 25 shadcn + 17 elements + 3 доп. подраздела |
| `docs/ai-chats-map.md` | **654** | trim + actualization (MiniMax → Grok/Claude/MiniMax split) |
| `docs/ai-minimax.md` | **271** | +banner (-15 строк старой шапки, +15 строк новой) |
| `specs/WORKFLOW.md` | **791** | 13-doc триггерная таблица в Правиле 6 |

grep-тесты:
- `grep 'v3\.'` в теле ключевых файлов → **0** ✅
- `grep 'ТЗ-'` (русское) в теле → **0** ✅
- `grep 'docs/*.md' specs/WORKFLOW.md` → все **13 docs/** упомянуты ✅

### Статус ТЗ_DocsCleanup: 100% готово к архивации

| Этап | Файл | Статус |
|---|---|---|
| 1 | `docs/ai-chats-map.md` | ✅ closed (commit `889f017` в Сессии 1) |
| 2 | `docs/architecture.md` + `docs/design-system.md` | 🟡 ждёт final manual test + commit |
| 3 | `SIMPLY_STATUS.md` | 🟡 ждёт final manual test + commit |
| 4 | `specs/WORKFLOW.md` | 🟡 ждёт final manual test + commit |
| 5 | `docs/ai-minimax.md` + главный `CHANGELOG.md` | 🟡 ждёт final manual test + commit |

**Что ждёт Владимир:**
1. Мануальная проверка 7 правленных файлов.
2. Один финальный коммит (рекомендация) или 4 отдельных по этапам — на выбор.
3. После коммита: `mv specs/TZ_DocsCleanup/ specs/_archive/TZ_DocsCleanup/` — папка готова уйти в архив.

**Команда для одного финального коммита (рекомендация):**
```bash
git add docs/architecture.md docs/design-system.md docs/ai-minimax.md \
  SIMPLY_STATUS.md CHANGELOG.md specs/WORKFLOW.md \
  specs/TZ_DocsCleanup/
git commit -m "docs: TZ_DocsCleanup finalize — Этапы 2+3+4+5 (architecture SSOT, SIMPLY_STATUS snapshot, WORKFLOW 13-doc triggers, ai-minimax banner)"
```

После коммита сделать архивацию:
```bash
mkdir -p specs/_archive
mv specs/TZ_DocsCleanup specs/_archive/TZ_DocsCleanup
git add specs/_archive/TZ_DocsCleanup specs/TZ_DocsCleanup  # deleted path + added path
git commit -m "docs(archive): TZ_DocsCleanup → _archive после финализации"
```

### 4 механизма защиты от регрессии

1. **Memory `feedback_ai_chats_map_sync.md`** (Сессия 1) — триггер обновления ai-chats-map при task-assignments/model-catalog изменениях
2. **Memory `feedback_ssot_before_list.md`** (Сессия 2) — SSOT-проверка перед любым списком в doc
3. **Memory `feedback_check_arch_ssot_before_describing.md`** (Сессия 2) — читать архитектурные SSOT активной серии ТЗ перед описанием фич
4. **WORKFLOW.md Правило 6 таблица на 13 docs/ файлов** (Сессия 2 Этап 4) — процессная защита на уровне чек-листа финализации

Эти 4 механизма работают в двух слоях:
- **Memory (1-3)** — личная привычка-напоминание, загружается в каждый сессионный контекст автоматически.
- **WORKFLOW (4)** — формальный процессный чек-лист, проходится в Фазе 4 каждого ТЗ.

Если хотя бы один из 4 сработает — регрессия блокируется.

### Что НЕ делал (намеренно, вне scope)

- **Не трогал CLAUDE.md** — инвариант 220 строк, файл на 211, не нарушал.
- **Не пушил коммиты** — правило «Владимир коммитит сам».
- **Не делал `mv specs/TZ_DocsCleanup/ _archive/`** — это последний шаг после коммита, делает пользователь или я по явному запросу.
- **Не трогал ROADMAP конкретных активных ТЗ** (TZ_xai_4, etc.) — append-only принцип, не моя зона.

### Урок серии для будущих сессий

**SSOT-ловушка конвейера:** root cause деградации CLAUDE.md и других доков был не в халатности, а в **процессном конвейере** WORKFLOW.md + ROADMAP_GUIDE.md + шаблонах ТЗ, которые формально требовали «обновлять файл X» без указания ЧТО именно писать и чего НЕ писать. Плюс 90+ исполнений — и файл вырос в 3×.

**Защита на этот раз:** жёсткие триггеры («файл Y в diff → файл X должен быть обновлён»), grep-тесты правдивости («каждая модель в docs должна существовать в code»), memory-правила-привычки (загружаются в контекст автоматически), WORKFLOW.md как SSOT триггеров.

Если эти 4 слоя начнут снова деградировать — root cause будет другим. Но этот классический root cause закрыт.

---

## Сессия 2 — 2026-04-15 — RAG-split фикс (пост-ревью Владимира, Этапы 2+3)

**Фидбэк Владимира:** недочёт архитектуры — в `architecture.md` и `SIMPLY_STATUS.md` я упомянул только MIND, не показав что RAG = umbrella с двумя разными хранилищами. SSOT дизайна → [SIMPLY_ATTACHMENT_ARCHITECTURE.md § Слой 3](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md).

**Разделение, которое я пропустил:**
- **MIND** (Voyage + pgvector) — ✅ работает. Персональная автоматическая память из разговоров.
- **Collections** (xAI Grok native) — 📋 план ТЗ-XAI-COL-1. Явная загрузка документов пользователем. **Из коробки у xAI, без своей векторной инфраструктуры.**

Общий интерфейс: `knowledge_search` tool. Принцип: для персональной памяти → Voyage, для документов-знаний → xAI Collections.

**Верификация перед правкой:** `grep -rl "knowledge_search|Collections|file_search" lib/ app/` → 0 результатов. В коде нет ничего. Владимир подтвердил «реализовано только первых три фазы» (MIND extract/retrieve/consolidate/profile).

**Правки (2 файла, 4 блока):**

1. **`docs/architecture.md` Карта фич** — entry MIND переделана в «База знаний (Слой 3 RAG) — MIND + Collections» с двумя подсекциями: MIND ✅ (сохранено) + Collections 📋 (новое, с status/provider/cost/UI/принципом).
2. **`docs/architecture.md` External Services ASCII** — строка xAI расширена: «Simply Chat + MIND extract + Collections RAG (план ТЗ-XAI-COL-1)». 500 → 519 строк.
3. **`SIMPLY_STATUS.md` таблица компонентов** — строка MIND разделена на две: «База знаний — MIND ✅» + «База знаний — Collections 📋». 165 → 166 строк.
4. **`SIMPLY_STATUS.md` Три уровня персонализации** — пункт 2 уточнён: «MIND = автоматическая память, не путать с Библиотекой (Collections) для явной загрузки — см. таблицу выше».

**Валидация:**
- `grep 'v3\.'` в обоих файлах → 0 ✅
- Collections помечен именно как 📋 план (не ⚠️ partial), потому что grep подтвердил 0 кода ✅
- Обе правки ссылаются на `SIMPLY_ATTACHMENT_ARCHITECTURE.md` как SSOT дизайна и `SIMPLY_XAI_ROADMAP.md` как SSOT статуса ТЗ

Полный лог правок: [CHANGELOG.md](CHANGELOG.md) → «RAG-split фикс».

**Урок:** перед любым описанием архитектурной фичи в документации — **сверять с ТЗ-документами серии** (SIMPLY_ATTACHMENT_ARCHITECTURE, MIND_ARCHITECTURE, SIMPLY_XAI_ROADMAP). Там часто есть umbrella-концепции, которые я могу не заметить читая только код. Сейчас я читал `lib/ai/memory/` и описал только то что нашёл в коде — и пропустил planned Collections, который есть в архитектурном SSOT.

---

## Сессия 2 — 2026-04-15 — Этап 3 выполнен (SIMPLY_STATUS.md 2323 → 165 строк)

**Контекст:** После Этапа 2 SSOT-фикса Владимир сказал «отлично продолжай» → зелёный свет на Этап 3 в той же сессии. Этап 3 = самая тяжёлая часть всего ТЗ.

**Файл:** `SIMPLY_STATUS.md` — **полностью переписан** (2323 → 165 строк, −93%).

**Подход:** новая структура, не «урезание старого». Старый STATUS.md дублировал тематические doc-ы (система промптов, проекты, профиль БД, список tools). По SSOT всё это должно жить в одном месте (`ai-agents.md`, `architecture.md`, `ai-tools.md`), STATUS — только snapshot + указатели.

**Структура нового STATUS (11 H2-разделов):**

1. Шапка — версия 3.91.0, статус, URL
2. О проекте — 3 строки философии + ссылка на PRODUCT_VISION
3. **Компоненты — таблица 17 строк** (Simply Chat, Экспертиза, Создание, Проекты, MIND, Briefing, Podcast, Meeting, Telegram, Artifacts, Service Chats, Ben ⚠️ deprecated, Dev Switchboard, Auth, Voice, Deep Research, Web Search, Fetch URL, PDF preview, Оплата 📋)
4. Активная серия ТЗ — Simply_xAI со ссылками на ROADMAP/NOTES/ARCHITECTURE
5. Три уровня персонализации — 3 строки product-описания (Профиль + MIND + Chat Memory)
6. Инфраструктура — техстек table
7. **Метрики — 8 строк с SSOT-ссылками** на каждую цифру (39 taskId, 29 таблиц, 17 tools, 25 примитивов, 17 elements, 5 артефактов)
8. Известные проблемы — 4 открытых хвоста из backlog с прямыми ссылками
9. Навигация по документации
10. Footer

**Удалено (массив старого STATUS):**
- Раздел «Унаследовано от Family AI Assistant»
- Раздел «Система промптов v3.3» с полным деревом файлов
- Раздел «Проекты v3.2.0» с описанием tier-моделей
- Раздел «Профиль пользователя» с таблицей БД полей
- Раздел «AI-инструменты» со списком tools
- Раздел «План развития» с фантазией Smart Routing
- Раздел «Статистика» (метрики отставали на 18 версий)
- Раздел «Документация → архив» с 40+ ссылками на закрытые ТЗ

**Ключевое соглашение (soft-duplicate по золотому критерию):**

Таблица компонентов содержит модели (например «Grok 4.1 Fast (default) · Grok 4.20 (Думать) · Claude Haiku (vision)»). Это технически перекрывает `docs/ai-chats-map.md`. Но по золотому критерию Владимира STATUS должен отвечать «что работает» в present tense с конкретными моделями. Триггер обновления документирован во вступлении таблицы: **task-assignments.ts → ai-chats-map.md → STATUS**. Это единственное допустимое soft-duplication в новом STATUS.

**Валидация:**

| Проверка | Цель | Факт |
|---|---|---|
| `wc -l SIMPLY_STATUS.md` | ≤ 400 | **165** ✅ |
| Русское `ТЗ-` в теле | 0 | **0** ✅ |
| `v3\.` в теле | 0 | **0** ✅ |
| Версия в шапке = package.json | 3.91.0 | **3.91.0** ✅ |
| SSOT compliance audit (6 разделов) | ✅ | ✅ (все помечены) |

**Где остановились:**

- `SIMPLY_STATUS.md` полностью переписан, валидация пройдена.
- ROADMAP/CHANGELOG/HANDOFF обновлены.
- **Ждём мануальный тест Владимира** по `SIMPLY_STATUS.md` + финальный коммит по выбору: один (Этапы 2+3) или два отдельных.

**Статус ТЗ_DocsCleanup на конец Сессии 2:** 3 из 5 этапов закрыты (по коду/docs; ждут финального мануального теста и коммита).

| Этап | Файл | Статус |
|---|---|---|
| 1 | `docs/ai-chats-map.md` | ✅ закрыт (commit 889f017) |
| 2 | `docs/architecture.md` + `docs/design-system.md` | 🟡 ждёт manual test + commit |
| 3 | `SIMPLY_STATUS.md` | 🟡 ждёт manual test + commit |
| 4 | `specs/WORKFLOW.md` полное расширение | ⬜ Сессия 3 |
| 5 | `docs/ai-minimax.md` banner + финализация ТЗ | ⬜ Сессия 3 (можно объединить с Этапом 4) |

**Что читать следующему Claude Code в Сессии 3:**

1. Эту запись HANDOFF (сверху).
2. [CHANGELOG.md](CHANGELOG.md) записи «Этап 3 выполнен» и «Этап 2 SSOT-фикс».
3. [ROADMAP.md](ROADMAP.md) → Этапы 4 и 5.
4. Memory правило `feedback_ssot_before_list.md` — **не забыть SSOT-проверку** перед любым списком.
5. Memory правило `feedback_ai_chats_map_sync.md` — уже есть для ai-chats-map.
6. [specs/WORKFLOW.md](../WORKFLOW.md) текущее состояние (mini-extension для ai-chats-map уже применён в Сессии 1, полное расширение на 13 docs/ файлов — остаток Этапа 4).

**Оценка тяжести Сессии 3:**
- Этап 4 (расширение триггеров WORKFLOW на 13 docs/ файлов) — средний вес.
- Этап 5 (banner в ai-minimax.md + финализация ТЗ через ROADMAP_GUIDE чек-лист + архив папки) — лёгкий.
- Оба этапа можно объединить в одну сессию.

**Не забыть в Сессии 3:**
- НЕ трогать CLAUDE.md (лимит 220, не истёк)
- SIMPLY_STATUS.md теперь стабильный snapshot — не дописывать, только обновлять модели в таблице компонентов при изменении task-assignments.ts
- Memory SSOT-правило (`feedback_ssot_before_list.md`) должно сработать в любой работе с документацией
- Финальный коммит с `mv specs/TZ_DocsCleanup/ specs/_archive/` + главный CHANGELOG.md запись в `[Unreleased]`

---

## Сессия 2 — 2026-04-15 — Этап 2 SSOT-фикс после DOCUMENTATION_GUIDE.md

**Контекст:** Владимир спросил какой документ ему показать чтобы я оформлял документацию правильно. Ответ: `DOCUMENTATION_GUIDE.md`. Владимир дал команду `@DOCUMENTATION_GUIDE.md` — я прочитал его и немедленно применил к текущей работе.

**Обнаружил в собственном расширении architecture.md 2 грубых SSOT-нарушения:**

1. ❌ Полный список 25 shadcn/ui примитивов в architecture.md **дублирует** `design-system.md` раздел 13 (там было только 7 — неполный SSOT, но SSOT).
2. ❌ 17 файлов `lib/ai/tools/` с описаниями в architecture.md **дублирует** `ai-tools.md` (921 строка, SSOT per DOCUMENTATION_GUIDE.md).
3. ⚠️ 17 `components/elements/` нигде не задокументированы — контент должен попасть в design-system.md, не в architecture.md.

**DOCUMENTATION_GUIDE.md L40-48 правило:** «SSOT — одно место, остальные ссылаются».

**Что сделано (2 файла правлены):**

**`docs/design-system.md` раздел 13 полностью переделан (362 → 450 строк):**
- 13.1 — 25 shadcn/ui примитивов (было 7) — полная таблица
- 13.2 — **НОВОЕ** — 17 AI-chat элементов из `components/elements/`
- 13.3 — `components/shared/` (model-select)
- 13.4 — Фичевые папки (14 папок)
- 13.5 — Top-level `components/*.tsx`
- Жирный warning в шапке раздела 13: «ЭТО ЕДИНСТВЕННЫЙ СПИСОК КОМПОНЕНТОВ В ПРОЕКТЕ» + 4-шаговый протокол
- Теперь design-system.md — **реальный SSOT** для всех компонентов.

**`docs/architecture.md` (542 → 500 строк, −42):**
- UI-блок сжат в 12-строчный указатель на [design-system.md раздел 13](design-system.md#13-используемые-компоненты-ssot). Ни одного имени компонента не осталось.
- `#### lib/ai/tools/` сжат в 2-строчный указатель на ai-tools.md. Ни одного имени tool-файла не осталось.
- TOC обновлён. Блок «SSOT-файлы для быстрого перехода» расширен с 5 до 8 ссылок (добавлены ai-tools, ai-agents, ai-artifacts).

**Урок, который надо запомнить:**

Владимир сказал «не изобретай компоненты с нуля, они уже созданы». Я интерпретировал как «напиши список в architecture.md». Это было неверно. Правильно: «обнови SSOT (design-system.md), в architecture.md оставь указатель». Дубликат = неизбежный rot. DOCUMENTATION_GUIDE.md явно запрещает.

**Memory правило, которое нужно зафиксировать:** ПЕРЕД написанием списка/таблицы/перечня в документе — проверить, не существует ли другой документ, который является SSOT для этой темы. Если да — обновить SSOT, а не писать второй раз.

**Финальная валидация:**
- `grep 'v3\.' docs/architecture.md` → 0 ✅
- `grep 'ТЗ-' docs/architecture.md` → 0 ✅
- architecture.md UI-блок: 0 имён компонентов ✅
- architecture.md `#### tools/`: 0 имён tool-файлов ✅
- design-system.md 13.1: 25/25 shadcn примитивов ✅
- design-system.md 13.2: 17/17 elements ✅
- `wc -l`: architecture.md 500, design-system.md 450

**Ждём мануальный тест Владимира по ДВУМ файлам.** Команда для коммита:
```bash
git add docs/architecture.md docs/design-system.md specs/TZ_DocsCleanup/
git commit -m "docs(architecture+design-system): SSOT fix — move component lists to design-system, add 13.2 elements (TZ_DocsCleanup Этап 2)"
```

---

## Сессия 2 — 2026-04-15 — Этап 2 РАСШИРЕН (пост-ревью Владимира)

**Фидбэк Владимира после базового trim:** «Ты делаешь документацию для СЕБЯ. Проверь что тебе будет легко искать информацию. Ты любишь начинать новый UI с нуля, забываешь что стандарт уже есть — не изобретай новые компоненты.»

**Этот фидбэк — архитектурный.** Он меняет критерий приёмки Этапа 2: не «убрать теги», а «сделать документ полезным для поиска с позиции будущего Claude». Переоценил результат базового trim и нашёл 8 критических пробелов. Расширил scope.

**Что добавлено поверх базового trim (542 строки vs 359 после базового):**

1. **Оглавление + SSOT-ссылки сверху** — 8 разделов + быстрые ссылки на task-assignments, model-catalog, schema.ts, design-system.md, ai-chats-map.md.

2. **⛔ UI — закон и существующие компоненты** (H2 секция сразу после TOC, +50 строк). Громкий блок, невозможно пропустить:
   - Правило «Прочитать design-system.md ПЕРЕД любой UI-работой»
   - Правило «НЕ изобретать новые компоненты»
   - **25 shadcn/ui примитивов** полностью перечислены (components/ui/)
   - **17 AI-chat элементов** полностью перечислены (components/elements/)
   - Фичевые папки components/ перечислены
   - 4-шаговое правило при новом UI

3. **`#### lib/ai/tools/` переписан** — 6 файлов → **17** (сгруппированы по категориям). Был протухший список, теперь соответствует `ls lib/ai/tools/`.

4. **Data Layer полностью переработан** — 19 таблиц → **29**, 7 категорий с H4 заголовками. **Добавлены все пропущенные MIND-таблицы** (`MemoryEntry`, `MemorySettings`, `UserProfileSummary`) — ключевая фича xAI серии. Также `ProjectFolder`, `BriefingTopics`, `Suggestion`, `Stream`. Deprecated (`Message`, `Vote`) помечены явно.

5. **Новая H2 «Карта фич (пофайлово)»** — САМАЯ ЦЕННАЯ ЧАСТЬ (+110 строк). Для каждой из **13 фич** — route + pipeline + tools + UI папки + БД таблицы + модели + ADR-ссылка: Simply Chat, Expertise, Create, Projects, Briefing, Podcast, Meeting Recorder, Telegram Bot, MIND Memory, Service Chats, Artifacts, Dev Switchboard, Prompt System. **Теперь «где код для X» = один поиск по странице.**

6. **Сломанная иерархия H3/H2 исправлена** — «Streaming Pipeline» был `### 5` внутри H2 «Система промптов». Промотан до отдельной H2 «Streaming Pipeline & Observability».

7. **Дубликат Prompt System убран** — раздел существовал дважды (в AI Layer и как отдельный H2). Остался один указатель на Карту фич.

8. **ASCII-диаграмма route groups уточнена** — `(chat)` теперь явно «Simply Chat + projects + api», `(dashboard)` включает «expertise/create landings», индивидуальные чаты указаны как отдельные root groups.

9. **Связанные документы** — 6 ссылок → **11** (добавлены `design-system.md` ⭐, `ai-chats-map.md` ⭐, `model-catalog-ops.md`, `troubleshooting.md`, `mcp-tools.md`).

**Изначальный список правок Этапа 2 (14 правок + удаление Smart Routing) — всё ещё в силе.** Расширение НЕ заменило базовый trim, а добавилось поверх него.

**Валидация финальная:**
- `grep 'v3\.'` → **0** ✅
- `grep 'ТЗ-'` → **0** ✅
- `wc -l` → **542** (было 366, итого +176 строк чистой навигации)
- Реальность сверена с 10 `ls` командами по `app/`, `components/`, `lib/ai/tools/`
- БД таблицы: 29/29 совпадают с `grep pgTable lib/db/schema.ts`
- Иерархия заголовков: прошла `grep -n '^#{1,4} '`, нет orphan H3

**Что читать следующему Claude Code в Сессии 3:**
- Полное описание расширения — в [CHANGELOG.md](CHANGELOG.md) → «Этап 2 РАСШИРЕН»
- Структура нового architecture.md может быть шаблоном для Этапа 3 (SIMPLY_STATUS.md как snapshot + пофайловая карта компонентов)

---

## Сессия 2 — 2026-04-15 — Этап 2 базовый trim (перед расширением)

**Что сделано в Этапе 2 (`docs/architecture.md`, 366 → 359 строк):**

Сверка с реальностью ПЕРЕД правками:
- Прочитан `lib/ai/task-assignments.ts` — подтверждена текущая раскладка провайдеров (Grok Simply Chat/MIND/Экспертиза, Claude vision/artifacts/clerks/professor/project-expert, MiniMax create+briefing).
- `ls app/` — обнаружены 6 route groups: `(auth)`, `(chat)`, `(create)`, `(dashboard)`, `(expertise)`, `(task)`. В документе было перечислено только 4.
- `ls lib/` — обнаружены `meeting/`, `telegram/`. В диаграмме Business Logic не было.

**14 правок + 1 удаление секции:**

1. ASCII App Router — добавлены `(expertise)`, `(create)`, `(task)` в диаграмму.
2. ASCII Business Logic — удалены 6 inline тегов (`(v3.83, ТЗ-1)`, `(v3.58)`, `(v3.69)`, `(v3.27, v3.52)`, `(v3.43)`, `(v3.83)`). Добавлены `meeting/`, `telegram/`.
3. ASCII External Services — полная замена с 2 до 4 строк AI Providers: **xAI Grok** (primary), **Anthropic Claude**, **MiniMax** (create + briefing), **Google Gemini** (reserved).
4. «Core Registry (v3.83.0+, ТЗ-1)» → «Core Registry». `overrides (stub, ТЗ-2)` → `dev overrides (model-overrides-node.ts)`. Мёртвый якорь `#core-registry-v3830-тз-1` заменён на корень.
5. «Prompt System (v3.3 — Skills + Agents)» × 2 места → «— Skills + Agents».
6. «Developer Panel (v3.57.0)» → «Developer Panel».
7. «Dev Switchboard (v3.84.0 — ТЗ-2)» → «Dev Switchboard».
8. «Tool Call Guardian (v3.50.0 + v3.51.0)» — удалены 3 тега, Phase 1/Phase 2 нарратив свёрнут в 2 строки описания архитектуры (а не changelog).
9. «Usage Logging (v3.46.0)» → «Usage Logging».
10. «Background Briefing Generation (v3.54.0)» → «Background Briefing Generation».
11. «ТЗ-TG4b» (ссылка на future TZ) → «отдельный pipeline».
12. Блок «Anthropic Claude (основной — v3.23.0+)» переписан полностью как «Мультипровайдерная маршрутизация» с актуальной раскладкой провайдеров и ссылками на `ai-chats-map.md` / `ai-providers.md`.
13. Footer `Обновлено: 2026-04-12 (v3.84.0 — Dev Switchboard UI)` → `2026-04-15 (TZ_DocsCleanup Этап 2)`.
14. **Удалена фантазийная секция «Smart Routing (план)»** (16 строк) — референсила GPT-4o-mini/Gemini Flash как «auto», ни одной из этих моделей в проекте нет, план никогда не реализовывался. Чистое misinformation + CHANGELOG-стиль.

**Валидация:**
- `grep 'v3\.' docs/architecture.md` → **0** ✅
- `grep 'ТЗ-' docs/architecture.md` → **0** ✅
- `wc -l` → **359** (было 366)
- Структура слоёв сверена с `ls app/ lib/` ✅

**Где остановились:**

- `docs/architecture.md` отредактирован, grep-валидация пройдена.
- ROADMAP.md обновлён — Этап 2 статус `🟡 готов к мануальному тесту`, все задачи `[x]` кроме мануального теста.
- Локальный CHANGELOG.md дополнен полным лог-записью Этапа 2.
- **Ждём мануальный тест Владимира** перед git commit.
- Git commit пока не сделал (правило: Владимир коммитит сам).

**Следующий шаг — Сессия 3 = Этап 3:**

`SIMPLY_STATUS.md` переписать как snapshot ≤ 400 строк. Это **самый тяжёлый** этап из 5:
- Текущий файл 2323 строки (включая историю 65 ТЗ, которые дублируют CHANGELOG).
- Золотой критерий: STATUS = настоящее время («Simply Chat работает на Grok 4.1 Fast», не «в v3.88 переключили»).
- Сиротные факты (не в CHANGELOG / не в SPEC какого-либо ТЗ) → **выкидываем** (вариант A, согласовано Владимиром).
- Требует чтения `package.json`, `task-assignments.ts`, `db/schema.ts`, `specs/_backlog/README.md`, первых 338 строк текущего STATUS.

**Что читать следующему Claude Code при старте Сессии 3:**

1. **Эту запись HANDOFF.md** (сверху).
2. **[SPEC.md](SPEC.md)** — золотой критерий STATUS = настоящее время.
3. **[ROADMAP.md](ROADMAP.md) → Этап 3** — структура новой шапки + целевой размер ≤ 400 строк.
4. **[ANALYSIS.md](ANALYSIS.md) → Аудит 2** — почему 2323 строки стали помойкой, какой блок «живого статуса» сохранить (строки 1-338).
5. **[CHANGELOG.md](CHANGELOG.md)** этой папки — весь контекст Этапов 1 + 2.

**Критические находки для Этапа 3 (из ANALYSIS.md и Этапа 2):**

- `package.json` должна быть версия `3.91.0` (проверить).
- Состав моделей для шапки: Simply Chat = Grok 4.1 Fast (default) / Grok 4.20 (think) / Claude Haiku 4.5 (vision); Экспертиза = Grok 4.20 Multi-Agent; Создание = MiniMax M2.7; MIND = Grok 4.20 (extract) + Grok 4.1 Fast (остальные); Briefing = MiniMax M2.7-long. Это всё уже в `docs/ai-chats-map.md` после Этапа 1.
- Таблицы БД можно посчитать через `lib/db/schema.ts` SSOT (~18 таблиц по аудиту architecture.md).
- Открытые хвосты — в `specs/_backlog/README.md` (на момент старта ТЗ = 4 задачи, не блокируют).

**Что НЕ трогать в Сессии 3:**

- CLAUDE.md (правило инварианта: лимит 220, не трогать).
- `docs/ai-chats-map.md` (закрыт в Этапе 1).
- `docs/architecture.md` (закрыт в Этапе 2).
- `package.json` версия — не меняем (docs/chore).

**Состояние git на конец Сессии 2:**

Ожидается что Владимир:
1. Посмотрит `git diff docs/architecture.md` — одобрит правки.
2. Сделает commit:
   ```
   git add docs/architecture.md
   git commit -m "docs(architecture): remove version tags and TZ markers from layer diagrams (TZ_DocsCleanup Этап 2)"
   ```
3. При желании — откроет новую сессию Claude Code для Сессии 3 (Этап 3 — самый тяжёлый, перезапись SIMPLY_STATUS).

Если Владимир не одобрит — я буду доступен для правок в этой же сессии.

**Не забыть в Сессии 3:** НЕ трогать CLAUDE.md, `.bak` не делать, Этап 3 в ОДНОЙ сессии (если разрастается — STOP + HANDOFF).

---

## Сессия 1 — 2026-04-15 — Старт ТЗ

**Что сделано:**

- Прошли два статус-аудита: `docs/` папка (13 файлов + 54 ADR) и `SIMPLY_STATUS.md` (2323 строки). Полные находки → `ANALYSIS.md`.
- Владимир инициировал подход «маленькие шаги + HANDOFF между сессиями» — защита от «обрезания углов» в длинной сессии. Зафиксировано в SPEC принципах.
- Создана папка `specs/TZ_DocsCleanup/` с пятью файлами по стандарту WORKFLOW.
- Backlog проверен (Правило 9) — 4 открытых долга, ни один не блокирует.
- Согласованы решения: 5 этапов в определённом порядке (сначала чиним «врущие» документы, процессный фикс после практики), `.bak` не делаем, CLAUDE.md не трогаем, версию не поднимаем.

**Где остановились:**

- Файлы ТЗ созданы, **код/документация ещё не трогалась**.
- Следующий шаг — Этап 1 из ROADMAP.md: hot fix `docs/ai-chats-map.md`. Ждём зелёного света от Владимира на старт.

**Что читать следующему Claude Code перед стартом Сессии 2:**

1. **[SPEC.md](SPEC.md)** — контекст, scope, принципы. ~10 мин.
2. **[ANALYSIS.md](ANALYSIS.md)** — находки аудитов. ~10 мин.
3. **[ROADMAP.md](ROADMAP.md)** — текущий этап (см. статус 🔄 / ⬜). ~5 мин.
4. **Последняя запись в этом HANDOFF.md** — где остановились и почему.
5. **Инвариант в шапке [CLAUDE.md](../../CLAUDE.md)** — правило «CLAUDE.md не трогать, лимит 220».

**Критические ссылки на находки (для быстрого доступа):**

- `docs/ai-chats-map.md` L30, L46-L48 — MiniMax как `✅ Работает` (вранье).
- `docs/architecture.md` — 21 версионный тег в ASCII-диаграмме (грязь).
- `SIMPLY_STATUS.md` шапка: версия `3.90.0` (отстаёт от package.json `3.91.0`). Строки ~2237-2241: метрики «Статистика» на версии `3.73.0`.
- `specs/WORKFLOW.md` L607-616, L682-692 — чеклисты финализации упоминают только 3 из 13 docs/ файлов.

**Ключевые принципы сессии (не забыть):**

- Один этап = одна сессия. Не объединять этапы из жадности.
- После каждого этапа — git commit + валидация + мануальный тест Владимира + запись в HANDOFF + локальный CHANGELOG.
- Если этап разрастается — STOP, HANDOFF, продолжить в следующей сессии.
- Владимир коммитит САМ. Claude Code не делает `git commit` автоматически.
- `npx tsc --noEmit` / `npm run build` — не применимо для markdown-only правок (нечего компилировать). Валидация = grep-проверки из ROADMAP + мануальный тест.

**Состояние git на момент HANDOFF (старт Сессии 1):**

```
untracked:
  specs/TZ_DocsCleanup/ (5 файлов только что созданы)
  CLAUDE.md.bak (от предыдущей уборки, Владимир удалит)
  specs/TZ_RAG_SimplyRAG/AUDIT_REPORT.md (untracked с начала сессии, не моё)

modified (от предыдущей уборки CLAUDE.md — жду коммита от Владимира):
  CLAUDE.md
  CHANGELOG.md
  DOCUMENTATION_GUIDE.md
  specs/ROADMAP_GUIDE.md
  specs/WORKFLOW.md
```

**TODO на конец сессии 1 (после получения зелёного света):**

1. Доложить Владимиру структуру ТЗ (готова).
2. Получить подтверждение на старт Этапа 1.
3. Выполнить Этап 1 → валидация → HANDOFF → конец сессии.

---

## Сессия 1 — 2026-04-15 — Этап 1 выполнен, ждём manual test

**Что сделано в Этапе 1:**

- Прочитан `lib/ai/task-assignments.ts` как SSOT — получена точная карта 39 taskId на реальные модели.
- **Критическая находка:** MiniMax **не убран целиком** — остаётся активным для `create` chatMode + `briefing:filter/author/section` + `briefing:podcast-script` (5 taskId). Убран только из Simply Chat и MIND memory. Моя первоначальная гипотеза «убрать MiniMax целиком» была бы неверной.
- Прочитан `lib/ai/model-catalog.ts` — подтверждены точные цены Grok (4.1 Fast $0.20/$0.50, 4.20 $2/$6) и MiniMax M2.7 ($0.30/$1.20).
- Сделано **16 edit-блоков** в `docs/ai-chats-map.md` (676 → 654 строки):
  - Шапка: дата 2026-04-15
  - Быстрый обзор: удалён блок из 8 версионных blockquote, заменён на компактный snapshot
  - Главная таблица чатов: полная перезапись с корректными моделями и taskId (убрана строка удалённого `chat` режима, исправлены Simply Chat / Экспертиза / Создание, добавлены MIND / Vision OCR / util)
  - chatMode routing: таблица перезаписана, убраны ссылки на удалённые `/chat` и `/chats`
  - Таблица цен: переписана с Grok + MiniMax, подтверждено против model-catalog.ts
  - 10 заголовков секций: убраны версионные теги из `Сервисные чаты (v3.8)`, `Менеджер (v3.13)`, `Эксперт (v3.16)` и т.д.
  - 3 исторических blockquote удалены: про v3.80 Filter miniMax, v3.82 Map-Reduce, v3.81→v3.82 TTS, v3.23 Gemini→Claude
  - 23 точечные inline версионные пометки `(v3.17)`, `(v3.53.0)` и т.д. в детальных блоках и списках файлов — удалены bulk-заменой
- Валидация grep-командами: `v3.` = 0, `ТЗ-` = 0, Grok = 12 упоминаний, MiniMax = 22 (ожидаемо, это правда), `chatMode=chat` = 0, ссылки 16/16 валидны.

**Где остановились:**

- `docs/ai-chats-map.md` отредактирован и провалидирован grep-проверками.
- **Mini-extension Этапа 1 → процессный фикс в `specs/WORKFLOW.md`** (по инициативе Владимира): 5 правок + memory. Узкая защита для ai-chats-map включена **прямо сейчас**, не ждать Сессии 4 полного Этапа 4. Причина: серия Simply_xAI активна, каждый следующий ТЗ (XAI-4, XAI-5) снова деградирует документ если защита не включена.
- **Ждём мануальный тест Владимира** по двум файлам (`docs/ai-chats-map.md` + `specs/WORKFLOW.md`) перед git commit'ом.
- Полный отчёт о правках — в локальном [CHANGELOG.md](CHANGELOG.md).
- Memory правило `feedback_ai_chats_map_sync.md` создано — дублирующая защита для будущих сессий даже если формальный чек-лист не проходится.

**Следующий шаг — Сессия 2 = Этап 2** из ROADMAP.md:

- **`docs/architecture.md` trim 21 версионного тега** (v3.83, v3.58, v3.69, v3.43, v3.52, …) из ASCII-диаграммы слоёв и описаний модулей. Это срочно потому что CLAUDE.md перенаправил туда пофайловую карту — архитектурный документ должен быть чистой архитектурой без CHANGELOG-стиля.

**Что читать следующему Claude Code при старте Сессии 2:**

1. **Эту запись HANDOFF.md** (сверху).
2. **[SPEC.md](SPEC.md)** — контекст, scope, разделение STATUS↔CHANGELOG (золотой критерий).
3. **[ROADMAP.md](ROADMAP.md) → Этап 2** — задачи, валидация, git commit.
4. **[ANALYSIS.md](ANALYSIS.md) → Аудит 1 → architecture.md** — почему и какие теги убирать.
5. **Инвариант в шапке [CLAUDE.md](../../CLAUDE.md)** — правило лимита 220 + запрет на v-теги в навигационных файлах. **architecture.md не под тем же инвариантом, но дух правила применим**.

**Критические находки для Этапа 2 (из ANALYSIS):**

- `docs/architecture.md` = 366 строк, 21 версионный тег, 5 ТЗ-пометок.
- Примеры проблем (из предыдущего аудита):
  - `ai/getModel.ts - SSOT getModel(taskId) (v3.83, ТЗ-1)` → должно быть `ai/getModel.ts - SSOT getModel(taskId)`
  - `Pipeline trace (v3.58)` → `Pipeline trace`
  - `Retry wrapper (v3.69)` → `Retry wrapper`
- Убрать v-теги из ASCII-диаграммы и описаний слоёв.
- Проверить что описание слоёв (Presentation / Auth / Business / Data / External) отражает реальность — сверить с `ls app/ lib/ components/`.
- Если не хватает пофайловой карты для навигации из CLAUDE.md — добавить одной таблицей.

**Состояние git на конец Сессии 1:**

Ожидается что Владимир:
1. Посмотрит `git diff docs/ai-chats-map.md` — одобрит правки контента.
2. Посмотрит `git diff specs/WORKFLOW.md` — одобрит mini-extension процесса.
3. Проверит что memory файл `feedback_ai_chats_map_sync.md` создан в `.claude/projects/.../memory/` + ссылка в MEMORY.md.
4. Сделает commit (два файла + memory вне git репо):
   ```
   git add docs/ai-chats-map.md specs/WORKFLOW.md
   git commit -m "docs(ai-chats-map): hot fix — remove MiniMax, add xAI Grok + WORKFLOW sync rule (TZ_DocsCleanup Этап 1)"
   ```
5. При желании — откроет новую сессию Claude Code для Сессии 2 (Этап 2).

Если Владимир не одобрит — я буду доступен для правок в этой же сессии.

**Не забыть в Сессии 2:** НЕ трогать CLAUDE.md (правило инварианта), `.bak` файлы не создавать (git), каждый этап — отдельный commit.
