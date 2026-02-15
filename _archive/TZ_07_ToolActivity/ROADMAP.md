# Roadmap ТЗ-07: Tool Activity UX

**Создан:** 2026-02-15
**Версия проекта:** 3.19.0 → 3.20.0
**Статус:** Этап 2 завершён, осталась финализация

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 3 (финализация) |
| Сессий | 3 |

**Scope:** 3 tool'а (webSearch, parseExcel, readProjectFile) получают компактный ToolActivityIndicator с группировкой параллельных вызовов.

---

## Этап 1: Config + Компонент

**Статус:** ✅ Завершён

**Задачи:**
- [x] Создать `lib/ai/tool-activity-config.ts` — маппинг toolName → { icon, activeLabel, doneLabel, argsFormatter, resultFormatter, resultCounter }
- [x] Создать `components/tool-activity-indicator.tsx` — презентационный компонент (Loader спиннер, CheckIcon, ×N бейдж, раскрываемые details)
- [x] Стилизация: `bg-muted rounded-lg px-3 py-2 text-sm`, без border

**Валидация:** ✅ tsc + build

---

## Этап 2: Интеграция

**Статус:** ✅ Завершён

**Задачи:**
- [x] Backend: перехват `tool-input-start` → `data-tool-activity` в обоих route (chat + task expert)
- [x] Client: `groupedToolActivities` useMemo в message.tsx (единый источник данных)
- [x] Один render-point перед `deduplicatedParts.map()`
- [x] Catch-all → `return null` для TOOL_ACTIVITY_CONFIG tools
- [x] Скрытие пустого assistant message при streaming (double avatar fix)
- [x] min-h-96 отключен при isLoading (пустое пространство fix)
- [x] Подавление ThinkingMessage при tool activity (messages.tsx)
- [x] Очистка stale data-tool-activity (chat.tsx, task-chat.tsx)
- [x] Группировка параллельных вызовов по toolName с агрегацией результатов
- [x] Анимация: Loader спиннер при active (вместо animate-pulse)
- [x] 🧪 Мануальный тест пользователем — ОК

**Валидация:** ✅ tsc + build + мануальный тест

---

## Этап 3: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальный `npm run build`
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (добавить ToolActivityIndicator в структуру)
- [x] Обновить docs/design-system.md (sidebar icon mode)
- [x] Обновить package.json (версия 3.20.0)
- [x] Git commit
- [x] Переместить папку в _archive/

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] Документация актуальна
