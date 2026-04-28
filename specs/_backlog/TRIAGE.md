# Backlog Triage — план разруливания

> Чёткий план: что делаем сейчас, что переживёт миграция, что отложено.
>
> **Создан:** 2026-04-27
> **Обновлён:** 2026-04-28 — после полного аудита: 7 ТЗ закрыты как obsoleted by migration. Backlog сокращён с 14 до 8 ТЗ. Структура переделана: Quick wins → Migration → Deferred.

---

## Стратегия

**Текущая серия — Simply_Migration** ([SIMPLY_MIGRATION_CONCEPT.md](../Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md)). 11 шагов в 4 фазы. Из них Шаги 1-2 закрыты (Шаг 2 — `TZ_MigrateArtifactPromptsToSkills` 2026-04-27).

**Принцип triage:**
1. Bugs которые миграция закроет архитектурно → НЕ чинить отдельно, отметить в SPEC соответствующего шага
2. Bugs которые блокируют пользователей и независимы от миграции → quick win **до** миграции
3. Bugs архитектурной корректности но без UX-блока → defer **после** миграции

**Что было выкинуто 2026-04-28:** 7 ТЗ (см. [BACKLOG_CLOSED.md](../_archive/BACKLOG_CLOSED.md)) — все obsoleted by migration steps.

---

## Сводка приоритетов

| Блок | ТЗ | Impact | Оценка | Когда |
|---|---|---|---|---|
| **A.1** | **TZ_SimplyChatLoadPerf** *(в `/specs/`)* | 🟥 high — 15-22s TTI на /simply | 1-1.5 сессии | сейчас (размотозен 2026-04-28) |
| **A.2** | [TZ_ChatModeUndefinedSubmit](TZ_ChatModeUndefinedSubmit.md) | 🟥 high | 0.5 сессии | сейчас |
| **A.3** | [TZ_PptxRevealUpdateRender](TZ_PptxRevealUpdateRender.md) | 🟥 high | 0.5-1 сессия | сейчас |
| **A.4** | [TZ_ChatInputBlockedOnDocumentFetchHang](TZ_ChatInputBlockedOnDocumentFetchHang.md) | 🟧 medium | 0.5 сессии | сейчас |
| — | **МИГРАЦИЯ Шаги 3-11** | — | — | **далее** |
| **B.1** | [TZ_MindAtomicityFix](TZ_MindAtomicityFix.md) | 🟥 high (но не UX-блок) | 0.3-0.5 сессии | после миграции |
| **B.2** | [TZ_SimplyChatUiScaling](TZ_SimplyChatUiScaling.md) | 🟧 medium | 1-1.5 сессии | после ~500 сообщений |
| **B.3** | [TZ_SimplyCompactionDivider](TZ_SimplyCompactionDivider.md) | 🟧 medium | 1 сессия | после миграции |
| **B.4** | [TZ_BriefingConcurrencyGuard](TZ_BriefingConcurrencyGuard.md) | 🟧 medium | 0.3-0.5 сессии | после миграции |

**Итого quick wins сейчас:** 2.5-3.5 сессии. **Итого deferred:** 4 ТЗ, ~3-4 сессии после миграции.

---

## Блок A — Quick wins ДО миграции

### A.1 — TZ_SimplyChatLoadPerf (high) — СНАЧАЛА

Открытие /simply занимает 15-22 секунды. Два root cause:
1. **C** — двойной RSC рендер (`getMessagesByChatId` × 2 на одно открытие)
2. **D** — 8 параллельных `GET /api/document` без viewport-гейтинга

Размоторожен 2026-04-28 после partial-fix billing leak. SPEC: [TZ_SimplyChatLoadPerf/SPEC.md](../TZ_SimplyChatLoadPerf/SPEC.md), уже есть [ANALYSIS.md](../TZ_SimplyChatLoadPerf/ANALYSIS.md).

**Оценка:** 1-1.5 сессии.

### A.2 — TZ_ChatModeUndefinedSubmit (high)

Runtime error `getChatUrl: chatMode "undefined"` блокирует submit при открытом артефакте. TS-fix контракта пропа `chatMode?: string` → `chatMode: string`. Найти проблемного родителя и добавить недостающий проп.

**Оценка:** 0.5 сессии.

