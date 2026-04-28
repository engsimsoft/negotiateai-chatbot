# Backlog ТЗ — открытые долги и находки

> 📋 **План разруливания** → [TRIAGE.md](TRIAGE.md) — Quick wins → Migration → Deferred.

> Список нерешённых задач, найденных при работе над предыдущими ТЗ.
>
> **Перед стартом нового большого ТЗ** Claude обязан пройтись по этому списку и
> предложить пользователю: «В backlog N открытых долгов: …. Хочешь сначала закрыть
> какой-то из них, или они не блокируют новый ТЗ?» Решение принимает пользователь.
>
> **Правило:** новый bug найден → НЕ создавать ТЗ автоматически. Сначала свериться с [Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md](../Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md). Если миграция закрывает в одном из 11 шагов — пометка в SPEC соответствующего шага, не отдельное ТЗ. Этот файл и папку создаёт правило 8 WORKFLOW.md.
>
> Создан: 2026-04-13
> Обновлён: 2026-04-28 — закрыты 4 quick wins (TZ_SimplyChatLoadPerf, TZ_ChatModeUndefinedSubmit, TZ_ChatInputBlockedOnDocumentFetchHang, TZ_PptxRevealUpdateRender) → v3.100.4. Остаётся 4 deferred. До этого: после полного аудита backlog 7 ТЗ закрыты как obsoleted by migration. См. [BACKLOG_CLOSED.md](../_archive/BACKLOG_CLOSED.md).

---

## Как пользоваться

- Каждый файл в этой папке — заготовка ТЗ (формат как у обычного `SPEC.md`)
- Когда поднимаем работу над долгом — файл становится исходником полноценного ТЗ:
  ```
  mkdir specs/TZ_<name>
  mv specs/_backlog/TZ_<name>.md specs/TZ_<name>/SPEC.md
  ```
  Дальше — обычный WORKFLOW (ANALYSIS → ROADMAP → код → финализация → архив)
- Если долг закрыт:
  1. Файл переносится в `_backlog/_archive/` (или `_archive/TZ_<name>/` если был активным)
  2. Запись о закрытии добавляется в [`_archive/BACKLOG_CLOSED.md`](../_archive/BACKLOG_CLOSED.md) — исторический журнал
  3. В этом README запись УДАЛЯЕТСЯ — не дублируется в «Закрытые»

**Этот файл держит ТОЛЬКО открытые долги.** История закрытых — в `_archive/BACKLOG_CLOSED.md`.

---

## Открытые долги (4)

### 🟧 Deferred (после миграции)

| ТЗ | Описание | Почему отложено |
|---|---|---|
| [TZ_MindAtomicityFix](TZ_MindAtomicityFix.md) | `markMessagesExtracted` в [lib/ai/memory/extract.ts:235-246](../../lib/ai/memory/extract.ts#L235-L246) безусловно отмечает сообщения как extracted даже при провале `processAndStoreFact` (Voyage 403). Память может теряться. Fix: условный mark + retry с backoff. | Архитектурная корректность, не блокер UX |
| [TZ_SimplyChatUiScaling](TZ_SimplyChatUiScaling.md) | Скоуп: virtual scroll + cursor pagination. Ждать пока Simply chat перевалит ~500 сообщений. | Нет срочности, преждевременная оптимизация |
| [TZ_SimplyCompactionDivider](TZ_SimplyCompactionDivider.md) | Когда compaction уплотняет старые сообщения в `chat.compactionSummary`, пользователь видит их в UI как обычно — mental model расходится. Показать визуальный разделитель. | UX nice-to-have, не блокер |
| [TZ_BriefingConcurrencyGuard](TZ_BriefingConcurrencyGuard.md) | Гонка cron-запуска и user-triggered `/api/briefing/generate`. Решение: partial unique index или `SELECT FOR UPDATE`. | Редкий race condition, не критично |

**Итого deferred:** 4 ТЗ, в backlog без срочности.

---

## Закрытые долги

История закрытых долгов — в **[`_archive/BACKLOG_CLOSED.md`](../_archive/BACKLOG_CLOSED.md)**.

**На 2026-04-28 закрыто 11 ТЗ:**
- 7 obsoleted by migration: TZ_SimplyChatBillingLeak, TZ_DocumentTruncationSilent, TZ_EstimatorIgnoresAttachments, TZ_GrokSkipsUpdateDocumentTool, TZ_RevealVsPptxToolSelection, TZ_ExpertiseReasoningRestore, TZ_BriefingScriptwriterPromptUpdate
- 4 quick wins (v3.100.4): TZ_SimplyChatLoadPerf, TZ_ChatModeUndefinedSubmit, TZ_ChatInputBlockedOnDocumentFetchHang, TZ_PptxRevealUpdateRender

Этот файл держит только открытые долги. Когда долг закрывается — запись переносится в архивный журнал, сюда не добавляется.
