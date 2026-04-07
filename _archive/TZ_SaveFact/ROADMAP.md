# Roadmap ТЗ-SaveFact: Tool saveFact — гарантированная запись в MIND

**Создан:** 2026-04-07
**Версия проекта:** 3.74.0 → 3.75.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Миграция БД + типы

**Статус:** ✅ Завершён

**Цель:** Добавить колонку `source` в `memory_entry`, обновить типы.

**Задачи:**
- [x] Создать миграцию: `ALTER TABLE memory_entry ADD COLUMN "source" varchar(32) NOT NULL DEFAULT 'extracted'`
- [x] Обновить `lib/db/schema.ts` — добавить колонку `source`
- [x] Обновить `lib/ai/memory/types.ts` — добавить `MemorySource` тип, добавить `source` в `NewMemoryEntry`
- [x] Обновить `lib/ai/memory/extract.ts` — передавать `source: "extracted"` при вызове `insertMemoryEntry()`
- [x] Обновить `lib/ai/memory/memory-queries.ts` — передавать `source` в insert и select
- [x] Применить миграцию: `npm run db:migrate`

**Файлы:**
- `lib/db/migrations/0050_save-fact-source.sql` — новая миграция
- `lib/db/schema.ts` — добавить колонку
- `lib/ai/memory/types.ts` — новый тип + обновить интерфейс
- `lib/ai/memory/extract.ts` — явно передавать source
- `lib/ai/memory/memory-queries.ts` — возможно обновить insertMemoryEntry

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Миграция применена без ошибок
- [ ] 🧪 SQL: `SELECT column_name FROM information_schema.columns WHERE table_name='memory_entry' AND column_name='source'`

**Git:** `git commit -m "feat(tz-savefact): add source column to memory_entry"`

**Критерий готовности:** Колонка `source` существует, типы обновлены, build проходит.

---

## Этап 2: Tool saveFact + регистрация + промпт

**Статус:** ✅ Завершён

**Цель:** Создать tool, зарегистрировать в Simply, обновить промпт.

**Задачи:**
- [x] Создать `lib/ai/tools/save-fact.ts` — tool с параметрами content + category
- [x] Зарегистрировать в `lib/ai/tools/chat-tools.ts` — только для `chatMode === "simply"`
- [x] Обновить `lib/prompts/chat/simply-chat.md` — блок "Память (MIND)" с инструкциями
- [x] Добавить tool activity config в `lib/ai/tool-activity-config.ts` (icon, labels)

**Файлы:**
- `lib/ai/tools/save-fact.ts` — **новый**
- `lib/ai/tools/chat-tools.ts` — регистрация
- `lib/prompts/chat/simply-chat.md` — обновление промпта
- `lib/ai/tool-activity-config.ts` — UX конфиг для индикатора

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: в Simply написать "запомни: встреча с Григорием в пятницу в 14:00" → факт записан
- [ ] Браузер: повторить → дедупликация сработала (merged или skipped)
- [ ] Браузер: в Экспертизе tool saveFact НЕ доступен
- [ ] DevPanel: видны embedding и dedup вызовы
- [ ] SQL: факт имеет `source='explicit'`
- [ ] 🧪 Мануальный тест пользователем

**Git:** `git commit -m "feat(tz-savefact): saveFact tool + simply prompt update"`

**Критерий готовности:** AI корректно вызывает saveFact при явных запросах на запоминание, факты записываются с дедупликацией.

---

## Этап 3: Финализация

**Статус:** ✅ Завершён

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (структура кода — новый tool)
- [x] Обновить package.json (версия 3.75.0)

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Нет (переиспользуем существующую инфраструктуру, нет нового паттерна)
- [x] docs/architecture.md нужно обновить? → Нет
- [x] docs/ai-tools.md нужно обновить? → Да (обновлено — добавлен saveFact в таблицу + код)
- [x] docs/ai-chats-map.md нужно обновить? → Нет (модели не меняются)
- [x] docs/ai-agents.md нужно обновить? → Нет
- [x] docs/design-system.md нужно обновить? → Нет (нет нового UI)

**Завершение:**
- [x] SQL-проверка БД (колонка source, данные) — подтверждено
- [x] Мануальное тестирование пользователем — пройдено (создание, дедупликация, категории, экспертиза, запрет вранья, settings)
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна (проверено по чеклисту выше)
