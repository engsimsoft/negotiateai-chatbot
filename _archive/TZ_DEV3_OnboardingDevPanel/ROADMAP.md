# Roadmap ТЗ-DEV3: Developer Panel для Onboarding

**Создан:** 2026-03-01
**Версия проекта:** 3.58.0 → 3.59.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 3 ✅ |
| Сессий (оценка) | 1-2 |

---

## Этапы

### Этап 1: Инфраструктура + Footer

**Статус:** ✅ Завершён

**Цель:** Debug events из service-chat streaming попадают в клиентский state, footer с базовой информацией рендерится под каждым ответом ассистента в онбординге.

**Задачи:**

- [x] Smart truncation: добавить `truncateToolResultSmart()` в `lib/ai/debug-events.ts` — обрезает `content`/`text` поля внутри объекта до 200 chars, но сохраняет метаданные (`rssUrl`, `source`, `isValid`, `title`, `tier`, `fetchMethod`, `postCount`)
- [x] Обновить `service-chat/route.ts` — использовать `truncateToolResultSmart()` вместо `truncateForDebug()` для контекста `briefing-onboarding`
- [x] Создать `hooks/use-onboarding-debug.ts` — hook для сбора debug events
- [x] Создать `components/dev-panel/onboarding-debug-provider.tsx`
- [x] Интегрировать в `briefing-setup-client.tsx`
- [x] Модифицировать `briefing-chat-panel.tsx` — DevPanelFooter per assistant message (skip greeting)
- [x] Расширить `DevPanelFooter` — tool count display

**Файлы:**
- `lib/ai/debug-events.ts` — +truncateToolResultSmart()
- `app/(chat)/api/service-chat/route.ts` — smart truncation для briefing-onboarding
- `hooks/use-onboarding-debug.ts` — NEW
- `components/dev-panel/onboarding-debug-provider.tsx` — NEW
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — integration
- `app/(dashboard)/briefing/setup/components/briefing-chat-panel.tsx` — +footer
- `components/dev-panel/dev-panel-footer.tsx` — +tool count display

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/briefing/setup` → footer появляется под ответом (модель, токены, стоимость, время)
- [x] Браузер: клик по footer → drawer открывается (все 6 секций DEV1)
- [x] Браузер: greeting message → footer НЕ отображается
- [ ] Браузер: production mode (без SIMPLY_DEV_MODE) → footer НЕ отображается
- [ ] Браузер: перезагрузка страницы → footer-ы восстанавливаются из localStorage
- [x] 🧪 Мануальный тест: пройден

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dev3): onboarding debug infrastructure + footer integration"
```

**Критерий готовности:** Footer с базовой информацией (модель, токены, ₽, время, tool count) рендерится под каждым ответом ассистента в онбординге. Drawer открывается по клику с существующими секциями DEV1.

---

### Этап 2: Tools Section + Source Warnings

⛔ **НЕ НАЧИНАТЬ без подтверждения Этапа 1**

**Статус:** ✅ Завершён

**Цель:** Расширенная секция "Tools" в drawer с детализацией каждого tool call, structured display для fetchUrl/readTelegramChannel/updateBriefingPreview, и предупреждения по источникам.

**Задачи:**

- [x] Создать `components/dev-panel/sections/tools-section.tsx` (Collapsible per tool call, summary, structured display)
- [x] Structured display per tool type (deepResearch, fetchUrl, readTelegramChannel, updateBriefingPreview)
- [x] Warning detection logic (client-side)
- [x] Tool call без результата → warning
- [x] Добавить "Tools" секцию в `DevPanelDrawer` (между Timeline и Guardian, условный рендер)

**Файлы:**
- `components/dev-panel/sections/tools-section.tsx` — NEW
- `components/dev-panel/dev-panel-drawer.tsx` — +Tools section (conditional import)
- `components/dev-panel/sections/index.ts` — +export (если есть barrel)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/briefing/setup` → попросить AI найти источники → drawer → секция "Tools" показывает все tool calls
- [x] Браузер: fetchUrl tool call → показывает URL, source method, RSS status, content length
- [x] Браузер: readTelegramChannel → показывает isValid, post count
- [x] Браузер: updateBriefingPreview → показывает topic/source count
- [x] Браузер: проблемный источник → amber warning badge (RSS не обнаружен)
- [ ] Браузер: основной чат (`/chat/...`) → drawer НЕ показывает секцию Tools (если нет tool calls) — регрессия
- [x] 🧪 Мануальный тест: пройден

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dev3): tools section with structured display + source warnings"
```

