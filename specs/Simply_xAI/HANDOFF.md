# HANDOFF — Хвосты (Backlog)

**Последнее обновление:** 2026-04-17 (длинная cleanup-сессия)
**Версия:** 3.92.2
**HEAD:** `pending` — серия коммитов за сессию (см. ниже)
**Git state:** много коммитов ahead of origin — push решение владельца
**Dev overrides:** есть файл (несколько задач под override)

---

## ⛔ Правило сессии: маленькие шаги

**Один шаг → пауза → подтверждение → следующий шаг.**

Не делать всё скопом. Не копаться в архивах и истории ТЗ без причины.
Подход к хвостам: **тест-first** — воспроизвести проблему → найти в коде → починить → проверить.

---

## 🎯 Состояние после сессии 2026-04-17

**Серия Simply_xAI закрыта (v3.92.1).** Финальная архитектура работает.

**Из активных хвостов закрыто 6 за сессию** (см. таблицу внизу). Осталось 3 активных — все низкоприоритетные или отложенные.

### Архитектурный документ создан
`specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md` — концепция Simply Compaction
(сжатие истории через Summary Buffer для Grok-чатов, где нет Anthropic Compaction API).
Фикс виджета контекста интегрирован в реализацию этой фичи.

---

## 📋 Хвосты (3 активных)

### 🟧 Низкий / отложенный приоритет

| # | Файл | Суть |
|---|---|---|
| 1 | [TZ_MaxOutputTokensAudit](../_backlog/TZ_MaxOutputTokensAudit.md) | Нет явных лимитов длины ответа. **Отложено** до финализации моделей по taskId — лимит зависит от модели |
| 2 | [TZ_ProfessorPlanStreaming](../_backlog/TZ_ProfessorPlanStreaming.md) | Plan целиком в конце вместо стриминга. **Отложено** — парный с #1 (один проход) |
| 3 | [TZ_UrlVerificationMetricNormalization](../_backlog/TZ_UrlVerificationMetricNormalization.md) | Unit тесты для URL-нормализации (основной фикс `58d9d2e` уже в проде) |

### Следующая сессия — что делать

**Приоритет — Simply Compaction** (реализация `SIMPLY_COMPACTION_ARCHITECTURE.md`):
- Новый механизм сжатия для всех Grok-чатов (expertise/create/projects на Grok)
- Попутно чинится виджет контекста (три типа событий: extract/compaction/truncation_warning)
- Открытые вопросы: пороги триггера, порядок MIND vs Compaction в Simply Chat, детекция Anthropic compaction event

**Перед стартом Compaction:**
- Прочитать `SIMPLY_COMPACTION_ARCHITECTURE.md` целиком
- Обсудить с владельцем открытые вопросы из раздела «Открытые вопросы» документа
- Определить триггеры для каждого режима/модели отдельно

---

## ✅ Закрыто в сессии 2026-04-17

| Что | Коммит |
|---|---|
| Smoke test v3.92.2 — все модели подтверждены в БД | — |
| Input не появлялся при первом открытии задачи | `a7d1a3f` |
| Grok пропускал вопросы при создании проекта (RAG-агрессия) | `a7d1a3f` |
| Worktrees `stoic-wu` + `angry-nobel` удалены | git worktree prune |
| Dev overrides — reader регистрируется в `instrumentation.ts` (boot), все routes покрыты | `c4b2b63` |
| Error Recovery UI — Stage 2 закрыт: не воспроизводится, Stage 1 hint достаточно | `e703e6c` |
| Context Widget — поглощён архитектурным документом `SIMPLY_COMPACTION_ARCHITECTURE.md` | `01f154f` |
| Simply Chat race condition — partial unique index в БД, defensive `onConflictDoNothing` в коде, 1 дубль вычищен | `84c5fb5` |
| DevPanel footer — агрегирует все nested AI-вызовы (артефакты + request-suggestions), показывает домин. модель, tooltip с разбивкой по цене | `6b3b61d` |
| requestSuggestions tool удалён — 0 вызовов за всю историю, legacy из Vercel template | `d27a116` |
| `lib/ai/prompts.ts` dead code cleanup — 90% файла удалено, остался только `updateDocumentPrompt`, файл переименован в `artifact-prompts.ts` | pending commit |

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
- **Партициальный unique index** `Chat_user_simply_uniq` — физически запрещает второй Simply чат у одного userId.

---

## 🚀 Продуктовые направления (после Simply Compaction и хвостов)

- Оплата в рублях (ЮKassa, Тинькофф, СБП)
- ТЗ-XAI-MA-1 — Multi-agent через Responses API + MCP
- ТЗ-XAI-COL-1 — Библиотека через Collections API
- ТЗ-XAI-VOICE-1 — Voice Agent
