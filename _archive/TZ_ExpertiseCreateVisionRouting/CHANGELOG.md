# Changelog ТЗ-ExpertiseCreateVisionRouting

Локальный лог сессий по этому ТЗ. После финализации — перенос записи в главный `CHANGELOG.md` проекта.

---

## Сессия 1 — 2026-04-21

### Analysis
- Прочитаны: `SPEC.md` (из backlog), `WORKFLOW.md`, `app/(chat)/api/chat/route.ts` (routing + gates + hasAttachments + adaptHistoryToCapabilities), `lib/ai/vision-ocr.ts`, `lib/ai/task-assignments.ts`, `lib/ai/model-catalog.ts` (CAPS_GROK, CAPS_CLAUDE), `app/(chat)/api/files/upload/route.ts` (Layer 0 PDF extraction), `specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md`.
- WebSearch по Правилу 1: Anthropic Claude Haiku 4.5 (PDF до 100 стр, 200K context), xAI Grok vision (JPG/PNG only, PDF не поддерживается).
- `specs/_backlog/README.md`: помимо этого ТЗ — 1 Low (`TZ_CompactionActualCalibration`), не блокирует.

### Decisions
- Выбрана архитектура **единого capability-driven механизма** (вместо дублей `expertise-vision` / `create-vision`) после замечания владельца.
- Принцип: fallback на Haiku срабатывает ТОЛЬКО когда default-модель режима не тянет тип вложения (строго capability-driven). Следствие: JPG/PNG в simply теперь идут на Grok 4.1 Fast (а не Haiku как сейчас), PDF-сканы — на Haiku во всех режимах.
- Переименование `simply-chat-vision` → `chat-vision` (унификация).
- Новый модуль `lib/ai/routing.ts` (`resolveActiveTaskId`, `needsVisionFallback`) + удаление `hasAttachments()`.
- Оба gate (`adaptHistoryToCapabilities`, `convertTextFilesInAllMessages`) снимаются с simply — единый pipeline.
- ADR зафиксирует принцип.

### Files (planned, пока не тронуты)
- `lib/ai/task-assignments.ts`
- `lib/ai/routing.ts` (новый)
- `app/(chat)/api/chat/route.ts`
- `lib/ai/chat-mode-config.ts`, `lib/ai/tools/chat-tools.ts`, `scripts/debug-orphan-tool-use.ts`, `lib/prompts/builder/composer.ts` — проверить grep
- `docs/decisions/NNN-capability-driven-attachment-routing.md` (новый)
- `docs/ai-chats-map.md`, `docs/architecture.md`, `specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md`

### Status
- Фаза 1 завершена: `SPEC.md` + `ANALYSIS.md` + `ROADMAP.md` + `CHANGELOG.md` + `HANDOFF.md` созданы.
- Ждём утверждения ROADMAP владельцем перед стартом Этапа 1.
