# Локальный CHANGELOG — TZ_DocsCleanup

> Append-only лог изменений по ТЗ. Формальный перенос в главный `CHANGELOG.md` — на финализации (Этап 5).

---

## 2026-04-15 — Старт ТЗ (Сессия 1)

- Создана папка `specs/TZ_DocsCleanup/`
- Создан SPEC.md — контекст, цели, scope (5 этапов), принципы, критерии
- Создан ANALYSIS.md — находки двух статус-аудитов (docs/ и SIMPLY_STATUS.md), проверка backlog (4 долга, не блокируют), согласованные решения
- Создан ROADMAP.md — 5 этапов с задачами, валидацией, git-commit шаблонами, gate-keeping
- Создан HANDOFF.md — начальная запись «Сессия 1 — старт»
- Создан этот CHANGELOG.md (пустой append-only лог)

**Статус на конец создания ТЗ:** все 5 файлов созданы, ждём зелёного света от Владимира на Этап 1.

---

## 2026-04-15 — Этап 1 выполнен (Сессия 1)

**Файл:** `docs/ai-chats-map.md` (676 → 654 строки)

**Key facts:** проверил `lib/ai/task-assignments.ts` как источник правды. Подтверждено: MiniMax **частично** активен — в `create` chatMode + весь briefing pipeline (`briefing:filter/author/section`) + `briefing:podcast-script`. Убран **только** из Simply Chat и MIND memory. Это было важное уточнение — моя первоначальная гипотеза «убрать MiniMax целиком» была бы неверной.

**Что правлено (16 edit блоков):**

1. Шапка: `Обновлено: 2026-04-11 → 2026-04-15`
2. Секция «Быстрый обзор» (L9-26) — удалён блок из 8 версионных blockquote (v3.83.0, v3.43.0, v3.30.0, v3.80.0, v3.38.0, v3.26.0, v3.24.0, v3.23.0), заменён на компактный snapshot «активные AI-провайдеры». Сохранён warning про SSOT = task-assignments.ts.
3. Главная таблица чатов (L28-53) — полная перезапись на 30 строк:
   - Удалена строка `Чат (chatMode=chat)` — режим удалён в ТЗ-LegacyChatCleanup
   - Simply Chat → три строки: default text (Grok 4.1 Fast), think (Grok 4.20), vision (Haiku 4.5)
   - Экспертиза → Grok 4.20 Multi-Agent (было ошибочно Claude Sonnet)
   - Создание → MiniMax M2.7 (было ошибочно Claude Sonnet)
   - Добавлены: MIND Memory (extract + batch), Vision OCR, util (title/project-summary/artifact-suggestions)
   - Каждая строка указывает точный taskId для сверки с task-assignments.ts
4. chatMode routing (L423-451) — таблица перезаписана корректно, удалены ссылки на `/chat` и `/chats`, указаны реальные страницы `/simply`, `/expertise/[id]`, `/create/[id]`. Список файлов обновлён (getModel + task-assignments вместо старого myProvider/chat-mode-config).
5. Таблица цен (L602-612) — переписана полностью. Добавлены Grok 4.1 Fast ($0.20/$0.50), Grok 4.20 ($2/$6), Grok 4.20 Multi-Agent. Убраны устаревшие упоминания Gemini 2.0 Flash для Briefing filter (сейчас MiniMax). Добавлены Deepgram, Perplexity. Цены подтверждены против `lib/ai/model-catalog.ts`.
6. Core Registry секция — убрана пометка «v3.83.0+».
7. Заголовки секций (10 штук) — убраны версионные пометки:
   - `Сервисные чаты (ServiceChat v3.8)` → `Сервисные чаты (ServiceChat)`
   - `Менеджер проекта (v3.13 — живой AI-диалог)` → `Менеджер проекта — живой AI-диалог`
   - `Профессор планирования (v3.14)` → `Профессор планирования`
   - `Эксперт по задаче (ExpertTaskChat v3.16)` → `Эксперт по задаче (ExpertTaskChat)`
   - `Клерк-анализатор файлов (v3.13)` → `Клерк-анализатор файлов`
   - `Суммаризатор задач (Клерк v3.17)` → `Суммаризатор задач (Клерк)`
   - `Ревьюер задач (Профессор v3.17)` → `Ревьюер задач (Профессор)`
   - `Briefing Onboarding (ТЗ-A2, v3.30)` → `Briefing Onboarding`
   - `Briefing: AI-пайплайн (v3.26)` → `Briefing: AI-пайплайн`
   - `Podcast Engine (ТЗ-Б1, v3.43; финальная архитектура v3.82)` → `Podcast Engine`
8. 3 исторических blockquote удалены:
   - «v3.80.0 (ТЗ-Briefing-1): Filter и Author переведены на MiniMax... Цена: $0.074 → $0.011 (6.6×)»
   - «v3.82.0 (ТЗ-MapReduce): Map-Reduce отклонён... socket reuse bug»
   - «v3.81.0 → v3.82.0: TTS попытка MiniMax Speech 2.8 HD → откат»
   - «v3.23.0: Переключены с Gemini на Claude»
9. Точечные версионные пометки в детальных блоках (23 штуки в inline комментариях и списках файлов) — все убраны (v3.17, v3.53.0, v3.30, v3.14+, v3.16, v3.13+, v3.11+, v3.8, v3.73.0, v3.87.3, ТЗ-B2, ТЗ-2).

**Валидация (grep-результаты):**

| Проверка | Цель | Факт |
|---|---|---|
| `v3.` | 0 | **0** ✅ |
| `ТЗ-` | 0 | **0** ✅ |
| `Grok` упоминания | ≥ 6 | **12** ✅ |
| `MiniMax` упоминания | > 0 (create + briefing + podcast) | **22** ✅ (ожидаемо) |
| `chatMode=chat` | 0 | **0** ✅ |
| Ссылки | все валидны | **16/16** ✅ |
| Размер файла | — | 676 → 654 (−22) |

**Что НЕ трогал (вне scope этапа 1):**
- Детальные секции сервисных чатов (Секретарь, Менеджер, Профессор, Эксперт и т.д.) — корректны по моделям (совпадают с task-assignments.ts). Только заголовки и inline теги почистил.
- Раздел «Архитектура промптов» (дерево файлов) — оставил как есть, там несколько пометок типа `(v3.14+)` уже убрано bulk заменой.

**Ждём мануальный тест Владимира** перед переходом к Этапу 2 (`docs/architecture.md` trim 21 версионного тега в ASCII-диаграмме).

---

## 2026-04-15 — Mini-extension Этапа 1 → процессная защита в WORKFLOW (Сессия 1, продолжение)

**Инициатива Владимира.** После валидации Этапа 1 Владимир правильно заметил: «Надо где-то отразить что при смене этот документ всегда обновлялся, сейчас мы каждый день вот эти позиции всегда меняем». Согласовано — узкое расширение Этапа 4 применяется **сразу**, не ждёт Сессии 4, потому что серия Simply_xAI активна и каждый следующий ТЗ снова деградирует документ, если защита не включена.

**Ключевое наблюдение до правок:** правило частично **уже было** в WORKFLOW (L613 «Обновить ai-chats-map если затронуты AI-модели») — и всё равно не работало в серии ТЗ-XAI-1/2/3. Почему:

1. **«Если затронуты»** — размытая формулировка, интерпретируется автором ТЗ.
2. **Таблица Правила 6 ссылалась на мёртвые файлы** — `myProvider`, `chat-mode-config.ts`, `model-tiers.ts`, `api/service-chat/route.ts`. `myProvider` удалён в v3.83 (Core Registry), остальные — тонкие обёртки без моделей. Добросовестный чек-лист находил «нет расхождений» потому что сверял с пустотой.
3. **Нет теста на правду** — никакого grep-а типа «каждая модель в документе должна существовать в коде».

**5 правок в `specs/WORKFLOW.md`:**

1. **L122 (Правило 6 таблица)** — две устаревшие строки про ai-chats-map объединены в одну корректную:
   ```
   | docs/ai-chats-map.md → Главная таблица + таблица моделей | Каждая модель и taskId | SSOT: lib/ai/task-assignments.ts + lib/ai/model-catalog.ts. Никакого myProvider больше нет. |
   ```

2. **L128-132 («Быстрая проверка» grep-команды)** — обновлены на актуальные:
   - Было: `grep "anthropic\|google\|model" lib/ai/providers.ts` + `grep "modelId\|model:" app/(chat)/api/service-chat/route.ts`
   - Стало: `grep '"[a-z][a-z0-9-]*":\s*"' lib/ai/task-assignments.ts` + `grep '^\s*id:' lib/ai/model-catalog.ts`

3. **L612 (чек-лист финализации, секция 3)** — мягкое правило заменено жёстким с триггером:
   - Было: `- Обновить docs/ai-chats-map.md (если затронуты AI-модели, чаты, провайдеры)`
   - Стало: `- ⛔ docs/ai-chats-map.md — ОБЯЗАТЕЛЬНО если в diff ТЗ есть изменения lib/ai/task-assignments.ts или lib/ai/model-catalog.ts. Это не «если затронуты» (размытая формулировка, уже приводила к регрессиям) — если любая из этих двух файлов в git diff — ОБНОВИТЬ. [...]`

4. **L633-636 (раздел 4 «Верификация docs против кода»)** — блок «Для ЛЮБОГО ТЗ: открыть ai-chats-map → код-блок myProvider» заменён на 4-шаговую процедуру с grep-тестом на правду:
   ```bash
   grep -oE '\b(claude|grok|MiniMax|gemini)[a-zA-Z0-9.\-]*' docs/ai-chats-map.md
   ```
   Все модели из вывода должны существовать в model-catalog.ts.

5. **L690 (чек-лист завершения ТЗ)** — «ai-chats-map.md → код-блок myProvider совпадает с providers.ts» (мёртвое правило, myProvider удалён) заменено на: «если в diff ТЗ есть task-assignments.ts или model-catalog.ts → ОБЯЗАТЕЛЬНО сверить главную таблицу и таблицу моделей построчно».

**6-я правка — memory:**

Создан файл `/Users/mactm/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/feedback_ai_chats_map_sync.md` с типом `feedback` — правило-привычка «при правке `task-assignments.ts` или `model-catalog.ts` обновлять `ai-chats-map.md` в той же сессии». Добавлена ссылка в `MEMORY.md` индекс (строка 85).

Это **дублирующая защита**: если следующий Claude Code работает в hot fix режиме без формальной финализации (чек-лист не проходится) — memory-правило всё равно сработает, потому что memory грузится в каждый контекст.

**Валидация:**
- `grep -c 'task-assignments' specs/WORKFLOW.md` → **6** (было 0)
- `grep -c 'model-catalog' specs/WORKFLOW.md` → **7** (было 0)
- `grep 'myProvider' specs/WORKFLOW.md` → только в запретительных контекстах (2 строки) «Никакого myProvider — удалён»
- memory файл создан: 4.7KB
- MEMORY.md индекс содержит ссылку: ✓

**Scope-оговорка:** это **только mini-extension** узко для `ai-chats-map.md`. Полный Этап 4 — расширение триггеров на все 13 файлов `docs/` (setup.md, deployment.md, ai-tools.md, ai-agents.md, ai-artifacts.md, ai-providers.md, design-system.md, mcp-tools.md, model-catalog-ops.md, troubleshooting.md) — **остаётся на своей очереди (Сессия 4)**. Не пытался угадать эмпирически недоказанные триггеры для остальных файлов. Для `ai-chats-map.md` триггер эмпирически доказан (файл task-assignments.ts), поэтому и расширение обоснованное.

**Причина расширения именно сейчас (не ждать Сессии 4):** активная серия xAI продолжается (XAI-4 = pipeline batch migration, XAI-5 = multi-agent). Каждый следующий ТЗ будет трогать task-assignments.ts. Если mini-extension не применить сейчас — после 2-3 ТЗ `ai-chats-map.md` снова начнёт врать, и вся моя работа в Этапе 1 аннулируется.

**Ждём мануальный тест Владимира** по двум файлам: `docs/ai-chats-map.md` (Этап 1 content) + `specs/WORKFLOW.md` (Этап 1 mini-extension процесс). Потом commit и переход к Сессии 2 (Этап 2 — architecture.md trim).

---

## 2026-04-15 — Этап 2 выполнен (Сессия 2)

**Файл:** `docs/architecture.md` (366 → 359 строк, −7)

**Контекст:** сессия 1 закрыта коммитом `889f017`, Владимир явно запросил продолжение по ROADMAP. Контекст Этапа 2 — удалить 21 версионный тег + 5 ТЗ-пометок из архитектурного документа (CLAUDE.md перенаправляет туда пофайловую карту, документ должен быть чистой архитектурой без CHANGELOG-стиля).

**Сверка с реальностью перед правками:**
- Прочитан `lib/ai/task-assignments.ts` как SSOT — подтверждён текущий состав моделей: Grok (Simply Chat, MIND, Экспертиза), Claude (vision, артефакты, клерки, professor, project expert), MiniMax (create + briefing filter/author/section + podcast-script).
- Проверены реальные route groups: `ls app/` → `(auth)`, `(chat)`, `(create)`, `(dashboard)`, `(expertise)`, `(task)` — ASCII-диаграмма в документе перечисляла только 4, упускала `(create)`, `(expertise)`, `(task)`.
- Проверен `lib/` → есть `meeting/`, `telegram/` — в диаграмме Business Logic их не было.

**Что правлено (14 edit-блоков):**

