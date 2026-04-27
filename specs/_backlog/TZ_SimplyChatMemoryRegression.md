# TZ_SimplyChatMemoryRegression

**Impact:** 🟥 CRITICAL
**Найдено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills (2026-04-27)
**Источник:** диалог владельца про потерю памяти про artefact, FINDINGS #5 ТЗ-MigrateArtifactPromptsToSkills

## Проблема

Simply Chat «помнит только последнее сообщение» с точки зрения пользователя. Архитектура Simply агрессивно режет inline-историю через `excludeExtracted=true` фильтр в `getMessagesByChatId`, **независимо от наличия места в context window**.

## Воспроизведение (chat `3353a183-37f5-498e-b461-c2e87ff65ef1`, 2026-04-27)

- **192 сообщения в БД** (49k токенов суммарно)
- **190 помечено `extractedAt!=null`** (MIND extract job их обработал)
- **2 сообщения в inline-контексте** (видимы для модели)
- **Окно модели grok-4-1-fast: 200k токенов**
- **Использовано: 7 156 токенов (3.5% окна)** — `system: 4256 + history: 1832 + new: 26 + mind: 180 + tools: 1334`
- В абсолютном выражении вся история **в 4 раза меньше окна модели**

Пользователь спросил «помнишь artefact про утреннюю пробежку?» (созданный 30 минут назад в этом же чате через `tool-createDocument`). Модель ответила «не помню, не храню историю между сессиями». Ассистент **сам же создал** этот артефакт, но через 30 минут не помнит.

## Где код

- **Фильтр:** [lib/db/queries.ts:520-533](lib/db/queries.ts#L520-L533) — `getMessagesByChatId({ id, excludeExtracted, ... })`. Когда `excludeExtracted=true` (для simply-chat) — `WHERE extractedAt IS NULL`.
- **MIND extract:** [lib/ai/memory/extract.ts](lib/ai/memory/extract.ts) — помечает `extractedAt = NOW()`
- **MIND retrieve:** [lib/ai/memory/retrieve.ts](lib/ai/memory/retrieve.ts) — поднимает 5-10 фактов через Voyage embedding similarity (компенсация)
- **Compaction:** [lib/ai/compaction/](lib/ai/compaction/) — soft 100k / hard 170k. Здесь не срабатывает (action=noop при 7k tokens)

## Гипотезы решения

1. **Адаптивный фильтр (рекомендую):** не применять `excludeExtracted=true` пока inline-история помещается в `soft_threshold` (100k tokens). Только при превышении — переключаться на extracted-фильтр + retrieve. Сжимать только когда **реально нужно**, а не превентивно.
2. **Гибрид:** всегда грузить последние N=50-100 сообщений независимо от `extractedAt`, плюс retrieve фактов для всего что старше. Дифференциация по recency, не по флагу extract.
3. **Усилить retrieve:** поднимать 20-30 фактов (запас токенов есть), плюс keyword-search по entities (artifact title/id, document references) поверх семантического embedding-поиска.
4. **MIND extract intelligence:** сейчас факты слишком абстрактные. Нужны facts с привязкой к конкретным entities (artifact id, document title, project id) для надёжного retrieve.

## Влияние

UX-катастрофа для основного сценария «помнишь, мы вчера обсуждали X». Пользователь теряет доверие к ассистенту. Связано с TZ_GrokSkipsUpdateDocumentTool — модель не вызывает updateDocument, потому что не «помнит» что артефакт существует.

## Связанные

- TZ_MindAtomicityFix — потеря фактов при провале Voyage upload (усугубляет эту проблему)
- TZ_GrokSkipsUpdateDocumentTool — частично следствие
