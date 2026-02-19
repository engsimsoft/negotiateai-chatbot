# Roadmap ТЗ-PX + ТЗ-FU: Deep Research + Fetch URL

**Создан:** 2026-02-19
**Версия проекта:** 3.28.0 → 3.29.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | ✅ Все завершены |
| Сессий (оценка) | 1 |

---

## Этап 1: ТЗ-FU — fetchUrl tool

**Статус:** ✅ Завершён

**Задачи:**
- [x] Создать shared utility `lib/ai/tools/fetch-page.ts`
- [x] Создать `lib/ai/tools/fetch-url.ts` — tool с wrapToolExecution
- [x] Зарегистрировать fetchUrl в `lib/ai/tools/chat-tools.ts`
- [x] Активировать фильтрацию по chatMode — исключить fetchUrl + deepResearch для 'chat'
- [x] Добавить конфигурацию в `lib/ai/tool-activity-config.ts`
- [x] `npx tsc --noEmit` — 0 ошибок

---

## Этап 2: ТЗ-PX — deepResearch tool

**Статус:** ✅ Завершён

**Задачи:**
- [x] Добавить PERPLEXITY_API_KEY в `.env.local`
- [x] Создать `lib/ai/tools/deep-research.ts` — factory tool с двумя режимами
- [x] Зарегистрировать deepResearch в `lib/ai/tools/chat-tools.ts`
- [x] Добавить конфигурацию в `lib/ai/tool-activity-config.ts`
- [x] Обновить description `webSearch` — разграничение с deepResearch
- [x] `npx tsc --noEmit` — 0 ошибок

---

## Этап 3: Dev UI + передача depth

**Статус:** ✅ Завершён

**Задачи:**
- [x] Расширить `app/(chat)/api/chat/schema.ts` — `researchDepth?: "pro" | "deep"`
- [x] Прокинуть researchDepth через chat route → `getStandardTools()`
- [x] `deepResearch` — factory-функция с `defaultDepth` через замыкание
- [x] Dev-переключатель в `components/multimodal-input.tsx` (🔬 Auto → Pro → Deep)
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен

**Валидация (ожидает):**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: deepResearch работает ("исследуй тему X")
- [x] Фикс: argsFormatter убрана вводящая в заблуждение depth из args модели (показывала всегда "Pro")
- [x] Браузер (dev): переключатель виден в Экспертизе
- [x] Браузер (dev): переключатель НЕ виден в Chat
- [x] Браузер: fetchUrl работает (дать ссылку)
- [x] Браузер: проверить что Deep override реально использует sonar-deep-research (лог `[deepResearch] Starting:`)
- [x] 🧪 Мануальный тест пользователем

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (новые файлы в структуре)
- [x] Обновить package.json (версия 3.29.0)
- [x] Обновить docs/ai-tools.md (deepResearch + fetchUrl)
- [x] Обновить docs/ai-chats-map.md
- [x] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Все функции работают в браузере
- [x] Документация актуальна