1. **ASCII-диаграмма App Router (L18-23)** — добавлены `(expertise)/`, `(create)/`, `(task)/` route groups. Описания обновлены (`(chat) - Simply Chat (persistent)`, `(dashboard) - Projects, Briefing, Meeting`).
2. **ASCII-диаграмма Business Logic (L26-41)** — удалены 6 inline версионных пометок (`(v3.83, ТЗ-1)`, `(v3.83)`, `(v3.58)`, `(v3.69)`, `(v3.27, v3.52)`, `(v3.43)`, `(v3.83)`). Добавлены недостающие папки: `meeting/`, `telegram/`.
3. **ASCII-диаграмма External Services (L46-53)** — полная замена: было 2 строки AI Providers (Anthropic + Google Gemini) → стало 4 корректных (xAI Grok primary, Anthropic, MiniMax, Google Gemini reserved).
4. **L99 «Core Registry (v3.83.0+, ТЗ-1)»** → «Core Registry» (без тегов).
5. **L103 — описание `getModel.ts`** — `overrides (stub, ТЗ-2)` заменено на актуальное `dev overrides (model-overrides-node.ts)`.
6. **L109 ссылка на ai-providers.md** — якорь `#core-registry-v3830-тз-1` заменён на корень документа (не мой якорь, но он был сгенерирован из устаревшего h2, надо чистить).
7. **L116 + L171 «(v3.3 — Skills + Agents)»** → «— Skills + Agents» (убрана версия).
8. **L230 Developer Panel (v3.57.0)** → «Developer Panel».
9. **L238 Dev Switchboard (v3.84.0 — ТЗ-2)** → «Dev Switchboard».
10. **L247-252 Tool Call Guardian (v3.50.0 + v3.51.0)** — удалены 3 версионных тега + Phase 1/Phase 2 нарратив свёрнут в 2 описательные строки (архитектурный документ, не changelog).
11. **L254 Usage Logging (v3.46.0)** → «Usage Logging».
12. **L259 Background Briefing Generation (v3.54.0)** → «Background Briefing Generation».
13. **L292 ТЗ-TG4b** → «отдельный pipeline» (не ссылка на несуществующую задачу).
14. **L342 блок «Anthropic Claude (основной — v3.23.0+)»** — переписан как «Мультипровайдерная маршрутизация» с актуальной раскладкой провайдеров (xAI primary, Anthropic по задачам, MiniMax активен, Google Gemini reserved) + ссылки на ai-chats-map.md и ai-providers.md.
15. **L366 footer** — `Обновлено: 2026-04-12 (v3.84.0 — Dev Switchboard UI)` → `2026-04-15 (TZ_DocsCleanup Этап 2 — trim версионных тегов)`.

**Удалена секция «Smart Routing (план)» (L302-317, 16 строк):**
Фантазийный план никогда не реализовывался. Референсил `GPT-4o-mini`, `Gemini Flash / GPT-4o` как auto — ни одной из этих моделей в task-assignments.ts нет. Чистое misinformation + CHANGELOG-стиль «план». Удалено согласно принципу STATUS = настоящее время (по духу, хотя формально этот принцип в SPEC относится к SIMPLY_STATUS.md — но архитектурный документ не должен содержать фантазий).

**Валидация (grep):**

| Проверка | Цель | Факт |
|---|---|---|
| `v3\.` | 0 | **0** ✅ |
| `ТЗ-` | 0 | **0** ✅ |
| Структура слоёв сверена с `ls app/ lib/` | — | ✅ (добавлены 3 route groups + 2 папки lib) |
| `wc -l` | — | 366 → 359 (−7) |

**Что НЕ трогал (вне scope Этапа 2):**
- Система промптов ASCII-диаграмма (L178-202) — структура папок соответствует реальности (проверено быстрым `ls lib/prompts/`).
- Streaming Pipeline ASCII-блок (L215-228) — отражает реальность по имени событий (step-start, text-delta, tool-input-start, step-finish).
- Security / Authorization разделы — не устарели, версии не упоминаются.

**Ждём мануальный тест Владимира** перед коммитом Этапа 2. После коммита → HANDOFF.md → конец Сессии 2. Сессия 3 = Этап 3 (SIMPLY_STATUS.md переписать как snapshot, ~300 строк).

---

## 2026-04-15 — Этап 2 РАСШИРЕН (Сессия 2 — пост-ревью Владимира)

**Ключевой фидбэк Владимира:** «Ты делаешь документацию для СЕБЯ. Проверь что тебе будет легко искать информацию. Ты любишь когда добавляешь новые страницы делать всё с нуля и забываешь что у нас уже есть стандарт — не надо выдумывать новые компоненты, они уже все созданы.»

Этот фидбэк заставил переоценить результат базового trim как недостаточный. Документ чистый от тегов, но как **пофайловая карта для поиска** — бесполезен. Провёл полный аудит с позиции «будущий я ищет код».

**Критические находки пост-аудита:**

1. **Нет оглавления** — 359 строк без TOC. Скроллить до нужного раздела = cognitive cost.
2. **Сломанная иерархия:** `### 5. Streaming Pipeline` жил **внутри** H2 «Система промптов». Найти «Streaming Pipeline» через outline невозможно.
3. **Дубликат Prompt System** — раздел существовал и как подсекция AI Layer (L123-129), и как отдельный H2 «Система промптов» (L178-204). Одно и то же.
4. **`#### tools/` раздел выдавал вранье** — перечислено 6 файлов, `ls lib/ai/tools/` → **17** файлов. Отсутствовали критические: `deep-research`, `fetch-page`, `jina-reader`, `perplexity-client`, `read-telegram-channel`, `create-document`, `update-document`, `request-suggestions`, `read-project-file`, `load-skill`, `chat-tools`, `tool-wrapper`.
5. **Data Layer вранье:** перечислено **19** таблиц, `grep pgTable lib/db/schema.ts` → **29**. Отсутствовали ВСЕ MIND-таблицы (`memoryEntry`, `memorySettings`, `userProfileSummary`) — ключевая фича xAI серии. Также `ProjectFolder`, `BriefingTopics`, `Suggestion`, `Stream`, `messageDeprecated`, `voteDeprecated`.
6. **Нет пофайловой карты фич.** CLAUDE.md перенаправляет сюда за «где лежит код для Briefing / Podcast / Meeting / Telegram», но в документе только общая ASCII-диаграмма. Будущий я не найдёт быстрый ответ.
7. **`components/` папка вообще не упомянута** — ни списка UI-папок, ни shadcn/ui примитивов, ни AI-elements. При создании нового UI я буду **изобретать с нуля** потому что не знаю что уже есть.
8. **Route groups в диаграмме вводили в заблуждение.** `(chat)` содержит не только Simply Chat (ещё `projects/`, `simply/`, `api/`). `(dashboard)` содержит `expertise/page.tsx` и `create/page.tsx` (landing pages), а индивидуальные чаты — под отдельными root route groups `(expertise)/expertise/[id]/` и `(create)/create/[id]/`. Описание в диаграмме не отражало этой тонкости.

**Особо важная находка (инициативой Владимира):**

