# ADR 055: Capability-Driven Attachment Routing

**Дата:** 2026-04-21
**Статус:** Принято

---

## Контекст

Обработка вложений (image, pdf) в chat-handler была рассогласована между режимами:

- **simply:** хардкод «любое вложение → Haiku 4.5» через `hasAttachments()` helper и taskId `simply-chat-vision`. Применялось всегда, даже когда default-модель режима (Grok 4.1 Fast) умеет картинки нативно.
- **expertise / create:** routing-блока не было. Default-модель Grok 4.20 получала PDF как `file part` → AI SDK падал с `AI_UnsupportedFunctionalityError` на сканированных PDF (CAD-чертежи и другие не-извлекаемые PDF).
- **project chat:** taskId собирался как template string `\`project:expert:${tier}\`` с tier из `ProjectModelTier = "executor" | "expert" | "professor"`. Эти строки не существуют в `TaskId` union — ни один taskId с такими суффиксами. `getModelIdForTask` не находил их в `DEFAULT_TASK_MODELS`, routing полагался на параллельный путь `getProjectModel(tier).model` для фактического выбора модели, а `activeTaskId` записывался в `ai_usage_log` как несуществующий ключ → data-consistency была нарушена.

Дополнительно: helper'ы `convertTextFilesInAllMessages` и `adaptHistoryToCapabilities` были gated на `chatMode === "simply"`, что означало два параллельных pipeline для обработки истории сообщений.

SSOT уже существовала — capabilities каждой модели (`vision`, `documentSupport.supported`) зафиксированы в `lib/ai/model-catalog.ts`, — но routing-логика эту SSOT не использовала.

---

## Решение

**Capability-driven attachment routing** — единый механизм fallback для всех chat modes:

1. `lib/ai/routing.ts` — новый модуль с чистыми функциями:
   - `resolveActiveTaskId(ctx)` — единая точка резолва активного taskId для запроса
   - `needsVisionFallback(parts, defaultTaskId)` — capability-check из SSOT каталога

2. Алгоритм:
   - Резолв default taskId по chat mode / project tier (через `getTaskIdForTier`, не template string).
   - Проверка capabilities default-модели против типов вложений в запросе.
   - Если модель не поддерживает хотя бы один тип — переключение на `chat-vision` (Claude Haiku 4.5).
   - Иначе — default taskId.

3. Переименование taskId: `simply-chat-vision` → `chat-vision`. Смысл расширен — это не частный случай simply, а универсальный vision-fallback.

4. Снятие gate'ов: `convertTextFilesInAllMessages` и `adaptHistoryToCapabilities` применяются ко всем chat modes, pipeline унифицирован.

5. Удаление `hasAttachments()` — избыточен после введения `needsVisionFallback`.

---

## Причины

1. **Один принцип вместо трёх хардкодов.** Раньше: simply (вложение → Haiku), expertise/create (нет routing, падение), project (неправильные taskId). После: «если модель режима не тянет вложение — fallback на Haiku», применяется ко всем режимам.

2. **SSOT используется как источник истины.** `capabilities` в каталоге уже существовали, но routing их игнорировал. Теперь `needsVisionFallback` читает `getModelEntry(getModelIdForTask(taskId))?.capabilities` — одна цепочка из SSOT.

3. **Ортогональность с `/dev/models` override.** `getModelIdForTask` уже учитывает override, значит capability-check делается на **реально активной** модели, а не на default из каталога. Если владелец override'нет expertise на Sonnet (vision+pdf=true) — fallback автоматически отключается. Если на MiniMax (vision=false) — fallback включается для картинок. Никакого дополнительного кода.

4. **Future-proof.** Когда xAI добавит PDF-support для Grok — достаточно переключить флаг `documentSupport.supported=true` в model-catalog, routing автоматически перестанет гнать PDF на Haiku. Без правок кода в `chat/route.ts`.