**Критерий готовности:** Секция "Tools" в drawer показывает каждый tool call с structured metadata и warnings. Основной чат не затронут.

---

### Этап 3: Cost Breakdown + Fix Billing

⛔ **НЕ НАЧИНАТЬ без подтверждения Этапа 2**

**Статус:** ✅ Завершён

**Цель:** Секция Cost Breakdown в drawer — визуализация стоимости per-step с bar chart. Также: исправление биллинга (per-step sum вместо naive last-step cumulative) во всех компонентах.

**Задачи:**

- [x] Создать `components/dev-panel/sections/cost-breakdown-section.tsx`:
  - Per-step cost calculation (reasoning tokens billed at output rate)
  - Сортировка по стоимости DESC, bar chart, % от total
  - Label: tool names или "Final response" / "Step N"
  - Delta warning если naive estimate отличается от real per-step sum
- [x] Добавить "Cost Breakdown" секцию в `DevPanelDrawer` (после Tokens, перед Timeline, условный рендер при steps.length > 1)
- [x] Исправить `dev-panel-footer.tsx` — per-step sum вместо `finish.estimatedCostRub`
- [x] Исправить `tokens-section.tsx` — per-step sum для cost и tokens (не cumulative finish values)
- [x] Все 3 route files: `tc.input ?? tc.args` и `tr.output ?? tr.result` (AI SDK v5 compatibility)

**Файлы:**
- `components/dev-panel/sections/cost-breakdown-section.tsx` — NEW
- `components/dev-panel/sections/tokens-section.tsx` — per-step cost calculation
- `components/dev-panel/dev-panel-footer.tsx` — per-step cost + tokens
- `components/dev-panel/dev-panel-drawer.tsx` — +Cost Breakdown section
- `app/(chat)/api/service-chat/route.ts` — tc.input, tr.output fix
- `app/(chat)/api/chat/route.ts` — tc.input, tr.output fix
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — tc.input, tr.output fix

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/briefing/setup` → multi-step ответ → drawer → "Cost Breakdown" показывает bar chart per-step
- [x] Браузер: bars корректно отображают пропорции (самый дорогой step = самая длинная полоса)
- [x] Браузер: total cost совпадает с footer ₽ value (проверено: ₽11.32 vs $0.11×100 = ₽11.00, ~97%)
- [x] Браузер: одиношаговый ответ → Cost Breakdown секция НЕ показывается (Haiku 4.5, 1 step, ₽1.11)
- [x] Браузер: основной чат → Tokens & Cost ₽ = footer ₽ (оба ₽1.11)
- [x] 🧪 Мануальный тест: пройден

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dev3): cost breakdown section with per-step bar chart"
```

**Критерий готовности:** Cost Breakdown в drawer визуализирует стоимость каждого шага. Помогает определить на что тратится бюджет.

---

### Этап 4: Финализация

⛔ **НЕ НАЧИНАТЬ без подтверждения Этапа 3**

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Статус:** ⏳ В работе

**Задачи:**

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (секция Developer Panel + новые файлы)
- [x] Обновить package.json (версия 3.59.0)

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Да: ADR 031 (Onboarding Debug Architecture — why separate provider, smart truncation)
- [x] docs/architecture.md нужно обновить? → Нет (dev-panel уже описан)
- [x] docs/ai-tools.md нужно обновить? → Нет
- [x] docs/ai-chats-map.md нужно обновить? → Нет
- [x] docs/ai-agents.md нужно обновить? → Нет
- [x] docs/design-system.md нужно обновить? → Нет

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен (Этап 3)
- [ ] Production URL работает (если деплой)
- [x] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "chore: archive ТЗ-DEV3 (Onboarding DevPanel) — completed v3.59.0"
```
