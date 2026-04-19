# ТЗ-ExpertiseCreateVisionRouting — vision-routing для expertise/create (как в Simply)

**Статус:** Архитектурный долг, High impact (падение запросов с non-text PDF/картинками)
**Создано:** 2026-04-19 (выявлено в smoke test ТЗ-COMPACTION-1 Этап B1)
**Связано с:** [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts), [lib/ai/vision-ocr.ts](../../lib/ai/vision-ocr.ts), [SIMPLY_ATTACHMENT_ARCHITECTURE.md](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md)

---

## Симптом

В expertise/create при загрузке сканированного PDF (или PDF из CAD/чертежа без извлекаемого текста) запрос падает:

```
Error [AI_UnsupportedFunctionalityError]:
  'file part media type application/pdf' functionality not supported.
```

Воспроизведение: загрузить `Carwash Building - 1 этаж.pdf` (или любой scan/CAD-PDF) в expertise → upload Layer 0 не извлекает текст → файл попадает в payload как `file` part с `mediaType: "application/pdf"` → Grok 4.1 Fast / Grok 4.20 не поддерживают PDF нативно → AI SDK бросает unsupported error → user сидит без ответа.

---

## Root cause

В [chat/route.ts:622-626](../../app/(chat)/api/chat/route.ts#L622-L626) для **simply** chatMode реализован capability-routing:

```typescript
// Priority: think → Grok 4.20, attachments → Haiku 4.5 (vision), default → Grok 4.1 Fast
if (hasAttachments) {
  activeTaskId = "simply-chat-vision";  // → claude-haiku-4-5-20251001
}
```

Это переключает taskId на `simply-chat-vision` → Haiku 4.5, который умеет PDF/картинки нативно.

**В expertise/create этого блока routing'а нет.** Сообщение всегда идёт на основную модель expertise (Grok 4.20-0309-reasoning или override на 4.1 Fast), которая для не-извлечённых PDF падает.

Также в [chat/route.ts:1043-1052](../../app/(chat)/api/chat/route.ts#L1043-L1052) `adaptHistoryToCapabilities` — функция fallback'а заменяющая неподдерживаемые file parts на текстовые placeholder'ы — gated **только на simply**:

```typescript
const preparedHistory =
  chatMode === "simply"
    ? adaptHistoryToCapabilities(...)
    : textInlinedHistory;
```

В expertise/create нет ни proactive routing'а, ни reactive fallback'а.

---

## Существующая инфраструктура (использовать, не создавать заново)

1. **`lib/ai/vision-ocr.ts`** — Vision OCR через Claude Haiku 4.5 (taskId `vision:ocr`). Умеет PDF, image/png, image/jpeg, сканированные документы. С billing-логированием.
2. **`activeTaskId = "simply-chat-vision"`** routing pattern — переиспользовать архитектуру для expertise/create.
3. **`adaptHistoryToCapabilities`** — fallback на текстовые placeholder'ы для legacy file parts в истории.

---

## Решение (рекомендованное направление)

**Распространить vision-routing pattern на expertise/create:**

1. **Новые taskId** в [task-assignments.ts](../../lib/ai/task-assignments.ts):
   - `expertise-vision: claude-haiku-4-5-20251001`
   - `create-vision: claude-haiku-4-5-20251001`

2. **Routing** в [chat/route.ts](../../app/(chat)/api/chat/route.ts) перед resolution `activeTaskId`:
   - Для `chatMode === "expertise"` с attachments containing неподдерживаемые типы (PDF без извлечения, image без vision) → `activeTaskId = "expertise-vision"`
   - Для `chatMode === "create"` аналогично → `"create-vision"`
   - Логика «hasAttachments && !modelSupportsType» взять из simply-chat-vision pattern

3. **adaptHistoryToCapabilities** — снять gate `chatMode === "simply"`, применять для всех режимов. Это backstop для legacy записей в истории (когда модель в этом turn'е не та что обработала вложение оригинально).

---

## Альтернативы (рассмотреть)

1. **Pre-processing OCR** — при upload Layer 0 ВСЕГДА вызывать `vision-ocr.ts` для PDF которые не дали текст через `pdf-parse`. Тогда expertise/create получают только text/plain. Минус: дополнительная latency на upload, может удвоить cost для PDF (если pdf-parse и vision-ocr оба запускаются).

2. **Two-step Haiku** — Haiku описывает PDF/картинку в своём вызове, описание идёт в историю как text, дальше основная модель (Grok) видит текстовое описание. Уже есть в roadmap как «будущее улучшение» в [SIMPLY_ATTACHMENT_ARCHITECTURE.md:72](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md#L72).

---

## Acceptance criteria

- [ ] Smoke test: загрузить сканированный PDF (CAD-чертёж) в expertise → запрос проходит без `AI_UnsupportedFunctionalityError`, модель Haiku даёт описание/анализ.
- [ ] То же для create.
- [ ] Регрессия simply: vision routing продолжает работать как было.
- [ ] Регрессия expertise/create без attachments: основная модель (Grok) используется как раньше.
- [ ] `ai_usage_log` пишет `chatMode: "expertise-vision"` / `"create-vision"` для verification.

---

## НЕ в scope

- Замена Haiku на другую vision-модель — отдельный продуктовый вопрос (cost/quality tradeoff).
- Multi-Agent анализ документа — отдельный roadmap (Responses API + MCP).
- OCR coursework для специфических доменов (CAD, рукописный текст) — отдельные ТЗ.

---

## Оценка

**0.5 сессии:**
- Добавить 2 taskId в task-assignments.ts (5 мин).
- Routing блок в chat/route.ts по simply-chat-vision pattern (30 мин).
- Снятие gate adaptHistoryToCapabilities (5 мин).
- Smoke test 3 сценариев (15 мин).
- CHANGELOG + commit (10 мин).
