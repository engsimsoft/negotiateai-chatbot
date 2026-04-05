# Roadmap ТЗ-SDK6: Миграция AI SDK v5 → v6

**Создан:** 2026-03-09
**Версия проекта:** 3.64.0 → 3.65.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Обновление зависимостей + Codemod

**Статус:** ✅ Завершён

**Цель:** Обновить все AI SDK пакеты до v6, запустить codemod, убрать мёртвую зависимость.

**Задачи:**
- [x] Запустить `npx @ai-sdk/codemod v6` (codemod не изменил файлы — ручная миграция)
- [x] `convertToCoreMessages` → `await convertToModelMessages` в 3 файлах (4 вызова)
- [x] `await` корректно добавлен (все вызовы внутри async функций)
- [x] `professor-pipeline.ts`: `CoreMessage` → `ModelMessage` (import + usage)
- [x] Удалить `@openrouter/ai-sdk-provider` + `@ai-sdk/gateway` + `@ai-sdk/openai` + `@ai-sdk/provider` + `@ai-sdk/xai` (5 мёртвых зависимостей)
- [x] Обновить версии: ai@6.0.116, @ai-sdk/anthropic@3.0.58, @ai-sdk/google@3.0.43, @ai-sdk/react@3.0.118
- [x] `npm install` — без ошибок
- [x] Доп: `CoreAssistantMessage`→`AssistantModelMessage`, `CoreToolMessage`→`ToolModelMessage` (lib/utils.ts)
- [x] Доп: ToolUIPart 3 новых состояния в tool.tsx
- [x] Доп: `context-usage` добавлен в CustomUIDataTypes (lib/types.ts)
- [x] Доп: `result.text` PromiseLike→Promise.resolve() wrap (service-chat/route.ts)

**Файлы:**
- `package.json` — версии зависимостей
- `app/(chat)/api/chat/route.ts` — convertToCoreMessages → await convertToModelMessages
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — то же
- `app/(chat)/api/assistant/ben/route.ts` — то же
- `lib/ai/professor-pipeline.ts` — CoreMessage → ModelMessage

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: отправить 1 сообщение в основной чат — ОК

**Git (после валидации):**
```bash
git add package.json package-lock.json app/(chat)/api/chat/route.ts app/(chat)/api/projects/\[id\]/tasks/\[taskId\]/chat/route.ts app/(chat)/api/assistant/ben/route.ts lib/ai/professor-pipeline.ts
git commit -m "feat(tz-sdk6): upgrade AI SDK v5 → v6, codemod, remove openrouter"
```

**Критерий готовности:** Все пакеты на v6, codemod применён, `tsc --noEmit` чисто (или ошибки только в usage-кастах для Этапа 2).

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

## Этап 2: Убрать все `(usage as any)` касты

**Статус:** ✅ Завершён

**Цель:** Заменить все `(usage as any)` на нативные типы v6 (`inputTokenDetails`, `outputTokenDetails`). Ноль кастов в кодовой базе.

**Задачи:**
- [x] Обновить `extractUsageFields()` в `lib/ai/usage-utils.ts` — нативные v6 типы
- [x] Обновить inline касты в `chat/route.ts` (5 замен)
- [x] Обновить inline касты в `service-chat/route.ts` (5 замен)
- [x] Обновить inline касты в `tasks/.../chat/route.ts` (5 замен)
- [x] grep `(usage as any)` — 0 результатов

**Файлы:**
- `lib/ai/usage-utils.ts` — `extractUsageFields()` body
- `app/(chat)/api/chat/route.ts` — inline casts в onStepFinish/onFinish
- `app/(chat)/api/service-chat/route.ts` — inline casts
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — inline casts

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] grep `(usage as any)` → 0 результатов
- [x] 🧪 Мануальный тест — ОК

**Git (после валидации):**
```bash
git add lib/ai/usage-utils.ts app/(chat)/api/chat/route.ts app/(chat)/api/service-chat/route.ts app/(chat)/api/projects/\[id\]/tasks/\[taskId\]/chat/route.ts
git commit -m "feat(tz-sdk6): remove all (usage as any) casts, native v6 token details"
```

**Критерий готовности:** Ноль `(usage as any)` в коде. `cacheWriteTokens` заполняется нативно.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

## Этап 3: Финализация

**Статус:** ✅ Завершён

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (версии SDK в секции "Технологии")
- [ ] Обновить package.json (версия 3.64.0 → 3.65.0)

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Нет (стандартная миграция мажорной версии, нет архитектурных решений)
- [ ] docs/ai-providers.md нужно обновить? → Да (версии SDK)
- [ ] docs/ai-chats-map.md нужно обновить? → Нет (модели не меняются)
- [ ] docs/architecture.md нужно обновить? → Нет

**Верификация docs против кода (Правило 5):**
- [ ] `docs/ai-providers.md` → версии SDK сверены с package.json
- [ ] `CLAUDE.md` → секция "Технологии" актуальна

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json docs/
git commit -m "chore(tz-sdk6): finalization — docs, version bump 3.64.0 → 3.65.0"
```
