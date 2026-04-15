# Backlog ТЗ — открытые долги и находки

> Список нерешённых задач, найденных при работе над предыдущими ТЗ.
>
> **Перед стартом нового большого ТЗ** Claude обязан пройтись по этому списку и
> предложить пользователю: «В backlog N открытых долгов: …. Хочешь сначала закрыть
> какой-то из них, или они не блокируют новый ТЗ?» Решение принимает пользователь.
>
> Этот файл и папку создаёт правило 8 WORKFLOW.md (FINDINGS → backlog).
>
> Создан: 2026-04-13

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
| [TZ_ErrorRecoveryUI](TZ_ErrorRecoveryUI.md) | Stage 2 — root cause fix: useChat state recovery через правильную обработку `clearError` для не-ChatSDK ошибок. Stage 1 (hint в красном флаге) ✅ сделан в v3.90.0+. | 0.5 сессии | 9 эпизодов в разных ТЗ |

### 🟧 Medium impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_DevPanelFooterHidesSubCalls](TZ_DevPanelFooterHidesSubCalls.md) | **DevPanel footer скрывает nested AI-вызовы (артефакты, clerks, tools).** Footer показывает модель + стоимость только parent chat, sub-calls (artifact:markdown → Sonnet, clerks → Haiku и т.д.) не агрегируются. Пример: в /expertise с Grok 4.1 Fast создан markdown-артефакт → footer «Grok 4.1 Fast — 3.43 руб», но SQL: 92% стоимости ушло на Sonnet sub-call внутри artifact handler. Backend observability (ai_usage_log) корректен, проблема только frontend. | 0.5–1 сессия | Владимир, 2026-04-16 во время тестирования ТЗ-XAI-4 |
| [TZ_TaskExpertChatInputMissingOnFirstOpen](TZ_TaskExpertChatInputMissingOnFirstOpen.md) | **Task expert chat без поля ввода при входе из режима планирования.** Первый заход в задачу после утверждения плана показывает ответ эксперта, но не рендерит `multimodal-input` внизу. Hard reload лечит — воспроизводится 100%. Гипотеза — useChat state / hydration order при client navigation. Раздражает UX каждый раз при переключении задач. | 0.5–1 сессия | Владимир, 2026-04-16 во время тестирования ТЗ-XAI-4 |
| [TZ_SimplyContextUsageWidget](TZ_SimplyContextUsageWidget.md) | **UI виджет контекста в Simply показывает не ту шкалу** — знаменатель прогресс-бара привязан к `contextWindow` модели (128K), а не к `SIMPLY_CONTEXT_LIMIT` (200K). Даёт ложную тревогу («55% предела» когда реально 23% от наших порогов Extract-on-compression). Плюс — число 128K для Grok 4.1 Fast подозрительное, возможно ошибка в model-catalog. Плюс — «Расход за сессию» без определения термина «сессия». | 1 сессия | Владимир, 2026-04-16 после ТЗ-ATTACH-1 |
| [TZ_PromptsDeadCodeCleanup](TZ_PromptsDeadCodeCleanup.md) | Удалить мёртвые экспорты из `lib/ai/prompts.ts` (`artifactsPrompt`, `regularPrompt`, `systemPrompt` deprecated, `buildUserContext` deprecated). 90% файла dead, только `updateDocumentPrompt` живой. Рассмотреть переименование в `lib/ai/artifact-prompts.ts`. | 0.5 сессии | TZ_DeadModelSelectors |
| [TZ_SimplyChatRaceCondition](TZ_SimplyChatRaceCondition.md) | `getOrCreateSimplyChat` без partial unique index → race при первых параллельных запросах нового пользователя (SELECT + INSERT без транзакционной защиты). Partial unique index + `onConflictDoNothing`. | 0.5 сессии | ТЗ-XAI-2 smoke test |

---

## Закрытые долги

История закрытых долгов вынесена в отдельный архивный журнал:
**[`_archive/BACKLOG_CLOSED.md`](../../_archive/BACKLOG_CLOSED.md)**

Этот файл держит только открытые долги. Когда долг закрывается — запись переносится в архивный журнал, сюда не добавляется.
