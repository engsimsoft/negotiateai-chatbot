# Передача сессии ТЗ-DEV1: Developer Panel

**Дата:** 2026-02-28
**Сессия:** 2 (Этапы 1-2 завершены)

## Статус этапов
- [x] Этап 1: Серверная эмиссия debug events (Main Chat) ✅
- [x] Этап 2: UI — DevPanel компоненты ✅
- [ ] Этап 3: Service Chat + Project Tasks + удаление старого DEV mode
- [ ] Этап 4: Polish + Edge Cases
- [ ] Этап 5: Финализация

## Что сделано

### Этап 1 — Серверная эмиссия
- `lib/ai/debug-events.ts` — типы + 4 emit-функции (emitDebugStep, emitDebugFinish, emitDebugGuardian, emitDebugPrompt)
- `lib/ai/providers.ts` — MODEL_PRICING_RUB + calculateCostRub()
- `app/(chat)/api/chat/route.ts` — интеграция: onStepFinish → debug step queue, onFinish → debug finish, instrumentedStream → guardian + step emit, перед streaming → debug prompt
- Все emit-функции проверяют `isSimplyDevMode` внутри (no-op если false)

### Этап 2 — UI компоненты
- `components/dev-panel/dev-panel-provider.tsx` — React Context, useMemo парсит dataStream → группирует events в batches → маппит к assistant messages (по offset с конца)
- `components/dev-panel/dev-panel-footer.tsx` — компактная строка: `Haiku 4.5 · 15.4k tok · ₽1.42 · 2.5s ▸`
- `components/dev-panel/dev-panel-drawer.tsx` — Sheet справа (400px) с 6 секциями
- `components/dev-panel/sections/` — model, tokens, timeline, guardian, prompt, raw (6 файлов)
- `components/dev-panel/index.ts` — exports
- `components/message.tsx` — DevPanelFooter рендерится после MessageActions для assistant messages
- `components/chat.tsx` — DevPanelProvider оборачивает весь Chat контент
- `lib/types.ts` — добавлены debug типы в CustomUIDataTypes

### Важные исправления (баги найденные при тестировании)
1. **`transient: true` блокирует `onData`** — AI SDK v5 НЕ доставляет transient events в onData callback. Решение: убрали `transient: true` из всех debug events. Безопасно, т.к. events эмитятся только при SIMPLY_DEV_MODE=true.
2. **Маппинг batches к messages** — исходная логика маппила batch[0] → первый assistant message (из истории). Исправлено: маппим с offset = assistantMessages.length - batches.length (к ПОСЛЕДНИМ сообщениям).

## Следующая сессия: начни с

1. **Прочитать ROADMAP.md** — `specs/TZ_DEV1_DevPanel/ROADMAP.md`
2. **Начать Этап 3** — задачи:
   - Интегрировать debug events в `app/(chat)/api/service-chat/route.ts` (emitDebugStep, emitDebugFinish, emitDebugGuardian; удалить `data-model-info` event и `DISPLAY` map)
   - Интегрировать debug events в `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
   - **Удалить старый DEV mode:**
     - Удалить файл `lib/prompts/builder/dev-mode-inject.ts`
     - Удалить файл `lib/prompts/core/dev-mode.md`
     - В `lib/prompts/builder/composer.ts` (~строка 217): убрать вызов `injectDevMode()`
     - В service-chat route: убрать вызов `injectDevMode()`
     - В project task chat route: убрать вызов `injectDevMode()`
     - В `components/message.tsx`: удалить `devModelName` useMemo (строки ~212-216) и рендер badge (строки ~259-263)
   - Grep: проверить 0 references на удалённые файлы

## Ключевые файлы

### Новые (Этап 1-2)
- `lib/ai/debug-events.ts` — типы + emit функции
- `lib/ai/providers.ts` — pricing (добавлено к существующему)
- `components/dev-panel/` — 10 файлов (provider, footer, drawer, 6 sections, index)

### Модифицированные
- `app/(chat)/api/chat/route.ts` — debug events интеграция
- `components/message.tsx` — DevPanelFooter import + рендер
- `components/chat.tsx` — DevPanelProvider import + wrapper
- `lib/types.ts` — debug типы в CustomUIDataTypes

### Для удаления (Этап 3)
- `lib/prompts/builder/dev-mode-inject.ts` — УДАЛИТЬ
- `lib/prompts/core/dev-mode.md` — УДАЛИТЬ

## Блокеры / Вопросы
- Нет блокеров. Этап 3 можно начинать сразу.
