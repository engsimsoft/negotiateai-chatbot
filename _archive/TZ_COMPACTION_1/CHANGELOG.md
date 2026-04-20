# Changelog ТЗ-COMPACTION-1

История изменений в рамках этого ТЗ. Обновляется после каждой сессии.

---

## Сессия 1 — 2026-04-18 (Фаза 1 — Анализ)

### Added
- `specs/TZ_COMPACTION_1/SPEC.md` — короткий шаблон с ссылкой на архитектурный документ v1.7.
- `specs/TZ_COMPACTION_1/ANALYSIS.md` — 8 секций: Изученная документация, Резюме, Код-ревью (8 findings), Согласованность с MIND, Вопросы архитектору, Риски, Зависимости, Оценка сложности.
- `specs/TZ_COMPACTION_1/ARCHITECT_ANSWERS.md` — ответы архитектора на Группы 1-2 вопросов.
- `specs/TZ_COMPACTION_1/ROADMAP.md` — план этапов A1-A6, B1, Финализация.
- `specs/TZ_COMPACTION_1/CHANGELOG.md` — этот файл.
- `specs/TZ_COMPACTION_1/HANDOFF.md` — контекст для следующей сессии.

### Changed
- `specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md` → v1.7 → v1.8 (8 правок по результатам код-ревью + ответов архитектора):
  1. Точка интеграции исправлена на единый `app/(chat)/api/chat/route.ts` (в проекте нет отдельных routes для expertise/create).
  2. Подсчёт токенов: SSOT = `estimateMessageTokens` из `lib/utils.ts` (формула MIND extract).
  3. AI SDK integration: explicit pre-call preprocessing, не `prepareStep`.
  4. Таблица «Сводка изменений кода» исправлена + переписывание `supportsCompaction` логики Line 952-965 через `getCompactionStrategy` с реальным modelId.
  5. xAI caching автоматическое, `x-grok-conv-id` только оптимизация routing — в MVP не включаем.
  6. Edge case verbatim окна: hard upper bound 80K токенов.
  7. Язык summary: одна инструкция на русском + директива автоадаптации.
  8. Виджет: реализация через существующий DataStream protocol + `emitDebugCompaction` helper.

### Pre-ТЗ (фиксация ранее)
- Архитектурный документ v1.1 → v1.7: 6 версий создания + закрытия 5 вопросов (Q1/Q2/Q3/Q4/Q5 закрыты в v1.3/v1.4/v1.2/v1.5/v1.7).
- Создан backlog-долг [TZ_UnifyContextThresholdBase](../_backlog/TZ_UnifyContextThresholdBase.md) в v1.2.

### Files
- `specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md` — v1.7 → v1.8
- `specs/TZ_COMPACTION_1/SPEC.md` — создан
- `specs/TZ_COMPACTION_1/ANALYSIS.md` — создан
- `specs/TZ_COMPACTION_1/ARCHITECT_ANSWERS.md` — создан
- `specs/TZ_COMPACTION_1/ROADMAP.md` — создан
- `specs/TZ_COMPACTION_1/CHANGELOG.md` — создан
- `specs/TZ_COMPACTION_1/HANDOFF.md` — создан

### Status на конец сессии
- Фаза 1 WORKFLOW: ✅ завершена
- Фаза 2 WORKFLOW (планирование ROADMAP): ✅ завершена
- Ждёт: одобрение ROADMAP владельцем перед Фазой 3 (код)
