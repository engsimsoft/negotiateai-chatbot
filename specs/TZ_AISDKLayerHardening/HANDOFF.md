# Передача сессии ТЗ-AISDKLayerHardening

**Дата:** 2026-04-17
**Сессия:** 1 (Фаза 1 + Фаза 2 закончены)

---

## Статус этапов

- [x] Фаза 1 — Анализ + Код-ревью (SPEC + ANALYSIS, 4 вопроса отвечены владельцем)
- [x] Фаза 2 — Планирование (ROADMAP с cap table на 37 taskIds)
- [ ] Этап 1: DevOverrides cleanup ← **СЛЕДУЮЩИЙ**
- [ ] Этап 2: MaxOutputTokens SSOT + getter + 36 call sites
- [ ] Этап 3: plan/route.ts → streamText
- [ ] Этап 4: Финализация

## Следующая сессия: начни с

1. Подтверждение владельца на весь ROADMAP (особенно cap table — ключевое архитектурное решение)
2. При OK → стартуем Этап 1 (DevOverrides cleanup, 0.5 сессии)
3. Строго по gate-keeping: после каждой задачи `tsc`, после этапа `build` + мануальный тест + git commit + OK владельца

## Ключевые решения из Фазы 1

**Подтверждены владельцем:**
- Q1: cap для всех 36 call sites (max coverage), обоснование cost ceiling
- Q2: удалить все 7 redundant side-effect imports, добавить комментарий-маяк в `instrumentation.ts`
- Q3: `Record<TaskId, number>` always-number для compile-time safety
- Q4: пересобрать cap table с нуля по 37 реальным taskIds → сделано в ROADMAP § 2.1

## В процессе
(сейчас ничего в работе, ждём апрув ROADMAP)

## Блокеры / Вопросы
- Ожидание ОК владельца на cap table (ROADMAP § 2.1) перед стартом Этапа 1

## Важные файлы для следующей сессии

- [SPEC.md](SPEC.md) — umbrella ТЗ
- [ANALYSIS.md](ANALYSIS.md) — аудит + изученная документация
- [ROADMAP.md](ROADMAP.md) — чеклист с cap table (ключевое)
- [specs/WORKFLOW.md](../WORKFLOW.md) — процесс работы
- [specs/ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md) — шаблон

## Напоминания по критическим правилам

- ⛔ `npm run build` в Simply = `tsx lib/db/migrate && next build` → запускать только после остановки `next dev`
- ⛔ Не отмечать `[x]` без реальной валидации
- ⛔ Gate после каждого этапа: build → мануальный тест → OK → следующий
- ⛔ Находки вне scope → FINDINGS.md СРАЗУ, не «заодно»
- ⛔ Официальная документация если затронем технологию не покрытую в ANALYSIS