**UI-стандарт.** Есть 3 уровня компонентов + закон, которые в документе никак не были упомянуты:
- `components/ui/` — **25 shadcn/ui примитивов** (Button, Card, Dialog, Input, Select, Sheet, Sidebar, Tooltip и т.д.)
- `components/elements/` — **17 AI-chat элементов** (message, conversation, reasoning, tool, response, prompt-input, source, task и др.) — паттерн Vercel AI SDK UI
- `components/shared/` — кросс-фичевые (model-select)
- Фичевые папки — `briefing/`, `chats/`, `dev-panel/`, `glavnaya/`, `groups/`, `input/`, `list-detail/`, `meeting/`, `projects/`, `service-chat/`, `settings/`, `tasks/`, `file-viewer/`, `context/`
- [docs/design-system.md](docs/design-system.md) — **ЗАКОН** (упомянут в CLAUDE.md как обязательное чтение, но не связан из architecture.md)

**Владимир формулирует причину:** я (Claude) имею паттерн начинать новые UI с нуля, забывая что базовые компоненты уже созданы. Без прямого upfront-напоминания в architecture.md — буду дублировать.

### Что сделано в расширении (5 крупных правок):

**1. Table of Contents + SSOT-ссылки сверху (+20 строк)**
Добавлено оглавление с 8 разделами + быстрый список SSOT-файлов (task-assignments.ts, model-catalog.ts, schema.ts, design-system.md, ai-chats-map.md, ai-providers.md).

**2. ⛔ UI-секция как H2 сразу после TOC (+50 строк)**
Громкий блок, невозможно пропустить:
- Правило: «Прочитать design-system.md ПЕРЕД любой UI-работой»
- Правило: «НЕ изобретать новые компоненты, использовать то что уже есть»
- Полный список `components/ui/` (25 имён)
- Полный список `components/elements/` (17 имён)
- Упоминание `components/shared/` + фичевые папки
- 4-шаговое правило при новом UI: ls → импорт → проп-вариант → (крайне редко) новый файл

**3. `#### lib/ai/tools/` переписан (17 файлов, сгруппированы по 5 категориям)**
Reg/infrastructure (chat-tools, tool-wrapper) · Web/research (web-search, fetch-url/page, jina-reader, deep-research, perplexity) · Artifacts (create/update-document, request-suggestions, excel) · Context/files (read-project-file, load-skill, read-telegram-channel) · Utility (date, weather).

**4. Data Layer полностью переработан (29 таблиц, 7 категорий с H4)**
Users/Auth · Chats/Messages/Artifacts · Projects · Briefing · MIND Memory/RAG · Telegram · Meeting · Observability. Правило: «SSOT = schema.ts, если в диффе новая `pgTable` — добавить сюда в том же коммите». Deprecated таблицы (`Message`, `Vote`) помечены явно.

**5. Новая H2 секция «Карта фич (пофайлово)» — САМАЯ ЦЕННАЯ ЧАСТЬ (+110 строк)**
Для каждой из 13 фич: route + pipeline + tools + UI папки + БД таблицы + модели + (опционально) ссылка на ADR/spec. Фичи: Simply Chat, Expertise, Create, Projects, Briefing, Podcast, Meeting Recorder, Telegram Bot, MIND Memory/RAG, Service Chats, Artifacts, Dev Switchboard, Prompt System. Теперь «где код для X» = один поиск по странице.

**Структурные правки:**

- **Иерархия:** «Streaming Pipeline» промотан с H3 (`### 5`) на H2 (`## Streaming Pipeline & Observability`). Сломанная нумерация слоёв убрана.
- **Дубликат Prompt System:** вместо полного дубля в AI Layer оставлен один параграф-указатель на Карту фич → Prompt System ниже.
- **Route groups в ASCII:** описания уточнены. `(chat)` теперь «Simply Chat + projects + api», `(dashboard)` явно включает «expertise/create landings», индивидуальные чаты указаны как отдельные root route groups с [/id].
- **Связанные документы (нижний раздел):** добавлены `design-system.md` (⭐), `ai-chats-map.md` (⭐), `model-catalog-ops.md`, `troubleshooting.md`, `mcp-tools.md`. 6 → 11 ссылок.

**Статистика:**

| Метрика | До Этапа 2 | После базового trim | После расширения |
|---|---|---|---|
| Строк | 366 | 359 | **542** |
| Версионных тегов | 21 | 0 | **0** |
| ТЗ-пометок | 5 | 0 | **0** |
| БД таблиц упомянуто | 19 | 19 | **29** (✅ = schema.ts) |
| `lib/ai/tools/` файлов | 6 | 6 | **17** (✅ = реальность) |
| Фич с пофайловой картой | 0 | 0 | **13** |
| Упоминание `components/ui/` | нет | нет | **25 примитивов** |
| Упоминание `components/elements/` | нет | нет | **17 элементов** |
| Упоминание `design-system.md` | нет | нет | **3 раза** (TOC, UI-блок, Related) |
| Оглавление | нет | нет | **есть** |
| Сломанная иерархия (H3 Streaming под H2 Prompts) | да | да | **исправлено** |

**Рост на 176 строк (359 → 542) оправдан:** весь прирост — **навигация и пофайловые карты**, не болтовня. Это единственный способ сделать документ полезным для будущего меня. Без этого — 359 строк чистого воздуха.

**Валидация:**
- `grep 'v3\.' docs/architecture.md` → **0** ✅
- `grep 'ТЗ-' docs/architecture.md` → **0** ✅
- `wc -l` → 542
- Реальность сверена с `ls app/ app/(dashboard)/ app/(chat)/ app/(task)/ app/api/ components/ components/ui/ components/elements/ components/shared/ lib/ai/tools/` — **все списки соответствуют**
- Таблицы БД сверены с `grep pgTable lib/db/schema.ts` — **29/29**
- Заголовочная иерархия прошла по `grep -n '^#{1,4} '` — ✅ нет orphan H3

**Файлы правлены в этом расширении:**
- `docs/architecture.md` — единственный (Этап 2 был только про него)

**Ждём мануальный тест Владимира** + коммит.

---

## 2026-04-15 — Этап 2 SSOT-фикс после чтения DOCUMENTATION_GUIDE.md (Сессия 2)

**Контекст:** Владимир спросил «какой документ тебе показать чтобы ты оформлял документацию правильно?». Ответ: [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) (496 строк). Владимир тут же дал команду `@DOCUMENTATION_GUIDE.md` — я прочитал файл и немедленно применил его правила к только что сделанной работе (Этап 2 расширенный).

**Обнаружил собственные нарушения SSOT в расширенном architecture.md:**

1. ❌ **Полный список 25 shadcn/ui примитивов** в `architecture.md` UI-блоке — **дублирует** `docs/design-system.md` раздел 13. Design-system.md и так был неполным (7/25), но руль «SSOT — одно место» ясный: моё место было НЕПРАВИЛЬНОЕ.