### A.3 — TZ_PptxRevealUpdateRender (high)

Презентации не перерисовываются в холсте после `onUpdateDocument` (БД и blob обновлены, скачанный файл свежий, но клиент показывает старую версию). Скорее всего проблема в client-side state или `data-pptxComplete` event handler.

**Оценка:** 0.5-1 сессия (debug client state + правка event handler).

### A.4 — TZ_ChatInputBlockedOnDocumentFetchHang (medium)

Chat input блокируется при висящем `GET /api/document` (Neon timeout 10s). Расцепить input от artifact loading + 5s timeout + graceful UI fallback.

**Оценка:** 0.5 сессии.

---

## Что делаем после quick wins

**Возвращаемся в Simply_Migration с Шага 1 (BR-AUTHOR-KIMI).** План миграции 11 шагов в [SIMPLY_MIGRATION_CONCEPT.md](../Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md). HANDOFF для следующей сессии — [Simply_Migration/HANDOFF_NEXT_SESSION.md](../Simply_Migration/HANDOFF_NEXT_SESSION.md).

**Закрываются по ходу миграции:**
- Шаг 1 → TZ_BriefingScriptwriterPromptUpdate (метаданные обновятся)
- Шаг 4 → TZ_DocumentTruncationSilent + TZ_EstimatorIgnoresAttachments + TZ_SimplyChatBillingLeak (остаток)
- Шаг 7 → TZ_GrokSkipsUpdateDocumentTool + TZ_RevealVsPptxToolSelection
- Шаг 8 → TZ_ExpertiseReasoningRestore

Все эти ТЗ уже закрыты в backlog с пометкой «obsoleted by migration». Но research/контекст в файлах остаётся в `_backlog/_archive/` — авторы соответствующих шагов миграции должны прочитать соответствующий архивный TZ перед началом работы.

---

## Блок B — Deferred ПОСЛЕ миграции

### B.1 — TZ_MindAtomicityFix (high impact, не UX-блок)

`markMessagesExtracted` в [lib/ai/memory/extract.ts:235-246](../../lib/ai/memory/extract.ts#L235-L246) безусловно отмечает сообщения как extracted даже при провале `processAndStoreFact`. Память может теряться при сбоях Voyage. Fix: условный mark + retry с backoff.

**Почему отложено:** не UX-блокер (память теряется граcеfully, без видимых ошибок). Архитектурная корректность.

**Оценка:** 0.3-0.5 сессии.

### B.2 — TZ_SimplyChatUiScaling (medium)

Virtual scroll + cursor pagination для длинного Simply chat. Текущий лимит — 500+ сообщений начнут давать ощутимую загрузку.

**Почему отложено:** ждать пока чат перевалит ~500 сообщений. Сейчас Simply владельца — 370+ сообщений.

**Оценка:** 1-1.5 сессии.

### B.3 — TZ_SimplyCompactionDivider (medium)

Визуальный разделитель в UI чата в месте `chat.compactionIndex` — сейчас пользователь видит все старые сообщения как обычно, а модель помнит только summary. Mental model расходится.

**Почему отложено:** UX nice-to-have, не блокирует функциональность.

**Оценка:** 1 сессия.

### B.4 — TZ_BriefingConcurrencyGuard (medium)

Гонка cron-запуска и user-triggered «Сгенерировать» для одного userId. Решение: partial unique index или optimistic lock.

**Почему отложено:** редкий race condition, не наблюдается в production.

**Оценка:** 0.3-0.5 сессии.

### B.5 — TZ_SimplyChatLoadPerf (заморожен в `/specs/`)

Был заморожен на время разбора billing leak. Billing leak partial-fix применён 2026-04-28, остаток уйдёт через Шаг 4 миграции. После миграции — переоценить актуальность.

---

## Связь с серией Simply_Migration

Все quick wins (A.1-A.3) **независимы от миграции** — UX-блокеры пользователей. Делаем в одной сессии, потом возвращаемся в миграцию с чистой головой.

Все deferred (B.1-B.5) — **не критичны** для миграции, но могут быть подняты после Фазы Г (Шаги 9-11) если появится свободное окно.

**Backlog не должен расти во время миграции.** Каждая новая находка → сначала «закрывает ли это какой-то шаг миграции?», только если нет → отдельный TZ.
