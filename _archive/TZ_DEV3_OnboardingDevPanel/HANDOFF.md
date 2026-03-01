# Передача сессии ТЗ-DEV3

**Последнее обновление:** 2026-03-01
**Сессия:** 0 → 1 (планирование завершено, разработка не начата)

---

## Статус этапов

- [ ] Этап 1: Инфраструктура + Footer ← НАЧАТЬ ЗДЕСЬ
- [ ] Этап 2: Tools Section + Source Warnings
- [ ] Этап 3: Cost Breakdown
- [ ] Этап 4: Финализация

---

## Следующая сессия: начни с

1. Прочитай этот файл (5 мин контекст)
2. Прочитай `specs/TZ_DEV3_OnboardingDevPanel/ROADMAP.md` — Этап 1 (это твой чеклист)
3. Запусти `npm run dev`
4. **Первая задача:** Smart truncation → `truncateToolResultSmart()` в `lib/ai/debug-events.ts`

---

## Что сделано в сессии 0

- Полный анализ кодовой базы: DEV1, DEV2, service-chat route, briefing-setup, briefing-chat-panel
- Написан SPEC.md (5 требований: Tool Calls, Source Verification, Preview Content, Cost Breakdown, Warnings)
- Написан ANALYSIS.md (код-ревью, 4 рекомендации, архитектурное решение, риски)
- Написан ROADMAP.md (4 этапа, полный чеклист)
- Получены ответы на все вопросы от пользователя

---

## Ключевые решения (из анализа)

1. **Сервер УЖЕ готов** — `service-chat/route.ts` эмитит `data-debug-step/guardian/finish/prompt`. Серверных изменений минимум (только smart truncation).

2. **Отдельный provider** — `DevPanelProvider` зависит от `DataStreamContext` (нет в онбординге). Создаём `OnboardingDebugProvider` с тем же `DevPanelContext` → `DevPanelFooter` и `DevPanelDrawer` работают без изменений.

3. **Data flow:** `useChat.onData` → `useOnboardingDebug` hook → `OnboardingDebugProvider` → `DevPanelFooter` per message.

4. **Smart truncation** — текущий `truncateForDebug()` обрезает весь JSON до 500 chars (теряем метаданные). Нужен `truncateToolResultSmart()`: обрезает `content`/`text` внутри объекта, сохраняет meta-поля (`rssUrl`, `source`, `isValid`).

5. **Persistence** — localStorage (`simply-dev-onboarding-debug`). Сохраняем при `data-debug-finish`, восстанавливаем при загрузке. Dev-mode only.

---

## Ответы пользователя

- **Warnings в footer** → НЕТ, только в drawer
- **Footer** → под КАЖДЫМ ответом ассистента (кроме greeting)
- **Persistence** → ДА, через localStorage, переживает reload

---

## Файлы в работе

| Файл | Статус | Примечание |
|------|--------|-----------|
| `specs/TZ_DEV3_OnboardingDevPanel/SPEC.md` | Готов | ТЗ |
| `specs/TZ_DEV3_OnboardingDevPanel/ANALYSIS.md` | Готов | Код-ревью + ответы |
| `specs/TZ_DEV3_OnboardingDevPanel/ROADMAP.md` | Готов | Рабочий чеклист (4 этапа) |

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```