2. ❌ **17 файлов `lib/ai/tools/` с описаниями** в `architecture.md` `#### lib/ai/tools/` — **дублирует** `docs/ai-tools.md` (921 строка, DOCUMENTATION_GUIDE.md прямо говорит «ai-tools.md ⭐ КРИТИЧЕСКИ ВАЖНЫЙ — Источник правды для AI Tools»).

3. ⚠️ **17 AI-chat элементов `components/elements/`** в `architecture.md` — этого списка вообще нигде не было (ни в design-system.md, ни в ai-tools). Контент нужен, но **не в architecture.md** — он про UI-компоненты, место = design-system.md.

**Правило из DOCUMENTATION_GUIDE.md L40-48 (принцип №1):**

> ### 1. Single Source of Truth (SSOT)
> - Каждая информация живёт в ОДНОМ месте
> - Остальные файлы ссылаются на неё
> - Обновил в одном месте → везде актуально
>
> **Пример:** ❌ Неправильно: Писать список AI tools в README, CLAUDE.md и docs/ai-tools.md
> ✅ Правильно: Написать в docs/ai-tools.md, остальные файлы ссылаются на него

Я в точности совершил антипример — написал tool-список и в ai-tools.md (SSOT), и в architecture.md (дубликат).

### Что сделано в SSOT-фиксе (2 правки design-system.md, 3 правки architecture.md):

**1. `docs/design-system.md` раздел 13 полностью переделан (362 → 450 строк).**

Было: один flat раздел «13. Используемые UI-примитивы (shadcn/ui)» с 7 примитивами в таблице.

Стало:
- **13. Используемые компоненты (SSOT)** — жирный warning «ЭТО ЕДИНСТВЕННЫЙ СПИСОК КОМПОНЕНТОВ В ПРОЕКТЕ» + 4-шаговый протокол «при новой UI-работе».
- **13.1** — shadcn/ui примитивы, таблица **все 25 файлов** (было 7), каждый с путём и типичным use-case.
- **13.2** — AI-chat элементы, таблица **все 17 файлов** из `components/elements/` (новое). Паттерн Vercel AI SDK UI, переиспользовать во всех чатах.
- **13.3** — Кросс-фичевые (`components/shared/`) — сейчас один `model-select`.
- **13.4** — Фичевые папки (таблица 14 папок с примерами: briefing, chats, context, dev-panel, file-viewer, glavnaya, groups, input, list-detail, meeting, projects, service-chat, settings, tasks).
- **13.5** — Top-level компоненты (`components/*.tsx`) — 20+ глобальных компонентов перечислены inline.

Теперь design-system.md — **реальный SSOT** для компонентов, а не неполный список 7.

**2. `docs/architecture.md` UI-секция сокращена до указателя (−38 строк).**

Было: H2 «⛔ UI — закон и существующие компоненты» со всеми деталями: 25 примитивов, 17 элементов, shared, фичевые папки, top-level, 4-шаговый протокол.

