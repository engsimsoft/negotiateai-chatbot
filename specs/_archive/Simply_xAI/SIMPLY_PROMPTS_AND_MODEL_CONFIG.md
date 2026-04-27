# Simply — Карта промптов и настроек поведения моделей

**Кому:** Владимиру Анатольевичу (не программисту) — чтобы понимать, где лежит «мозг» Simply и где крутить ручки.

**Обновлено:** 2026-04-15

**Принцип чтения:** документ структурирован от общего к частному. Сначала — ЧТО где настраивается (4 слоя), потом — КОНКРЕТНЫЕ ФАЙЛЫ по каждому слою.

---

## TL;DR — четыре слоя настроек

Поведение любой ИИ-фичи в Simply определяется четырьмя независимыми слоями. Когда что-то работает не так — сначала понимаешь, какой слой виноват, и идёшь именно туда.

| № | Слой | Что задаёт | Где лежит |
|---|------|-----------|-----------|
| 1 | **Промпты** | ЧТО модель должна делать (характер, задача, стиль) | [lib/prompts/](lib/prompts/) |
| 2 | **Назначение моделей** | КАКАЯ модель выполняет какую задачу (Sonnet / Haiku / Grok / MiniMax) | [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts) |
| 3 | **Каталог моделей** | КАКИЕ модели вообще доступны + их цены и возможности | [lib/ai/model-catalog.ts](lib/ai/model-catalog.ts) |
| 4 | **Параметры вызова** | КАК модель отвечает (температура, лимит токенов, инструменты) | разбросаны по коду (список ниже) |

**Главный принцип:** для большинства изменений ты правишь один слой в одном месте. Например:
- Хочешь сменить модель для брифинга → только слой 2 (одна строка).
- Хочешь изменить стиль брифинга → только слой 1 (один .md файл).
- Хочешь, чтобы брифинг был креативнее → только слой 4 (температура).

---

# Слой 1 — Промпты

Каждый промпт — это инструкция поведения для ИИ в конкретной ситуации. У нас 9 групп, каждая отвечает за свой участок продукта.

## 1.1 База — применяется ВЕЗДЕ

Папка [lib/prompts/core/](lib/prompts/core/) — это то, что подмешивается в КАЖДЫЙ чат Simply как фундамент.

- [base.md](lib/prompts/core/base.md) — кто ты такой, общий характер Simply («я AI-помощник российского рынка…»)
- [safety.md](lib/prompts/core/safety.md) — что нельзя говорить/делать (безопасность)
- [formatting.md](lib/prompts/core/formatting.md) — как оформлять ответы (markdown, заголовки, списки)
- [russian-market.md](lib/prompts/core/russian-market.md) — контекст российского пользователя (рубли, локальные реалии)

**Влияние:** меняешь здесь → меняется тон/правила сразу во всех чатах продукта.

## 1.2 Основные чаты — где пользователь сидит каждый день

### Simply Chat (главный постоянный чат)
- [chat/simply-chat.md](lib/prompts/chat/simply-chat.md) — роль Simply Chat, правила навигации пользователя по продукту, как направлять в другие инструменты.
- **Куда попадает:** страница `/simply`. Это «основной разговор».

### Экспертиза и Создание (режимы с главной)
Эти режимы не имеют отдельного .md — они собираются из `core/` + подключаемых **Skills** (см. 1.4).
**Куда попадает:** кнопки «🔍 Экспертиза» и «✨ Создать» на главной.

## 1.3 Агенты — персонажи с характером

[lib/prompts/agents/ben/](lib/prompts/agents/ben/) — **Бен**, помощник-онбординг «❓».
- `AGENT.md` — его личность, манера речи, задача
- `onboarding.md` — сценарий первого знакомства с новичком

⚠️ **Важно:** Бена решено убирать, не инвестировать в него.

## 1.4 Skills — «навыки» которые подключаются по запросу

[lib/prompts/skills/](lib/prompts/skills/) — атомарные инструкции «как делать одну конкретную вещь». ИИ подтягивает нужный skill, когда пользователь просит соответствующую задачу.

