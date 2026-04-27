# Backlog Triage — план разруливания

> Порядок решения 10 открытых долгов с обоснованием и зависимостями. Этот файл — рабочий план для следующих ТЗ серии Simply_Migration после ТЗ-2 (MigrateArtifactPromptsToSkills, закрыт 2026-04-27, коммит `c04e73e`).
>
> **Источник большинства долгов:** мануальный смок-тест Этапа 7 ТЗ-MigrateArtifactPromptsToSkills выявил 7 предсуществующих багов (1 critical + 4 high + 2 medium). FINDINGS детально → `specs/_archive/Simply_Migration/TZ_MigrateArtifactPromptsToSkills/FINDINGS.md`.
>
> **Создан:** 2026-04-27

---

## Сводка приоритетов

| Блок | ТЗ | Impact | Оценка | Зависит от |
|---|---|---|---|---|
| **A.1** | [TZ_MindAtomicityFix](TZ_MindAtomicityFix.md) | 🟥 high | 0.3-0.5 сессии | — |
| **A.2** | [TZ_SimplyChatMemoryRegression](TZ_SimplyChatMemoryRegression.md) | 🟥 **CRITICAL** | 1-2 сессии | A.1 |
| **B.1** | [TZ_ChatModeUndefinedSubmit](TZ_ChatModeUndefinedSubmit.md) | 🟥 high | 0.5 сессии | — |
| **B.2** | [TZ_PptxRevealUpdateRender](TZ_PptxRevealUpdateRender.md) | 🟥 high | 0.5-1 сессия | — |
| **C.1** | [TZ_GrokSkipsUpdateDocumentTool](TZ_GrokSkipsUpdateDocumentTool.md) | 🟥 high | 0.3-0.5 сессии | A.2 |
| **D.1** | [TZ_RevealVsPptxToolSelection](TZ_RevealVsPptxToolSelection.md) | 🟧 medium | 0.2-1 сессия | — |
| **D.2** | [TZ_ChatInputBlockedOnDocumentFetchHang](TZ_ChatInputBlockedOnDocumentFetchHang.md) | 🟧 medium | 0.5 сессии | — |
| **E.1** | [TZ_ExpertiseReasoningRestore](TZ_ExpertiseReasoningRestore.md) | 🟧 medium | 0.5-1 сессия | — |
| **E.2** | [TZ_BriefingConcurrencyGuard](TZ_BriefingConcurrencyGuard.md) | 🟧 medium | 0.3-0.5 сессии | — |
| **E.3** | [TZ_BriefingScriptwriterPromptUpdate](TZ_BriefingScriptwriterPromptUpdate.md) | 🟦 low | 0.1-0.2 сессии | — |

**Итого:** ~5-9 сессий на полный разгребный pass через все 10 долгов.

---

## Блок A — Память (CRITICAL, делать первым)

> **Задача блока:** вернуть Simply Chat способность помнить контекст разговора. Сейчас модель помнит только последнее сообщение (см. описание в TZ_SimplyChatMemoryRegression). Это **главная UX-катастрофа** проекта.

### A.1 — TZ_MindAtomicityFix (фундамент)

**Делать первым в блоке.** Без атомарности любые улучшения памяти бессмысленны: новые факты будут продолжать теряться при сетевых сбоях Voyage. Это — обязательный фундамент.

