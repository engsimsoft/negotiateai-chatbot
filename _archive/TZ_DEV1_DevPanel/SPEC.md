# ТЗ-DEV1: Developer Panel (AI Observability)

**Автор:** Claude Code (на основе обсуждения с пользователем)
**Дата:** 2026-02-28
**Версия проекта:** 3.56.0 → 3.57.0
**Приоритет:** Высокий (инфраструктура для отладки)

---

## 1. Контекст и проблема

### Текущая ситуация

В Simply реализован упрощённый DEV-режим:
- **[DEV] badge в тексте сообщения** — модель добавляет строку `[DEV] chat | Haiku | Simply Chat | ничего` в начало каждого ответа через prompt injection (`dev-mode-inject.ts` + `dev-mode.md`)
- **Model badge под аватаром** — показывает название модели (Haiku/Sonnet) через `data-model-info` event (только в `NODE_ENV=development`)
- **Tool Activity Indicator** — показывает активный инструмент (спиннер + название) — работает для всех пользователей

### Проблемы

1. **Слепая отладка** — Tool Call Guardian ловит галлюцинации, но результаты видны только в терминале. При отладке брифинга приходилось постоянно переключаться в терминал, чтобы понять: выполнился tool или нет, какие аргументы были, что Guardian заблокировал.

2. **Разрозненность** — информация о модели (в тексте), о tools (в индикаторе), о Guardian (в терминале), о токенах (нигде в UI) — в разных местах или вообще недоступна.

3. **Дублирование** — [DEV] badge в тексте и model badge под аватаром показывают частично пересекающуюся информацию разными способами.

4. **Нет метрик** — токены, стоимость, тайминги, cache hit rate не отображаются нигде в UI.

5. **Готовность к экспертному режиму** — следующий этап продукта предполагает серьёзные настройки (режим Эксперт). Для их отладки нужен профессиональный инструмент.

### Решение

Создать **Developer Panel** — единую изолированную панель для разработки, которая:
- Показывает ВСЮ отладочную информацию в одном месте
- Работает ТОЛЬКО в dev-режиме (`SIMPLY_DEV_MODE=true`)
- Не рендерится вообще в production (tree-shaking)
- Заменяет текущие разрозненные dev-инструменты

---

## 2. Что удаляем (консолидация)

| Компонент | Файл(ы) | Что делаем |
|-----------|---------|-----------|
| **[DEV] badge в тексте** | `lib/prompts/builder/dev-mode-inject.ts`, `lib/prompts/core/dev-mode.md` | **Удаляем полностью** — промпт-инъекция больше не нужна |
| **Model badge под аватаром** | `components/message.tsx` (devModelName useMemo + рендер) | **Удаляем** — модель показывается в DevPanel |
| **`data-model-info` event** | `app/(chat)/api/service-chat/route.ts` | **Заменяем** на унифицированный `data-debug-step` event |
| Вызовы `injectDevMode()` | `composer.ts`, `service-chat/route.ts`, `tasks/[taskId]/chat/route.ts` | **Удаляем** вызовы (функция не нужна) |

**Что НЕ трогаем:**
- `SIMPLY_DEV_MODE` env variable — остаётся как механизм активации
- `isSimplyDevMode` constant — остаётся
- **Tool Activity Indicator** — остаётся как user-facing (Level 1) для всех пользователей
- **Tool Call Guardian** — остаётся, но дополнительно отправляет данные в DevPanel
- `experimental_telemetry` — остаётся (отдельная серверная concern)

---

## 3. Архитектура

### 3.1 Data Flow

```
Server (route.ts)                          Client (React)
─────────────────                          ──────────────

onStepFinish() ─┐
  usage          │
  toolCalls      │──→ data-debug-step ──→  DevPanel Context
  toolResults    │    (transient event)     │
  response       │                         ├─ DevPanelFooter (per message)
  timing         │                         │   "Sonnet 4.6 · 3,359 tok · ₽0.84"
                 │                         │
onFinish() ─────┤                         └─ DevPanelDrawer (click to expand)
  totalUsage     │──→ data-debug-finish       ├─ Model & Routing
  steps          │    (transient event)       ├─ Tokens & Cost
                 │                            ├─ Timeline (steps)
Guardian ───────┤                            ├─ Guardian Status
  detected       │──→ data-debug-guardian     ├─ System Prompt
  confidence     │    (transient event)       └─ Raw Details
  details        │
```

