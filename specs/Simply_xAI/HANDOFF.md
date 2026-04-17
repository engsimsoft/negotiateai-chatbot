# HANDOFF — Хвосты (Backlog)

**Последнее обновление:** 2026-04-17 (сессия smoke test + 2 фикса)
**Версия:** 3.92.2
**HEAD:** `a7d1a3f` fix(projects): input missing + project-creation prompt guard
**Git state:** ~40 коммитов ahead of origin — push решение владельца
**Dev overrides:** файла нет (чистое состояние)

---

## ⛔ Правило сессии: маленькие шаги

**Один шаг → пауза → подтверждение → следующий шаг.**

Не делать всё скопом. Не копаться в архивах и истории ТЗ без причины.
Подход к хвостам: **тест-first** — воспроизвести проблему → найти в коде → починить → проверить.

---

## 🎯 Задача следующей сессии: закрыть долги

**Серия Simply_xAI закрыта (v3.92.1).** Финальная архитектура работает.
Smoke test v3.92.2 пройден 2026-04-17 — все модели на месте.

**Приоритет:** закрыть оставшиеся 7 хвостов перед продуктовыми фичами.

### Следующий хвост: TZ_DevPanelFooterHidesSubCalls

Цена под-вызовов (artifact handlers, clerks) скрыта в footer DevPanel —
показывается только parent chat model. Видна только реальная картина в SQL.

---

## 📋 Хвосты (6 активных)

### 🟧 Средний приоритет

| # | Файл | Суть |
|---|---|---|
| 1 | [TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md) | Цена под-вызовов (artifacts, clerks) скрыта в footer |
| 2 | [TZ_MaxOutputTokensAudit](../_backlog/TZ_MaxOutputTokensAudit.md) | Нет явных лимитов длины ответа → потенциальный timeout |
| 3 | [TZ_PromptsDeadCodeCleanup](../_backlog/TZ_PromptsDeadCodeCleanup.md) | 90% prompts.ts мёртвый код — мешает читать |
| 4 | [TZ_SimplyChatRaceCondition](../_backlog/TZ_SimplyChatRaceCondition.md) | Редкий дубль сообщений при параллельных запросах |
| 5 | [TZ_UrlVerificationMetricNormalization](../_backlog/TZ_UrlVerificationMetricNormalization.md) | Unit тесты для URL-нормализации (основной фикс уже в проде) |
| 6 | [TZ_ProfessorPlanStreaming](../_backlog/TZ_ProfessorPlanStreaming.md) | Plan показывается целиком в конце вместо стриминга |

---

## ✅ Закрыто в сессии 2026-04-17

| Что | Коммит |
|---|---|
| Smoke test v3.92.2 — все модели подтверждены в БД | — |
| Input не появлялся при первом открытии задачи | `a7d1a3f` |
| Grok пропускал вопросы при создании проекта (RAG-агрессия) | `a7d1a3f` |
| Worktrees `stoic-wu` + `angry-nobel` удалены | git worktree prune |
| Dev overrides — reader регистрируется в `instrumentation.ts` (boot), все routes покрыты | `c4b2b63` |
| Error Recovery UI — Stage 2 закрыт: не воспроизводится, Stage 1 hint достаточно, Session Errors поймает если вернётся | — |
| Context Widget — поглощён архитектурным документом `SIMPLY_COMPACTION_ARCHITECTURE.md` (виджет фиксится при реализации Simply Compaction) | pending commit |

---

## 🏗 Архитектура (константа, не менять без обсуждения)

**4 роли · 3 production провайдера · 1 dev-инструмент:**
- **Подсобка** → Grok 4.1 Fast (быстрое, дешёвое, механическое)
- **Кухня** → MiniMax M2.7 / M2.7-long (briefing pipeline, by design)
- **Зал** → Grok 4.20 reasoning (пользователь видит результат)
- **Автор** → Claude Opus/Sonnet/Haiku (professor:planning, service chats, artifacts)
- **Dev-инструмент** → OpenRouter (только через /dev/models override)

---

## ⚠️ Важные квирки

- **Voyage + финский VPN** → 403. Переключить на US Buffalo. Не код.
- **`npm run build`** автоматически накатывает pending migrations. Предупреждать владельца ДО запуска.
- **`next build` ломает активный `next dev`** → для валидации только `tsc --noEmit`.
- **Dev overrides** — файл `.simply-dev-overrides.json` отсутствует (чистое состояние).

---

## 🚀 Продуктовые направления (после хвостов)

- Оплата в рублях (ЮKassa, Тинькофф, СБП)
- ТЗ-XAI-MA-1 — Multi-agent через Responses API + MCP
- ТЗ-XAI-COL-1 — Библиотека через Collections API
- ТЗ-XAI-VOICE-1 — Voice Agent
