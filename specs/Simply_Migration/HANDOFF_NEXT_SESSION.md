# HANDOFF — следующая сессия Claude Code

**Дата:** 2026-04-28
**Текущая серия:** Simply_Migration (xAI + Kimi K2.6 + Perplexity, Anthropic Opus только аудитор)
**Состояние:** Шаги 1-2 закрыты, готовимся к Шагу 3+
**Контекст:** этот файл — точка входа для нового Claude. Прочитай его первым, дальше следуй ссылкам по необходимости.

---

## Что произошло в предыдущей сессии (2026-04-28)

### 1. Разобран Simply chat billing leak ([HANDOFF](../_archive/TZ_SimplyChatBillingLeak/HANDOFF.md))

**Корень:** двухслойная утечка токенов в Simply chat:
1. Compaction noop не подставлял сохранённый summary → старые сообщения слались целиком каждый turn
2. Inline-текст файлов (`.md`/`.docx`/`.xlsx`) копится в истории навсегда + дублируется при повторной загрузке файла

**Применённые фиксы (dev-only, не зарелижено):**
- `lib/ai/compaction/prepare-messages.ts:107-126` — noop-but-substitute branch (КЕЕП — переживёт миграцию)
- `app/(chat)/api/chat/route.ts:340-352` — strip inline file-text в `stripOldAttachmentsFromHistory` (УДАЛИТЬ при Шаге 4 — станет мёртвым кодом)

**Замеры (chat `3353a183`):** noop-turn input упал с 94K до 38-41K (-57%).

### 2. Полный аудит backlog → 7 ТЗ закрыты как obsoleted

Backlog был раздут до 14 ТЗ. После аудита — 8 (3 quick wins + 5 deferred). Закрытые перешли в [BACKLOG_CLOSED.md](../_archive/BACKLOG_CLOSED.md), их research остаётся доступным в `_backlog/_archive/`.

**Принцип, который начали применять:** новый bug → сверка с миграцией → если миграция закрывает → НЕ создаём отдельный ТЗ, отмечаем в SPEC шага миграции.

---

## Куда идти из этого файла

| Что нужно сделать | Куда смотреть |
|---|---|
| Понять серию миграции и 11 шагов | [SIMPLY_MIGRATION_CONCEPT.md](SIMPLY_MIGRATION_CONCEPT.md) |
| Понять Briefing pipeline (отдельная серия) | [SIMPLY_BRIEFING_CONCEPT.md](SIMPLY_BRIEFING_CONCEPT.md) |
| Открытые backlog долги | [../_backlog/README.md](../_backlog/README.md) |
| План разруливания backlog | [../_backlog/TRIAGE.md](../_backlog/TRIAGE.md) |
| История закрытых долгов | [../_archive/BACKLOG_CLOSED.md](../_archive/BACKLOG_CLOSED.md) |
| Архивы закрытых ТЗ серии Simply_Migration | [../_archive/Simply_Migration/](../_archive/Simply_Migration/) |
| Workflow и правила работы с ТЗ | [../WORKFLOW.md](../WORKFLOW.md) |

---

## План действий следующей сессии

### Этап 1 — Quick wins (2.5-3.5 сессии)

Четыре независимых UX-блокера, которые не связаны с миграцией. Сделать ДО Шага 3 миграции. **TZ_SimplyChatLoadPerf делать первым** — самый острый UX-блокер (15-22s TTI):

1. **TZ_SimplyChatLoadPerf** ([SPEC](../TZ_SimplyChatLoadPerf/SPEC.md), [ANALYSIS](../TZ_SimplyChatLoadPerf/ANALYSIS.md)) — 1-1.5 сессии. **Размотозен 2026-04-28** после partial-fix billing leak. Открытие /simply 15-22 сек: двойной RSC рендер + 8 параллельных `/api/document`. Scope: дедупликация RSC + lazy loading артефактов через IntersectionObserver.
2. **TZ_ChatModeUndefinedSubmit** ([SPEC](../_backlog/TZ_ChatModeUndefinedSubmit.md)) — 0.5 сессии. Runtime error блокирует submit при открытом артефакте. TS-fix контракта пропа.
3. **TZ_PptxRevealUpdateRender** ([SPEC](../_backlog/TZ_PptxRevealUpdateRender.md)) — 0.5-1 сессия. Презентации не перерисовываются после `onUpdateDocument`. Client-side state debug.
4. **TZ_ChatInputBlockedOnDocumentFetchHang** ([SPEC](../_backlog/TZ_ChatInputBlockedOnDocumentFetchHang.md)) — 0.5 сессии. Chat input блокируется на Neon timeout 10s. Расцепить + 5s timeout.

### Этап 2 — Возвращаемся в миграцию

**Следующий шаг — Шаг 3 (Vision/OCR cleanup)** — подготовка к Шагу 4.

Полный список шагов:
- ✅ Шаг 1 — BR-AUTHOR-KIMI (зарелижено)
- ✅ Шаг 2 — MigrateArtifactPromptsToSkills (зарелижено 2026-04-27, commit `c04e73e`)
- ⏭ **Шаг 3 — Vision/OCR cleanup** (следующий)
- ⏭ Шаг 4 — PDF на xAI Files API ⭐ закрывает 3 backlog ТЗ + остаток billing leak
- Шаг 5 — Web Tools (xAI web_search + Perplexity tool + librarySearch)
- Шаг 6 — UI кнопки в Simply Chat
- Шаг 7 — Артефакты A/B (5 типов × 3 модели) ⭐ закрывает 2 backlog ТЗ
- Шаг 8 — Экспертиза + External Verifier A/B ⭐ закрывает 1 backlog ТЗ
- Шаг 9 — Multi-Agent
- Шаг 10 — BR-ONBOARDING-XAI
- Шаг 11 — BR-DAILY-FETCH

