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

**Приоритет:** закрыть все 9 хвостов перед продуктовыми фичами.

### Старт следующей сессии — 3 шага:

```
1. Прочитать все 9 файлов хвостов в specs/_backlog/ (не архив, только активные)
2. Найти пересечения — некоторые можно закрыть одним проходом
3. Предложить владельцу сгруппированный план → работать группами, маленькими шагами
```

Хвосты могут пересекаться — например cleanup prompts.ts (№6) пересекается с
любой правкой промптов. DevPanel footer (№3) и context widget (№5) — оба про
observability UI. Найди их сам при чтении файлов.

---

## 📋 Хвосты (9 активных)

### 🟥 Высокий приоритет

| # | Файл | Суть |
|---|---|---|
| 1 | [TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md) | Override модели не применяется без рестарта сервера — блокирует A/B тесты |
| 2 | [TZ_ErrorRecoveryUI](../_backlog/TZ_ErrorRecoveryUI.md) | Чат упал с ошибкой → нельзя продолжить диалог |

### 🟧 Средний приоритет

| # | Файл | Суть |
|---|---|---|
| 3 | [TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md) | Цена под-вызовов (artifacts, clerks) скрыта в footer |
| 4 | [TZ_MaxOutputTokensAudit](../_backlog/TZ_MaxOutputTokensAudit.md) | Нет явных лимитов длины ответа → потенциальный timeout |
| 5 | [TZ_SimplyContextUsageWidget](../_backlog/TZ_SimplyContextUsageWidget.md) | Виджет контекста показывает неправильную шкалу |
| 6 | [TZ_PromptsDeadCodeCleanup](../_backlog/TZ_PromptsDeadCodeCleanup.md) | 90% prompts.ts мёртвый код — мешает читать |
| 7 | [TZ_SimplyChatRaceCondition](../_backlog/TZ_SimplyChatRaceCondition.md) | Редкий дубль сообщений при параллельных запросах |
| 8 | [TZ_UrlVerificationMetricNormalization](../_backlog/TZ_UrlVerificationMetricNormalization.md) | Unit тесты для URL-нормализации (основной фикс уже в проде) |
| 9 | [TZ_ProfessorPlanStreaming](../_backlog/TZ_ProfessorPlanStreaming.md) | Plan показывается целиком в конце вместо стриминга |

---

## ✅ Закрыто в сессии 2026-04-17

| Что | Коммит |
|---|---|
| Smoke test v3.92.2 — все модели подтверждены в БД | — |
| Input не появлялся при первом открытии задачи | `a7d1a3f` |
| Grok пропускал вопросы при создании проекта (RAG-агрессия) | `a7d1a3f` |
| Worktrees `stoic-wu` + `angry-nobel` удалены | git worktree prune |

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
