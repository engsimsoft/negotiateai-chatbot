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
- Если долг закрыт — файл удаляется из `_backlog/`, а закрывшее его ТЗ уходит в `_archive/` со ссылкой в своём CHANGELOG: «закрывает backlog/TZ_X»

---

## Открытые долги

### 🟧 Medium impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_DeadModelSelectors](TZ_DeadModelSelectors.md) | Удалить `lib/ai/models.ts` + 5 dead импортёров (3 model-selector компонента, dropdown в multimodal-input, entitlements). Покрывает Findings #4, #6, #7 из TZ_LegacyChatCleanup | 1–2 сессии | TZ_LegacyChatCleanup |
| [TZ_UsageLoggingCoverage](TZ_UsageLoggingCoverage.md) | Покрыть `ai_usage_log` всеми вызовами `getModel(taskId)` (фоновые: util:title, OCR, клерки, сервисные чаты, briefing pipelines). Расхождение с Anthropic Console ~10%. Включает переименование/документирование `inputTokens` (Findings #2, #3) | 1 сессия | TZ_LegacyChatCleanup |
| [TZ_StreamObservability](TZ_StreamObservability.md) | Заменить молчаливый `onError: () => "Oops"` в обоих chat routes на `console.error` + `emitDebugError` (Finding #5) | 0.5 сессии | TZ_LegacyChatCleanup |
| [TZ_CreateSnapshotAudit](TZ_CreateSnapshotAudit.md) | SQL audit реальных вызовов `createSnapshot` tool. Если 0 — удалить tool целиком. Если есть — задокументировать use case (Finding #8) | 0.5 сессии | TZ_LegacyChatCleanup |

### 🟩 Low impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_GrokContextWindowAudit](TZ_GrokContextWindowAudit.md) | Эмпирическая проверка реального context window для Grok 4.20 (каталог: 256K, docs.x.ai: 2M). Бинарный поиск через xAI API, обновить `model-catalog.ts` (Finding #1) | 0.5 сессии | TZ_LegacyChatCleanup |

---

## Происхождение по ТЗ

| ТЗ-источник | Дата | Долгов внесено |
|---|---|---|
| TZ_LegacyChatCleanup | 2026-04-13 | 5 (4 medium + 1 low) |
