# ТЗ-XAI-4 — ROADMAP

**Создан:** 2026-04-16
**Статус:** Этап 1 в работе
**Scope:** 7 taskId (см. [ANALYSIS.md §2](ANALYSIS.md))
**Зависит от:** [ANALYSIS.md](ANALYSIS.md) (утверждён владельцем 2026-04-16)

> Живой чеклист. Обновляется после каждой задачи. `[x]` ставится только после `npx tsc --noEmit` → 0 ошибок.

---

## Этап 1 — Smoke test streamObject (изолированный, до правок task-assignments)

**Цель:** убедиться что `streamObject` с `output: "array"` работает на `grok-4-1-fast-non-reasoning` через AI SDK v6. Fallback по Q-A — `grok-4.20-0309-non-reasoning`.

- [ ] Создать `scripts/test-grok-streamObject.ts` (изолированный тест через registry, не через task-assignments)
- [ ] Прогнать: `npx tsx scripts/test-grok-streamObject.ts`
- [ ] Проверить: валидный stream, элементы соответствуют Zod schema, usage promise резолвится, нет parse errors
- [ ] Если FAIL на 4.1 Fast — повторить на grok-4.20-0309-non-reasoning (Q-A fallback)
- [ ] Удалить тестовый скрипт после прохождения (паттерн v3.91.0 / test-pdf-extract-scenarios.ts)
- [ ] Записать результат в [`../SIMPLY_XAI_NOTES.md`](../SIMPLY_XAI_NOTES.md) (append-only)
- [ ] Доложить владельцу результат + какая модель будет у `util:artifact-suggestions`

---

## Этап 2 — Миграция «Подсобки» (6 taskId)

**Цель:** переключить 6 точек на Grok 4.1 Fast (или 4.20 для artifact-suggestions если fallback). Одно изменение в `lib/ai/task-assignments.ts` + обновление `docs/ai-chats-map.md`.

**Task 2.1 — Изменения в task-assignments.ts**
- [ ] `briefing:filter` → `grok-4-1-fast-non-reasoning`
- [ ] `clerk:task-summary` → `grok-4-1-fast-non-reasoning`
- [ ] `clerk:file-analyzer` → `grok-4-1-fast-non-reasoning`
- [ ] `util:title` → `grok-4-1-fast-non-reasoning`
- [ ] `util:project-summary` → `grok-4-1-fast-non-reasoning`
- [ ] `util:artifact-suggestions` → `grok-4-1-fast-non-reasoning` (или `grok-4.20-0309-non-reasoning` по результату Этапа 1)
- [ ] Обновить inline-комментарии в task-assignments.ts рядом с каждой правкой (указать ТЗ-XAI-4 и дату)
- [ ] `npx tsc --noEmit` → 0 ошибок

**Task 2.2 — Синхронизация docs**
- [ ] `docs/ai-chats-map.md` — обновить строки для 6 taskId (правило feedback_ai_chats_map_sync.md)
- [ ] `npx tsc --noEmit` → 0 ошибок

**Task 2.3 — Build + предупреждение владельцу**
- [ ] ⚠️ Предупредить владельца: `npm run build` автоматически накатит pending migrations. Спросить ОК перед запуском.
- [ ] `npm run build` → успешно

**Task 2.4 — Мануальный тест (6 сценариев)**
- [ ] `briefing:filter` — запустить генерацию брифинга → фильтр-шаг прошёл успешно
- [ ] `clerk:task-summary` — завершить 1 задачу проекта → clerk-summary в БД, валидный JSON
- [ ] `clerk:file-analyzer` — загрузить 2-3 файла в проект → анализ успешен, нет HTTP 500
- [ ] `util:title` — создать новый чат → автонейминг генерируется
- [ ] `util:project-summary` — запросить summary 1 проекта → валидный текст
- [ ] `util:artifact-suggestions` — создать текстовый артефакт → вызвать requestSuggestions → элементы streamятся, usage логируется
- [ ] SQL-проверка: `ai_usage_log` содержит записи с новыми `modelId` за последний час

**Task 2.5 — Commit**
- [ ] Создать commit `feat(xai-migration): TZ_XAI_4 Этап 2 — подсобка на Grok 4.1 Fast (6 taskId)` только после OK владельца
- [ ] НЕ пушить до завершения всех этапов (локально остаётся ahead of origin)