**Документы** ([skills/document/](lib/prompts/skills/document/)):
- `create-text-document` — как писать текстовый документ
- `create-spreadsheet` — как создавать Excel-таблицы
- `create-presentation` — как собирать презентации
- `analyze-document` — как анализировать загруженный файл

**Исследование** ([skills/research/](lib/prompts/skills/research/)):
- `web-research` — как искать информацию в интернете
- `telegram-channel-reading` — как читать публичные Telegram-каналы

**Влияние:** если качество документов/таблиц/ресёрча «не то» — правится тут.

## 1.5 Сервисные чаты — узкие диалоги с конкретной целью

[lib/prompts/service-chats/](lib/prompts/service-chats/) — маленькие чаты с одной миссией.

- [project-creation.md](lib/prompts/service-chats/project-creation.md) — **чат создания проекта** (собирает: название, цель, материалы)
- [project-manager.md](lib/prompts/service-chats/project-manager.md) — **Менеджер проекта** (right drawer внутри открытого проекта, следит за ходом работ)
- [briefing-onboarding.md](lib/prompts/service-chats/briefing-onboarding.md) — **онбординг Брифинга** (помогает собрать темы/источники при первом заходе на /briefing)
- [briefing-onboarding-mode-injection.md](lib/prompts/service-chats/briefing-onboarding-mode-injection.md) — добавка к онбордингу в режиме «редактирование» уже собранного профиля

## 1.6 Проекты — трёхуровневая иерархия «мозгов»

### Профессора — думают стратегически (Claude Opus)
[lib/prompts/professors/](lib/prompts/professors/):
- [planning.md](lib/prompts/professors/planning.md) — **Профессор планирования.** При создании проекта и нажатии «Спланировать» — анализирует материалы и создаёт список задач
- [task-review.md](lib/prompts/professors/task-review.md) — **Профессор ревью.** Когда Эксперт заканчивает задачу — проверяет результат и говорит «принято» или «доработай»

### Эксперты — исполняют задачи (Claude Sonnet)
- [experts/task-expert.md](lib/prompts/experts/task-expert.md) — **Эксперт по задаче.** Тот, с кем ты разговариваешь внутри конкретной задачи проекта

### Клерки — делают мелкую рутину (Claude Haiku — дешёвый)
[lib/prompts/clerks/](lib/prompts/clerks/):
- [file-analyzer.md](lib/prompts/clerks/file-analyzer.md) — краткое описание файла при загрузке в проект
- [task-summarizer.md](lib/prompts/clerks/task-summarizer.md) — резюме диалога по завершённой задаче

## 1.7 Брифинг и Подкаст

[lib/prompts/briefing/](lib/prompts/briefing/):
- [briefing-author.md](lib/prompts/briefing/briefing-author.md) — **Автор брифинга.** Получает отфильтрованные новости и пишет утренний брифинг
- [briefing-scriptwriter.md](lib/prompts/briefing/briefing-scriptwriter.md) — **Сценарист подкаста.** Превращает текст брифинга в диалог для двух голосов (Kore + Iapetus)
- [briefing-scriptwriter-user-template.md](lib/prompts/briefing/briefing-scriptwriter-user-template.md) — шаблон, в который подставляются данные одной темы

## 1.8 Память MIND — как AI запоминает тебя

[lib/prompts/memory/](lib/prompts/memory/) — внутренние инструкции как AI обрабатывает историю разговоров.

- [extract.md](lib/prompts/memory/extract.md) — как вытаскивать факты из одного сообщения (старая версия)
- [extract-batch.md](lib/prompts/memory/extract-batch.md) — как вытаскивать факты из целого куска разговора (новая, используется сейчас)
- [consolidate.md](lib/prompts/memory/consolidate.md) — быстрая чистка накопленных фактов (hot path, дешёвая модель)
- [deep-consolidate.md](lib/prompts/memory/deep-consolidate.md) — **ночная глубокая консолидация** на reasoning-модели (01:00 МСК). Можно редактировать под свои предпочтения: что сжимать агрессивнее, какие категории не трогать и т.д. Поддерживает 4 действия: merge / supersede / **rephrase** (сжатие длинного факта с сохранением id) / remove.
- [profile.md](lib/prompts/memory/profile.md) — как писать связный нарративный «портрет пользователя» (800–1200 слов)