### 3.2 Transient Data Events

Все debug events — **transient** (`transient: true`), не сохраняются в историю сообщений.

#### `data-debug-step` (per step)

```typescript
type DebugStepEvent = {
  type: 'data-debug-step';
  data: {
    stepIndex: number;
    stepType: 'initial' | 'continue' | 'tool-result';
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    reasoningTokens: number;
    finishReason: string;
    toolCalls: Array<{
      toolName: string;
      args: Record<string, unknown>;
      duration?: number;
    }>;
    toolResults: Array<{
      toolName: string;
      result: unknown;  // truncated to ~500 chars for display
    }>;
    durationMs: number;  // step duration
    timestamp: number;
  };
  transient: true;
};
```

#### `data-debug-finish` (per message, on completion)

```typescript
type DebugFinishEvent = {
  type: 'data-debug-finish';
  data: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    totalReasoningTokens: number;
    totalSteps: number;
    totalDurationMs: number;
    timeToFirstToken: number;
    estimatedCostRub: number;  // calculated from model pricing
    modelId: string;
    finishReason: string;
    contextWindowPercent: number;  // % of context used
  };
  transient: true;
};
```

#### `data-debug-guardian` (per step, if Guardian detects something)

```typescript
type DebugGuardianEvent = {
  type: 'data-debug-guardian';
  data: {
    stepIndex: number;
    detected: boolean;
    confidence: number;
    action: 'clean' | 'blocked' | 'warning' | 'bypassed';
    details: Array<{
      toolMentioned: string;
      pattern: string;
      snippet: string;
    }>;
  };
  transient: true;
};
```

#### `data-debug-prompt` (once per message, if panel is expanded)

```typescript
type DebugPromptEvent = {
  type: 'data-debug-prompt';
  data: {
    systemPromptPreview: string;   // first 500 chars
    systemPromptTokens: number;
    historyTokens: number;
    activeSkills: string[];
    activeAgent: string;
    chatMode: string;
    contextInjections: string[];   // e.g. "user-profile", "chat-memory"
  };
  transient: true;
};
```

### 3.3 UI Components

```
components/dev-panel/
├── dev-panel-provider.tsx    — React Context (собирает events, хранит state)
├── dev-panel-footer.tsx      — Компактная строка под сообщением
├── dev-panel-drawer.tsx      — Выдвижная панель справа (полные детали)
├── sections/
│   ├── model-section.tsx     — Модель и роутинг
│   ├── tokens-section.tsx    — Токены, стоимость, кэш
│   ├── timeline-section.tsx  — Пошаговый timeline (waterfall)
│   ├── guardian-section.tsx   — Статус Guardian
│   ├── prompt-section.tsx    — System prompt (collapsible)
│   └── raw-section.tsx       — Raw tool call data (JSON)
└── index.ts                  — exports
```

### 3.4 Activation

```typescript
// В layout или root — условный рендер
{isSimplyDevMode && <DevPanelProvider />}

// В message.tsx — условный footer
{isSimplyDevMode && <DevPanelFooter messageId={message.id} />}
```

Production bundle: **0 bytes** — компоненты не импортируются если `isSimplyDevMode === false`. Используем dynamic import с `next/dynamic` и проверкой на клиенте.

---

## 4. UI спецификация

### 4.1 DevPanelFooter (под каждым сообщением ассистента)

