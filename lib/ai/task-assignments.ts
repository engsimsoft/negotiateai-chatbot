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
  | "simply-chat-think"     // кнопка «Думать» = tier upgrade → Grok 4.20 (non-reasoning)
  | "simply-chat-vision"    // attachments (image/pdf) → Claude Haiku 4.5
  // Экспертиза и Создание — разовые ветки (ТЗ-LegacyChatCleanup)
  | "expertise"             // chatMode=expertise → Grok 4.20 Multi-Agent
  | "create"                // chatMode=create → MiniMax M2.7
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
  // Simply Chat (ТЗ-XAI-3 2026-04-15)
  // simply-chat — дворецкий KITT на Grok 4.1 Fast non-reasoning (быстро, дёшево,
  // не тратит токены на reasoning overhead). Кнопка «Думать» = продуктовая
  // метафора «используй умную модель» — tier upgrade на Grok 4.20 non-reasoning
  // ($2/$6 vs $0.20/$0.50, ×10 дороже input, заметно сильнее). Variant
  // reasoning/non-reasoning для Think — стартовая точка, переключается через
  // /dev/models без коммита. Vision остаётся на Haiku — проверенное решение,
  // Claude vision конкурентен Grok'овскому, один провайдер уже в проекте (Opus).
  "simply-chat":              "grok-4-1-fast-non-reasoning",
  "simply-chat-think":        "grok-4.20-0309-non-reasoning",
  "simply-chat-vision":       "claude-haiku-4-5-20251001",

  // Экспертиза и Создание (ТЗ-LegacyChatCleanup)
  "expertise":                "grok-4.20-multi-agent-0309",
  "create":                   "MiniMax-M2.7",

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

  // Клерки
  "clerk:task-summary":       "claude-haiku-4-5-20251001",
  "clerk:snapshot":           "claude-haiku-4-5-20251001",
  "clerk:file-analyzer":      "claude-haiku-4-5-20251001",

  // Memory (ТЗ-XAI-2 2026-04-14)
  // memory:extract — mission-critical задача извлечения фактов из диалогов.
  // Оставлена на сильной модели Grok 4.20 (non-reasoning variant — задача
  // структурированная Zod-схемой, reasoning tokens не нужны). Остальные 4
  // memory-задачи — механические (batch, dedup, consolidate, profile), им
  // достаточно рабочей лошадки Grok 4.1 Fast. Любой defaults можно
  // переключить через /dev/models dev switchboard без правки кода — это
  // стартовые точки, не финальный выбор.
  "memory:extract":           "grok-4.20-0309-non-reasoning",
  "memory:extract-batch":     "grok-4-1-fast-non-reasoning",
  "memory:consolidate":       "grok-4-1-fast-non-reasoning",
  "memory:profile":           "grok-4-1-fast-non-reasoning",
  "memory:dedup-verify":      "grok-4-1-fast-non-reasoning",

  // Briefing (MiniMax long timeout — алиас указывает на ту же физическую модель,
  // но через отдельный provider namespace с 180s fetch timeout)
  "briefing:filter":          "MiniMax-M2.7-long",
  "briefing:author":          "MiniMax-M2.7-long",
  "briefing:section":         "MiniMax-M2.7-long",
  "briefing:podcast-script":  "MiniMax-M2.7",

  // Meeting
  "meeting:summary":          "claude-sonnet-4-6",

  // Service chats — defaults mirror service-chat/route.ts getModelId() + ben/route.ts
  "service-chat:ben":                 "claude-haiku-4-5-20251001",
  "service-chat:project-creation":    "claude-sonnet-4-6",
  "service-chat:project-manager":     "claude-haiku-4-5-20251001",
  "service-chat:briefing-onboarding": "claude-sonnet-4-6",

  // Утилиты
  "util:title":                 "claude-haiku-4-5-20251001",
  "util:project-summary":       "claude-haiku-4-5-20251001",
  "util:artifact-suggestions":  "claude-sonnet-4-6",

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
