# Передача сессии ТЗ-BRIEFING-VOLUME

**Последнее обновление:** 2026-02-21
**Сессия:** 1 (финальная)
**Статус:** ✅ ЗАВЕРШЕНО

---

## Статус этапов

- [x] Этап 1: MAX_CONTENT_LENGTH 1000 → 6000
- [x] Этап 2: DB Schema + Migration (volume)
- [x] Этап 3: Query + Tool (сохранение volume)
- [x] Этап 4: Author pipeline (передача volume)
- [x] Этап 5: Промпты (author v4 + onboarding v8)
- [x] Этап 6: Edit mode + UI Preview
- [x] Этап 7: Финализация (build + диагностический тест)

---

## Выявленный баг (отдельное ТЗ)

**fullText URL mismatch** — `fullTextsMap` строится по URL страниц-источников, но кандидаты после фильтра имеют URL отдельных статей. Результат: автор получает 0 полных текстов, пишет только из oneLinerSummary.

**Фикс:** 2 файла, ~5 строк — добавить fallback-lookup по sourceName.

---

## Ключевые решения

1. **volume в Zod как enum** — `z.enum(["compact", "standard", "detailed"])` вместо свободной строки
2. **Русские лейблы** — компактный/стандартный/подробный в UI и edit mode
3. **Edit mode injection** — PE пропустил, архитектор добавил
4. **page.tsx initialProfile fix** — баг обнаружен при ревью, volume не передавался в клиент
