# Backlog ТЗ — открытые долги и находки

> 📋 **План разруливания** → [TRIAGE.md](TRIAGE.md) — рекомендуемый порядок решения с зависимостями (CRITICAL: Simply Chat memory, далее quick wins).

> Список нерешённых задач, найденных при работе над предыдущими ТЗ.
>
> **Перед стартом нового большого ТЗ** Claude обязан пройтись по этому списку и
> предложить пользователю: «В backlog N открытых долгов: …. Хочешь сначала закрыть
> какой-то из них, или они не блокируют новый ТЗ?» Решение принимает пользователь.
>
> Этот файл и папку создаёт правило 8 WORKFLOW.md (FINDINGS → backlog).
>
> Создан: 2026-04-13
> Обновлён: 2026-04-27 — **TZ_SimplyChatMemoryRegression закрыт** (ТЗ-FixSimplyMemory v3.100.0 + hotfix v3.100.1, см. [BACKLOG_CLOSED](../_archive/BACKLOG_CLOSED.md)). Ранее в этот же день добавлены 7 новых записей из FINDINGS ТЗ-MigrateArtifactPromptsToSkills.

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
  1. Файл удаляется из `_backlog/`
  2. ТЗ уходит в `_archive/TZ_<name>/` со своим `HANDOFF.md`
  3. **Запись о закрытии добавляется в [`_archive/BACKLOG_CLOSED.md`](../../_archive/BACKLOG_CLOSED.md) — исторический журнал**
  4. В этом README (в секции «Открытые долги») запись УДАЛЯЕТСЯ — не дублируется в «Закрытые»

**Этот файл держит ТОЛЬКО открытые долги.** История закрытых — в `_archive/BACKLOG_CLOSED.md`.

---

## Открытые долги

### 🟥 High impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_MindAtomicityFix](TZ_MindAtomicityFix.md) | `markMessagesExtracted` в [lib/ai/memory/extract.ts:235-246](../../lib/ai/memory/extract.ts#L235-L246) безусловно отмечает сообщения как extracted даже при провале `processAndStoreFact` (Voyage 403). Память безвозвратно теряется. Fix: условный mark + retry с backoff. | 0.3-0.5 сессии | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #4 |
| [TZ_ChatModeUndefinedSubmit](TZ_ChatModeUndefinedSubmit.md) | Runtime error `getChatUrl: chatMode "undefined"` в `submitForm` блокирует submit при открытом артефакте. Контракт `chatMode?: string` опциональный — TS не возражает, родители не передают. F5 помогает временно. | 0.5 сессии | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #6 |
| [TZ_GrokSkipsUpdateDocumentTool](TZ_GrokSkipsUpdateDocumentTool.md) | Grok 4.1 Fast иногда генерит ответ как обычный chat-message вместо вызова `updateDocument` tool. Артефакт не обновляется, пользователь видит «модель ничего не сделала». Усилить tool description / system prompt. | 0.3-0.5 сессии | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #7 |
| [TZ_PptxRevealUpdateRender](TZ_PptxRevealUpdateRender.md) | Презентации (pptx/reveal) не перерисовываются в холсте после `onUpdateDocument` — БД и blob обновлены, превью генерится, но клиент показывает старую версию. Скачанный файл свежий. Скорее всего проблема в client-side state / data-pptxComplete handler. | 0.5-1 сессия | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #1 |

### 🟧 Medium impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_ExpertiseReasoningRestore](TZ_ExpertiseReasoningRestore.md) | Экспертиза руками понижена с `grok-4.20-reasoning` → `grok-4.20-non-reasoning` из-за регрессии `@ai-sdk/xai@3.0.83`: при параллельных tool calls `webSearch+librarySearch` ломается reasoning-stream (`reasoning part not found`), запрос виснет с пустым ответом. Качество Экспертизы снижено. Что пробовали и не помогло: апдейт SDK, `reasoningEffort:high` (xAI не поддерживает), кастомный `reasoningReconciliationMiddleware`. Самый дешёвый путь — попробовать sequential tool calls (`xai.parallel_function_calling: false`). | 0.5-1 сессия | Существует с 2026-04-23 (commit `a469c51`); в README ранее не отражён, добавлен в финализации ТЗ-BriefingStuckRecovery |
| [TZ_BriefingConcurrencyGuard](TZ_BriefingConcurrencyGuard.md) | Гонка cron-запуска и user-triggered `/api/briefing/generate` для одного userId. Оба INSERT'нут 'generating' (после ТЗ-BriefingStuckRecovery — сделают два UPDATE'а), приведёт к двойной работе и потенциальному overwrite готового брифинга. Решение: partial unique index `(userId) WHERE status='generating'` (как для simply-chat) или `SELECT FOR UPDATE` lock. | 0.3-0.5 сессии | Найден в B5 ANALYSIS ТЗ-BriefingStuckRecovery (вынесен из scope) |
| [TZ_RevealVsPptxToolSelection](TZ_RevealVsPptxToolSelection.md) | AI выбирает `presentation-pptx` когда пользователь просит `reveal`. Reveal-артефакт практически недоступен через AI-канал. Уточнить tool description, или deprecate reveal если мало используется. | 0.2-1 сессия | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #2 |
| [TZ_ChatInputBlockedOnDocumentFetchHang](TZ_ChatInputBlockedOnDocumentFetchHang.md) | Chat input блокируется когда `GET /api/document` висит в Neon timeout 10s. UX полностью замораживается. Расцепить input ↔ artifact loading + timeout 5s + graceful UI fallback. | 0.5 сессии | Этап 7 ТЗ-MigrateArtifactPromptsToSkills, FINDINGS #3 |

### 🟦 Low impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_BriefingScriptwriterPromptUpdate](TZ_BriefingScriptwriterPromptUpdate.md) | Header `lib/prompts/briefing/briefing-scriptwriter.md:4-6` содержит устаревшую metadata: «Модель: MiniMax M2-Her» и «MiniMax Speech 2.8 HD TTS». После ТЗ-BR-AUTHOR-KIMI весь `briefing:podcast-script` работает на Kimi K2.6, TTS — Gemini. Промпт целиком уходит в system message → модель видит вранье о своей identity. PE-сессия для обновления метаданных. | 0.1-0.2 сессии | Найден в Этапе 5 ТЗ-BR-AUTHOR-KIMI (SPEC явно запретил трогать промпты — вынесено вне scope) |

---

## Закрытые долги

История закрытых долгов вынесена в отдельный архивный журнал:
**[`_archive/BACKLOG_CLOSED.md`](../../_archive/BACKLOG_CLOSED.md)**

Этот файл держит только открытые долги. Когда долг закрывается — запись переносится в архивный журнал, сюда не добавляется.