```
┌─────────────────────────────────────────────────────┐
│  Сообщение ассистента...                            │
│                                                     │
│  ┌─ 🔍 Поиск в интернете (12 результатов) ──────── │  ← Tool Activity (остаётся)
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Sonnet 4.6 · 3,359 tok · ₽0.84 · 2.5s  [▸] │   │  ← DevPanel Footer (NEW)
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Содержимое footer:**
- Название модели (Sonnet 4.6 / Haiku / Opus)
- Общее количество токенов
- Стоимость в рублях
- Время генерации
- Кнопка `[▸]` — открыть DevPanel Drawer для этого сообщения

**Стиль:**
- `font-mono text-[11px] text-muted-foreground/60`
- `bg-muted/30 rounded px-2 py-1`
- Не привлекает внимания, но доступен при необходимости

### 4.2 DevPanelDrawer (развёрнутая панель)

Открывается при клике на `[▸]` в footer. **Drawer справа** (как RightSidebar), ширина ~400px.

```
┌─ Developer Panel ──────────────── [×] ─┐
│                                         │
│  MODEL                                  │
│  claude-sonnet-4-6                      │
│  Routing: chatMode=expertise → Sonnet   │
│  Finish: stop                           │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  TOKENS                                 │
│  Input:     2,847  (1,200 cached 42%)   │
│  Output:      512                       │
│  Reasoning:     0                       │
│  Total:     3,359  ≈ ₽0.84             │
│  Context:   ████████░░░░ 34%            │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  TIMELINE                               │
│  ┌─ Step 1 · initial · 420ms ────────┐  │
│  │  webSearch({ query: "AI тренды" })│  │
│  │  → 12 results                     │  │
│  │  1,200 in · 48 out               │  │
│  └───────────────────────────────────┘  │
│  ┌─ Step 2 · tool-result · 890ms ────┐  │
│  │  fetchUrl({ url: "https://..." }) │  │
│  │  → 4,200 chars                    │  │
│  │  2,100 in · 340 out              │  │
│  └───────────────────────────────────┘  │
│  ┌─ Step 3 · initial · 1.2s ────────┐  │
│  │  text generation                  │  │
│  │  2,847 in · 512 out              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  GUARDIAN  ✅ clean                      │
│  (или ⚠️ blocked: deepResearch          │
│   pattern: fake_progress                │
│   "найдено 5 источников..." conf: 0.9) │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ▶ System Prompt (1,847 tok)  [expand]  │
│    Skills: web-search, excel, research  │
│    Agent: Simply Chat                   │
│    Context: user-profile, chat-memory   │
│                                         │
│  ▶ Raw Tool Calls               [JSON]  │
│  ▶ Raw Tool Results             [JSON]  │
│                                         │
└─────────────────────────────────────────┘
```

### 4.3 Стили

- Фон: `bg-sidebar` (согласовано с design-system)
- Текст: `font-mono text-xs` для всех данных
- Секции: разделены `border-b border-border/50`
- Цветовая кодировка:
  - Зелёный (`text-emerald-500`): Guardian clean, cached tokens
  - Жёлтый (`text-amber-500`): Guardian warning, high token usage
  - Красный (`text-red-500`): Guardian blocked, errors
- Collapsible секции: через shadcn Collapsible
- JSON: `<pre>` с syntax highlighting (простая подсветка key/value)

---

## 5. Серверная интеграция

### 5.1 Точки эмиссии events

| Route | Что эмитим | Примечание |
|-------|-----------|------------|
| `app/(chat)/api/chat/route.ts` | `data-debug-step`, `data-debug-finish`, `data-debug-guardian`, `data-debug-prompt` | Основной чат |
| `app/(chat)/api/service-chat/route.ts` | `data-debug-step`, `data-debug-finish`, `data-debug-guardian` | Сервисные чаты (Бен, менеджер, онбординг) |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | `data-debug-step`, `data-debug-finish`, `data-debug-guardian` | Чат с Экспертом |

### 5.2 Условность эмиссии

```typescript
// Все debug events эмитятся ТОЛЬКО если SIMPLY_DEV_MODE=true
if (process.env.SIMPLY_DEV_MODE === 'true') {
  dataStream.write({
    type: 'data-debug-step',
    data: { ... },
    transient: true,
  });
}
```

В production — **нулевой overhead**: условие не выполняется, events не создаются.

### 5.3 Расчёт стоимости

```typescript
// lib/ai/model-pricing.ts (новый файл)
const MODEL_PRICING_RUB: Record<string, { input: number; output: number; cached: number }> = {
  'claude-sonnet-4-6': { input: 0.27, output: 1.35, cached: 0.027 },  // per 1K tokens, в рублях
  'claude-haiku-4-5':  { input: 0.09, output: 0.045, cached: 0.009 },
  'claude-opus-4-6':   { input: 1.35, output: 6.75, cached: 0.135 },
  // Gemini models for briefing pipeline
  'gemini-2.0-flash':  { input: 0.009, output: 0.036, cached: 0.0 },
  'gemini-2.5-flash':  { input: 0.013, output: 0.054, cached: 0.0 },
};

function calculateCostRub(modelId: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING_RUB[modelId];
  if (!pricing) return 0;
  return (
    (usage.inputTokens / 1000) * pricing.input +
    (usage.outputTokens / 1000) * pricing.output +
    ((usage.cachedInputTokens ?? 0) / 1000) * pricing.cached
  );
}
```

---

## 6. Скоуп по routes

### Этап 1: Main chat route (`api/chat/route.ts`)

Начинаем с основного чата — это 80% использования. Добавляем:
- `onStepFinish` → `data-debug-step`
- `onFinish` → `data-debug-finish`
- Guardian → `data-debug-guardian`
- Prompt info → `data-debug-prompt`

### Этап 2: Service chat + Project tasks

Расширяем на:
- `api/service-chat/route.ts`
- `api/projects/[id]/tasks/[taskId]/chat/route.ts`

### Этап 3: Briefing pipeline (если потребуется)

Cron и pipeline routes не используют useChat, поэтому DevPanel к ним не применим напрямую. Для их отладки по-прежнему используются серверные логи.

---

## 7. Требования

### Функциональные

| # | Требование |
|---|-----------|
| F1 | DevPanel footer видна под каждым сообщением ассистента в dev-режиме |
| F2 | Клик по footer открывает drawer с полными деталями |
| F3 | Drawer показывает: модель, токены, стоимость, timeline, Guardian, prompt |
| F4 | Timeline показывает каждый step с tool calls, args, results, timing |
| F5 | Guardian секция показывает статус (clean/blocked/warning/bypassed) с деталями |
| F6 | System Prompt секция показывает preview + metadata (skills, agent, mode) |
| F7 | Raw секции позволяют просмотреть JSON tool calls и results |
| F8 | Все данные приходят через transient `data-*` events (не сохраняются в историю) |
| F9 | Стоимость рассчитывается в рублях по актуальным тарифам моделей |
| F10 | При `SIMPLY_DEV_MODE !== 'true'` — компоненты НЕ рендерятся, events НЕ эмитятся |

### Нефункциональные

| # | Требование |
|---|-----------|
| NF1 | Production bundle size: +0 bytes (dynamic import + tree-shaking) |
| NF2 | Dev-mode overhead: < 5ms per step (event serialization) |
| NF3 | Drawer не влияет на layout основного чата (push-layout НЕ используется) |
| NF4 | Данные per-message, не per-session (каждое сообщение — свой контекст) |

---

## 8. Что удаляем при внедрении

### Файлы на удаление:
- `lib/prompts/core/dev-mode.md`

### Код на удаление:
- `lib/prompts/builder/dev-mode-inject.ts` → полное удаление файла
- `components/message.tsx` → удалить `devModelName` useMemo и рендер
- `lib/prompts/builder/composer.ts` → удалить вызов `injectDevMode()`
- `app/(chat)/api/service-chat/route.ts` → удалить `data-model-info` event и `DISPLAY` map
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` → удалить вызов `injectDevMode()`

---

## 9. Не в скоупе (явно исключено)

| Исключение | Причина |
|-----------|---------|
| Внешние сервисы (Langfuse, LangSmith) | Не нужны — собираем всё сами |
| AI SDK 6 DevTools | Требует апгрейд SDK — преждевременно |
| A/B тест framework | Нет мультипровайдера |
| Prompt editor в UI | Отдельная задача |
| Embedding vectors / RAG debug | RAG ещё не реализован |
| Raw API headers | Шум без практической ценности |
| Briefing cron debugging | Cron не использует useChat |

---

## 10. Зависимости

- **AI SDK 5** (`ai: 5.0.123`) — `onStepFinish`, `onFinish`, `createUIMessageStream`, transient events — всё доступно
- **shadcn/ui** — Drawer/Sheet, Collapsible, ScrollArea
- **RightSidebar** (`components/right-sidebar.tsx`) — возможно переиспользуем shell
- Никаких новых npm-зависимостей

---

## 11. Референсы

- **LangSmith Trace Viewer** — иерархия runs/steps с timing + tokens
- **Vercel AI SDK DevTools** (v6) — per-step inspection с raw payloads
- **Shape of AI: Stream of Thought** — паттерн progressive disclosure
- **CHI 2025: Design Principles for LLM Observability** — awareness + monitoring + intervention
