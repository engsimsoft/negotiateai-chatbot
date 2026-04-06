# ТЗ-RAG2: MIND Consolidation + Profile + UI

**Версия проекта:** 3.71.0 → 3.72.0
**Зависимости:** RAG-1 (v3.71.0) завершён
**Источник:** PHASES.md → секция RAG-2, SIMPLY_RAG_UNIFIED_CONCEPT.md

---

## Цель

Превратить накопление фактов из RAG-1 в управляемую, качественную систему памяти:
1. **Консолидация** — периодическая ревизия фактов (противоречия, дубли, устаревшее)
2. **Opus-профиль** — ночная генерация нарративного профиля пользователя
3. **UI управления** — пользователь видит что AI знает и может удалить

---

## Scope

### 1. Консолидация (периодическая)

- Каждые N сообщений (5-10) — Sonnet ревизия активных фактов:
  - Противоречия между фактами → supersede старый
  - Устаревшие факты → supersede с обновлённым
  - Дубли, не пойманные на этапе extract (cosine < 0.92) → merge
  - Обновление confidence на основе подтверждений
- Trigger: счётчик сообщений (не cron, а inline в chat route)

### 2. Ночной Opus-профиль

- Cron: 3:00 MSK (до брифинга в 5:00 MSK → 2:00 UTC)
- Opus получает все активные факты пользователя
- Генерирует нарративный профиль (800-1200 слов):
  - Кто этот человек (роль, бизнес, индустрия)
  - Люди вокруг (коллеги, клиенты, партнёры)
  - Приоритеты и текущие задачи
  - Открытые вопросы и контекст
- Профиль — первый блок system prompt во всех чатах
- Новая таблица: `user_profile_summary` (userId UNIQUE, content, factCount, generatedAt, modelId)

### 3. UI `/settings` → секция "Память"

- Новая секция в существующей странице настроек
- Список фактов: категория (badge), содержимое, дата, источник (ссылка на чат)
- Удаление отдельного факта (один клик + confirm)
- "Удалить всё" (полная очистка + confirm)
- Opus-профиль: read-only, дата последнего обновления
- Переключатель: вкл/выкл извлечение фактов (глобально)
- Статистика: N фактов, дата последнего профиля

### 4. Два слоя контекста в каждом разговоре

1. **"Кто этот человек"** — Opus-профиль (~500 токенов) — стабильная база
2. **"Что релевантно сейчас"** — pgvector retrieval top-5 (~300 токенов) — динамика

---

## Стоимость (оценка, на активного пользователя в день)

| Компонент | Расчёт | Стоимость |
|-----------|--------|-----------|
| Sonnet консолидация | ~4 вызова × 5₽ | ~20₽ |
| Opus ночной профиль | 1 × 50₽ | 50₽ |
| **Итого RAG-2** | | **~70₽/день** |
| RAG-1 (для сравнения) | extract + embed + search | ~100₽/день |

---

## API

### Memory API (`/api/user/memory`)
- `GET` — список фактов (pagination, category filter)
- `DELETE /:id` — удалить один факт
- `DELETE /all` — удалить все факты

### Memory Settings API (`/api/user/memory/settings`)
- `GET` — текущие настройки (enabled, profile)
- `PATCH` — обновить (memoryEnabled toggle)

### Cron (`/api/cron/memory-profile`)
- Ночной Opus-профиль
- CRON_SECRET auth
- p-limit(3) для параллельности

---

## Файлы (предварительно)

### Новые
- `lib/ai/memory/consolidate.ts` — Sonnet-ревизия фактов
- `lib/ai/memory/profile.ts` — Opus-генерация профиля
- `lib/prompts/memory/consolidate.md` — промпт консолидации
- `lib/prompts/memory/profile.md` — промпт Opus-профиля
- `app/(chat)/api/user/memory/route.ts` — API фактов (GET, DELETE)
- `app/(chat)/api/user/memory/settings/route.ts` — API настроек памяти
- `app/api/cron/memory-profile/route.ts` — Ночной cron
- `lib/db/migrations/NNNN_user-profile-summary.sql` — Миграция
- `components/settings/memory-section.tsx` — UI секция памяти

### Изменяемые
- `lib/db/schema.ts` — +таблица user_profile_summary, +memoryEnabled в user
- `lib/db/queries.ts` — +query functions для profile + memory settings
- `app/(chat)/api/chat/route.ts` — +profile inject, +consolidation trigger
- `app/(dashboard)/settings/settings-page.tsx` — +секция "Память"
- `lib/ai/memory/retrieve.ts` — +инжекция профиля перед фактами
- `lib/ai/memory/index.ts` — +re-exports
- `vercel.json` — +cron entry
- `lib/ai/usage-utils.ts` — +chatMode conventions (memory:consolidate, memory:profile)
