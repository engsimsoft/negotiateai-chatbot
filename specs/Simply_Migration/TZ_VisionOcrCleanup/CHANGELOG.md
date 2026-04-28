# Changelog ТЗ — Simply_Migration · Шаг 3 · Vision/OCR cleanup

## Сессия 1 — 2026-04-28 (закрытие)

### Workflow
- Получен SPEC + ROADMAP от архитектора, переименованы в стандарт проекта.
- WebFetch + WebSearch xAI vision/Files docs (Правило 1) — подтверждён 2M контекст для Grok 4.1 Fast (расхождение с устаревшим каталогом).
- Phase 1 audit: 0 внешних call sites; R1/R4/R5/R7 = зелёные; R3 (PDF-сканы) подтверждён как known limitation до Шага 4.
- Backlog проверка (Правило 9): 4 deferred ТЗ, ничто не блокирует.

### Removed
- `lib/ai/vision-ocr.ts` (мёртвый файл, 0 call sites)
- `vision:ocr` taskId — 5 удалённых упоминаний в `task-assignments.ts` (header doc, TaskId union, DEFAULT_TASK_MODELS, DEFAULT_MAX_OUTPUT_TOKENS, TASK_DESCRIPTIONS)

### Changed
- `chat-vision` default: `claude-haiku-4-5-20251001` → `grok-4-1-fast-non-reasoning` (`task-assignments.ts`)
- `model-catalog.ts:388,398` — `contextWindow: 128_000 → 2_000_000` для обеих Grok 4.1 Fast записей (sanity-fix, FINDINGS #1)
- Комментарии TaskId-union (стр 29) и DEFAULT_MAX_OUTPUT_TOKENS (стр 268) — Haiku → Grok 4.1 Fast non-reasoning
- `docs/ai-chats-map.md`: 7 правок (header providers, vision fallback table row, vision OCR row removed, chatMode routing row, Gemini section heading, Gemini code example, Grok 4.1 Fast catalog row, Haiku catalog row)
- `docs/ai-providers.md`: 4 правки (taskId table, Anthropic usage list, Google SDK row removed, Google usage paragraph)
- `SIMPLY_STATUS.md`: 3 правки (Подсобка добавлен chat-vision, Автор убраны vision:ocr+chat-vision, Simply Chat ряд)

### Verified
- `pnpm exec tsc --noEmit` = 0 ошибок
- Manual Test 1 (default vision JPEG) = PASS — `[PAYLOAD-DEBUG] provider=xai partTypes={"image_url":1}`, ответ модели «великолепный» (подтверждение владельца)
- Manual Test 2 (fallback override) = N/A (все активные модели каталога vision-capable)
- Manual Test 3 (text regression) = covered повседневным использованием владельца (default Simply Chat path = тот же Grok)
- Manual Test 4 (PDF) = диагностический, R3 принят как known limitation

### Files changed
- `lib/ai/vision-ocr.ts` (deleted)
- `lib/ai/task-assignments.ts`
- `lib/ai/model-catalog.ts`
- `docs/ai-chats-map.md`
- `docs/ai-providers.md`
- `SIMPLY_STATUS.md`
- `CHANGELOG.md` (root)
- `package.json` (3.100.5 → 3.100.6)
- `specs/Simply_Migration/HANDOFF_NEXT_SESSION.md` (Шаг 4 hint про PDF-fallback подмену)