Стало: H2 «⛔ UI — закон» → 12-строчный блок-указатель:
- Громкое правило «ПЕРЕД любой UI-работой читать design-system.md»
- Правило «НЕ изобретать новые компоненты»
- Краткий индекс разделов design-system.md 13.1-13.5 (1 строка на раздел)
- Прямая ссылка-якорь на [design-system.md#13-используемые-компоненты-ssot](../design-system.md#13-используемые-компоненты-ssot)
- Мета-заметка: «architecture.md **намеренно НЕ дублирует** список компонентов» + ссылка на DOCUMENTATION_GUIDE.md

**3. `docs/architecture.md` `#### lib/ai/tools/` сокращён до указателя (−26 строк).**

Было: H4 с 17 файлами, сгруппированными по 5 категориям, с inline-описаниями.

Стало: H4 + 2 строки — «17 файлов в пяти категориях, SSOT = ai-tools.md». Детали ушли в ai-tools.md где они уже есть.

**4. TOC обновлён.**

- Секция переименована «⛔ UI — закон» (было «⛔ UI — закон и существующие компоненты»).
- Блок «SSOT-файлы для быстрого перехода» расширен с 5 до 8 ссылок: добавлены `ai-tools.md`, `ai-agents.md`, `ai-artifacts.md` — чтобы будущий я сразу понимал какой документ SSOT для какой области.
- Все ссылки на SSOT-файлы помечены «⭐» где особенно важно.

**Статистика SSOT-фикса:**

| Файл | До SSOT-фикса | После | Дельта |
|---|---|---|---|
| `docs/architecture.md` | 542 | 500 | **−42** (удалены дубликаты) |
| `docs/design-system.md` | 362 | 450 | **+88** (раздел 13 раскрыт до SSOT) |
| Итого | 904 | 950 | +46 |

**Прирост +46 строк оправдан:** design-system.md стал полным SSOT (18 новых компонентов задокументировано), architecture.md очищен от дубликатов. В сумме — информация перестала жить в двух местах, стала жить в одном, полном.

**Валидация:**

- `grep 'v3\.' docs/architecture.md` → 0 ✅
- `grep 'ТЗ-' docs/architecture.md` → 0 ✅
- architecture.md UI-блок содержит только указатели, ни одного имени shadcn-компонента и ни одного имени elements — ✅
- architecture.md `#### tools/` содержит только указатель, ни одного имени tool-файла — ✅
- design-system.md раздел 13 содержит все 25 shadcn примитивов (сверено с `ls components/ui/`) — ✅
- design-system.md 13.2 содержит все 17 elements (сверено с `ls components/elements/`) — ✅

**Урок для самого себя (почему чуть не ушёл с дубликатами):**

Проблема возникла потому что на прошлом шаге Владимир сказал мне «не изобретай компоненты с нуля, они уже созданы», и я интерпретировал это как «напиши список компонентов в architecture.md чтобы не забыть». **Это было неверное решение.** Правильное: «напиши список компонентов в design-system.md (SSOT), а в architecture.md — указатель». Причина — DOCUMENTATION_GUIDE.md явно запрещает дублирование, и если информация меняется, то в одном месте она остаётся актуальной, а в другом — рот, что и **приводит к ровно тем ошибкам**, которые я и делал всю предыдущую итерацию Этапа 2.

Memory правило: **до написания списка/таблицы/перечня в документе — проверить, не является ли другой документ SSOT для этой темы.** Если является — писать/обновлять только там, в текущем документе оставлять указатель.

**Ждём мануальный тест Владимира** по двум файлам: `docs/architecture.md` (итоговый, после SSOT-фикса) + `docs/design-system.md` (раздел 13 полностью переделан). Потом коммит одним блоком.

---

## 2026-04-15 — Этап 3 выполнен (Сессия 2 — продолжение)

**Контекст:** Владимир сказал «отлично продолжай» после Этапа 2 SSOT-фикса — зелёный свет на Этап 3 в той же сессии. Этап 3 = самая тяжёлая часть ТЗ (перезапись SIMPLY_STATUS.md с 2323 до ≤400 строк).

**Что прочитал перед правками:**
- `package.json` → версия **3.91.0** (в старом STATUS было 3.90.0 — отставание).
- `SIMPLY_STATUS.md` начало + хвост → понял структуру: 10+ H2 разделов, 65 ТЗ-записей, «Статистика» отстающая на 18 версий (v3.73), 40+ archive-ссылок.
- `specs/_backlog/README.md` → 4 открытых хвоста (1 high, 3 medium).
- `lib/ai/task-assignments.ts` → SSOT моделей (уже проверял в Этапе 2).

**Ключевые решения:**

1. **Структура новая, не урезание.** Старый STATUS дублировал ai-agents.md, architecture.md, ai-tools.md. По SSOT всё это должно жить в тематических doc-ах, STATUS — только указатели.

2. **STATUS = health dashboard.** «Что работает прямо сейчас на один взгляд». Три главные таблицы: компоненты (17 строк), метрики (8 строк), известные проблемы (4 строки backlog).

3. **Модели в таблице компонентов — сознательный soft-duplicate с ai-chats-map.md.** Золотой критерий Владимира прямо требует «Simply Chat работает на Grok 4.1 Fast» в STATUS. Триггер обновления документирован во вступлении таблицы: task-assignments → ai-chats-map → STATUS.

4. **Ben помечен ⚠️ deprecated** (из memory `project_ben_deprecation.md`).

**Удалено полностью:**
- «Унаследовано от Family AI Assistant» (устаревшая миграция)
- «Система промптов v3.3» с деревом папок → в architecture.md Карта фич
- «Проекты v3.2.0» → в architecture.md Карта фич
- «Профиль пользователя» таблица полей БД → в architecture.md Data Layer
- «AI-инструменты» список → в docs/ai-tools.md
- «План развития» — фантазия Smart Routing, уже удалена из architecture.md
- «Статистика» — метрики отставали на 18 версий, переписаны через SSOT-ссылки
- «Документация → архив» — 40+ ссылок на закрытые ТЗ = шум, всё в CHANGELOG.md

**Новые разделы:**
- «Три уровня персонализации» — product-описание, нигде больше не существует (7 строк)
- «Известные проблемы» — pull из backlog с прямыми ссылками
- «Метрики (от SSOT-файлов)» — каждая цифра с указателем на SSOT-файл

**Валидация:**

| Проверка | Цель | Факт |
|---|---|---|
| `wc -l` | ≤ 400 | **165** ✅ (2323 → 165, **−93%**) |
| `v3\.` в теле | 0 | **0** ✅ |
| `ТЗ-` русское | 0 | **0** ✅ |
| `TZ_` латинское (backlog/серия) | ≤ 5 | **5** ✅ |
| Версия в шапке | 3.91.0 | **3.91.0** ✅ |

**SSOT аудит по всем разделам:**

| Раздел STATUS | Дубликат? | Решение |
|---|---|---|
| Таблица компонентов (модели) | ai-chats-map.md | **Soft-duplicate по золотому критерию**, триггер документирован |
| Инфраструктура | architecture.md | Разные уровни (стек vs слои) — не дубликат |
| Метрики | SSOT-файлы каждой цифры | По дизайну указатели — не дубликат |
| Три уровня персонализации | MIND_ARCHITECTURE.md | Product-обзор vs technical pipeline — не дубликат |
| Известные проблемы | specs/_backlog/README.md | Summary с указателями — принят backlog workflow |
| Навигация | CLAUDE.md | Разные роли (AI instructions vs human snapshot) |

Оценка: ✅ SSOT compliance приемлемая по DOCUMENTATION_GUIDE.md L40-48.

**Ждём мануальный тест Владимира.**

Вариант коммита (Этапы 2+3 одним блоком или отдельно — на выбор):

```bash
# Один коммит
git add docs/architecture.md docs/design-system.md SIMPLY_STATUS.md specs/TZ_DocsCleanup/
git commit -m "docs: architecture+design-system SSOT fix + SIMPLY_STATUS rewrite (TZ_DocsCleanup Этап 2+3)"

# Или два коммита
git add docs/architecture.md docs/design-system.md specs/TZ_DocsCleanup/{HANDOFF,ROADMAP}.md
git commit -m "docs(architecture+design-system): SSOT fix (TZ_DocsCleanup Этап 2)"
git add SIMPLY_STATUS.md specs/TZ_DocsCleanup/
git commit -m "docs(simply-status): rewrite as snapshot 2323→165 lines (TZ_DocsCleanup Этап 3)"
```

---

## 2026-04-15 — RAG-split фикс (пост-ревью Владимира, Этапы 2+3)

**Фидбэк Владимира:** «есть недочёт в архитектуре по поводу RAG. Вся идея будущей архитектуры в `SIMPLY_ATTACHMENT_ARCHITECTURE.md`: для MIND мы используем Voyage, а для Библиотеки знаний берём всё из коробки от провайдера Grok».

Ключевое уточнение: **RAG в Simply — это umbrella с двумя разными хранилищами**, а не одно:

1. **MIND** (Voyage AI + pgvector) — ✅ работает сегодня. Автоматическое извлечение фактов из разговоров. Это **персональная автоматическая память**, не пользовательская загрузка документов.
2. **Collections** (xAI Grok native `collections_search` / `file_search`) — 📋 планируется (ТЗ-XAI-COL-1 в SIMPLY_XAI_ROADMAP.md). Явная загрузка документов пользователем в «Библиотеку». **Никакой собственной векторной инфраструктуры не строим** — берём из коробки у xAI.

Оба хранилища будут доступны через единый tool `knowledge_search`. SSOT будущего дизайна → [specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md § Слой 3](../../specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md).

**Мой недочёт в Этапах 2 и 3:** я упомянул только MIND, не показав что это часть большего umbrella «База знаний (Слой 3 RAG)» и что есть второе хранилище Collections как product-решение. Читатель `architecture.md` и `SIMPLY_STATUS.md` не видел полной картины будущей архитектуры — думал что MIND это и есть RAG целиком.

**Верификация состояния кода перед правкой:**
- `grep -rl "knowledge_search\|collections_search\|file_search\|Collection" lib/ app/` → **0 результатов**. В коде ничего не реализовано. Владимир подтвердил: «реализовано только первых три фазы» (MIND extract/retrieve/consolidate/profile работают).
- `grep "COL" specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md` → ТЗ-XAI-COL-1 формально зарегистрирован как «Collections (Библиотека) — Grok Collections API для RAG документов пользователя».
- Вывод: Collections = 📋 planned, не ⚠️ partial.

### Правки (4 блока в 2 файлах):

**1. `docs/architecture.md` Карта фич — entry `### MIND Memory / RAG` переделан в `### База знаний (Слой 3 RAG) — MIND + Collections`:**
- Intro строка: «Два хранилища, один интерфейс `knowledge_search`. SSOT → SIMPLY_ATTACHMENT_ARCHITECTURE.md § Слой 3».
- **Подсекция «MIND (Voyage AI + pgvector) — ✅ работает»** — сохранено прежнее содержимое (pipeline, БД, models, external, архитектура) + явная формулировка «автоматическое извлечение фактов из разговоров».
- **Новая подсекция «Collections (xAI Grok native) — 📋 планируется (ТЗ-XAI-COL-1)»** с полями:
  - Status: в коде ничего нет, формально в SIMPLY_XAI_ROADMAP.md
  - Provider API: Grok Collections API
  - Стоимость: ~$2.50 / 1000 поисков + storage (из SIMPLY_ATTACHMENT_ARCHITECTURE.md)
  - UI: пользователь явно загружает документ
  - Взаимодействие: единый `knowledge_search` tool
  - **Принцип:** для персональной памяти → Voyage. Для документов-знаний → из коробки у xAI, не изобретаем.

**2. `docs/architecture.md` External Services ASCII-диаграмма (L95) — строка xAI расширена:**
```
│  ├── xAI Grok          - Simply Chat + MIND extract +     │
│  │                       Collections RAG (план ТЗ-XAI-COL-1)│
```
Раньше было одна строка «Simply Chat + MIND (@ai-sdk/xai)» — теперь явно показано что xAI обслуживает MIND extract (LLM роль) + Collections RAG (storage+search роль в будущем).

**3. `SIMPLY_STATUS.md` таблица компонентов — строка MIND разделена на две:**

Было (1 строка):
```
| **MIND Memory / RAG** | ✅ | Grok 4.20 (extract) + Grok 4.1 Fast + Voyage AI |
```

Стало (2 строки):
```
| **База знаний — MIND** (Слой 3 RAG, auto из разговоров) | ✅ | Grok 4.20 (extract) + Grok 4.1 Fast (batch, consolidate, profile, dedup) + Voyage AI (embeddings) + pgvector |
| **База знаний — Collections** (Слой 3 RAG, явная загрузка документов) | 📋 план | xAI Grok Collections API из коробки (knowledge_search / file_search). Отдельного векторного стека не строим. ТЗ-XAI-COL-1 |
```

Теперь читатель STATUS видит **обе** подсистемы Слоя 3 одним блоком.

**4. `SIMPLY_STATUS.md` раздел «Три уровня персонализации» — пункт 2 уточнён:**
- Было: «MIND Memory / RAG — извлекает факты из диалогов...»
- Стало: «MIND — **автоматически** извлекает факты из диалогов... **Это автоматическая память** (из разговоров), не путать с Библиотекой (Collections) для явной загрузки документов — см. таблицу компонентов выше».

Объясняю явно что персонализация ≠ RAG-хранение документов, и Collections не входит в «Три уровня персонализации» (это другой слой).

### Валидация:

| Проверка | Факт |
|---|---|
| `grep 'v3\.' docs/architecture.md` | 0 ✅ |
| `grep 'v3\.' SIMPLY_STATUS.md` | 0 ✅ |
| `grep -rl "knowledge_search\|Collection" lib/ app/` | 0 ✅ (код не изменён, только docs) |
| `wc -l docs/architecture.md` | 500 → **519** (+19, расширение Карты фич на Collections) |
| `wc -l SIMPLY_STATUS.md` | 165 → **166** (+1, разделение строки) |
| Упоминание ТЗ-XAI-COL-1 | в обоих файлах + ссылка на SIMPLY_XAI_ROADMAP.md ✅ |
| Collections статус = 📋 (не ⚠️) | ✅ (верифицировано grep-ом что в коде 0) |

**SSOT compliance:** обе правки ссылаются на `SIMPLY_ATTACHMENT_ARCHITECTURE.md § Слой 3` как SSOT дизайна и `SIMPLY_XAI_ROADMAP.md` как SSOT статуса ТЗ. Дубликата детального описания Collections нет — только короткий snapshot + указатели.

**Итог:** недочёт архитектурного документа закрыт. Теперь любой читатель (включая будущего меня) видит что:
1. MIND ≠ вся RAG-система, это только половина.
2. Библиотека документов планируется отдельно через нативный xAI API — **принципиально не свой вектор-стек**.
3. Ссылка на SSOT дизайна `SIMPLY_ATTACHMENT_ARCHITECTURE.md` явно указана.

**Ждём мануальный тест Владимира** по обоим файлам после этого фикса. Коммиты — те же варианты что и раньше (Этапы 2+3 одним блоком или отдельно), просто с этим фиксом включённым.

---

## 2026-04-15 — Этапы 4 и 5 выполнены (Сессия 2, финализация)

**Контекст:** Владимир одобрил RAG-split фикс («Да окей»). Продолжаю в той же сессии — Этап 4 (процессная защита) и Этап 5 (banner + финализация ТЗ) оба помечены в ROADMAP как «лёгкие» и «можно объединить».

### Этап 4 — `specs/WORKFLOW.md` полное расширение триггеров (746 → 791 строк, +45)

**Цель:** механизм обновления всех **13 docs/ файлов** через explicit file-triggers в git diff. Закрывает root cause «файл не в чеклисте → никогда не обновляется».

**Ключевое решение:** расширил **Правило 6 таблицу** (было 3 строки: ai-providers, ai-chats-map, architecture) до **13 строк** — все docs/ файлы с колонкой «Файл(ы)-триггер в git diff». Это стало центральным справочником, на который ссылаются все чек-листы финализации.

**13 docs/ файлов с их триггерами:**

| Doc | Файл(ы)-триггер |
|---|---|
| `ai-chats-map.md` ⭐ | `task-assignments.ts`, `model-catalog.ts` |
| `design-system.md` ⭐ | `components/ui/*`, `components/elements/*`, новый layout/route group |
| `ai-providers.md` | `lib/ai/providers.ts`, `lib/ai/registry.ts`, pricing в catalog |
| `architecture.md` | новая папка `lib/*/`, route group, `pgTable` в schema.ts, крупный модуль |
| `ai-tools.md` | `lib/ai/tools/*.ts` |
| `ai-agents.md` | `lib/prompts/{agents,skills,service-chats,professors,experts,clerks}/*` |
| `ai-artifacts.md` | `artifacts/*`, `create-document.ts`, `update-document.ts`, `request-suggestions.ts` |
| `setup.md` | `.env.example`, `next.config.ts`, `drizzle.config.ts`, новая prereq в package.json |
| `deployment.md` | Vercel config, production env vars, новая миграция |
| `model-catalog-ops.md` | изменение workflow каталога (процессный) |
| `mcp-tools.md` | `.mcp.json`, новый MCP server |
| `troubleshooting.md` | incident-driven (нет формального триггера) |
| `ai-minimax.md` | 🗄️ архивный — не обновлять |

**Правила применения таблицы** (в 3 фазах workflow):
1. В Фазе 2 (ANALYSIS) / Фазе 3 (работа) — держать таблицу перед глазами, знать какие docs/ будут затронуты заранее.
2. В Фазе 4 (Финализация) — `git diff --stat master...HEAD` → для каждого файла-триггера в diff найти строку в таблице → обновить соответствующий `docs/*.md`.
3. Если триггер сработал, но обновить лень — записать в FINDINGS high impact → в backlog. Нельзя молча проигнорировать.

**Три места правлено в WORKFLOW.md:**

1. **L119-165 Правило 6 таблица** — было 3 строки, стало 13 + правила применения в 3 фазах. Добавлен grep-тест на правдивость моделей/компонентов/tools.

2. **L606-618 Фаза 4 «3. Документация»** — секция переделана. Было: длинный список индивидуальных правил (CLAUDE.md запрет, ai-chats-map trigger, architecture update и т.д.). Стало: ссылка на Правило 6 таблицу + 3 обязательные проверки для «живых» документов (ai-chats-map, design-system, architecture).

3. **L688-710 «Завершение ТЗ» чек-лист** — был 2 docs/ файла в чек-листе (ai-chats-map, architecture). Стал **13 docs/ файлов** с explicit триггерами в каждой строке. Плюс grep-тесты правдивости.

**Валидация Этапа 4:**
```bash
for f in ai-chats-map design-system ai-providers architecture ai-tools ai-agents ai-artifacts setup deployment model-catalog-ops mcp-tools troubleshooting ai-minimax; do
  grep -q "docs/$f.md" specs/WORKFLOW.md && echo "✅ $f" || echo "❌ $f"
done
```
Результат: **13/13 ✅**. Все docs/ файлы упомянуты в WORKFLOW.md с триггерами.

### Этап 5.1 — `docs/ai-minimax.md` banner (256 → 271 строк, +15)

**Замечание при подходе:** в ROADMAP был образец banner «Архивный документ», но на самом деле MiniMax НЕ полностью archival — он всё ещё используется для `create` chatMode и briefing pipeline. Фактический archival (full removal) был бы враньём. Использовал более честную формулировку.

**Banner-блок добавлен в шапку файла (заменил старые «Статус: В production», «Версия проекта 3.85.0», «Дата последнего аудита»):**

```
> ⛔ Документ частично устарел — не весь контент ниже отражает текущее состояние проекта.
>
> После серии Simply_xAI MiniMax убран из:
> - Simply Chat (все 3 variant: default text, «Думать», vision) → Grok + Claude Haiku
> - MIND Memory / RAG → Grok 4.20 + Grok 4.1 Fast
>
> MiniMax всё ещё активен для двух задач:
> - Create chatMode → MiniMax M2.7
> - Briefing pipeline (filter/author/section long-timeout + podcast-script) → MiniMax M2.7 / M2.7-long
>
> Актуальные источники правды:
> - Карта моделей → docs/ai-chats-map.md ⭐
> - Текущее состояние → SIMPLY_STATUS.md
> - Архитектура RAG → SIMPLY_ATTACHMENT_ARCHITECTURE.md § Слой 3
> - История миграции → CHANGELOG.md
```

**Не делал:**
- Не переименовывал файл (избежал grep-hell по ссылкам во всём проекте).
- Не удалял содержимое ниже — сохранено для технических деталей pricing / Anthropic-compatible mode / long-timeout namespace, которые всё ещё применимы для оставшихся двух задач.
- Не трогал ADR 043, 046, 049 (актуальные по MiniMax).

### Этап 5.2 — Главный CHANGELOG.md обновлён

Добавлена запись `### Docs / Chore — 2026-04-15 — TZ_DocsCleanup (5 этапов)` в секцию `[Unreleased]`, после существующего `CLAUDE.md cleanup + process fix` блока. Структура:
- Подробный разбор каждого этапа (5 блоков: Этап 1-5)
- Включает RAG-split фикс как подраздел Этапа 2+3
- Все ключевые цифры (376→519, 2323→166, 746→791, 7→25 компонентов, 0 version tags)
- 4 механизма защиты от регрессии (3 memory-правила + расширенная WORKFLOW таблица)
- Версия проекта **не поднимается** (docs/chore)

### Этап 5.3 — Финальная валидация

| Файл | Было | Стало | Инвариант |
|---|---|---|---|
| `CLAUDE.md` | 211 | **211** | ≤ 220 ✅ (не трогали) |
| `SIMPLY_STATUS.md` | 2323 | **166** | ≤ 400 ✅ |
| `docs/architecture.md` | 366 | **519** | — (целевое расширение карты фич) |
| `docs/design-system.md` | 362 | **450** | — (SSOT § 13 расширение) |
| `docs/ai-chats-map.md` | 676 | **654** | — (trim + actualization) |
| `docs/ai-minimax.md` | 256 | **271** | — (banner +15) |
| `specs/WORKFLOW.md` | 746 | **791** | — (13-doc таблица) |

**grep-тесты правдивости:**
- `grep 'v3\.' CLAUDE.md SIMPLY_STATUS.md docs/architecture.md docs/ai-chats-map.md` → **0** в теле (все 4 файла чисты от CHANGELOG-стиля)
- `grep -c 'ТЗ-' SIMPLY_STATUS.md docs/architecture.md` → **0** в теле
- `grep 'docs/*.md' specs/WORKFLOW.md` → все **13 docs/** файлов упомянуты ✅
- `wc -l CLAUDE.md` → **211** (инвариант ≤ 220 соблюдён ✅)

### Готово к архивации

ТЗ_DocsCleanup завершено на **100% по коду/docs**. Все 5 этапов закрыты:

| Этап | Файл | Статус |
|---|---|---|
| 1 | `docs/ai-chats-map.md` | ✅ closed (commit `889f017`) |
| 2 | `docs/architecture.md` + `docs/design-system.md` | 🟡 ждёт финальный manual test + commit |
| 3 | `SIMPLY_STATUS.md` | 🟡 ждёт финальный manual test + commit |
| 4 | `specs/WORKFLOW.md` | 🟡 ждёт финальный manual test + commit |
| 5 | `docs/ai-minimax.md` banner + главный `CHANGELOG.md` | 🟡 ждёт финальный manual test + commit |

**Что ждёт пользователь:**
1. Мануальная проверка всех 7 правленных файлов.
2. Финальный коммит (один большой блок или несколько отдельных коммитов по этапам).
3. После коммита — `mv specs/TZ_DocsCleanup/ specs/_archive/TZ_DocsCleanup/`.

**Команды коммита (одним блоком — рекомендация):**
```bash
git add docs/architecture.md docs/design-system.md docs/ai-minimax.md \
  SIMPLY_STATUS.md CHANGELOG.md specs/WORKFLOW.md \
  specs/TZ_DocsCleanup/
git commit -m "docs: TZ_DocsCleanup finalize — Этапы 2+3+4+5 (architecture+design-system SSOT, SIMPLY_STATUS snapshot, WORKFLOW 13-doc triggers, ai-minimax banner)"
```

Или 4 отдельных коммита по этапам — на выбор пользователя.

**После мануального теста и коммита — можно архивировать папку.**
