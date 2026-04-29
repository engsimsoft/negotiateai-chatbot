# ADR 058: Контент файлов НИКОГДА не инлайнится в `Message_v2.parts` — только file-references

**Дата:** 2026-04-29
**Статус:** Принято

---

## Контекст

**Симптом, который повторялся минимум 4 раза:** биллинг-спайк в Simply Chat при наличии прикреплённых файлов в истории. Признаки:
- `fresh_input_tokens` устойчиво растёт после каждого нового файла, не возвращается к baseline
- В `Message_v2.parts` обнаруживаются гигантские text-парты с маркером `📄 **Файл: <name>**\n\`\`\`\n<content>\n\`\`\``
- В UI старые сообщения «раскрываются» полным текстом файла («портянка») вместо карточки
- На каждом turn'е эти text-парты целиком улетают в xAI как часть истории чата

**Самый яркий случай (ради ориентира):** chat `3353a183` к 2026-04-29 содержал 23 user-сообщения с маркером, суммарно ~720K токенов раздутой истории. Одна запись `c7853a33` = 685K токенов / 2.86 МБ.

**Хронология попыток решения:**

| # | Когда | ТЗ | Что сделали | Что НЕ закрыли |
|---|---|---|---|---|
| 1 | До 04-2026 | TZ_SimplyChatBillingLeak | Strip файлов из старых turn'ов в `stripOldAttachmentsFromHistory` (только последние 2 user-msg видны полностью) | Не отменили саму конверсию file→text при upload — только маскировали |
| 2 | 2026-04-28 (v3.100.5) | TZ_InlineFilePortyanka | UI-детектор маркера `📄 **Файл:` в `components/message.tsx` → рендер карточкой `<PreviewAttachment>` вместо markdown | Косметика — text-парты в БД остались, в xAI продолжали уходить |
| 3 | 2026-04-29 коммит `1dedf27` | TZ_FilesAPIMigration Phase 3 | Удалена `convertTextFilePartsInMessage` + все 3 call sites + UI-детектор маркера. Новые файлы идут как file-reference через xAI Files API | Legacy записи в БД не мигрировали; удаление UI-детектора нарушило SPEC §5.6 «Backward compat (R8)» — портянки визуально раскрылись |
| 4 | 2026-04-29 Phase 3.5 | TZ_FilesAPIMigration | DELETE legacy данных в smoke-чате `3353a183` (273 MIND + 232 Stream + 454 Message_v2). Hot-fix только для smoke. | Регрессия в коде уже закрыта Phase 3, но `stripOldAttachmentsFromHistory` strip-стратегия из §5.6 не верифицирована end-to-end. Если в prod-deployment появятся такие записи — нужна placeholder-migration |

---

## Решение

**Архитектурный принцип:** содержимое прикреплённого файла **НИКОГДА** не сохраняется в `Message_v2.parts` как `text` part. Только file-reference:

```typescript
{
  type: "file",
  mediaType: "application/pdf" | "text/plain" | "image/...",
  name: "filename.ext",
  url: "https://blob.vercel-storage.com/...",
  providerMetadata: { xai: { fileId: "file_..." } }
}
```

xAI парсит файл по `file_id` на своей стороне (Files API + Responses API path). Локальная конверсия PDF/DOCX/XLSX/MD/CSV → text для inlining'а в parts **запрещена**.

**Контракт по слоям:**

| Слой | Правило |
|---|---|
| Upload (`app/(chat)/api/files/upload/route.ts`) | Файл → Vercel Blob + xAI Files API → возвращает `file_id`. НЕ извлекает текст в response, кроме изображений (vision path) |
| User-message creation | `Message_v2.parts` сохраняет `{type:"file", providerMetadata.xai.fileId}` + опциональный `{type:"text", text:"<user prompt>"}`. Никаких text-партов с содержимым файла |
| Payload в xAI (`prepareMessagesWithCompaction` + chat route) | `convertToModelMessages` пропускает file-parts с `providerMetadata.xai.fileId` напрямую в Responses API. Старые legacy text-парты с маркером (если ещё есть) — strip'аются в `stripOldAttachmentsFromHistory` на лету |
| UI (`components/message.tsx`) | Рендер file-парта = карточка `<PreviewAttachment>`. Если в БД встретится legacy text-парт с маркером `📄 **Файл:` — детектор маскирует его как карточку (защита для legacy данных) |

---

## Причины

1. **Биллинг.** Inline-text оседает в истории навсегда. Каждый turn → каждый файл целиком улетает в xAI → fresh-input растёт линейно с количеством файлов в чате. Один scan-PDF в Simply = 23K токенов на turn × N turn'ов = десятки тысяч лишних токенов.

2. **Эта проблема уже возвращалась 4 раза.** Полу-меры (strip, UI-маска, частичные удаления) не работают — нужен инвариант: text-парт с файловым содержимым **не должен существовать в принципе**.

