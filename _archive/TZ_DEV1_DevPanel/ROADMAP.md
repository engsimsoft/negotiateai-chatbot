# Roadmap ТЗ-DEV1: Developer Panel

**Создан:** 2026-02-28
**Версия проекта:** 3.56.0 → 3.57.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | ✅ Все завершены |
| Сессий | 3 |

---

## Этап 1: Серверная эмиссия debug events (Main Chat)

**Статус:** ✅ Завершён

**Цель:** Main chat route эмитит все debug events через transient data stream parts. Данные доступны на клиенте.

**Задачи:**
- [x] Создать `lib/ai/debug-events.ts` — типы и утилиты эмиссии debug events
  - Типы: `DebugStepData`, `DebugFinishData`, `DebugGuardianData`, `DebugPromptData`
  - Утилиты: `emitDebugStep()`, `emitDebugFinish()`, `emitDebugGuardian()`, `emitDebugPrompt()`
  - Guard: все функции проверяют `isSimplyDevMode` внутри, no-op если false
- [x] Добавить pricing data в `lib/ai/providers.ts` — объект `MODEL_PRICING_RUB` с тарифами моделей + функция `calculateCostRub(modelId, usage)`
- [x] Интегрировать в `app/(chat)/api/chat/route.ts`:
  - `onStepFinish` → `emitDebugStep(dataStream, stepData)` — модель, токены, tool calls, timing
  - `onFinish` → `emitDebugFinish(dataStream, finishData)` — суммарные метрики, стоимость
  - В `instrumentedStream` после `tracker.analyze()` → `emitDebugGuardian(dataStream, guardianResult)`
  - При старте streaming → `emitDebugPrompt(dataStream, promptInfo)`
- [x] Добавить timing tracking: `Date.now()` при `start-step`, delta при `finish-step`
- [x] Убедиться что все events имеют `transient: true`

**Файлы:**
- `lib/ai/debug-events.ts` — новый (типы + утилиты)
- `lib/ai/providers.ts` — добавляем pricing
- `app/(chat)/api/chat/route.ts` — интеграция events

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: открыть чат, написать сообщение, в DevTools Console (Network tab → EventStream) видны `data-debug-step`, `data-debug-finish`, `data-debug-prompt` events
- [ ] Вызвать web search → в events видны tool call details
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/ai/debug-events.ts lib/ai/providers.ts app/\(chat\)/api/chat/route.ts
git commit -m "feat(tz-dev1): debug events emission for main chat route"
```

**Критерий готовности:** Events эмитятся корректно для всех типов сообщений (текст, tool calls, multi-step). При `SIMPLY_DEV_MODE=false` — events не эмитятся.

---

## Этап 2: UI — DevPanel компоненты

**Статус:** 🔄 В работе

~~⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1~~ ✅ Этап 1 подтверждён

**Цель:** Клиентские компоненты DevPanel: Provider (сбор данных), Footer (компактная строка), Drawer (полные детали).

**Задачи:**
- [x] Создать `components/dev-panel/dev-panel-provider.tsx`:
  - React Context для хранения debug данных per message
  - `useDevPanel(messageId)` hook — возвращает данные для конкретного сообщения
  - Подписка на transient `data-*` events через dataStream
  - Аккумуляция step events, finish event, guardian events
- [x] Создать `components/dev-panel/dev-panel-footer.tsx`:
  - Компактная строка: `Sonnet 4.6 · 3,359 tok · ₽0.84 · 2.5s [▸]`
  - Клик → открывает Drawer
  - `font-mono text-[11px] text-muted-foreground/60 bg-muted/30`
- [x] Создать `components/dev-panel/dev-panel-drawer.tsx`:
  - Использует `Sheet` из shadcn (overlay, не push-layout)
  - Ширина ~400px, `side="right"`
  - Рендерит секции (см. задачи ниже)
- [x] Создать секции drawer:
  - `sections/model-section.tsx` — модель, routing reason, finish reason
  - `sections/tokens-section.tsx` — input/output/cached/reasoning tokens, стоимость, context %
  - `sections/timeline-section.tsx` — пошаговый timeline: каждый step как card (тип, timing bar, tool calls, tokens)
  - `sections/guardian-section.tsx` — clean/blocked/warning/bypassed с деталями (confidence, pattern, snippet)
  - `sections/prompt-section.tsx` — Collapsible: preview system prompt, skills, agent, mode, context injections
  - `sections/raw-section.tsx` — Collapsible: JSON tool calls + results с простой подсветкой
- [x] Создать `components/dev-panel/index.ts` — exports
- [x] Интегрировать в `components/message.tsx`:
  - Рендер footer под сообщением ассистента (после MessageActions)
- [x] Интегрировать DevPanelProvider в chat.tsx (оборачивает контент Chat)
- [x] Добавить debug типы в `CustomUIDataTypes` (lib/types.ts)

**Файлы:**
- `components/dev-panel/` — новая папка (7+ файлов)
- `components/message.tsx` — интеграция footer
- `components/chat.tsx` или layout — Provider wrapper

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер (`SIMPLY_DEV_MODE=true`): после отправки сообщения — под ответом видна footer строка
- [x] Клик по footer → открывается drawer справа с секциями
- [x] Model section: показывает правильную модель (Haiku 4.5, TTFT 9ms)
- [x] Tokens section: показывает токены и стоимость (15 370 tok, ₽1.42)
- [x] Timeline section: показывает steps (Step 0, 895ms, stop)
- [x] Guardian section: показывает статус (✓ Clean)
- [x] Prompt section: показывает preview + metadata (Simply Chat, 15 009 chars, user-profile)
- [x] Raw section: показывает JSON данные
- [ ] Браузер (`SIMPLY_DEV_MODE=false`): footer НЕ видна, компоненты НЕ загружены
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/dev-panel/ components/message.tsx components/chat.tsx
git commit -m "feat(tz-dev1): DevPanel UI — footer, drawer, sections"
```

