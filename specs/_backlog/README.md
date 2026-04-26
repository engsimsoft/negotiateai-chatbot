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
> Обновлён: 2026-04-26 — закрыт TZ_BriefingStuckRecovery (v3.99.1); добавлены: TZ_BriefingMiniMaxHang (High, найден в ходе финализации), TZ_ExpertiseReasoningRestore (Medium, ранее пропущен в README — существует с 2026-04-23), TZ_BriefingConcurrencyGuard (Medium, B5 финализации)

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
| [TZ_BriefingMiniMaxHang](TZ_BriefingMiniMaxHang.md) | `briefing:author` и `briefing:section` (MiniMax-M2.7-long через AI SDK 6.0.168) — silent hang `streamText` после filter-stage. AbortSignal.timeout(180_000) не срабатывает. Гипотеза: регрессия в `ai@6.0.168` (апгрейд от 23 апреля коммит `97af934`) на парсинге Anthropic-protocol stream от MiniMax с reasoning-блоками. Последний успешный прогон 2026-04-23 19:04 (`ai_usage_log` подтверждает). **Briefing полностью неработоспособен в production**, watchdog ТЗ-BriefingStuckRecovery маскирует hang как 'failed' через 10 мин. | 0.5-1 сессия | Найден 2026-04-26 в ходе мануального тестирования ТЗ-BriefingStuckRecovery. Подробная диагностика — [AUDIT_BRIEFING.md § 4.1](../_archive/TZ_BriefingStuckRecovery/AUDIT_BRIEFING.md) |

### 🟧 Medium impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_ExpertiseReasoningRestore](TZ_ExpertiseReasoningRestore.md) | Экспертиза руками понижена с `grok-4.20-reasoning` → `grok-4.20-non-reasoning` из-за регрессии `@ai-sdk/xai@3.0.83`: при параллельных tool calls `webSearch+librarySearch` ломается reasoning-stream (`reasoning part not found`), запрос виснет с пустым ответом. Качество Экспертизы снижено. Что пробовали и не помогло: апдейт SDK, `reasoningEffort:high` (xAI не поддерживает), кастомный `reasoningReconciliationMiddleware`. Самый дешёвый путь — попробовать sequential tool calls (`xai.parallel_function_calling: false`). | 0.5-1 сессия | Существует с 2026-04-23 (commit `a469c51`); в README ранее не отражён, добавлен в финализации ТЗ-BriefingStuckRecovery |
| [TZ_BriefingConcurrencyGuard](TZ_BriefingConcurrencyGuard.md) | Гонка cron-запуска и user-triggered `/api/briefing/generate` для одного userId. Оба INSERT'нут 'generating' (после ТЗ-BriefingStuckRecovery — сделают два UPDATE'а), приведёт к двойной работе и потенциальному overwrite готового брифинга. Решение: partial unique index `(userId) WHERE status='generating'` (как для simply-chat) или `SELECT FOR UPDATE` lock. | 0.3-0.5 сессии | Найден в B5 ANALYSIS ТЗ-BriefingStuckRecovery (вынесен из scope) |

### 🟩 Low impact (косметика)

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_CompactionActualCalibration](TZ_CompactionActualCalibration.md) | Compaction формула `totalContext = system + history + new + mind + tools` доведена до ±10-15% точности (ТЗ-COMPACTION-1). После недели MVP в production — sanity-check delta нашего `estimate` vs `actual.promptTokens` из `ai_usage_log`. Если ratio за пределами 0.85-1.15 — калибровать коэффициенты `estimateTokenCount` или перейти на tiktoken-based tokenizer. Иначе закрыть как невостребованный. | 0.3 сессии (или 0 если ratio ок) | Архитектор по решению Проблемы #2 ТЗ-COMPACTION-1 |

---

## Закрытые долги

История закрытых долгов вынесена в отдельный архивный журнал:
**[`_archive/BACKLOG_CLOSED.md`](../../_archive/BACKLOG_CLOSED.md)**

Этот файл держит только открытые долги. Когда долг закрывается — запись переносится в архивный журнал, сюда не добавляется.