**Влияние:** что AI помнит на странице `/context` — определяется именно этими инструкциями.

## 1.9 Meeting Recorder — форматы встреч

[lib/prompts/meeting/](lib/prompts/meeting/):
- [meeting-summary-compact.md](lib/prompts/meeting/meeting-summary-compact.md) — короткое резюме встречи
- [meeting-summary-standard.md](lib/prompts/meeting/meeting-summary-standard.md) — стандартное
- [meeting-summary-detailed.md](lib/prompts/meeting/meeting-summary-detailed.md) — детальное с таймкодами

## 1.10 Контексты — не промпты, а «вставки данных»

[lib/prompts/contexts/](lib/prompts/contexts/) — **не** инструкции, а кусочки которые подклеиваются в промпт с ДАННЫМИ:
- [user-profile.ts](lib/prompts/contexts/user-profile.ts) — вставляет твой профиль (имя, роль, предпочтения)
- [chat-memory.ts](lib/prompts/contexts/chat-memory.ts) — вставляет релевантные факты из MIND
- [project-context.ts](lib/prompts/contexts/project-context.ts) — вставляет манифест проекта

## Как это всё собирается вместе

Когда ты пишешь сообщение в Simply Chat, реально в модель уходит бутерброд:

```
[core/base.md] + [core/safety.md] + [core/formatting.md] + [core/russian-market.md]
+ [chat/simply-chat.md]
+ [contexts/user-profile ← твой профиль]
+ [contexts/chat-memory ← факты MIND]
+ [твоё сообщение]
```

Если открываешь задачу в проекте — вместо `simply-chat.md` подставляется `experts/task-expert.md` + контекст проекта. Логика сборки живёт в [lib/prompts/builder/](lib/prompts/builder/) и [lib/prompts/server.ts](lib/prompts/server.ts).

**Плейсхолдеры `<current_mode>` и `<current_model>`** в [chat/simply-chat.md](lib/prompts/chat/simply-chat.md) подменяются композером автоматически: `<current_mode>` ← реальный `chatMode` (`simply` / `expertise` / `create`), `<current_model>` ← `displayName` из каталога моделей (слой 3) через `getModelEntry(getModelIdForTask(activeTaskId))`. Смена модели в слое 2 (task-assignments) или через `/dev/models` override автоматически отражается в промпте — никаких правок composer-а. Починено в ТЗ-SimplyChatModeInjection (v3.90.1).

---

# Слой 2 — Назначение моделей (task-assignments)

**Единственное место** в приложении, где фиксируется: какая модель выполняет какую задачу.

📁 **Файл:** [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts)

**Принцип:** 39 задач (`taskId`), каждой сопоставлена одна модель. Смена default модели для задачи = одна строка в этом файле.

## Текущий расклад (v3.88.0)

### Simply Chat (основной чат)
| Задача | Модель | Когда срабатывает |
|---|---|---|
| `simply-chat` | **MiniMax M2.7** | Текстовый запрос (по умолчанию) |
| `simply-chat-think` | **Claude Sonnet 4.6** | Нажата кнопка «Думать» |
| `simply-chat-vision` | **Claude Haiku 4.5** | Приложено фото или PDF |

### Экспертиза и Создание
| Задача | Модель |
|---|---|
| `expertise` | **Grok 4.20 Multi-Agent** (🔍 разовые экспертные запросы) |
| `create` | **MiniMax M2.7** (✨ разовые задания на создание) |

### Проекты — Эксперты по задачам
| Tier | Модель | Для каких проектов |
|---|---|---|
| `project:expert:haiku` | **Claude Haiku 4.5** | дешёвые/простые |
| `project:expert:sonnet` | **Claude Sonnet 4.6** | средние (default) |
| `project:expert:opus` | **Claude Opus 4.6** | сложные |

