# Анализ ТЗ-ExpertiseCreateVisionRouting

**Дата анализа:** 2026-04-21
**Источник:** specs/_backlog/TZ_ExpertiseCreateVisionRouting.md (High impact долг)

---

## Резюме

В expertise/create отсутствует vision-routing на Haiku 4.5, который уже работает в simply через `simply-chat-vision`. Сканированный PDF (или PDF из CAD/чертежа, не извлекаемый как текст на Layer 0) попадает в payload как `file part` c `mediaType: "application/pdf"` и падает на Grok 4.20 (у которого `documentSupport=false` по SSOT каталога) с `AI_UnsupportedFunctionalityError`. Задача — распространить проверенный simply-pattern на expertise/create: новые taskId для vision-ветки + селективный роутинг + снять gate `chatMode === "simply"` с capability-адаптера истории.

---

## Изученная документация (Правило 1)

### Внешние технологии, затронутые ТЗ

1. **Anthropic Claude Haiku 4.5 (PDF input)**
   - Источник: [Claude API Docs — Models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [AWS Bedrock model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html)
   - Ключевые факты:
     - Haiku 4.5 нативно принимает `text | image | pdf` как input modality.
     - Context window 200K, output до 64K.
     - **PDF до 100 страниц** при inline base64 / URL / Files API (зафиксировано в `CAPS_CLAUDE_200K_DOCS` нашего каталога, совпадает с текущей Anthropic документацией).
     - Caveat: Haiku без prompt-injection protection — релевантно при обработке untrusted attachments. Для нашего кейса (пользователь сам загружает свой документ) не блокирующе, но стоит держать в уме.
   - **Изменений с последнего использования нет** — Haiku 4.5 используется в simply-chat-vision, project:expert:haiku, vision:ocr и работает стабильно.

2. **xAI Grok 4.1 Fast / 4.20 (vision + PDF)**
   - Источник: [xAI Release Notes](https://docs.x.ai/developers/release-notes), [xAI docs — Vision](https://x.ai/api), [Oracle docs — Grok 4.1 Fast](https://docs.oracle.com/en-us/iaas/Content/generative-ai/xai-grok-4-1-fast.htm)
   - Ключевые факты:
     - Vision: только JPG/PNG, base64 inline, 256–1792 токенов на картинку.
     - **PDF как file part — не поддерживается.** Документальное цитирование подтверждает наш `CAPS_GROK.documentSupport.supported=false` в model-catalog.
     - Files API существует, но в Simply не интегрирован (явно отмечено комментарием в catalog:137).
   - **Изменений нет** — паттерн симметричен тому, что уже работает в simply.

3. **Vercel AI SDK v6 (file parts, capabilities)**
   - Ничего нового: `hasAttachments()`, `adaptHistoryToCapabilities()`, `convertTextFilesInAllMessages()` — всё уже написано под simply, паттерн готовый, API стабилен с v6.

### Красные флаги / грабли

- **Нет новых API для изучения** — ТЗ переиспользует уже выверенные механизмы. Риск «устаревшей памяти» минимален.
- **Единственная реальная развилка** — scope самого роутинга (см. вопрос Q1).

---

## Рекомендации разработчика (Код-ревью ТЗ)

> **Обновлено после замечания владельца 2026-04-21:** изначально предлагал дубли taskId (`expertise-vision` / `create-vision`), повторяющие simply-pattern. Владелец справедливо указал: это размножение сущностей. Плюс я не включил `project:expert:*` в scope. Правильный подход — **один универсальный механизм**, работающий для всех chat modes (simply / expertise / create / project) через capability-check из SSOT. Ниже — пересмотренная архитектура.

### 🟢 Единый механизм (рекомендуется)

**Принцип:** Не «в каких режимах роутить на Haiku», а «когда default-модель режима не тянет вложение».

Это уже закрепленный архитектурный выбор — смотри [SIMPLY_ATTACHMENT_ARCHITECTURE.md § «Три слоя обработки»](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md): «Любая модель умеет работать с текстом. Не каждая модель умеет работать с файлами.» И уже используется в двух местах:
- `adaptHistoryToCapabilities` — capability-driven fallback для истории.
- `upload/route.ts extractPdfText` — Layer 0 конвертация текстовых PDF до чата.

Но **момент routing'а** (выбор active модели для текущего turn'а) сделан хардкодом для simply и отсутствует для остальных. Исправление — распространить тот же SSOT-принцип.

**Алгоритм (один на все режимы):**

```typescript
// 1. Резолв default taskId по режиму (без изменений существующей логики)
let defaultTaskId: TaskId;
if (isProjectChat && project) {
  defaultTaskId = `project:expert:${tier}` as TaskId;
} else if (chatMode === "simply") {
  defaultTaskId = think ? "simply-chat-think" : "simply-chat";
} else {
  defaultTaskId = getTaskIdForChatMode(chatMode);
}

// 2. Универсальный capability-check (SSOT из model-catalog)
const activeTaskId = needsVisionFallback(message.parts, defaultTaskId)
  ? "chat-vision"          // Haiku 4.5, единственный attachment-handler
  : defaultTaskId;
```

где:

```typescript
function needsVisionFallback(parts: any[], taskId: TaskId): boolean {
  const caps = getModelEntry(getModelIdForTask(taskId))?.capabilities;
  if (!caps) return false;
  return parts.some((p) => {
    if (p.type === "image" || (p.type === "file" && p.mediaType?.startsWith("image/"))) {
      return !caps.vision;
    }
    if (p.type === "file" && p.mediaType === "application/pdf") {
      return !caps.documentSupport?.supported;
    }
    return false;
  });
}
```

### Что получаем

| Аспект | Текущее состояние | После |
|---|---|---|
| taskId для vision-ветки | 1 хардкод (`simply-chat-vision`) + ТЗ предлагает ещё 2 дубля | **Один** `chat-vision` (переименование `simply-chat-vision` — дропнуть префикс `simply-`) |
| Режимы покрытые vision-fallback | Только simply | simply ✅, expertise ✅ новое, create ✅ новое, project ✅ автоматически (но Claude-tiers не триггерят — capability=true, правильно) |
| Логика детекции | Хардкод `hasAttachments()` без учёта capability | Capability-driven: если модель умеет — роутинг не срабатывает |
| Future-proof | При появлении PDF-support у Grok надо вручную править hardcode | SSOT: флаг `documentSupport.supported=true` в catalog → роутинг перестаёт срабатывать автоматически |
| Код в route.ts | 9 строк if/else simply + планировалось ещё ~20 на expertise/create/project | ~10 строк единой функции + 3-строчный unified routing |
| Новых taskId | +2 (`expertise-vision`, `create-vision`) | +0 (переименование `simply-chat-vision` → `chat-vision`) |

### Почему project chat «автоматически ОК»

`project:expert:haiku/sonnet/opus` — все Anthropic, у всех `vision=true` + `documentSupport.supported=true`. Capability-check вернёт `false` → роутинг не сработает → модель tier'а сама обрабатывает файл. Это **желаемое** поведение: пользователь заплатил за Opus tier в проекте → не хотим тихо подменять модель на Haiku при каждом вложении.

Если в будущем появятся non-Anthropic tiers (например `project:expert:grok`) — механизм сработает и для них без единой правки кода.

### Снятие gate'ов на simply

`adaptHistoryToCapabilities` и `convertTextFilesInAllMessages` после унификации routing'а применяются ко всем chat modes безусловно. Это уже следствие, а не отдельное решение — единый pipeline на всё.

### Что с FINDINGS

`convertTextFilesInAllMessages` сегодня gated на simply (строки 988-991). На practice Layer 0 uploaded уже text-plain inline, но legacy БД-записи могли остаться в file-part форме. Снятие gate — pure safety backstop, такой же как `adaptHistoryToCapabilities`. Делаем симметрично в этом же ТЗ, не выносим в follow-up.

### ⚠️ Что нужно не потерять при унификации

| Риск | Mitigation |
|---|---|
| Переименование `simply-chat-vision` → `chat-vision` ломает references в коде | `grep -rn 'simply-chat-vision'` перед правкой. Правится строго через SSOT — union TaskId, DEFAULT_TASK_MODELS, DEFAULT_MAX_OUTPUT_TOKENS, TASK_DESCRIPTIONS, composer, prompts. TS compiler поймает всё. |
| Promptbuilder: `simply-chat-vision.md` system prompt | Скорее всего есть `lib/prompts/...` файл. Проверить — если да, просто переименовать файл. |
| `/dev/models` overrides в БД могли сохранить `simply-chat-vision` как ключ | Миграция ключа в дев-конфиге (1 UPDATE + FINDINGS если значимо) |
| Ai_usage_log исторические записи с `taskId="simply-chat-vision"` | Не трогаем — исторические данные остаются, новые пишутся под `chat-vision`. В аналитике просто два label'а до определённой даты. |

### ❌ Что НЕ делаем (зачем НЕ дубли)

Исходный план ТЗ с `expertise-vision` + `create-vision` имел обоснование «независимый override через /dev/models». Контр-аргумент: через `/dev/models` пользователь хочет поменять модель для *tаска* («что у меня сейчас роутится на Haiku» → заменить на Sonnet). В unified-варианте это всё равно **один переключатель** — не нужно менять три места.

---

## Решения (зафиксированы с владельцем 2026-04-21)

- **Архитектура:** единый capability-driven механизм, один taskId `chat-vision` (переименование из `simply-chat-vision`).
- **Scope routing'а — строго capability-driven:** fallback на Haiku срабатывает ТОЛЬКО когда default-модель режима не поддерживает тип вложения. По текущему каталогу:
  - JPG/PNG → Grok 4.1 Fast / Grok 4.20 справляются нативно (`vision=true`) → роутинг НЕ срабатывает, картинка идёт на модель режима (у reasoning-моделей картинка попадает в reasoning-контекст — качественнее чем описание Haiku + ответ Grok).
  - application/pdf → Grok не умеет (`documentSupport.supported=false`) → роутинг на Haiku.
  - Текстовые PDF уже конвертятся в text/plain на Layer 0 — сюда попадают только **сканы/encrypted/extraction-failed**, которые и были единственной реальной проблемой.
- **Модель fallback:** Haiku 4.5 (уже проверен в simply).
- **Gate'ы:** оба (`adaptHistoryToCapabilities` + `convertTextFilesInAllMessages`) снимаем симметрично — один pipeline для всех режимов.
- **ai_usage_log:** `chatMode` остаётся UX-режимом (`simply/expertise/create`); фильтр по `taskId="chat-vision"` даёт весь vision-трафик.
- **project:expert:** не требует отдельной ветки — Claude-tiers `vision=true` + `documentSupport.supported=true` → capability-check возвращает false → модель tier'а обрабатывает вложение сама.
- **Изменение поведения simply (важно):** сейчас любое вложение → Haiku. После ТЗ: JPG/PNG останутся на Grok 4.1 Fast. Проверяется в smoke-тесте владельцем; если качество картинок на Grok 4.1 Fast не устроит — вернём «always-Haiku-on-attach» флаг, но это будет отдельное решение, не дефолт.
- **Рефакторинг:** routing-логика выносится в `lib/ai/routing.ts` (`resolveActiveTaskId(...)`), `chat/route.ts` худеет. `hasAttachments()` удаляется — избыточен после введения `needsVisionFallback`.
- **ADR:** финализация — `docs/decisions/NNN-capability-driven-attachment-routing.md` фиксирует принцип как третий SSOT-паттерн проекта.

---

## Потенциальные риски

1. **Регрессия expertise без attachments** — легко проверить: simple text-запрос без файлов → `hasAttachments === false` → routing не триггерится → activeTaskId остаётся `"expertise"` → Grok 4.20 reasoning. Проверяется smoke-тестом.
2. **Регрессия simply vision** — код simply-ветки не трогаем, только добавляем ветки для expertise/create. Риск нулевой при аккуратной реализации.
3. **adaptHistoryToCapabilities после снятия gate** — теперь применяется ко ВСЕМ chat modes. В истории project:expert (Claude, все capabilities=true) ничего не вырежется. В истории expertise/create (Grok 4.20: vision=true, documentSupport=false) вырежутся PDF-файлы → заменятся на текстовый placeholder. **Это желаемое поведение** (backstop, ТЗ прямо этого хочет). Риск только если в истории лежит изображение, которое Grok 4.20 умеет, но capabilities некорректны — проверил: `CAPS_GROK.vision=true`, корректно.
4. **Layer 0 уже извлекает текстовые PDF.** В expertise/create попадают только сканы / encrypted / extraction-failed PDF. Объём трафика на новую Haiku-ветку — меньше, чем мог бы быть изначально. Хорошо для бюджета.
5. **Dev switchboard interaction** — после добавления двух новых taskId они сразу появятся в `/dev/models`. UI корректно рендерит всё из `ALL_TASK_IDS`, регрессии нет.

---

## Зависимости

- **Затронутые файлы (планируемые — после унификации):**
  - `lib/ai/task-assignments.ts` — переименование taskId `simply-chat-vision` → `chat-vision` (4 места: union, DEFAULT_TASK_MODELS, DEFAULT_MAX_OUTPUT_TOKENS, TASK_DESCRIPTIONS). **Новых taskId не добавляем.**
  - `app/(chat)/api/chat/route.ts` — ввести helper `needsVisionFallback(parts, defaultTaskId)` + переписать блок routing'а (строки 617-631) на unified pattern; снять gate'ы на `adaptHistoryToCapabilities` и `convertTextFilesInAllMessages` (строки 988-998).
  - `lib/prompts/...` — проверить grep на `simply-chat-vision` (builders, composer), переименовать где встречается.
  - `docs/ai-chats-map.md` — обновить таблицу (триггер Правило 6).
- **Никаких новых зависимостей / миграций / env vars.** Haiku 4.5 уже в каталоге, оплачен, используется.
- **Выполненные пререквизиты:** ТЗ-ATTACH-1 закрыто (Layer 0 PDF extraction работает), ТЗ-SimplyReadDocumentTool закрыто (`adaptHistoryToCapabilities` реализована через SSOT capabilities).
- **Grep-аудит для планирования:** `grep -rn "simply-chat-vision" lib/ app/ docs/` — полный список call-site'ов для переименования.

---

## Оценка сложности

- [x] **Простое (0.5–0.7 сессии)**
- [ ] Среднее
- [ ] Сложное

Оценка чуть выше ТЗ-шной (0.5 сессии) — из-за переименования `simply-chat-vision` → `chat-vision` и grep-аудита call-site'ов. Но архитектурно проще — меньше сущностей в коде.

**Декомпозиция (ориентир, финал — в ROADMAP):**
- Этап A (SSOT): переименование taskId в `task-assignments.ts` + `grep`-аудит всех call-site'ов + починка references. `npx tsc --noEmit` ловит всё через `Record<TaskId,...>`. ~20 мин.
- Этап B (unified routing + снятие gate'ов): `needsVisionFallback()` helper + переписанный блок в `chat/route.ts`. ~30 мин.
- Этап C (документация): `docs/ai-chats-map.md`. ~10 мин.
- Этап D (smoke-тест владельцем): 5 сценариев — скан-PDF в simply / expertise / create; картинка в expertise; картинка в project:expert:haiku (должна идти на tier, НЕ роутиться). ~15 мин.

---

## Следующий шаг

Решения зафиксированы. Приступаю к созданию `ROADMAP.md` по шаблону `ROADMAP_GUIDE.md`, далее `CHANGELOG.md` + `HANDOFF.md`, затем показываю план владельцу на утверждение перед стартом разработки.
