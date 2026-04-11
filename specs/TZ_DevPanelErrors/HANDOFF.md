# HANDOFF: ТЗ-DevPanelErrors + ТЗ-1 Этап 4 (pipelines)

**Последняя сессия:** 2026-04-11
**Статус ТЗ-DevPanelErrors:** ✅ завершено, валидировано в живую
**Статус ТЗ-1 Этап 4:** ⏸ 9 файлов мигрированы, commit не сделан, мануальный тест pipelines не завершён

---

## Что сделано в прошлой сессии

### ТЗ-DevPanelErrors — полностью готово

Постоянная диагностика DevPanel → секция «Errors & Warnings» (client + server). Все фазы (1–6) выполнены. Подробный чек-лист — в [ROADMAP.md](ROADMAP.md).

**Живое подтверждение от Владимира:** Voyage AI 403 отобразился в footer badge `⚠ 1 warning` + полная карточка в drawer. Он тут же локализовал проблему и починил самостоятельно (см. ниже).

**Новый архитектурный паттерн (важно для будущего):** `retrieveMemoryContext` теперь возвращает `error?: string` вместо тихого graceful degradation. Catch снаружи не срабатывает — это анти-паттерн для наблюдаемости. Применять ко всем функциям, которые «глотают» ошибки.

### Побочные починки в той же сессии

- `sanitizeCoreMessages` Pass 5 — reorder `tool-call` parts в конец `assistant.content` (Claude 4.5/4.6 требует `tool_use` последним). Фикс `lib/utils.ts`. Проверено через scripts/debug-orphan-tool-use.ts с реальным Anthropic API.
- `provider=null` регрессия в `ai_usage_log` — chat/route.ts теперь резолвит `resolvedTaskId` → `getProviderForTask` → передаёт в `saveAiUsageLog`. SQL verify прошёл.
- `setCurrentChatMode` unused → константа.
- `md:mr-[380px]` → `md:mr-95`, `sm:w-[440px]` → `sm:w-110` (IDE hints, больше не игнорируются).
- Удалены временные `console.log` (`[DEBUG-EMIT-WARN]`, `[DEBUG-FLUSH]`, `[parseBatches]`).

### ТЗ-1 Этап 4 — 9 файлов pipelines мигрированы на `getModel(taskId)`

1. [lib/ai/vision-ocr.ts](lib/ai/vision-ocr.ts) → `vision:ocr`
2. [lib/meeting/meeting-pipeline.ts](lib/meeting/meeting-pipeline.ts) → `meeting:summary`
3. [lib/ai/memory/profile.ts](lib/ai/memory/profile.ts) → `memory:profile`
4. [lib/ai/memory/consolidate.ts](lib/ai/memory/consolidate.ts) → `memory:consolidate`
5. [lib/ai/memory/extract.ts](lib/ai/memory/extract.ts) → `memory:extract` / `extract-batch` / `dedup-verify`
6. [lib/podcast/script-generator.ts](lib/podcast/script-generator.ts) → `briefing:podcast-script`
7. [lib/briefing/briefing-section-author.ts](lib/briefing/briefing-section-author.ts) → `briefing:section`
8. [lib/briefing/briefing-filter.ts](lib/briefing/briefing-filter.ts) → `briefing:filter`
9. [lib/briefing/briefing-author.ts](lib/briefing/briefing-author.ts) → `briefing:author`

`npx tsc --noEmit` и `npm run build` — чисто.

---

## Voyage AI 403 — root cause (важно запомнить)

**Проблема была не в коде.** Voyage AI блокирует запросы с определённых VPN-локаций:
- ❌ Финский VPN — 403
- ✅ США / Буффало — работает

Владимир локализовал это моментально благодаря новой секции Errors в DevPanel — тот самый use case, ради которого и делали инструмент. Если Voyage снова начнёт падать — первым делом проверять VPN-регион.

---

## 🔴 Первое, что нужно сделать в новой сессии

**Split uncommitted changes на 3 логических коммита.** `git status` покажет кашу из трёх задач — нельзя коммитить всё вместе.

### Коммит 1: `feat(tz-1): Stage 4 — migrate pipelines to getModel`

Только 9 файлов ТЗ-1:
```
lib/ai/vision-ocr.ts
lib/meeting/meeting-pipeline.ts
lib/ai/memory/profile.ts
lib/ai/memory/consolidate.ts
lib/ai/memory/extract.ts
lib/podcast/script-generator.ts
lib/briefing/briefing-section-author.ts
lib/briefing/briefing-filter.ts
lib/briefing/briefing-author.ts
```

### Коммит 2: `fix(chat): sanitizeCoreMessages reorder tool-call to end`

