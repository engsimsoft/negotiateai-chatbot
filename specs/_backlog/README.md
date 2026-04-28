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
> Обновлён: 2026-04-28 — после полного аудита backlog: **7 ТЗ закрыты как obsoleted by migration**, остаётся 3 quick wins + 5 deferred. См. [BACKLOG_CLOSED.md](../_archive/BACKLOG_CLOSED.md) для записей о закрытии.

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

## Открытые долги (8)

### 🟥 Quick wins (чинить ДО начала миграции)

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| **TZ_SimplyChatLoadPerf** *(в `/specs/`)* | 15-22 сек открытие /simply прямо сейчас. Двойной RSC рендер + 8 параллельных `/api/document`. Разморожен 2026-04-28 после partial-fix billing leak. | 1-1.5 сессии | Серия измерений Network tab + dev-логов 2026-04-28 |
| [TZ_ChatModeUndefinedSubmit](TZ_ChatModeUndefinedSubmit.md) | Runtime error `getChatUrl: chatMode "undefined"` блокирует submit при открытом артефакте. Контракт `chatMode?: string` опциональный — TS не возражает, родители не передают. F5 помогает временно. | 0.5 сессии | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #6 |
| [TZ_PptxRevealUpdateRender](TZ_PptxRevealUpdateRender.md) | Презентации (pptx/reveal) не перерисовываются в холсте после `onUpdateDocument` — БД и blob обновлены, превью генерится, но клиент показывает старую версию. Скачанный файл свежий. Проблема в client-side state / data-pptxComplete handler. | 0.5-1 сессия | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #1 |
| [TZ_ChatInputBlockedOnDocumentFetchHang](TZ_ChatInputBlockedOnDocumentFetchHang.md) | Chat input блокируется когда `GET /api/document` висит в Neon timeout 10s. UX полностью замораживается. Расцепить input ↔ artifact loading + timeout 5s + graceful UI fallback. | 0.5 сессии | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #3 |

**Итого quick wins:** 2.5-3.5 сессии. **Делать ДО Шага 3 миграции** — независимые UX-блокеры пользователей.

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

**На 2026-04-28 закрыто 7 ТЗ как obsoleted by migration:**
- TZ_SimplyChatBillingLeak (partial fix + Шаг 4 закроет остаток)
- TZ_DocumentTruncationSilent (Шаг 4)
- TZ_EstimatorIgnoresAttachments (Шаг 4)
- TZ_GrokSkipsUpdateDocumentTool (Шаг 7)
- TZ_RevealVsPptxToolSelection (Шаг 7)
- TZ_ExpertiseReasoningRestore (Шаг 8)
- TZ_BriefingScriptwriterPromptUpdate (Шаги 1/10)

Этот файл держит только открытые долги. Когда долг закрывается — запись переносится в архивный журнал, сюда не добавляется.
