# ANALYSIS — TZ_SimplyReadDocumentTool + R-6 correction

**Дата:** 2026-04-15
**Scope:** v3.90.2 hotfix
**Верификация против кода:** ✅ Полная

---

## Находка 1 — readDocument tool полностью мёртвый

### Первоначальная гипотеза SPEC

SPEC предлагал три варианта (A/B/C):
- **A** — убрать из Simply active tools
- **B** — научить tool различать knowledge/ vs attached
- **C** — правка промпта

### Аудит против кода и git history

**Файл [lib/ai/tools/read-document.ts:22](../../lib/ai/tools/read-document.ts#L22):**
```ts
if (!normalizedPath.startsWith("knowledge/") && !normalizedPath.startsWith("knowledge\\")) {
  throw new Error("Access denied: Only files in knowledge/ directory can be read");
}
```

Tool жёстко привязан к папке `knowledge/` на файловой системе.

**Git history:**
```
62540ff cleanup: remove old MIR.TRADE files and documentation
— 126 файлов удалено, знаменитая папка knowledge/ полностью исчезла
— Часть v2.0.0 "Family AI Assistant launch" pivot, ещё до Simply
```

Папка не существует ни локально (`ls knowledge/ → No such file or directory`), ни в git-дереве. Tool **всегда** возвращает ошибку для любого пользователя любого режима.

### Вывод

Tool — не Simply-specific quality issue. Это **dead legacy code** из pre-Simply эпохи. Правильный вариант — полное удаление:

| Место использования | Удалить | Обоснование |
|---|---|---|
| [lib/ai/tools/read-document.ts](../../lib/ai/tools/read-document.ts) | Весь файл (243 строки) | Tool не работает нигде |
| [lib/ai/tools/chat-tools.ts](../../lib/ai/tools/chat-tools.ts) | 4 места (import, getStandardTools, ALL_TOOL_NAMES, baseTools) | Registry cleanup |
| [components/message.tsx](../../components/message.tsx) | Render block (52 строки) | UI код который никогда не рендерится |
| [lib/prompts/chat/simply-chat.md](../../lib/prompts/chat/simply-chat.md) | Упоминание в «Не пиши:» | Устаревшая инструкция |
| [lib/prompts/skills/document/analyze-document/SKILL.md](../../lib/prompts/skills/document/analyze-document/SKILL.md) | Все упоминания (frontmatter + процесс) | Skill использовал tool который не работал |
| [lib/prompts/agents/ben/references/features.md](../../lib/prompts/agents/ben/references/features.md) | Строка с readDocument | Legacy фича-лист |

Итого: ~350 строк dead code + updated docs.

---

## Находка 2 — R-6 в ТЗ-XAI-3 реализован неполно

### Контекст предупреждения

В ROADMAP серии Simply_xAI ([SIMPLY_XAI_ROADMAP.md:96](../Simply_xAI/SIMPLY_XAI_ROADMAP.md#L96)) было явное указание:

> **[R-6, критично]** Полностью убрать `isSimplyNonAnthropicModel` + связанные strip-функции (`stripMediaPartsForTextModel`, `stripLegacyOpenAICompatToolParts`). Заменить на явную проверку `capabilities.vision` из `model-catalog.ts` (SSOT). **НЕ полагаться на маршрутизацию «vision → Haiku спасёт» — это хрупкая логика. Убирать причину, а не симптом.**

### Что было сделано в ТЗ-XAI-3 (v3.90.0)

Из [TZ_xai_3/ROADMAP.md:67-68](../Simply_xAI/TZ_xai_3/ROADMAP.md#L67):
```
- [x] 2.1 Создана функция inlineTextFileParts(messages) (заменила stripMediaPartsForTextModel)
- [x] 2.2 stripMediaPartsForTextModel удалена (заменена через единый Edit на inlineTextFileParts)
```

`inlineTextFileParts` обрабатывает **только** `text/plain` parts. Image и PDF parts **не трогаются**. Обоснование в ANALYSIS:

> «`stripMediaPartsForTextModel` (L257-284): заменяет image/file parts на текстовые плейсхолдеры. Нужна только когда модель не поддерживает vision. **Grok 4.1 Fast умеет vision → логика умирает.**»

Это утверждение было неверным.

### Реальные capabilities Grok (из model-catalog.ts)

```ts
const CAPS_GROK: ModelCapabilities = {
  vision: true,                    // ← Grok принимает image/png, image/jpeg
  documentSupport: {
    supported: false,              // ← но НЕ принимает application/pdf
    reason: "xAI Files API не интегрирован в Simply..."
  },
};
```

**Два разных capability:**
- `vision: true` — принимает `image/*` через стандартные image content parts
- `documentSupport: true` — принимает `application/pdf` через нативный PDF processing или Files API

Grok 4.1 Fast умеет vision для картинок, но для PDF нужен xAI Files API (не интегрирован). Я в ANALYSIS XAI-3 смешал эти два capability и удалил `stripMediaPartsForTextModel` думая что Grok заменит Haiku полностью.

### Последствие — bug из сессии 2026-04-15

Пользовательский сценарий:
1. Прикрепил PDF → `hasAttachments(message.parts) === true` → route `simply-chat-vision` → Haiku корректно обрабатывает, ответ сохранён в БД вместе с PDF file part
2. Follow-up текстовое сообщение → `hasAttachments === false` → route `simply-chat` → Grok
3. Grok загружает историю → видит PDF file part из шага 1
4. Crash: `AI_UnsupportedFunctionalityError: 'file part media type application/pdf' functionality not supported`

Routing смотрит только на **текущее** сообщение. История не участвует в routing decision. Значит любое follow-up текстовое сообщение после PDF attachment = гарантированный crash.

### Правильное решение — через SIMPLY_ATTACHMENT_ARCHITECTURE.md

Архитектурный документ (утверждён 2026-04-15) содержит буквальное описание нужной функции:

> «adaptHistoryToCapabilities — функция-адаптер. Если в истории остался file part который текущая модель не поддерживает (например, image part при модели без vision, или PDF part при Grok), заменяет на текстовый placeholder. Работает через capabilities из model-catalog (SSOT).»

Это и есть то что Roadmap требовал в R-6: «заменить на явную проверку `capabilities.vision` из `model-catalog.ts` (SSOT)» — просто документ детализировал что нужна не просто проверка, а **адаптация истории**.

---

## Реализация v3.90.2

### Функция adaptHistoryToCapabilities

[app/(chat)/api/chat/route.ts:252-344](../../app/(chat)/api/chat/route.ts#L252) — добавлена функция `adaptHistoryToCapabilities(messages, capabilities)`:

```ts
function adaptHistoryToCapabilities(
  messages: ChatMessage[],
  capabilities: ModelCapabilities | undefined,
): ChatMessage[] {
  if (!capabilities) return messages;  // conservative fallback

  const supportsVision = capabilities.vision === true;
  const supportsPdf = capabilities.documentSupport?.supported === true;

  return messages.map((message) => {
    const adaptedParts = message.parts.map((part: any) => {
      if (part.type === "file") {
        const mediaType = part.mediaType ?? "";

        // text/plain handled upstream by convertTextFilesInAllMessages
        if (mediaType === "text/plain") return part;

        if (mediaType.startsWith("image/")) {
          if (supportsVision) return part;
          return { type: "text", text: `[Ранее было прикреплено изображение: ${fileName}...]` };
        }

        if (mediaType === "application/pdf") {
          if (supportsPdf) return part;
          return { type: "text", text: `[Ранее был прикреплён PDF-документ: ${fileName} — текущая модель не поддерживает PDF...]` };
        }

        // other types — conservative placeholder
        return { type: "text", text: `[Ранее был прикреплён файл: ${fileName} (${mediaType})]` };
      }

      // legacy "image" part type
      if (part.type === "image") {
        if (supportsVision) return part;
        return { type: "text", text: `[Ранее было прикреплено изображение — текущая модель не поддерживает изображения]` };
      }

      return part;
    });
    return { ...message, parts: adaptedParts } as ChatMessage;
  });
}
```

### Интеграция в preparedHistory pipeline

[app/(chat)/api/chat/route.ts:968-1000](../../app/(chat)/api/chat/route.ts#L968):

```ts
const cleanedHistory = stripIncompleteToolParts(uiMessages);
const textInlinedHistory =
  chatMode === "simply"
    ? await convertTextFilesInAllMessages(cleanedHistory)
    : cleanedHistory;
const preparedHistory =
  chatMode === "simply"
    ? adaptHistoryToCapabilities(
        textInlinedHistory,
        effectiveCatalogEntry?.capabilities,
      )
    : textInlinedHistory;
```

Три шага:
1. `stripIncompleteToolParts` — универсальный (все провайдеры)
2. `convertTextFilesInAllMessages` — text/plain → inline text (уже был)
3. `adaptHistoryToCapabilities` — R-6 correction, capability-aware (новый)

### Gate на chatMode 'simply'

Почему только Simply:
- **Expertise/Create** — разовые чаты, история живёт в пределах одной сессии, edge case с смешанными media parts редкий
- **Project** — проекты используют Claude (полный capability set для vision/PDF), adapter всегда no-op
- **Simply** — persistent chat, где история накапливается годами, race between Grok/Haiku routing гарантирован

Если в будущем Expertise/Create тоже переключатся на модели без полного capability set — adapter легко распространить, одна строка.

---

## Маппинг на SIMPLY_ATTACHMENT_ARCHITECTURE.md

| Принятое решение документа | Реализация в v3.90.2 |
|---|---|
| №1 Гибрид Grok + Haiku | Routing не менял (через `hasAttachments`) |
| №2 Haiku отвечает напрямую | Не менял |
| №3 `adaptHistoryToCapabilities` через SSOT | **Функция буквально реализована** |
| №4 PDF extraction при upload — отдельный ТЗ | Не в этом scope, создан [TZ_ATTACH_PdfExtractionAtUpload](../_backlog/TZ_ATTACH_PdfExtractionAtUpload.md) |
| №5 Пороги — эмпирически | Не задаю новые пороги |

---

## Риски

- **Low.** Adapter замены происходят только в `chatMode === "simply"` ветке, не трогают expertise/create/project. Функция pure (no side effects), принимает и возвращает массив сообщений. Тесты: tsc clean, build clean.
- **Edge case: PDF-в-истории + user asks follow-up** — модель (Grok) видит placeholder вместо file part, может ответить «я не вижу содержимое PDF сейчас — прикрепи файл повторно». Это **желаемое поведение** — честный сигнал пользователю вместо silent data loss или crash.
