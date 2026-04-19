/**
 * Task Assignments — маппинг задач на модели (ТЗ-1 CoreRegistry)
 *
 * Единственное место в приложении, где фиксируется выбор модели для
 * конкретной задачи. Любая AI-точка через getModel(taskId) получает
 * модель отсюда.
 *
 * Изменение default-модели = одна строка в этом файле.
 *
 * Конвенция taskId — иерархический разделитель `:`. Семантика:
 *  - simply-chat*        — Simply Chat (MiniMax / Sonnet / Haiku vision)
 *  - expertise           — ветка «Экспертиза» (разовые экспертные запросы)
 *  - create              — ветка «Создание» (разовые задания на создание)
 *  - project:expert:*    — чат эксперта по задаче проекта (tier)
 *  - professor:*         — фазы planning/review/pipeline
 *  - clerk:*             — вспомогательные клерки (task summary, snapshot, file analyze)
 *  - memory:*            — RAG pipelines (extract / consolidate / profile)
 *  - briefing:*          — генерация брифинга и подкаста
 *  - meeting:*           — транскрипция и суммаризация встреч
 *  - service-chat:*      — сервисные чаты (ben, project-creation и т.д.)
 *  - util:*              — мелкие утилитарные вызовы (title, summary, suggestions)
 *  - vision:ocr          — OCR-экстракция текста из изображений
 */

export type TaskId =
  // Simply Chat (основной чат продукта)
  | "simply-chat"           // default text → Grok 4.1 Fast (non-reasoning)
  | "simply-chat-think"     // кнопка «Думать» = tier upgrade → Grok 4.20 (reasoning)
  | "simply-chat-vision"    // attachments (image/pdf) → Claude Haiku 4.5
  // Экспертиза и Создание — разовые ветки
  | "expertise"             // chatMode=expertise → Grok 4.20 (reasoning)
  | "expertise-multi-agent" // RESERVED для ТЗ-XAI-MA-1 (Premium «Команда агентов»)
  | "create"                // chatMode=create → Grok 4.20 (reasoning)
  // Проект — экспертный чат по задаче
  | "project:expert:haiku"
  | "project:expert:sonnet"
  | "project:expert:opus"
  // Профессорский pipeline
  | "professor:planning"
  | "professor:review"
  | "professor:pipeline-analyze"
  | "professor:pipeline-execute"
  | "professor:pipeline-synthesize"
  // Клерки
  | "clerk:task-summary"
  | "clerk:file-analyzer"
  // Memory (MIND / RAG)
  | "memory:extract"          // per-message extraction (Claude Sonnet, generateObject)
  | "memory:extract-batch"    // batch extraction (MiniMax M2.7)
  | "memory:consolidate"      // event-triggered consolidation
  | "memory:profile"          // nightly narrative profile
  | "memory:dedup-verify"     // Haiku LLM verify для двухуровневой дедупликации
  // Compaction (Simply Compaction MVP — ТЗ-COMPACTION-1)
  | "compaction:summarize"    // сжатие истории чата в 5-секционное summary (Grok 4.1 Fast non-reasoning)
  // Briefing + Podcast
  | "briefing:filter"
  | "briefing:author"
  | "briefing:section"
  | "briefing:podcast-script"
  // Meeting
  | "meeting:summary"
  // Service chats
  | "service-chat:ben"
  | "service-chat:project-creation"
  | "service-chat:project-manager"
  | "service-chat:briefing-onboarding"
  // Утилиты
  | "util:title"                 // автонейминг чата
  // Artifact generation (document handlers)
  | "artifact:text"
  | "artifact:markdown"
  | "artifact:excel"
  | "artifact:pptx"
  | "artifact:reveal"
  // Vision
  | "vision:ocr";

/**
 * Маппинг taskId → catalog id (physical or alias).
 *
 * Модели берутся из `model-catalog.ts`. Changing default model for a task =
 * change one line here. Nothing else in the app needs updating.
 */