### Проекты — Профессорский pipeline
| Задача | Модель |
|---|---|
| `professor:planning` | **Claude Opus 4.6** — создаёт план проекта |
| `professor:review` | **Claude Opus 4.6** — ревью завершённой задачи |
| `professor:pipeline-analyze` | **Claude Opus 4.6** — этап анализа |
| `professor:pipeline-execute` | **Claude Haiku 4.5** — этап выполнения (дёшево) |
| `professor:pipeline-synthesize` | **Claude Opus 4.6** — этап синтеза |

### Клерки (рутина, дёшево)
| Задача | Модель |
|---|---|
| `clerk:task-summary` | Claude Haiku 4.5 |
| `clerk:file-analyzer` | Claude Haiku 4.5 |

### Память MIND (после ТЗ-MindDeepConsolidation, апрель 2026)

**Двухуровневая консолидация (tiered pattern, Letta sleep-time):** hot path на дешёвой Grok 4.1 Fast ловит очевидные дубликаты в момент накопления фактов; ночной cron на reasoning-модели причёсывает базу глубже — тонкие переформулированные дубли, противоречия, устаревшие факты, сжатие многословных формулировок (`rephrase`).

| Задача | Модель | Когда | Что делает |
|---|---|---|---|
| `memory:extract-batch` | Grok 4.1 Fast | В процессе compaction | Извлекает факты из пачки сообщений, уходящих в summary |
| `memory:consolidate` | Grok 4.1 Fast | Hot path: по триггеру ≥10 новых фактов | Быстрая механическая чистка (merge/supersede/remove) |
| `memory:deep-consolidate` | **Grok 4.20 reasoning** | Ночной cron `0 22 * * *` = **01:00 МСК** | Глубокая консолидация reasoning-моделью. 4 действия: merge / supersede / **rephrase** / remove. Фильтры: активность за 24ч + idempotency 12ч + факт-count ≥5. Snapshot cursor защищает от race condition с hot path. Через `/dev/models` можно A/B с Haiku 4.5 / Sonnet / Opus. |
| `memory:profile` | Grok 4.1 Fast | Ночной cron `0 0 * * *` = 03:00 МСК | Нарративный профиль пользователя |
| `memory:dedup-verify` | Grok 4.1 Fast | При записи нового факта | LLM-проверка дубля (второй уровень после embedding similarity) |

> `memory:extract` (per-turn) удалён в ТЗ-COMPACTION-UNIFY — per-turn extract в expertise/create/project давал ~12× overhead на свежих сообщениях.

### Брифинг и Подкаст
| Задача | Модель | Примечание |
|---|---|---|
| `briefing:filter` | **MiniMax M2.7 long** | 180s timeout (отдельный namespace) |
| `briefing:author` | **MiniMax M2.7 long** | Автор утреннего брифинга |
| `briefing:section` | **MiniMax M2.7 long** | Per-section refresh |
| `briefing:podcast-script` | **MiniMax M2.7** | Сценарист подкаста |

### Meeting
| Задача | Модель |
|---|---|
| `meeting:summary` | **Claude Sonnet 4.6** |

### Сервисные чаты
| Задача | Модель |
|---|---|
| `service-chat:ben` | Claude Haiku 4.5 (Бен) |
| `service-chat:project-creation` | Claude Sonnet 4.6 |
| `service-chat:project-manager` | Claude Haiku 4.5 |
| `service-chat:briefing-onboarding` | Claude Sonnet 4.6 |

### Утилиты
| Задача | Модель | Применение |
|---|---|---|
| `util:title` | Claude Haiku 4.5 | Автонейминг нового чата |

### Генерация документов (артефакты)
Все 5 типов (`artifact:text`, `markdown`, `excel`, `pptx`, `reveal`) — **Claude Sonnet 4.6**.

### Vision
`vision:ocr` — Claude Haiku 4.5.

## Как сменить модель для задачи

1. Открыть [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts)
2. Найти строку с нужным `taskId`
3. Заменить id модели на другой из каталога (слой 3)
4. Готово — больше ничего править не надо.

## Dev Switchboard (временная подмена без правки кода)

Есть страница `/dev/models` (только в dev-режиме) — там можно переключить любую задачу на другую модель через UI. Сохраняется в файл [.simply-dev-overrides.json](.simply-dev-overrides.json) (в gitignore). Используется для экспериментов без редактирования кода. ADR: [docs/decisions/048-dev-switchboard-ui.md](docs/decisions/048-dev-switchboard-ui.md).

