# Roadmap ТЗ-XAI-1: Фундамент миграции на xAI

**Создан:** 2026-04-14
**Версия проекта:** 3.87.5 → 3.88.0
**Статус:** 🔄 В работе

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

### Этап 1: Правки каталога

**Статус:** ⬜ Не начат

**Задачи:**
- [ ] Удалить запись `grok-4` из [lib/ai/model-catalog.ts](../../../lib/ai/model-catalog.ts) (0 потребителей, deprecated, не в docs.x.ai)
- [ ] Обновить комментарий-блок над xAI секцией — убрать устаревшее «Context window: 2M aspirational, conservative values until confirmed». Заменить на пояснение «contextWindow задан с запасом под рабочий бюджет качества, не под провайдерский потолок — см. SIMPLY_XAI_NOTES.md»
- [ ] Добавить `notes` на запись `grok-4.20-multi-agent-0309`: `"Multi-agent variant не поддерживает client-side function calling через Chat Completions (только built-in tools + remote MCP). Текущее назначение expertise работает как обычный grok-4.20 (ai_usage_log: 1 вызов за историю). ТЗ-XAI-5 переключит expertise на grok-4.20-0309-non-reasoning. Multi-agent активируется только через Responses API — см. будущую ветку ТЗ-XAI-MA-1."`

**Валидация:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `grep -r "grok-4\"" app/ lib/` — нет ссылок на удалённую запись
- [ ] `npm run build` — успешен (предупреждение: build автоматически накатывает pending migrations, migrations на этом этапе не добавляем)

---

### Этап 2: Документация серии

**Статус:** ⬜ Не начат

**Задачи:**
- [ ] Переместить `specs/_backlog/TZ_GrokContextWindowAudit.md` → `specs/_backlog/_archive/` с пометкой «закрыт решением 2026-04-14: тест отвечал на неправильный вопрос, привязка к провайдерскому окну — антипаттерн»
- [ ] Append-only запись в [../SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) «2026-04-14 — ТЗ-XAI-1 завершён»: что изменено, что НЕ изменено и почему
- [ ] `CHANGELOG.md` entry `v3.88.0 — ТЗ-XAI-1 Фундамент миграции на xAI`
- [ ] `SIMPLY_STATUS.md` — отметить XAI-1 завершённым, XAI-2 next

**Валидация:**
- [ ] Markdown-ссылки в NOTES/CHANGELOG/STATUS рабочие
- [ ] `grep "TZ_GrokContextWindowAudit"` в `specs/_backlog/` — только в archived пути

---

### Этап 3: Финализация

**Статус:** ⬜ Не начат

**Задачи:**
- [ ] Smoke-тест в браузере: dashboard → Simply Chat → отправить сообщение → ответ приходит (по-прежнему MiniMax, поведение не изменилось — принцип «ноль изменений поведения»)
- [ ] Smoke-тест: `/dev/models` загружается, все актуальные xAI записи видны, `grok-4` отсутствует
- [ ] 🧪 Мануальный тест Владимира — явный ОК
- [ ] Version bump `package.json` → 3.88.0
- [ ] Git commit `release(v3.88.0): ТЗ-XAI-1 — фундамент миграции на xAI`

**Валидация:**
- [ ] Все галочки выше
- [ ] Явный ОК Владимира на коммит

---

## Риски

| Риск | Митигация |
|---|---|
| Удаление `grok-4` ломает неизвестный импорт | grep подтвердил 0 потребителей + `npx tsc --noEmit` страхует |
| Смысл notes на multi-agent потеряется за месяцы | NOTES-лог append-only фиксирует решение, плюс notes в коде каталога |
| Владимир потом захочет поднять contextWindow до реального значения | Отдельное ТЗ в будущем, не блокер миграции |