---

## Этап 3 — Миграция «Зала» (1 taskId)

**Цель:** переключить `meeting:summary` на Grok 4.20.

**Task 3.1 — Изменение**
- [ ] `meeting:summary` → `grok-4.20-0309-non-reasoning` в task-assignments.ts
- [ ] Обновить inline-комментарий
- [ ] `npx tsc --noEmit` → 0 ошибок

**Task 3.2 — Синхронизация docs**
- [ ] `docs/ai-chats-map.md` — обновить строку `meeting:summary`
- [ ] `npx tsc --noEmit` → 0 ошибок

**Task 3.3 — Build + мануальный тест**
- [ ] ⚠️ Предупредить владельца про migrations
- [ ] `npm run build` → успешно
- [ ] **Мануальный тест:** прогнать 1 реальную запись встречи через `/meeting` — summary корректный, transcribe → title → summary pipeline не падает
- [ ] SQL-проверка `ai_usage_log` для `modelId = grok-4.20-0309-non-reasoning`

**Task 3.4 — Commit**
- [ ] Создать commit `feat(xai-migration): TZ_XAI_4 Этап 3 — meeting:summary на Grok 4.20` после OK

---

## Этап 4 — Финализация

**Task 4.1 — MiniMax catalog audit deliverable**
- [ ] Зафиксировать в `SIMPLY_XAI_NOTES.md` итоги MiniMax audit (ожидается: 2 catalog entries, 4 task-assignments ссылки остаются после XAI-4, deliverable для XAI-6)

**Task 4.2 — Обновление live docs**
- [ ] `specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md` — отметить ТЗ-XAI-4 ✅
- [ ] `specs/Simply_xAI/SIMPLY_XAI_CHANGELOG.md` — append запись v3.92.0
- [ ] `SIMPLY_STATUS.md` — обновить текущее состояние серии
- [ ] Корневой `CHANGELOG.md` — append запись v3.92.0

**Task 4.3 — Version bump + release commit**
- [ ] `package.json` — bump version до `3.92.0`
- [ ] Release commit `release(v3.92.0): TZ_XAI_4 — Utility/Pipeline миграция на Grok (7 taskId)`

**Task 4.4 — HANDOFF + hygiene**
- [ ] `specs/Simply_xAI/HANDOFF.md` — обновить «Прогресс серии», «Что сделано в этой сессии», «Следующий шаг» (→ ТЗ-XAI-5)
- [ ] Архивировать `specs/Simply_xAI/TZ_xai_4_UtilityPipelines/` → `_archive/` + обновить `_archive/BACKLOG_CLOSED.md`
- [ ] Hygiene commit `chore: archive TZ_XAI_4 after v3.92.0`

---

## Rule №0 Checkpoints

| Checkpoint | Условие | Статус |
|---|---|---|
| Перед Этапом 1 | ANALYSIS.md одобрен владельцем | ✅ 2026-04-16 |
| Перед Этапом 2 | Этап 1 прошёл, модель для `util:artifact-suggestions` выбрана | ⏳ |
| Перед Этапом 3 | Этап 2 прошёл мануальный тест владельца | ⏳ |
| Перед Этапом 4 | Этап 3 прошёл мануальный тест владельца | ⏳ |

---

## Валидационные команды

```bash
# После каждой задачи — обязательно
npx tsc --noEmit

# Перед началом этапа — предупредить владельца
npm run build  # ⚠ auto-runs migrations

# SQL-проверка usage log (между этапами)
# через mcp__postgres__query или psql:
# SELECT chat_mode, model_id, COUNT(*) FROM ai_usage_log
#   WHERE created_at > NOW() - INTERVAL '1 hour'
#   GROUP BY chat_mode, model_id;
```

---

**Ссылки:**
- [ANALYSIS.md](ANALYSIS.md) — scope, audit findings, risk matrix, решения Q-A…Q-D
- [../SIMPLY_XAI_ROADMAP.md](../SIMPLY_XAI_ROADMAP.md) — общая дорожная карта серии
- [../SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) — append-only лог решений серии
- [../HANDOFF.md](../HANDOFF.md) — мост между сессиями
