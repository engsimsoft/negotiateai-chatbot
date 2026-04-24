-- ТЗ-XAI-COL-1 A6.1c: богатое описание документа для split-view.
-- autoDescription (≤200 знаков) остаётся как подпись для карточки в списке.
-- autoSummary генерируется через librarySearch по всем chunks проиндексированного
-- документа → второй LLM-вызов (taskId library:generate-summary) → структурный
-- обзор ~300-400 слов. Работает для любого объёма документа (охватывает весь
-- текст через уже построенные chunks, а не только первые 4000 символов).
-- Fire-and-forget после успешной индексации в xAI Collections.

ALTER TABLE "library_document"
  ADD COLUMN "autoSummary" text;
