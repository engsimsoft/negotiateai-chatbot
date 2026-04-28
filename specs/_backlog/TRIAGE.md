# Backlog Triage — план разруливания

> Чёткий план: что делаем сейчас, что переживёт миграция, что отложено.
>
> **Создан:** 2026-04-27
> **Обновлён:** 2026-04-28 — все 4 quick wins закрыты (v3.100.4). Остаются 4 deferred — после миграции. Возврат в серию Simply_Migration с Шага 3.

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
| — | **МИГРАЦИЯ Шаги 3-11** | — | — | **сейчас** |
| **B.1** | [TZ_MindAtomicityFix](TZ_MindAtomicityFix.md) | 🟥 high (но не UX-блок) | 0.3-0.5 сессии | после миграции |
| **B.2** | [TZ_SimplyChatUiScaling](TZ_SimplyChatUiScaling.md) | 🟧 medium | 1-1.5 сессии | после ~500 сообщений |
| **B.3** | [TZ_SimplyCompactionDivider](TZ_SimplyCompactionDivider.md) | 🟧 medium | 1 сессия | после миграции |
| **B.4** | [TZ_BriefingConcurrencyGuard](TZ_BriefingConcurrencyGuard.md) | 🟧 medium | 0.3-0.5 сессии | после миграции |

**Quick wins:** все 4 закрыты в v3.100.4 (см. [BACKLOG_CLOSED.md](../_archive/BACKLOG_CLOSED.md)). **Итого deferred:** 4 ТЗ, ~3-4 сессии после миграции.

---

## Возврат в миграцию

**Возвращаемся в Simply_Migration с Шага 3 (Vision/OCR cleanup).** План миграции 11 шагов в [SIMPLY_MIGRATION_CONCEPT.md](../Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md). HANDOFF для следующей сессии — [Simply_Migration/HANDOFF_NEXT_SESSION.md](../Simply_Migration/HANDOFF_NEXT_SESSION.md).

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

---

## Связь с серией Simply_Migration

Все 4 quick wins закрыты в v3.100.4 — продолжаем серию Simply_Migration с Шага 3 без отвлечений.

Все deferred (B.1-B.4) — **не критичны** для миграции, могут быть подняты после Фазы Г (Шаги 9-11) если появится свободное окно.

**Backlog не должен расти во время миграции.** Каждая новая находка → сначала «закрывает ли это какой-то шаг миграции?», только если нет → отдельный TZ.