3. **xAI Files API готов** (Phase 1 миграции подтвердил все 7 моделей Grok принимают file references через Responses API). Архитектурная альтернатива есть и работает.

4. **Encoding issues** в inline-text (битый UTF-8 для CSV/XLSX, JPEG header в PDF и т.п.) делают поиск/RAG/extract неточными даже когда токены не критичны.

---

## Последствия

### Плюсы
- Биллинг предсказуемый: фиксированная стоимость file_id reference (~50 токенов) + variable стоимость xAI document_search (1-6 calls × $0.01)
- История чата компактна → MIND работает быстрее
- UI всегда показывает файлы как карточки (file-parts), не «портянки»
- `Message_v2.parts` маленькие → быстрая загрузка чата, меньше нагрузка на Postgres

### Минусы / Trade-offs
- Зависимость от xAI Files API uptime. Если xAI недоступен — файлы не парсятся
- Legacy данные требуют отдельной миграции (placeholder-replace или DELETE) — не закрывается одним коммитом
- Reaper cron нужен для cleanup orphan'd xAI files (есть в Phase 2 миграции)

---

## Сигналы регрессии (что искать в будущей сессии)

**Если симптомы биллинг-спайка вернулись:**

1. **БД-проверка** (первая команда):
   ```sql
   SELECT COUNT(*), SUM("tokenCount") FROM "Message_v2"
   WHERE parts::text LIKE '%📄 **Файл:%';
   ```
   Если > 0 — кто-то снова инлайнит контент. Регрессия.

2. **Код-проверка**:
   ```bash
   grep -rn "convertTextFilePartsInMessage\|convertTextFilesInAllMessages" lib/ app/ components/
   grep -rn "📄 \*\*Файл:" lib/ app/ components/   # генерация маркера
   ```
   Должно быть пусто (только комментарии-doc-rot, не функциональный код).

3. **Биллинг-проверка** (DevPanel + `ai_usage_log`):
   - На чистом чате без файлов: `fresh_input` ~1-3K
   - Со scan PDF: `fresh_input` ~23K (один turn)
   - Следующий turn без файла: `fresh_input` падает к ~3-6K
   Если на 3-м шаге `fresh` остался высоким — `stripOldAttachmentsFromHistory` не покрывает file references из истории, или появилась новая утечка.

4. **UI-проверка**: проскроллить старые сообщения чата. Файлы должны быть карточками, не текстом-портянкой.

---

## Альтернативы

### Альтернатива 1: Inline file content + strip-on-the-fly

**Что это:** Сохранять контент в parts, но `stripOldAttachmentsFromHistory` вычищает его в payload xAI.

**Почему отклонили:**
- Несколько раз использовалась — не помогло (см. рецидивы #1 и #3)
- Strip-логика хрупкая, любое изменение в `prepare-messages.ts` может её обойти
- Не решает encoding и UI-проблему

**Когда может быть лучше:** Если xAI Files API недоступен в каком-то deployment.

### Альтернатива 2: Vector store + RAG вместо file references

**Что это:** Загрузить файл в xAI Vector Stores, использовать `xaiTools.fileSearch`.

**Почему отклонили:**
- Phase 1 миграции выбрал Files API + document_search (variable cost) над Vector Stores (fixed cost но потеря Library Collections инфраструктуры)
- Migration cost высокий

**Когда может быть лучше:** При очень больших корпусах файлов (>1000 на пользователя).

---

## Ссылки и ресурсы

- [TZ_FilesAPIMigration SPEC](../../specs/Simply_Migration/TZ_FilesAPIMigration/SPEC.md) — §5.6, §5.9, §6 (все три закрывают эту тему)
- [TZ_FilesAPIMigration FINDINGS Finding #8](../../specs/Simply_Migration/TZ_FilesAPIMigration/FINDINGS.md) — детальная хронология биллинг-спайка 29-04
- [TZ_FilesAPIMigration ROADMAP Phase 3.5](../../specs/Simply_Migration/TZ_FilesAPIMigration/ROADMAP.md) — hot-fix DELETE smoke-данных
- Архив TZ_SimplyChatBillingLeak — `specs/_archive/BACKLOG_CLOSED.md`
- Архив TZ_InlineFilePortyanka — CHANGELOG v3.100.5 (2026-04-28)
- [SIMPLY_ATTACHMENT_ARCHITECTURE](../../specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) — SSOT обработки вложений (обновляется при любом изменении контракта)
- [docs/ai-providers.md](../ai-providers.md) — pricing Files API
- ADR 057 — xai-prompt-cache-prefix-stability (related: cache-стабильность зависит от стабильности префикса, который ломается при inline-content)

---

## История изменений

- **2026-04-29** — Документ создан после Phase 3.5 hot-fix. Зафиксированы 4 рецидива и архитектурный принцип «file-reference only».