---

# Слой 3 — Каталог моделей

📁 **Файл:** [lib/ai/model-catalog.ts](lib/ai/model-catalog.ts)

Это «паспорт» каждой модели, которая в принципе доступна в Simply. Для каждой записи указано:

- **provider** — кто её делает (anthropic / minimax / xai / openrouter / google / perplexity / voyage / deepgram)
- **modelId** — физический id у провайдера (например, `claude-sonnet-4-6-20260101`)
- **displayName** — как отображается в UI
- **pricing в USD за 1M токенов** — сколько стоит input / output / кэш
- **capabilities** — что умеет:
  - `streaming` — потоковая выдача
  - `tools` — вызывать инструменты
  - `vision` — видеть картинки
  - `documentSupport` — умеет ли читать PDF (и как: inline или через Files API)
  - `thinking` — расширенное рассуждение
  - `embeddings` — строить векторные представления
  - `supportsCompaction` — поддерживает ли server-side сжатие контекста Anthropic (только Sonnet/Opus 4+)
- **contextWindow** — сколько токенов влезает за раз

## Ключевые решения

### Как выбирается contextWindow (ВАЖНО)
`contextWindow` для каждой модели задаётся **под рабочий бюджет качества, НЕ под провайдерский потолок**. Зафиксировано в ТЗ-XAI-1 (v3.88.0).

**Причина:** из-за эффекта «Lost in the Middle» (модели забывают середину длинного контекста) защита контекста через sliding window + Extract-on-compression остаётся основой **независимо** от размера провайдерского окна. Брать весь провайдерский потолок = деградировать качество.

### Pricing
Хранится в USD за 1M токенов. Конвертация в рубли делается в [lib/ai/providers.ts](lib/ai/providers.ts) через константу `RUB_PER_USD`.

### Non-LLM провайдеры
В каталоге также есть записи для:
- **Voyage AI** — embeddings для MIND памяти
- **Deepgram Nova-3** — транскрипция голоса (meeting recorder + диктовка)
- **Gemini 2.5 Flash TTS** — голоса подкаста (Kore + Iapetus)
- **Perplexity Sonar Pro / Deep** — deep research tool

Они не идут через главный registry, но нужны для трекинга стоимости.

## Workflow добавления модели
Смотри [docs/model-catalog-ops.md](docs/model-catalog-ops.md).

---

# Слой 4 — Параметры вызова модели

Это уже «как именно» модель отвечает: креативность, длина ответа, какие инструменты доступны, как сжимать контекст. Эти параметры живут прямо рядом с кодом, который вызывает модель.

## 4.1 Температура (креативность ответов)

**Температура** — это коэффициент «разброса» ответа. 0 = предсказуемый, 1.0 = креативный/непредсказуемый.