**Критерий готовности:** Полностью работающая DevPanel UI для main chat. Footer показывает ключевые метрики, drawer — все детали. В production — не рендерится.

---

## Этап 3: Service Chat + Project Tasks + удаление старого DEV mode

**Статус:** ✅ Завершён

**Цель:** DevPanel работает во всех чатах. Старый DEV mode полностью удалён.

**Задачи:**
- [x] Интегрировать debug events в `app/(chat)/api/service-chat/route.ts`:
  - `emitDebugStep()` в onStepFinish
  - `emitDebugFinish()` в onFinish
  - `emitDebugGuardian()` — учесть Guardian bypass для briefing-onboarding (`action: 'bypassed'`)
  - Удалить `data-model-info` event и `DISPLAY` map
- [x] Интегрировать debug events в `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`:
  - `emitDebugStep()`, `emitDebugFinish()`, `emitDebugGuardian()`
- [x] **Удалить старый DEV mode:**
  - Удалить файл `lib/prompts/builder/dev-mode-inject.ts`
  - Удалить файл `lib/prompts/core/dev-mode.md`
  - В `lib/prompts/builder/composer.ts`: убрать вызов `injectDevMode()`, оставить `systemPrompt: parts.join('\n\n')`
  - В `app/(chat)/api/service-chat/route.ts`: убрать вызов `injectDevMode()`
  - В `components/message.tsx`: удалить `devModelName` useMemo и рендер badge
  - В `briefing-setup-client.tsx` и `briefing-chat-panel.tsx`: удалить `devModelName` state/prop/badge