export const DEFAULT_TASK_MODELS: Record<TaskId, string> = {
  // Simply Chat (ТЗ-XAI-4 2026-04-16)
  // simply-chat — дворецкий KITT на Grok 4.1 Fast non-reasoning (быстро, дёшево,
  // не тратит токены на reasoning overhead). Кнопка «Думать» = продуктовая
  // метафора «используй умную модель» — tier upgrade на Grok 4.20 reasoning
  // ($2/$6 vs $0.20/$0.50). У grok-4.20 reasoning включён автоматически,
  // параметр reasoning_effort передавать нельзя. Vision остаётся на Haiku —
  // проверенное решение, Claude vision конкурентен Grok'овскому, один провайдер
  // уже в проекте (Opus).
  "simply-chat":              "grok-4-1-fast-non-reasoning",
  "simply-chat-think":        "grok-4.20-0309-reasoning",
  "simply-chat-vision":       "claude-haiku-4-5-20251001",

  // Экспертиза и Создание (ТЗ-XAI-4 2026-04-16)
  // Обе ветки переведены на Grok 4.20 reasoning — это «зал», пользователь видит
  // результат в реальном времени, качество важнее экономии. Multi-agent variant
  // снят с обычной expertise: через Chat Completions он работает как обычный
  // grok-4.20 (built-in tools игнорируют наши function calls). MiniMax снят
  // с create — остаётся только в «кухне» (briefing pipeline).
  "expertise":                "grok-4.20-0309-reasoning",

  // ---- expertise-multi-agent: RESERVED placeholder — НЕ вызывать ----
  // Premium-режим «Команда агентов» рядом с обычной expertise (toggle в UI по
  // паттерну кнопки «Думать»). Через Responses API + MCP сервер для наших
  // tools — multi-agent variant физически не работает через Chat Completions.
  // Реализация — отдельный ТЗ-XAI-MA-1: MCP сервер, auth layer, observability
  // адаптер, UI прогресса агентов. Полное обоснование — BRAINSTORM_GrokMultiAgent.md.
  // Запись существует чтобы зарезервировать имя taskId в SSOT и предотвратить
  // случайное переиспользование. На сегодня call sites нет — `getModel("expertise-multi-agent")`
  // зарезолвится в каталог, но никто не вызывает.
  "expertise-multi-agent":    "grok-4.20-multi-agent-0309",

  "create":                   "grok-4.20-0309-reasoning",

  // Проект — экспертный чат (tier)
  "project:expert:haiku":     "claude-haiku-4-5-20251001",
  "project:expert:sonnet":    "claude-sonnet-4-6",
  "project:expert:opus":      "claude-opus-4-6",

  // Профессор (v3.92.2, 2026-04-16)
  // Post-серия tweak: 4 точки переведены на Grok по философии «4 роли».
  // Остались на Opus (Автор): planning (mission-critical план всего проекта)
  // и project:expert:opus (tier choice пользователя). Review/analyze/synthesize
  // переведены в Зал (Grok 4.20 reasoning) — empirical test planning на
  // Grok 4.20 non-reasoning в ТЗ-XAI-4 подтвердил способность модели.
  // Execute переведён в Подсобку (Grok 4.1 Fast) по прецеденту clerk:task-summary
  // и clerk:file-analyzer — механическая работа subtask executor, не мыслителя.
  "professor:planning":              "claude-opus-4-6",              // Автор
  "professor:review":                "grok-4.20-0309-reasoning",     // Зал
  "professor:pipeline-analyze":      "grok-4.20-0309-reasoning",     // Зал
  "professor:pipeline-execute":      "grok-4-1-fast-non-reasoning",  // Подсобка
  "professor:pipeline-synthesize":   "grok-4.20-0309-reasoning",     // Зал

  // Клерки (ТЗ-XAI-4 2026-04-16)
  // task-summary и file-analyzer переведены с Haiku 4.5 на Grok 4.1 Fast — обе
  // задачи механические (суммаризация завершённой задачи + анализ загруженного
  // файла), используют generateText + JSON.parse + Zod workaround паттерн.
  // Ценовая экономия ~4× input / ~8× output по сравнению с Haiku.
  // clerk:snapshot placeholder удалён в ТЗ-XAI-6 финализации серии (2026-04-16,
  // v3.92.1) — snapshot-creator.ts был удалён ещё в ADR 052, taskId остался
  // висеть без call sites, мёртвая запись убрана окончательно.
  "clerk:task-summary":       "grok-4-1-fast-non-reasoning",
  "clerk:file-analyzer":      "grok-4-1-fast-non-reasoning",

  // Memory (ТЗ-XAI-4 2026-04-16)
  // memory:extract — mission-critical задача извлечения фактов из диалогов,
  // единственный MIND-вызов на сильной модели Grok 4.20 (reasoning variant —
  // нужен интеллект для извлечения фактов из произвольного диалога). Остальные
  // 4 memory-задачи — механические (batch, dedup, consolidate, profile), им
  // достаточно рабочей лошадки Grok 4.1 Fast. Любой default можно переключить
  // через /dev/models dev switchboard без правки кода.
  "memory:extract":           "grok-4.20-0309-reasoning",
  "memory:extract-batch":     "grok-4-1-fast-non-reasoning",
  "memory:consolidate":       "grok-4-1-fast-non-reasoning",
  "memory:profile":           "grok-4-1-fast-non-reasoning",
  "memory:dedup-verify":      "grok-4-1-fast-non-reasoning",

  // Compaction (ТЗ-COMPACTION-1, 2026-04-18) — Simply Compaction MVP.
  // «Подсобка»: роль summarizer истории чата (expertise/create при usage ≥50%
  // от SIMPLY_CONTEXT_LIMIT). Grok 4.1 Fast non-reasoning — дешёвый, быстрый,
  // структурированный вывод проверен в MIND extract (ТЗ-XAI-2). Архитектура:
  // specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md §Модель для сжатия.
  "compaction:summarize":     "grok-4-1-fast-non-reasoning",

  // Briefing (ТЗ-XAI-4 2026-04-16)
  // briefing:filter — механическая фильтрация/дедупликация новостей из потока —
  // переведён с MiniMax M2.7-long на Grok 4.1 Fast (подсобка). Остальные три
  // точки (author / section / podcast-script) остаются на MiniMax M2.7 —
  // работают, проверены, в ~5× дешевле Grok 4.20 для длинных кухонных задач
  // без пользовательского взаимодействия. author / section используют
  // minimaxLong namespace (180s fetch timeout для больших промптов).
  "briefing:filter":          "grok-4-1-fast-non-reasoning",
  "briefing:author":          "MiniMax-M2.7-long",
  "briefing:section":         "MiniMax-M2.7-long",
  "briefing:podcast-script":  "MiniMax-M2.7",

  // Meeting (ТЗ-XAI-4 2026-04-16)
  // Длинные транскрипты встреч → нужна качественная суммаризация. Переведён
  // с Sonnet 4.6 на Grok 4.20 reasoning. Это «зал» — результат показывается
  // пользователю как итоговый артефакт встречи.
  "meeting:summary":          "grok-4.20-0309-reasoning",

  // Service chats — defaults mirror service-chat/route.ts getModelId() + ben/route.ts
  "service-chat:ben":                 "claude-haiku-4-5-20251001",
  "service-chat:project-creation":    "claude-sonnet-4-6",
  "service-chat:project-manager":     "claude-haiku-4-5-20251001",
  "service-chat:briefing-onboarding": "claude-sonnet-4-6",

  // Утилиты (ТЗ-XAI-4 2026-04-16)
  // Короткая механическая задача (автонейминг чата). Переведена с Haiku на
  // Grok 4.1 Fast. Подробности в SIMPLY_XAI_NOTES.md запись 2026-04-16.
  "util:title":                 "grok-4-1-fast-non-reasoning",

  // Artifact generation — все 5 типов используют Sonnet
  "artifact:text":              "claude-sonnet-4-6",
  "artifact:markdown":          "claude-sonnet-4-6",
  "artifact:excel":             "claude-sonnet-4-6",
  "artifact:pptx":              "claude-sonnet-4-6",
  "artifact:reveal":            "claude-sonnet-4-6",

  // Vision
  "vision:ocr":               "claude-haiku-4-5-20251001",
};