**Что:** в [lib/ai/memory/extract.ts:235-246](../../lib/ai/memory/extract.ts#L235-L246) `markMessagesExtracted` вызывается безусловно даже при провале `processAndStoreFact`. Сообщения помечаются как «обработаны», факты в БД/Voyage не записаны → потеря памяти.

**Fix (минимальный):** условный mark — отметка extracted только если все факты успешно сохранены. Иначе retry на следующем on-visit.

**Оценка:** 0.3-0.5 сессии (изолированный fix в одной функции + регресс-тест).

### A.2 — TZ_SimplyChatMemoryRegression (главное лечение)

**Делать после A.1.** Архитектурный фильтр `excludeExtracted=true` режет inline-историю до сообщений с `extractedAt IS NULL`, при этом 192 сообщения чата (49k tokens) использовали бы 25% окна grok-4-1-fast (200k). История бы помещалась целиком без всякой компрессии.

**Гипотезы решения** (выбрать в ANALYSIS):
1. Адаптивный фильтр — не применять `excludeExtracted=true` пока история помещается в `soft_threshold` (100k tokens). Только при превышении — переключаться на extracted-фильтр.
2. Гибрид — всегда грузить последние N=50-100 сообщений независимо от `extractedAt`, плюс retrieve фактов для всего что старше.
3. Усилить retrieve — поднимать 20-30 фактов вместо 5-10 + keyword-search по entities.

**Оценка:** 1-2 сессии (требует архитектурного решения + замеры).

---

## Блок B — Quick Wins (high, делать параллельно с A)

> **Задача блока:** два изолированных high-impact bug с быстрым решением. Не зависят от Блока A. Можно запускать **параллельно** разработчиком/сессией.

### B.1 — TZ_ChatModeUndefinedSubmit

Runtime error `getChatUrl: chatMode "undefined"` блокирует submit при открытом артефакте. TS-fix контракта пропа `chatMode?: string` → `chatMode: string`. Найти проблемного родителя и добавить недостающий проп.

**Оценка:** 0.5 сессии.

### B.2 — TZ_PptxRevealUpdateRender

Презентации не перерисовываются в холсте после `onUpdateDocument` (БД и blob обновлены, скачанный файл свежий, но клиент показывает старую версию). Скорее всего проблема в client-side state или `data-pptxComplete` event handler.

**Оценка:** 0.5-1 сессия (debug client state + правка event handler).

---

## Блок C — Зависимое от Блока A

### C.1 — TZ_GrokSkipsUpdateDocumentTool

**Делать после A.2.** Grok 4.1 Fast иногда генерит ответ как обычный chat-message вместо вызова `updateDocument` tool. Частично следствие проблемы памяти — модель не «помнит» что артефакт существует, потому что сообщение про создание уже extractedAt. После лечения памяти hit-rate вызова tool должен вырасти.

**Метрика для следующей сессии:** замерить % случаев когда модель вызывает tool на запрос «отредактируй артефакт» **до** и **после** A.2.

**Если после лечения памяти hit-rate всё ещё низкий** — добавить prompt-усиление в tool description («при просьбе перепиши/сократи всегда вызывай этот tool»).

**Оценка:** 0.3-0.5 сессии (сама правка), плюс A/B-замер.

---

## Блок D — Хвосты medium impact

### D.1 — TZ_RevealVsPptxToolSelection

AI выбирает `presentation-pptx` когда пользователь просит `reveal`. Уточнить tool description, или **deprecate reveal** если он мало используется (спросить владельца). Если deprecate — отдельная задача с UI cleanup.

**Оценка:** 0.2 сессии (правка description) или 1 сессия (deprecate с cleanup).

### D.2 — TZ_ChatInputBlockedOnDocumentFetchHang

Chat input блокируется при висящем `GET /api/document` (Neon timeout 10s). Расцепить input от artifact loading + 5s timeout + graceful UI fallback.

**Оценка:** 0.5 сессии.

---

## Блок E — Старые долги (не из ТЗ-2)

> Эти долги предшествуют ТЗ-MigrateArtifactPromptsToSkills и не блокируют разруливание Блоков A-D. Но при текущей серии Simply_Migration могут быть подняты в подходящий момент.

### E.1 — TZ_ExpertiseReasoningRestore (medium)

Экспертиза временно понижена с `grok-4.20-reasoning` на non-reasoning из-за регрессии `@ai-sdk/xai@3.0.83` (`reasoning part not found` при параллельных tool calls). Самый дешёвый путь — попробовать sequential tool calls (`xai.parallel_function_calling: false`).

**Оценка:** 0.5-1 сессия. Существует с 2026-04-23.

### E.2 — TZ_BriefingConcurrencyGuard (medium)

Гонка cron-запуска и user-triggered «Сгенерировать» для одного userId. Решение: partial unique index или optimistic lock.

**Оценка:** 0.3-0.5 сессии.

### E.3 — TZ_BriefingScriptwriterPromptUpdate (low)

Header `briefing-scriptwriter.md:4-6` содержит устаревшую metadata «Модель: MiniMax M2-Her». После ТЗ-BR-AUTHOR-KIMI весь briefing на Kimi K2.6. PE-сессия для обновления.

**Оценка:** 0.1-0.2 сессии.

---

## Рекомендуемая стратегия запуска

**Первая последовательность (если двигать в одну линию):**
1. **A.1 → A.2** (память, ~1.5-2.5 сессии) — главный приоритет
2. **B.1 + B.2** (quick wins, ~1-1.5 сессии) — параллельно или сразу после A
3. **C.1** (post-A замер + правка, ~0.5 сессии)
4. **D.1, D.2, E.1, E.2, E.3** (хвосты, по мере возможности)

**Альтернатива (если важна быстрая видимость прогресса):**
1. **B.1** (TZ_ChatModeUndefinedSubmit) — самый быстрый high-impact win, 0.5 сессии
2. Дальше **A.1 → A.2** (память)
3. Остальное

Решение по конкретному порядку — за владельцем при старте следующего ТЗ.

---

## Связь с серией Simply_Migration

Backlog **не блокирует** продолжение серии Simply_Migration (концепт миграции на xAI/Kimi). Шаги 7+ концепта (A/B артефактов) разблокированы ТЗ-2.

Но **Блок A (память)** имеет риск **усугубиться** при миграции артефактов на Kimi/Grok — модели менее жирные на следование инструкциям могут хуже справляться с обрезанным контекстом. Поэтому **рекомендую Блок A разрулить до Шага 7** концепта миграции.

---

## Обновление этого документа

При закрытии любого долга:
1. Соответствующий файл удаляется из `_backlog/`
2. ТЗ уходит в `_archive/TZ_<name>/`
3. Запись добавляется в `_archive/BACKLOG_CLOSED.md`
4. **Этот TRIAGE обновляется** — закрытый блок помечается ✅ с датой закрытия (запись не удаляется, чтобы прогресс был виден в истории).