Только `lib/utils.ts` (Pass 5). Можно сослаться на scripts/debug-orphan-tool-use.ts как regression test.

### Коммит 3: `feat(tz-dev-panel-errors): Errors & Warnings diagnostic`

Всё остальное по ТЗ-DevPanelErrors:
- `lib/ai/debug-events.ts` (типы + emit функции + schema bump 2→3)
- `lib/client/error-bus.ts` (новый)
- `lib/ai/memory/retrieve.ts` (+`error` field — архитектурное улучшение)
- `components/dev-panel/dev-panel-provider.tsx` (context shape, parseBatches, global errors)
- `components/dev-panel/dev-panel-error-boundary.tsx` (новый)
- `components/dev-panel/sections/errors-section.tsx` (новый)
- `components/dev-panel/session-errors-drawer.tsx` (новый)
- `components/dev-panel/session-errors-indicator.tsx` (новый)
- `components/dev-panel/dev-panel-footer.tsx` (badges + `md:mr-95` попутно)
- `components/dev-panel/dev-panel-drawer.tsx` (ErrorsSection первой + `sm:w-110`)
- `components/dev-panel/onboarding-debug-provider.tsx` (consumer fix DevPanelContextValue)
- `hooks/use-onboarding-debug.ts` (consumer fix)
- `components/chat.tsx` (onError → error bus, Error Boundary, `setCurrentChatMode` → const)
- `components/chat-header.tsx` (SessionErrorsIndicator)
- `app/(chat)/api/chat/route.ts` (emit + prePromptWarnings buffer + provider fix)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (тот же паттерн)
- `specs/TZ_DevPanelErrors/ROADMAP.md` + `HANDOFF.md`

### НЕ коммитить (не относится к этим ТЗ)

- `.DS_Store`, `.mcp.json`, `.vscode/`
- `components/dev-panel/sections/model-section.tsx` — ТЗ-MiniMax display names
- `lib/ai/memory/types.ts` — ТЗ-SaveFactV2
- `specs/TZ_SlidingWindow/*` deletions (архивная чистка)
- `_archive/*` (архив)
- `docs/chat-page-audit.md`, `scripts/test-*.ts`
- `lib/db/migrations/0051_memory-metadata.sql` — другая работа

**Напоминание правил:** CLAUDE.md запрещает `--no-verify`, `git add -A`, коммиты без явного разрешения. Staging — только по именам файлов. Каждому коммиту — HEREDOC сообщение с Co-Authored-By Claude.

---

## После коммитов — вернуться к ТЗ-1 Этап 4 мануальному тесту

9 мигрированных файлов НЕ протестированы end-to-end. Минимальный набор:
- **briefing generation** — проверить что author/filter/section работают и пишут usage
- **podcast** — script-generator + TTS, проверить запись в ai_usage_log
- **memory** — триггернуть extract + consolidate + profile через реальные сообщения
- **meeting** — загрузить файл, прогнать pipeline
- **vision OCR** — прикрепить картинку с текстом

**Проверка SSOT:**
```sql
SELECT modelId, provider, chatMode, COUNT(*)
FROM ai_usage_log
WHERE createdAt > NOW() - INTERVAL '1 hour'
GROUP BY 1,2,3
ORDER BY 4 DESC;
```
Ни одной записи с `provider IS NULL`. Все taskId'ы правильно отражены в `chatMode`.

---

## Что работает прямо сейчас (не трогать)

- DevPanel footer + drawer + глобальный indicator в header
- Error Boundary вокруг чата
- window.onerror + unhandledrejection слушатели
- Server-side `emitDebugError` / `emitDebugWarning` в chat/route.ts и task chat
- `retrieveMemoryContext` возвращает `error` field (новый паттерн)
- `sanitizeCoreMessages` Pass 5

Обновление: `npx tsc --noEmit` и `npm run build` — чисто на момент окончания сессии.

---

## Важные уроки сессии (не забыть)

1. **Graceful degradation ≠ наблюдаемость.** Функция, которая «глотает» ошибку внутри catch, невидима для внешнего инструмента. Возвращай `error` поле или emit событие — иначе ошибка исчезает.
2. **Диагностическое оборудование важнее разовой охоты за багом.** Вместо `console.log` гонок — один раз инструментировать и потом ловить все баги сразу.
3. **VPN-регион может ломать API.** Voyage AI блокирует финские IP. Добавить в чек-лист отладки внешних API.
4. **Claude 4.5/4.6 строго требует `tool_use` последним в `assistant.content`.** AI SDK иногда генерирует `[tool_use, text]` — нужен reorder.