5. **Cost-оптимизация.** До ТЗ: в simply картинка всегда шла на Haiku ($1/$5 + один лишний прокси-вызов), хотя Grok 4.1 Fast ($0.2/$0.5) имеет `vision=true` и справляется сам. После: картинка остаётся на Grok, fallback срабатывает только для реально не поддерживаемых типов (PDF-сканы). Протестировано владельцем 2026-04-21 — качество приемлемое.

6. **Исправление параллельного бага.** Фикс `project:expert:${tier}` → `getTaskIdForTier(tier)` устранил data-consistency issue в ai_usage_log. TypeScript-enforcement через `Record<TaskId,...>` вместо runtime template-string.

---

## Последствия

### Плюсы

- Единый pipeline обработки вложений на 4 chat modes (simply / expertise / create / project).
- Падение `AI_UnsupportedFunctionalityError` на сканированных PDF в expertise/create закрыто.
- SSOT через capabilities каталога — новые модели добавляются одной записью, routing подхватывает без изменений.
- Dev switchboard работает через один taskId `chat-vision` — меняется модель fallback'а в одном месте.
- Code simplification: удалён `hasAttachments()`, удалены два гейта на chatMode, routing-блок в chat/route.ts ужался с ~15 строк до 6.
- ai_usage_log теперь пишет корректные taskId для project chats.

### Минусы / Trade-offs

- Изменение поведения simply на картинках: раньше Haiku, теперь Grok 4.1 Fast. Качество подтверждено приемлемым в smoke-тесте, но это регрессия-потенциал при сложных визуальных запросах. Mitigation: `/dev/models` override — меняется одной строкой.
- Существующие записи в `ai_usage_log` с `taskId="simply-chat-vision"` остаются; аналитика показывает два label'а до deploy-даты. Приемлемо, не ломает исторические отчёты.

---

## Альтернативы

### Альтернатива 1: Дубли taskId по режимам (исходный план ТЗ)

**Что это:** Добавить `expertise-vision` и `create-vision` taskId симметрично `simply-chat-vision`; в каждом режиме хардкодить `if (hasAttachments) → vision-taskId`.

**Почему отклонили:**
- Три дубля одной сущности в `TaskId` union.
- Не покрывает project chat.
- Не использует SSOT capabilities — через N режимов пришлось бы вручную переключать N ifов когда Grok получит PDF.
- Больше строк кода.

**Когда может быть лучше:** если бы разные режимы реально требовали разных vision-моделей (например expertise на Sonnet, create на Haiku). Сейчас одна Haiku покрывает все случаи.

### Альтернатива 2: Pre-processing OCR при upload

**Что это:** Вместо runtime-routing — на upload'е конвертить **все** PDF (и изображения) в text/plain через Haiku OCR. В чат попадает только text.

**Почему отклонили:**
- Удваивает cost на upload для PDF где pdf-parse справляется (Layer 0 уже делает это бесплатно).
- Latency на upload растёт.
- Теряется возможность для моделей-с-vision (Grok, Claude) видеть оригинальную картинку.
- Layer 0 (текстовые PDF → text/plain) уже реализован в ТЗ-ATTACH-1 и работает ортогонально этому ADR.

**Когда может быть лучше:** если бы мы хотели полностью убрать vision-модели из chat-handler. Сейчас цель другая — гибрид работает лучше.

---

## Ссылки и ресурсы

- [SPEC.md ТЗ-ExpertiseCreateVisionRouting](../../_archive/TZ_ExpertiseCreateVisionRouting/SPEC.md) (после архивации)
- [lib/ai/routing.ts](../../lib/ai/routing.ts) — модуль реализации
- [SIMPLY_ATTACHMENT_ARCHITECTURE.md](../../specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) — архитектура вложений (обновлена)
- [ADR 047 — Core Model Registry](./047-core-model-registry.md) — SSOT каталог моделей (базис)
- [ADR 048 — Dev Switchboard UI](./048-dev-switchboard-ui.md) — override mechanism

---

## История изменений

- **2026-04-21** — Документ создан (ТЗ-ExpertiseCreateVisionRouting финализация).
