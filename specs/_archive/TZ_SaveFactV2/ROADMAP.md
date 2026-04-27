# Roadmap ТЗ-SaveFactV2: saveFact v2 — метаданные для задач и календаря

**Создан:** 2026-04-07
**Версия проекта:** 3.76.0 → 3.77.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этапы

### Этап 1: БД + Schema + Types

**Статус:** ✅ Завершён

**Цель:** Добавить JSONB колонку metadata в memory_entry, обновить типы и queries

**Задачи:**
- [x] Миграция: `ALTER TABLE memory_entry ADD COLUMN metadata JSONB DEFAULT NULL`
- [x] `lib/db/schema.ts` — добавить `metadata: jsonb("metadata")` в memoryEntry
- [x] `lib/ai/memory/types.ts` — добавить `TaskMetadata`, `CalendarMetadata`, `FactMetadata` типы + `metadata?` в `NewMemoryEntry`
- [x] `lib/ai/memory/memory-queries.ts` — пробросить metadata в `insertMemoryEntry()`, добавить `updateMemoryMetadata()`, расширить `getMemorySummaryByCategory()` metadata в preview
- [x] Применить миграцию: `npm run db:migrate`

**Файлы:**
- `lib/db/schema.ts` — +metadata в memoryEntry
- `lib/db/migrations/00XX_memory-metadata.sql` — миграция
- `lib/ai/memory/types.ts` — +типы metadata
- `lib/ai/memory/memory-queries.ts` — +metadata в insert/update/summary

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: `SELECT column_name FROM information_schema.columns WHERE table_name='memory_entry' AND column_name='metadata'` → 1 row
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/ai/memory/types.ts lib/ai/memory/memory-queries.ts lib/db/migrations/
git commit -m "feat(tz-savefactv2): metadata JSONB column + types + queries"
```

**Критерий готовности:** Колонка metadata существует в БД, типы компилируются, insertMemoryEntry принимает metadata

---

### Этап 2: Tools (saveFact + updateFact) + Промпт

**Статус:** 🔄 В работе

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** saveFact принимает metadata, новый tool updateFact меняет статус задач, промпт обновлён

**Задачи:**
- [x] `lib/ai/tools/save-fact.ts` — добавить `metadata` в inputSchema (z.object optional), пробросить в insertMemoryEntry, автозаполнение status:"new" для task
- [x] `lib/ai/tools/update-fact.ts` — **НОВЫЙ**: semantic search по category=task → обновление metadata.status. Порог 0.7, подтверждение при 0.7-0.85
- [x] `lib/ai/tools/chat-tools.ts` — подключить updateFact для chatMode="simply"
- [x] `lib/ai/tool-activity-config.ts` — конфиг updateFact (icon, labels)
- [x] `lib/prompts/chat/simply-chat.md` — расширить блок `<memory>` инструкциями про metadata + updateFact

**Файлы:**
- `lib/ai/tools/save-fact.ts` — +metadata в schema и execute
- `lib/ai/tools/update-fact.ts` — **НОВЫЙ**
- `lib/ai/tools/chat-tools.ts` — +import и подключение updateFact
- `lib/ai/tool-activity-config.ts` — +конфиг updateFact
- `lib/prompts/chat/simply-chat.md` — +блок metadata/updateFact

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест:
  1. Simply Chat → «задача: позвонить Григорию» → БД: metadata = `{"status":"new"}`
  2. Simply Chat → «сделано: позвонить Григорию» → БД: metadata.status = "done", ответ «✓ Выполнено: ...»
  3. Simply Chat → «встреча: Григорий в пятницу в 14:00» → БД: metadata с date и time
  4. Simply Chat → «запомни: курс доллара 100 рублей» → БД: metadata = NULL

**Git (после валидации):**
```bash
git add lib/ai/tools/save-fact.ts lib/ai/tools/update-fact.ts lib/ai/tools/chat-tools.ts lib/ai/tool-activity-config.ts lib/prompts/chat/simply-chat.md
git commit -m "feat(tz-savefactv2): saveFact metadata + updateFact tool + prompt"
```

**Критерий готовности:** Все 4 сценария из критериев приёмки работают

---

### Этап 3: API context + DevPanel

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** API возвращает metadata, DevPanel показывает metadata фактов

**Задачи:**
- [ ] `app/(chat)/api/user/memory/context/route.ts` — расширить: query param `?category=task` → детальные факты с metadata (отдельный path от summary)
- [ ] `components/dev-panel/sections/rag-section.tsx` — показать metadata в debug-выводе фактов (если есть)

**Файлы:**
- `app/(chat)/api/user/memory/context/route.ts` — +category filter, +metadata в ответе
- `lib/ai/memory/memory-queries.ts` — новая функция getMemoryEntriesWithMetadata() или расширение существующей
- `components/dev-panel/sections/rag-section.tsx` — +metadata display

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] API: `GET /api/user/memory/context?category=task` → факты с metadata.status
- [ ] DevPanel: metadata видна под фактом
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/(chat)/api/user/memory/context/route.ts lib/ai/memory/memory-queries.ts components/dev-panel/sections/rag-section.tsx
git commit -m "feat(tz-savefactv2): context API metadata + DevPanel"
```

**Критерий готовности:** Критерий приёмки #6 (API возвращает metadata) проходит

---

### Этап 4: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (новый tool updateFact, metadata в save-fact)
- [ ] Обновить package.json: 3.77.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Нет (расширение существующего паттерна, не новая архитектура)
- [ ] docs/ai-tools.md нужно обновить? → Да (новый tool updateFact)
- [ ] docs/ai-chats-map.md нужно обновить? → Нет (модели не менялись)
- [ ] docs/ai-agents.md нужно обновить? → Нет
- [ ] docs/architecture.md нужно обновить? → Да (metadata в memory_entry)
- [ ] docs/design-system.md нужно обновить? → Нет (нет UI-изменений)

**Завершение:**
- [ ] SQL проверка: metadata колонка, данные с metadata
- [ ] Финальное мануальное тестирование (все 6 критериев приёмки)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json docs/
git commit -m "feat(tz-savefactv2): saveFact v2 metadata — v3.77.0"
```