| Температура | Файл | Что делает |
|---|---|---|
| **1.0** | [app/(chat)/api/assistant/ben/route.ts](app/(chat)/api/assistant/ben/route.ts#L41) | Бен (живой разговор) |
| **1.0** | [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L396) | Чат Эксперта по задаче проекта |
| **0.7** | [lib/podcast/script-generator.ts](lib/podcast/script-generator.ts#L141) | Сценарий подкаста (креативно) |
| **0.7** | [lib/briefing/briefing-author.ts](lib/briefing/briefing-author.ts#L215) | Автор брифинга (читабельный текст) |
| **0.7** | [lib/briefing/briefing-section-author.ts](lib/briefing/briefing-section-author.ts#L193) | Per-section обновление брифинга |
| **0.3** | [lib/ai/memory/profile.ts](lib/ai/memory/profile.ts#L121) | Генерация нарративного профиля |
| **0.3** | [lib/meeting/meeting-pipeline.ts](lib/meeting/meeting-pipeline.ts#L96) | Суммаризация встречи (фактологично) |
| **0.2** | [app/(chat)/api/projects/[id]/plan/route.ts](app/(chat)/api/projects/[id]/plan/route.ts#L176) | Профессор планирования (строго) |
| **0.2** | [lib/ai/professors/task-reviewer.ts](lib/ai/professors/task-reviewer.ts#L140) | Профессор ревью (объективно) |
| **0.1** | [lib/briefing/briefing-filter.ts](lib/briefing/briefing-filter.ts#L122) | Фильтр новостей (почти детерминированно) |
| **0.1** | [app/(chat)/api/projects/[id]/analyze-file/route.ts](app/(chat)/api/projects/[id]/analyze-file/route.ts#L134) | Клерк-анализатор файлов |
| **0.1** | [lib/ai/memory/consolidate.ts](lib/ai/memory/consolidate.ts#L156) | Консолидация памяти MIND |
| **0.1** | [lib/ai/memory/extract.ts](lib/ai/memory/extract.ts#L139) | Извлечение фактов MIND |
| **0.1** | [lib/ai/clerks/task-summarizer.ts](lib/ai/clerks/task-summarizer.ts#L158) | Клерк-суммаризатор задач |

**Закономерность:**
- **1.0** — живой диалог (Бен, Эксперт в задаче)
- **0.7** — креативный текст (брифинг, подкаст)
- **0.2–0.3** — профессионально-аналитические задачи (планирование, ревью, встречи)
- **0.1** — факты и классификация (фильтры, память, резюме)

**Главного чата Simply Chat в списке нет** — там температура по умолчанию провайдера (обычно 1.0).

## 4.2 Лимиты длины ответа (maxOutputTokens) — SSOT

📁 **Файл:** [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts) — `DEFAULT_MAX_OUTPUT_TOKENS`
📁 **Getter:** [lib/ai/getModel.ts](lib/ai/getModel.ts) — `getMaxOutputTokensForTask(taskId)`

Сколько модель может выдать за один ответ. Единственное место настройки — `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` в `task-assignments.ts`. Каждый AI call site берёт cap через getter `getMaxOutputTokensForTask(taskId)`.

**Двухслойная safety-net в getter'e:**
1. `Math.min(requested, capability)` — защищает от смены default-модели при которой cap окажется выше capability (через `/dev/models` override или правку `DEFAULT_TASK_MODELS`). Runtime молча режет до capability, без крахов.
2. `warnOnce` при cap > 21333 на Anthropic — предупреждает dev'а что call site обязан использовать `streamText`/`streamObject` (иначе timeout-bomb, `UND_ERR_SOCKET`).

**Текущие значения (38 taskId):**

| Группа | TaskId | Cap |
|---|---|---|
| Simply Chat | `simply-chat` / `-think` / `-vision` | 8192 / 16000 / 4096 |
| Экспертиза и Создание | `expertise` / `create` / `expertise-multi-agent` | 16000 / 16000 / 16000 |
| Project expert (tier) | `project:expert:haiku` / `:sonnet` / `:opus` | 8192 / 16384 / 32000 |
| Professor pipeline | `planning` / `review` / `pipeline-analyze` / `-execute` / `-synthesize` | 32000 / 8192 / 4096 / 8192 / 16000 |
| Clerks | `clerk:task-summary` / `clerk:file-analyzer` | 2048 / 4096 |
| Memory | `memory:extract-batch` / `consolidate` / `deep-consolidate` / `profile` / `dedup-verify` | 16000 / 4096 / 8192 / 4096 / 512 |
| Briefing / Podcast | `filter` / `author` (dynamic) / `section` / `podcast-script` | 1024 / 8192 fallback / 8192 / 4096 |
| Meeting | `meeting:summary` | 8192 |
| Service chats | `ben` / `project-creation` / `project-manager` / `briefing-onboarding` | 4096 / 8192 / 4096 / 8192 |
| Утилиты | `util:title` | 64 |
| Artifacts | `artifact:text` / `markdown` / `excel` / `pptx` / `reveal` | 16384 / 16384 / 8192 / 16384 / 16384 |
| Vision | `vision:ocr` | 4096 |

**Инвариант:** каждое значение ≤ `maxOutput` default-модели этого taskId (см. [lib/ai/model-catalog.ts](lib/ai/model-catalog.ts)). 6 taskId на Grok reasoning (`simply-chat-think`, `expertise`, `expertise-multi-agent`, `create`, `professor:pipeline-synthesize`) + `memory:extract-batch` на Grok non-reasoning — все упёрты в потолок capability Grok = 16000.

**Особый случай `briefing:author`:** call site сохраняет dynamic `MAX_TOKENS_BY_VOLUME[volume]` (бизнес-логика объёма). Значение 8192 в SSOT = fallback + документация намерения.

**Архитектурное правило (ADR «AI SDK invocation contract»):** при cap > 21333 на Anthropic call site ОБЯЗАН использовать `streamText`/`streamObject` (threshold Anthropic SDK — иначе socket timeout). В проекте два таких taskId: `professor:planning` и `project:expert:opus` (оба 32000 на Opus). В финализации ТЗ-AISDKLayerHardening оба переведены/проверены на streaming.

## 4.3 Контекстный бюджет (сколько истории грузим в модель)

📁 **Файл:** [lib/ai/context-limits.ts](lib/ai/context-limits.ts)

Самый важный параметр по управлению стоимостью и качеством. Определяет, сколько прошлых сообщений подгружается при каждом запросе.

| Константа | Значение | Что делает |
|---|---|---|
| `SIMPLY_CONTEXT_LIMIT` | **200 000** | **Единая база всех % порогов** — Compaction, UI виджет, extract trigger |
| `COMPACTION_THRESHOLD_SOFT` | **0.5** (50%) | 100K — middleware запускает extract → compact cycle |
| `COMPACTION_THRESHOLD_HARD` | **0.85** (85%) | 170K — observability-only (различение `action=compact` vs `action=truncate` в логах) |
| `COMPACTION_VERBATIM_WINDOW_TOKENS` | **40 000** | Сколько токенов истории остаётся дословно после сжатия |
| `COMPACTION_SUMMARY_TARGET_TOKENS` | **3 000** | Target размер summary в промпте (hard cap 4096 в `task-assignments`) |
| `SNAPSHOT_THRESHOLD` | **0.7** (70%) | Legacy от Snapshot tool — к compaction отношения не имеет |
| `FALLBACK_MESSAGE_PAIRS` | **5** | Legacy от Snapshot tool |

> Константы `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT/HARD`, `EXTRACT_PAUSE_MS` **удалены** в ТЗ-COMPACTION-UNIFY (v3.95.0). Extract теперь запускается только внутри compaction cycle — отдельного threshold нет. См. [ADR 054](../../docs/decisions/054-single-strategy-compaction.md).

## 4.4 Инструменты (tools) per режим чата

📁 **Файл:** [lib/ai/chat-mode-config.ts](lib/ai/chat-mode-config.ts)

Определяет, какие инструменты доступны в каждом режиме чата.

| Режим | Display | Tools |
|---|---|---|
| `simply` | Simply | `null` (отключены на уровне маршрута для MiniMax/Gemini — доступны при «Думать» → Sonnet) |
| `expertise` | Экспертиза | все стандартные (включая `deepResearch`) |
| `create` | Создание | все стандартные (включая `deepResearch`) |

**Стандартный набор tools:** определяется в [lib/ai/tools/chat-tools.ts](lib/ai/tools/chat-tools.ts) — функция `getStandardTools()`. Включает: web search, fetchUrl, deepResearch, createTextDocument, createSpreadsheet, createPresentation и т.д.

**Нюанс Simply Chat:**
- Текст → MiniMax → 12 инструментов (без `deepResearch` — он дорогой)
- «Думать» → Claude Sonnet → все 14 инструментов (включая `deepResearch`)
- Фото/PDF → Claude Haiku → vision-обработка

Логика маршрутизации: [app/(chat)/api/chat/route.ts:598](app/(chat)/api/chat/route.ts#L598).

## 4.5 Конфигурация tool activity (UX индикаторы)

📁 **Файл:** [lib/ai/tool-activity-config.ts](lib/ai/tool-activity-config.ts)

Определяет как отображается прогресс инструментов в UI (иконка, подписи «активен/готово», форматирование аргументов и результата). Это чисто UX-уровень, но тоже влияет на поведение продукта.

## 4.6 Retry и observability

📁 **Файлы:**
- [lib/ai/retry-with-logging.ts](lib/ai/retry-with-logging.ts) — retry pipeline-вызовов (замена скрытого SDK retry)
- [lib/ai/usage-utils.ts](lib/ai/usage-utils.ts) — логирование расхода токенов
- [lib/ai/debug-events.ts](lib/ai/debug-events.ts) — события для DevPanel

## 4.7 Guardian против галлюцинаций инструментов

📁 **Файл:** [lib/ai/tool-call-guardian.ts](lib/ai/tool-call-guardian.ts)

Детектирует, когда модель «притворяется», что вызвала инструмент, хотя на самом деле не вызвала. Паттерны и правила блокировки — тут.

---

# Куда идти при типовых задачах

| Хочу изменить | Слой | Файл |
|---|---|---|
| Общий тон Simply | 1 | [core/base.md](lib/prompts/core/base.md) |
| Как оформляются ответы (markdown, списки) | 1 | [core/formatting.md](lib/prompts/core/formatting.md) |
| Поведение Simply Chat | 1 | [chat/simply-chat.md](lib/prompts/chat/simply-chat.md) |
| Качество планов в проектах | 1 | [professors/planning.md](lib/prompts/professors/planning.md) |
| Диалог внутри задачи проекта | 1 | [experts/task-expert.md](lib/prompts/experts/task-expert.md) |
| Стиль утреннего брифинга | 1 | [briefing/briefing-author.md](lib/prompts/briefing/briefing-author.md) |
| Что AI запоминает в MIND | 1 | [memory/extract-batch.md](lib/prompts/memory/extract-batch.md) |
| Как звучит подкаст | 1 | [briefing/briefing-scriptwriter.md](lib/prompts/briefing/briefing-scriptwriter.md) |
| Сменить модель для любой задачи | 2 | [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts) |
| Добавить новую модель в систему | 3 | [lib/ai/model-catalog.ts](lib/ai/model-catalog.ts) |
| Сделать брифинг креативнее/строже | 4 | [lib/briefing/briefing-author.ts:215](lib/briefing/briefing-author.ts#L215) (температура) |
| Сделать планирование проекта жёстче | 4 | [app/(chat)/api/projects/[id]/plan/route.ts:176](app/(chat)/api/projects/[id]/plan/route.ts#L176) (температура) |
| Увеличить/сократить длину резюме встречи | 4 | [lib/meeting/meeting-pipeline.ts:97](lib/meeting/meeting-pipeline.ts#L97) (maxOutputTokens) |
| Изменить порог для MIND extraction | 4 | [lib/ai/context-limits.ts](lib/ai/context-limits.ts) |
| Изменить, какие tools доступны в Simply | 4 | [app/(chat)/api/chat/route.ts:598](app/(chat)/api/chat/route.ts#L598) + [lib/ai/tools/chat-tools.ts](lib/ai/tools/chat-tools.ts) |
| Временно поэкспериментировать с моделью | — | Dev Switchboard: `/dev/models` в браузере |

---

# Вспомогательные документы

- **Карта всех чатов и моделей (SSOT):** [docs/ai-chats-map.md](docs/ai-chats-map.md)
- **Провайдеры, модели, цены:** [docs/ai-providers.md](docs/ai-providers.md)
- **Workflow аудита каталога:** [docs/model-catalog-ops.md](docs/model-catalog-ops.md)
- **MiniMax M2.7 — детали интеграции:** [docs/ai-minimax.md](docs/ai-minimax.md)
- **ADR по Dev Switchboard:** [docs/decisions/048-dev-switchboard-ui.md](docs/decisions/048-dev-switchboard-ui.md)
- **ADR по Context Management:** [docs/decisions/047-core-model-registry.md](docs/decisions/047-core-model-registry.md)

---

**Главное правило:** не правь четыре слоя одновременно. Сначала пойми, что именно ты хочешь изменить — поведение (слой 1), исполнителя (слой 2), ассортимент (слой 3) или параметры отклика (слой 4). Каждый слой изолирован, и в 90% случаев правка живёт в одном месте.
