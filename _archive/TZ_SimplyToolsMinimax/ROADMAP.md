# Roadmap ТЗ-SimplyToolsMinimax: Включение инструментов для Simply Chat

**Создан:** 2026-04-08
**Версия проекта:** 3.78.0 -> 3.79.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 2 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Включение tools + фильтрация deepResearch

**Статус:** ✅ Завершён

**Цель:** MiniMax M2.7 в Simply Chat получает 12 инструментов. deepResearch исключён для MiniMax, доступен при «Думать» (Sonnet).

**Задачи:**

**1.1 Пробросить `think` в `getActiveToolNames`:**
- [x] В `lib/ai/tools/chat-tools.ts`: добавить параметр `think?: boolean` в `getActiveToolNames`
- [x] Добавить фильтрацию: `chatMode === "simply" && !think` → исключить `deepResearch`

**1.2 Убрать блокировку tools в route.ts:**
- [x] В `app/(chat)/api/chat/route.ts:870-874`: убрать условие `isSimplyNonAnthropicModel` для tools — передавать tools всегда
- [x] Передать `think` в вызов `getActiveToolNames`

**1.3 Включить `stopWhen` для MiniMax:**
- [x] В `app/(chat)/api/chat/route.ts:869`: убрать условие `isSimplyNonAnthropicModel` для `stopWhen: stepCountIs(5)` — применять для всех моделей

**Файлы:**
- `lib/ai/tools/chat-tools.ts` — добавить `think` параметр, фильтрация simply
- `app/(chat)/api/chat/route.ts` — убрать блокировку tools, включить stopWhen, пробросить think

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: 7/7 tools протестированы и работают (getWeather, getCurrentDate, webSearch, fetchUrl, readTelegramChannel, createDocument, createSnapshot)

**Git (после валидации):**
```bash
git add lib/ai/tools/chat-tools.ts app/(chat)/api/chat/route.ts
git commit -m "feat(tz-simply-tools): enable 12 tools for MiniMax M2.7 in Simply Chat"
```

**Критерий готовности:** Tools передаются в streamText для MiniMax, deepResearch исключён для simply без think, stopWhen работает

---

## Этап 2: Финализация

**Статус:** 🔄 В работе

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md -> пройти чеклист
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (секция Simply Chat — tools enabled)
- [x] Обновить package.json (версия 3.79.0)

**Документация (по чеклисту):**
- [x] docs/ai-tools.md — обновить матрицу доступности (simply: + вместо --)
- [x] docs/ai-chats-map.md — обновлено (tools count)
- [x] ADR нужен? — Нет (простое включение, не архитектурное решение)
- [x] TOOLS_AUDIT.md — обновить матрицу

**Завершение:**
- [ ] Финальное мануальное тестирование на production (после деплоя)
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна
