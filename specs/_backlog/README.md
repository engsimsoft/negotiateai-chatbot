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

### 🟧 Medium impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_PromptsDeadCodeCleanup](TZ_PromptsDeadCodeCleanup.md) | Удалить мёртвые экспорты из `lib/ai/prompts.ts` (`artifactsPrompt`, `regularPrompt`, `systemPrompt` deprecated, `buildUserContext` deprecated). 90% файла dead, только `updateDocumentPrompt` живой. Рассмотреть переименование в `lib/ai/artifact-prompts.ts`. | 0.5 сессии | TZ_DeadModelSelectors |

### 🟩 Low impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_GrokContextWindowAudit](TZ_GrokContextWindowAudit.md) | Эмпирическая проверка реального context window для Grok 4.20 (каталог: 256K, docs.x.ai: 2M). Бинарный поиск через xAI API, обновить `model-catalog.ts` (Finding #1) | 0.5 сессии | TZ_LegacyChatCleanup |

---

## Закрытые долги

История закрытых долгов вынесена в отдельный архивный журнал:
**[`_archive/BACKLOG_CLOSED.md`](../../_archive/BACKLOG_CLOSED.md)**

Этот файл держит только открытые долги. Когда долг закрывается — запись переносится в архивный журнал, сюда не добавляется.