/** Все известные taskId. */
export const ALL_TASK_IDS = Object.keys(DEFAULT_TASK_MODELS) as TaskId[];

/**
 * Default maxOutputTokens per task — SSOT для `maxOutputTokens` параметра
 * AI SDK вызовов (generateText / streamText / generateObject / streamObject).
 *
 * ТЗ-AISDKLayerHardening (2026-04-18): раньше cap задавался явно в каждом
 * call site (неконсистентно) или не задавался вовсе (неявный default SDK =
 * `Infinity` → runaway risk + timeout-bomb на Anthropic > 21333). Теперь
 * каждый call site обязан получать cap через `getMaxOutputTokensForTask()`.
 *
 * Инвариант: каждое значение ≤ `maxOutput` default-модели этого taskId
 * (см. lib/ai/model-catalog.ts). Runtime safety-net в `getMaxOutputTokensForTask`
 * дополнительно делает `Math.min(requested, capability)` — защита при смене
 * default-модели через /dev/models override или правку DEFAULT_TASK_MODELS.
 *
 * При cap > 21333 на Anthropic call site ОБЯЗАН использовать `streamText` /
 * `streamObject` (threshold SDK, иначе `UND_ERR_SOCKET`). Getter логирует
 * warning для dev'а.
 *
 * Изменение cap для задачи = одна правка здесь. TypeScript `Record<TaskId, number>`
 * гарантирует что при добавлении нового TaskId компиляция падает без записи.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number> = {
  // Simply Chat
  "simply-chat":              8192,   // Grok 4.1 Fast, типичные ответы 1-4K.
  "simply-chat-think":        16000,  // Grok 4.20 reasoning — потолок capability Grok.
  "simply-chat-vision":       4096,   // Haiku vision, OCR + summary.

  // Экспертиза / Создание / Multi-agent
  "expertise":                16000,  // Grok 4.20 reasoning — потолок capability Grok.
  "expertise-multi-agent":    16000,  // RESERVED placeholder, потолок capability Grok multi-agent.
  "create":                   16000,  // Grok 4.20 reasoning — потолок capability Grok.

  // Project expert chat (tier)
  "project:expert:haiku":     8192,   // Haiku tier — лёгкие вопросы.
  "project:expert:sonnet":    16384,  // Sonnet tier — средняя глубина.
  "project:expert:opus":      32000,  // Opus tier, streamText обязателен (>21333).

  // Professor pipeline
  "professor:planning":              32000,  // Opus 4.6 adaptive thinking, streamText (Этап 3).
  "professor:review":                8192,   // Analysis text.
  "professor:pipeline-analyze":      4096,   // Короткий JSON subtasks.
  "professor:pipeline-execute":      8192,   // Работа над одной subtask.
  "professor:pipeline-synthesize":   16000,  // Grok 4.20 reasoning — потолок capability Grok.

  // Clerks
  "clerk:task-summary":       2048,   // Короткий multiline summary.
  "clerk:file-analyzer":      4096,   // JSON-анализ файла.

  // Memory (MIND / RAG)
  "memory:extract":           4096,   // per-message facts, MAX_FACTS_PER_EXTRACTION=10.
  "memory:extract-batch":     16000,  // batch extraction, MAX_BATCH_FACTS=30 × ~500 = ~15K, потолок Grok 4.1 Fast.
  "memory:consolidate":       4096,   // JSON консолидация.
  "memory:profile":           4096,   // Narrative profile JSON.
  "memory:dedup-verify":      512,    // Haiku дедуп-верификация, крошечный ответ.

  // Compaction (ТЗ-COMPACTION-1)
  // Hard cap 4096 для 5-секционного summary (target 3000 в промпте, буфер на
  // структурный overhead Zod schema). См. SIMPLY_COMPACTION_ARCHITECTURE.md
  // §Обоснование размера summary.
  "compaction:summarize":     4096,

  // Briefing / Podcast
  "briefing:filter":          1024,   // JSON список IDs.
  "briefing:author":          8192,   // Особый случай: call site сохраняет dynamic MAX_TOKENS_BY_VOLUME, это значение = fallback + документация.
  "briefing:section":         8192,
  "briefing:podcast-script":  4096,

  // Meeting
  "meeting:summary":          8192,

  // Service chats
  "service-chat:ben":                 4096,
  "service-chat:project-creation":    8192,
  "service-chat:project-manager":     4096,
  "service-chat:briefing-onboarding": 8192,

  // Утилиты
  "util:title":               512,    // ТЗ-COMPACTION-1 fix #3: было 64, обрывало JSON {title,summary}
                                      // на середине строки в русском (NoObjectGeneratedError). 512 даёт
                                      // 4x запас под русский структурированный output, billing cap не cost.

  // Artifacts (document handlers, все на Sonnet capability 64K)
  "artifact:text":            16384,
  "artifact:markdown":        16384,
  "artifact:excel":           8192,
  "artifact:pptx":            16384,
  "artifact:reveal":          16384,

  // Vision
  "vision:ocr":               4096,   // Haiku non-streaming, cap критичен (capability 64K = timeout-bomb иначе).
};
