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
  | "clerk:snapshot"
  | "clerk:file-analyzer"
  // Memory (MIND / RAG)
  | "memory:extract"          // per-message extraction (Claude Sonnet, generateObject)
  | "memory:extract-batch"    // batch extraction (MiniMax M2.7)
  | "memory:consolidate"      // event-triggered consolidation
  | "memory:profile"          // nightly narrative profile
  | "memory:dedup-verify"     // Haiku LLM verify для двухуровневой дедупликации
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
  | "util:project-summary"       // суммаризация проекта
  | "util:artifact-suggestions"  // request-suggestions tool
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
  // снят с expertise: через Chat Completions он работает как обычный grok-4.20
  // (built-in tools игнорируют наши function calls). Multi-agent через Responses
  // API + MCP — отдельная ветка ТЗ-XAI-MA-1. MiniMax снят с create — остаётся
  // только в «кухне» (briefing pipeline).
  "expertise":                "grok-4.20-0309-reasoning",
  "create":                   "grok-4.20-0309-reasoning",

  // Проект — экспертный чат (tier)
  "project:expert:haiku":     "claude-haiku-4-5-20251001",
  "project:expert:sonnet":    "claude-sonnet-4-6",
  "project:expert:opus":      "claude-opus-4-6",

  // Профессор
  "professor:planning":              "claude-opus-4-6",
  "professor:review":                "claude-opus-4-6",
  "professor:pipeline-analyze":      "claude-opus-4-6",
  "professor:pipeline-execute":      "claude-haiku-4-5-20251001",
  "professor:pipeline-synthesize":   "claude-opus-4-6",

  // Клерки (ТЗ-XAI-4 2026-04-16)
  // task-summary и file-analyzer переведены с Haiku 4.5 на Grok 4.1 Fast — обе
  // задачи механические (суммаризация завершённой задачи + анализ загруженного
  // файла), используют generateText + JSON.parse + Zod workaround паттерн.
  // Ценовая экономия ~4× input / ~8× output по сравнению с Haiku.
  // clerk:snapshot остаётся на Haiku как мёртвый код per ADR 052 — удалится
  // в ТЗ-XAI-6 cleanup.
  "clerk:task-summary":       "grok-4-1-fast-non-reasoning",
  "clerk:snapshot":           "claude-haiku-4-5-20251001",
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
  // Все три — короткие механические задачи (автонейминг чата, summary проекта,
  // предложения правок к документу). Переведены с Haiku/Sonnet на Grok 4.1 Fast.
  // util:artifact-suggestions использует streamObject с output:"array" +
  // Zod schema — проверено smoke test'ом на Grok 4.1 Fast через AI SDK v6
  // xAI provider. Подробности в SIMPLY_XAI_NOTES.md запись 2026-04-16.
  "util:title":                 "grok-4-1-fast-non-reasoning",
  "util:project-summary":       "grok-4-1-fast-non-reasoning",
  "util:artifact-suggestions":  "grok-4-1-fast-non-reasoning",

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
