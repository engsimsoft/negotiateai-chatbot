# Roadmap ТЗ-XAI-1: Фундамент миграции на xAI

**Создан:** 2026-04-14
**Завершён:** 2026-04-14
**Версия проекта:** 3.87.5 → 3.88.0
**Статус:** ✅ Завершён (commit `ba9e928`)

**Связанные:**
[SPEC](TZ-XAI-1.md) · [ANALYSIS](ANALYSIS.md) · [ROADMAP серии](../SIMPLY_XAI_ROADMAP.md) · [NOTES](../SIMPLY_XAI_NOTES.md)

---

## Суть

ТЗ-XAI-1 было написано на ~60% вхолостую (регистр/getModel/providers/CAPS_GROK уже сделаны в CoreRegistry и DevSwitchboardUI). После архитектурной коррекции Владимира от эмпирического теста контекста тоже отказались — он отвечал на неправильный вопрос (см. NOTES 2026-04-14).

**Реальная работа:**
1. Удалить мёртвую `grok-4` запись из каталога (0 потребителей)
2. Добавить notes на `grok-4.20-multi-agent-0309` — зафиксировать что multi-agent через Chat Completions фактически не работает, XAI-5 переключит expertise на `grok-4.20-0309-non-reasoning`
3. Зафиксировать в NOTES/CHANGELOG/STATUS, закрыть backlog `TZ_GrokContextWindowAudit`
4. Build + smoke check + commit

**НЕ делаем:**
- Эмпирический тест контекстного окна (отменён, NOTES 2026-04-14)
- Обновление `contextWindow` у xAI записей (текущие 256K/128K заведомо выше рабочего бюджета, привязка архитектуры к окну провайдера — антипаттерн)
- Переключение taskId (это ТЗ-XAI-2+)

---

## Этапы

### Этап 1: Правки каталога ✅

**Статус:** ✅ Завершён

**Задачи:**
- [x] Удалить запись `grok-4` из [lib/ai/model-catalog.ts](../../../lib/ai/model-catalog.ts) — SQL-аудит подтвердил 0 исторических записей в ai_usage_log, оставлен только пояснительный комментарий
- [x] Обновить комментарий-блок над xAI секцией — убран устаревший TODO про «2M aspirational», добавлено архитектурное обоснование что contextWindow задан под рабочий бюджет качества, не под провайдерский потолок
- [x] Добавить `notes` на `grok-4.20-multi-agent-0309` с фиксацией что multi-agent не работает через Chat Completions и XAI-5 переключит expertise на non-reasoning variant

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `grep "grok-4"` (точный id pattern) в app/ lib/ — 0 живых ссылок
- [x] `npm run build` — EXIT 0, все маршруты собраны

---

### Этап 2: Документация серии ✅

**Статус:** ✅ Завершён

**Задачи:**
- [x] `specs/_backlog/TZ_GrokContextWindowAudit.md` → `specs/_backlog/_archive/` с заголовком «🗄️ АРХИВИРОВАН 2026-04-14 в ТЗ-XAI-1»
- [x] Append-only запись в [../SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) «2026-04-14 — ТЗ-XAI-1 завершён (v3.88.0)» с описанием что сделано и что НЕ сделано
- [x] `CHANGELOG.md` — entry `[3.88.0] — 2026-04-14 — ТЗ-XAI-1 Фундамент миграции на xAI` (Removed/Changed/Архитектурное решение/Closed backlog)
- [x] `SIMPLY_STATUS.md` — добавлена секция «🎯 Активная серия: Simply_xAI»
- [x] `docs/ai-providers.md` — таблица xAI обновлена
- [x] `docs/model-catalog-ops.md` — строка про deprecated grok-4 помечена strikethrough

**Валидация:**
- [x] Markdown-ссылки рабочие
- [x] `grep "TZ_GrokContextWindowAudit"` в specs/ — только в archived пути

---

### Этап 3: Финализация ✅

**Статус:** ✅ Завершён

**Задачи:**
- [x] Смоук-тест Владимира — отправка сообщения в Simply Chat через активный dev override на `grok-4-1-fast-non-reasoning` прошла успешно (TTFT 15ms, total 2.8s). Режим «Думать» на `grok-4-1-fast-reasoning` — успешно (TTFT 8ms, total 68s — нормально для reasoning). MIND retrieval работает. Все тесты прошли
- [x] Version bump `package.json` → 3.88.0 + `CLAUDE.md` + `SIMPLY_STATUS.md`
- [x] Git commit `release(v3.88.0): ТЗ-XAI-1 — фундамент миграции на xAI` (`ba9e928`, 13 files, +868 −27)

**Валидация:**
- [x] `npm run build` EXIT 0, все маршруты собраны
- [x] Явный ОК Владимира получен, коммит создан локально (push — решение Владимира)

---

## Риски

| Риск | Митигация |
|---|---|
| Удаление `grok-4` ломает неизвестный импорт | grep подтвердил 0 потребителей + `npx tsc --noEmit` страхует |
| Смысл notes на multi-agent потеряется за месяцы | NOTES-лог append-only фиксирует решение, плюс notes в коде каталога |
| Владимир потом захочет поднять contextWindow до реального значения | Отдельное ТЗ в будущем, не блокер миграции |