- [x] Проверить что нет других references на удалённые файлы (grep `injectDevMode`, `dev-mode-inject`, `dev-mode.md`, `devModelName`, `data-model-info`)

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — debug events + удаление old
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — debug events + удаление old
- `lib/prompts/builder/composer.ts` — удаление вызова
- `lib/prompts/builder/dev-mode-inject.ts` — УДАЛИТЬ файл
- `lib/prompts/core/dev-mode.md` — УДАЛИТЬ файл
- `components/message.tsx` — удаление old badge

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Grep: `injectDevMode` → 0 результатов в коде (только specs/archive/docs)
- [x] Grep: `data-model-info` → 0 результатов в коде (только specs/archive)
- [x] Grep: `devModelName` → 0 результатов в коде (только specs)
- [x] Браузер: Бен (service chat) → DevPanel footer видна, drawer работает
- [x] Браузер: чат Эксперта (project task) → DevPanel footer видна
- [x] Браузер: основной чат → `[DEV]` badge в тексте НЕ появляется (prompt injection удалён)
- [x] Браузер: model badge под аватаром НЕ появляется
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add -A
git commit -m "feat(tz-dev1): DevPanel for all routes, remove old DEV mode"
```

**Критерий готовности:** DevPanel работает в main chat, service chat, project tasks. Старый DEV mode полностью удалён. Нет дублирования.

---

## Этап 4: Polish + Edge Cases

**Статус:** ✅ Завершён

**Цель:** Шлифовка UI, обработка edge cases, проверка production-безопасности.

**Задачи:**
- [x] Edge case: streaming — footer показывает live elapsed timer (200ms interval), tokens обновляются по мере поступления step events
- [x] Edge case: ошибка генерации — footer красный (bg-destructive/10, text-destructive), finishReason в footer + цветной в model-section drawer (error/content-filter = red, length = yellow)
- [x] Edge case: multi-model pipeline (Профессор) — timeline section уже показывает modelShort per step, профессор использует отдельный endpoint
- [x] Production check: `NEXT_PUBLIC_SIMPLY_DEV_MODE` exposed via `next.config.ts env` mapping:
  - Provider: early return (skip useMemo processing) when not dev mode
  - Server: debug events не эмитятся (isSimplyDevMode check)
  - Client: DevPanelFooter returns null when no data, Provider creates empty Map
- [x] Responsive: drawer `w-full sm:w-[440px]` — full-width на мобильных
- [x] Accessibility: aria-label на footer button, Sheet уже имеет focus trap + Escape (Radix)

**Файлы изменены:**
- `components/dev-panel/dev-panel-footer.tsx` — elapsed timer, error state, aria-label
- `components/dev-panel/dev-panel-drawer.tsx` — w-full для мобильных
- `components/dev-panel/dev-panel-provider.tsx` — IS_DEV_MODE gate + early bailout
- `components/dev-panel/sections/model-section.tsx` — finishReason color coding
- `next.config.ts` — env mapping SIMPLY_DEV_MODE → NEXT_PUBLIC_SIMPLY_DEV_MODE

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: footer показывает метрики (модель, токены, стоимость, время)
- [x] Браузер: drawer открывается и показывает все секции
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/dev-panel/
git commit -m "feat(tz-dev1): DevPanel polish and edge cases"
```

**Критерий готовности:** DevPanel полностью отшлифован, все edge cases обработаны, production-safe.

---

## Этап 5: Финализация

**Статус:** ✅ Завершён

**Задачи:**

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (новые файлы: `components/dev-panel/`, `lib/ai/debug-events.ts`, удалённые файлы)
- [x] Обновить package.json: 3.56.0 → 3.57.0

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Да: `docs/decisions/029-developer-panel.md`
- [x] docs/architecture.md нужно обновить? → Да (DevPanel секция в streaming pipeline, удаление dev-mode-inject.ts)
- [x] docs/ai-tools.md нужно обновить? → Нет
- [x] docs/ai-chats-map.md нужно обновить? → Нет (модели не менялись)
- [x] docs/ai-agents.md нужно обновить? → Нет
- [x] docs/design-system.md нужно обновить? → Нет (DevPanel — dev-only, не часть design system)

**Верификация docs против кода:**
- [x] `CLAUDE.md` → пути файлов актуальны (dev-mode-inject.ts удалён, dev-panel/ добавлен)
- [x] `lib/ai/providers.ts` → pricing data корректна

**Завершение:**
- [x] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна (проверено по чеклисту выше)