---

## ⚠ Действия которые надо НЕ забыть

### При начале Шага 4 (PDF на xAI Files API)

1. **Прочитать архивные TZ** для понимания контекста:
   - [TZ_DocumentTruncationSilent](../_backlog/_archive/TZ_DocumentTruncationSilent.md) — что было с обрезкой больших документов
   - [TZ_EstimatorIgnoresAttachments](../_backlog/_archive/TZ_EstimatorIgnoresAttachments.md) — что было с estimator'ом и binary
   - [TZ_SimplyChatBillingLeak/HANDOFF.md](../_archive/TZ_SimplyChatBillingLeak/HANDOFF.md) — что было с inline-файлами

2. **Расширить scope Шага 4 на не-PDF файлы.** Концепт миграции описывает только PDF в Блоке 3. Но та же проблема (inline-текст копится) есть для `.docx`/`.xlsx`/`.csv`. Решение: единый путь через xAI Files API для всех типов документов.

3. **УДАЛИТЬ переходный код в `route.ts`.** Блок добавлен 2026-04-28 в [stripOldAttachmentsFromHistory](../../app/(chat)/api/chat/route.ts#L343-L352) — комментарий начинается с `// Inline-текст текстовых файлов`. После Шага 4 `convertTextFilePartsInMessage` перестаёт генерировать `📄 **Файл:**` markers, и этот блок становится no-op мёртвым кодом.

4. **Опционально удалить convertTextFilePartsInMessage.** Если Шаг 4 полностью забирает обработку файлов на xAI Files API — функция в [route.ts:233](../../app/(chat)/api/chat/route.ts#L233) больше не нужна. Проверить все call sites перед удалением.

### При начале Шага 7 (Артефакты A/B)

1. **Прочитать архивные TZ:**
   - [TZ_GrokSkipsUpdateDocumentTool](../_backlog/_archive/TZ_GrokSkipsUpdateDocumentTool.md) — Grok иногда игнорит updateDocument tool
   - [TZ_RevealVsPptxToolSelection](../_backlog/_archive/TZ_RevealVsPptxToolSelection.md) — модель путает reveal и pptx

2. Эти проблемы могут быть свойствами текущей модели (Grok 4.1 Fast). A/B покажет нужна ли отдельная правка prompt'а или замена модели решает проблему.

### При начале Шага 8 (Экспертиза + Verifier)

1. **Прочитать архивный TZ:**
   - [TZ_ExpertiseReasoningRestore](../_backlog/_archive/TZ_ExpertiseReasoningRestore.md) — была регрессия `@ai-sdk/xai@3.0.83` (`reasoning part not found` при параллельных tool calls). Самый дешёвый workaround — sequential tool calls (`xai.parallel_function_calling: false`). Возможно к моменту Шага 8 SDK уже починен.

### При начале Шагов 1/10 (Briefing)

1. **Прочитать архивный TZ:**
   - [TZ_BriefingScriptwriterPromptUpdate](../_backlog/_archive/TZ_BriefingScriptwriterPromptUpdate.md) — устаревшие metadata «MiniMax M2-Her» в `briefing-scriptwriter.md:4-6`. Обновить заодно.

---

## Состояние кода на 2026-04-28

### Незакоммиченные изменения

```
M lib/ai/compaction/prepare-messages.ts  (+19 строк, фикс compaction noop)
M app/(chat)/api/chat/route.ts           (+13 строк, переходный stripOldFile)
M lib/ai/registry.ts                     (правка не из этой сессии — проверить)
```

`prepare-messages.ts` — оставить, переживёт миграцию.
`route.ts` — оставить как переходный код до Шага 4, потом удалить (см. выше).

### Активные процессы / dev environment

- Dev сервер запущен (`next dev` PID 88257), HMR подхватывает правки в API routes
- Симли chat для тестов: `3353a183-37f5-498e-b461-c2e87ff65ef1` (370+ сообщений)
- compactionIndex = 20, compactionCount = 18 (после ряда compaction-turn'ов в этой сессии)

### НЕ нужно делать

- НЕ запускать `pnpm build` / `npm run build` пока активен dev — сломает HMR + автоматически накатит pending миграции
- НЕ чинить «новые» баги без проверки — закрывает ли их какой-то шаг миграции (новый принцип triage)
- НЕ создавать новые ТЗ автоматически на каждую находку — backlog раздулся именно из-за этого

---

## Правила работы (напоминание)

См. [WORKFLOW.md](../WORKFLOW.md) и [CLAUDE.md](../../CLAUDE.md). Ключевые:

1. **Official docs FIRST** — перед работой с новой технологией WebSearch + WebFetch актуальной документации
2. **Один коммит на ТЗ** (не поэтапно)
3. **`pnpm build` автоматически накатывает migrations** — предупреждать владельца
4. **Не трогать CLAUDE.md** при финализации ТЗ — история в CHANGELOG, пофайловая карта в `docs/architecture.md`
5. **Ответ владельцу ≤ 10 строк** (исключение — анализ ТЗ, код-ревью)
6. **Найден bug → проверить миграцию** перед созданием отдельного ТЗ

---

## Что делать первым в следующей сессии

```
1. Прочитать этот файл (HANDOFF_NEXT_SESSION.md)
2. Спросить владельца: «Quick wins (3 ТЗ, 1.5-2 сессии) или сразу Шаг 3 миграции?»
3. Действовать по ответу
```
