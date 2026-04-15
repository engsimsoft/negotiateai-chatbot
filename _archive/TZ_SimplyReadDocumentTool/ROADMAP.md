# ROADMAP — TZ_SimplyReadDocumentTool + R-6 correction (v3.90.2)

**Цель:** Удалить мёртвый `readDocument` tool + реализовать `adaptHistoryToCapabilities` через SSOT model-catalog (правильная реализация R-6 из ТЗ-XAI-3).

**Версия:** v3.90.1 → v3.90.2
**Dependent on:** [SIMPLY_ATTACHMENT_ARCHITECTURE.md](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) (принятое решение №3)

---

## Этап 1 — readDocument dead code cleanup

- [x] **1.1** Удалить файл [lib/ai/tools/read-document.ts](../../lib/ai/tools/read-document.ts) (243 строки)
- [x] **1.2** [lib/ai/tools/chat-tools.ts](../../lib/ai/tools/chat-tools.ts) — 4 места:
  - [x] Удалить import `readDocument` (строка 14)
  - [x] Удалить из `getStandardTools` (строка 55)
  - [x] Удалить из `ALL_TOOL_NAMES` (строка 124)
  - [x] Удалить из `baseTools` в `getActiveToolNames` (строка 163)
  - [x] Дополнить JSDoc комментарием про modern attachment pipeline
- [x] **1.3** [components/message.tsx](../../components/message.tsx) — удалить render block `tool-readDocument` (52 строки)
- [x] **1.4** [lib/prompts/chat/simply-chat.md](../../lib/prompts/chat/simply-chat.md) — убрать упоминание `readDocument` из «Не пиши:» строка + example
- [x] **1.5** [lib/prompts/skills/document/analyze-document/SKILL.md](../../lib/prompts/skills/document/analyze-document/SKILL.md) — переписан под modern pipeline (inline text + parseExcel, убран readDocument)
- [x] **1.6** [lib/prompts/agents/ben/references/features.md](../../lib/prompts/agents/ben/references/features.md) — убрать строку readDocument

---

## Этап 2 — R-6 correction через adaptHistoryToCapabilities

- [x] **2.1** [app/(chat)/api/chat/route.ts](../../app/(chat)/api/chat/route.ts): импортировать `ModelCapabilities` тип из `model-catalog`
- [x] **2.2** Добавить функцию `adaptHistoryToCapabilities(messages, capabilities)`:
  - [x] Pure function, conservative fallback если capabilities не передан
  - [x] `supportsVision` / `supportsPdf` флаги из capabilities
  - [x] Для каждой file part: text/plain → as-is, image/* → vision check, application/pdf → documentSupport check, прочее → conservative placeholder
  - [x] Legacy "image" part type — тот же vision check
- [x] **2.3** Вставить adapter в preparedHistory pipeline:
  - [x] Между `convertTextFilesInAllMessages` и `sanitizeCoreMessages(convertToModelMessages(...))`
  - [x] Gate на `chatMode === "simply"` (проектные чаты используют Claude с полным capability set)
  - [x] Передавать `effectiveCatalogEntry?.capabilities` (уже вычислено в ТЗ-2)
- [x] **2.4** Обновить комментарий блока preparedHistory с описанием трёх шагов

---

## Этап 3 — Валидация

- [x] **3.1** `npx tsc --noEmit` → 0 ошибок
- [x] **3.2** `npm run build` → migrate + next build успешны
- [x] **3.3** HMR dev server пересобрал без ошибок (5171 modules)
- [ ] **3.4** Мануальный тест в dev server (http://localhost:3000, бэкграунд `bcoqbg9od`):
  - [ ] Критичный: PDF в истории → текстовый follow-up → Grok не крашится, видит placeholder
  - [ ] Regression: новый PDF → Haiku обрабатывает
  - [ ] Regression: .xlsx → Grok inline
  - [ ] Regression: .txt → Grok inline
  - [ ] Regression: DevPanel → Prompt → ноль упоминаний `readDocument`
  - [ ] Regression: DevPanel → Tools → `readDocument` отсутствует

---

## Этап 4 — Финализация и SSOT anchors

- [x] **4.1** Обновить [SIMPLY_XAI_ROADMAP.md](../Simply_xAI/SIMPLY_XAI_ROADMAP.md): ссылка на архитектурный документ + новые ТЗ (ATTACH-1, XAI-COL-1) + progress row для TZ_SimplyReadDocumentTool + R-6 correction
- [x] **4.2** Обновить [CLAUDE.md](../../CLAUDE.md): добавить `SIMPLY_ATTACHMENT_ARCHITECTURE.md` в навигацию как обязательное чтение
- [x] **4.3** Создать backlog stub [TZ_ATTACH_PdfExtractionAtUpload.md](../_backlog/TZ_ATTACH_PdfExtractionAtUpload.md)
- [x] **4.4** Обновить [specs/_backlog/README.md](../_backlog/README.md): добавить TZ_ATTACH-1 в High impact, TZ_ErrorRecoveryUI Stage 2, TZ_SimplyChatRaceCondition
- [ ] **4.5** Обновить версию: [package.json](../../package.json) `3.90.1` → `3.90.2`
- [ ] **4.6** CHANGELOG запись `[3.90.2]` с описанием cleanup + R-6 correction
- [ ] **4.7** SIMPLY_XAI_CHANGELOG.md запись про исправление R-6
- [ ] **4.8** Commit всех файлов одной транзакцией `release(v3.90.2)`
- [ ] **4.9** Переместить `specs/TZ_SimplyReadDocumentTool/` → `_archive/TZ_SimplyReadDocumentTool/`
- [ ] **4.10** Запись в `_archive/BACKLOG_CLOSED.md`
- [ ] **4.11** Обновить todo: #2 → completed, переход на ТЗ-ATTACH-1
