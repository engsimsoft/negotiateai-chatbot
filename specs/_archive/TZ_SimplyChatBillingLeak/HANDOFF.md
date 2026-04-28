# HANDOFF — TZ_SimplyChatBillingLeak

**Дата закрытия:** 2026-04-28
**Статус:** ✅ partial fix применён, остаточная работа поглощена Шагом 4 миграции
**Версия:** не зарелижено (dev-only фиксы)

---

## Что было сделано в этой сессии

### Корень проблемы (подтверждён замерами по HTTP body)

**Двухслойная утечка:**

1. **Compaction noop не подставлял summary** — после compact-turn'а `compactionSummary` сохранялся в БД, но на следующих noop-turn'ах НЕ подставлялся в payload. Старые сообщения слались целиком каждый turn.
2. **Inline-текст файлов копится в истории навсегда** — `convertTextFilePartsInMessage` ([route.ts:233](../../app/(chat)/api/chat/route.ts#L233)) превращает `.md`/`.docx`/`.xlsx` в text part `📄 **Файл: имя**\n\`\`\`...весь текст...\`\`\``. Этот text part сохраняется в БД как часть user message и тащится в каждый последующий turn. Дополнительно: при повторной загрузке того же файла создаётся **дубликат** в истории.

### Применённые фиксы

**Fix 1 — `lib/ai/compaction/prepare-messages.ts:107-126`** (КЕЕП — переживёт миграцию)

Добавлена noop-but-substitute ветка: на noop-turn'ах middleware читает `getCompactionState`, и если есть сохранённый `summary` + `index` — подставляет `[syntheticSummary, ...messages.slice(index)]` вместо полной истории. Архитектурно корректно, симметрично с compact-веткой.

**Fix 2 — `app/(chat)/api/chat/route.ts:340-352`** (РЕШЕНИЕ ПО УДАЛЕНИЮ — см. ниже)

Добавлена обработка inline file-text в `stripOldAttachmentsFromHistory`: для user-сообщений старше последних 2 user-msgs текст вида `📄 **Файл: имя**\n\`\`\`...\`\`\`` заменяется на `[Ранее был прикреплён файл: имя]`. Симметрично с PDF/image stripping.

### Замеры (chat `3353a183-37f5-498e-b461-c2e87ff65ef1`)

| Состояние | Input на noop turn | Делta |
|---|---|---|
| До фиксов | 94K (history целиком) | baseline |
| После Fix 1 (compaction noop substitution) | 57K | -39% |
| После Fix 2 (file content stripping) | 38-41K | -57% от baseline |

---

## Решение по Fix 2 (route.ts) — оставить как переходный код

**Решение владельца + архитектора:** **оставить** Fix 2 на время до Шага 4 миграции.

**Обоснование:**
- Fix 2 экономит ~20K токенов на каждом turn'e в Simply chat прямо сейчас (реальные деньги)
- После Шага 4 (PDF на xAI Files API) `convertTextFilePartsInMessage` перестаёт генерировать `📄 **Файл:**` markers — Fix 2 автоматически становится мёртвым кодом (no-op)
- Удалить можно одной командой в финализации Шага 4

**Действие при Шаге 4:** удалить новый блок в [route.ts:343-352](../../app/(chat)/api/chat/route.ts#L343-L352) (внутри `stripOldAttachmentsFromHistory`) — комментарий `// Inline-текст текстовых файлов...` маркирует место. Fix 1 (prepare-messages.ts) трогать не надо — это про compaction, не про файлы.

---

## Закрытые этим решением backlog-долги

Следующие ТЗ полностью или частично решаются этой работой + Шагом 4 миграции:

- **TZ_DocumentTruncationSilent** — Шаг 4 (PDF через Files API без обрезания текста)
- **TZ_EstimatorIgnoresAttachments** — Шаг 4 (binary не в payload, file_id вместо)

См. [_archive/BACKLOG_CLOSED.md](../../_archive/BACKLOG_CLOSED.md) для полного списка.

---

## Известные остатки (не блокеры)

1. **xAI cache invalidates при кросс-провайдерных переключениях.** При Haiku ↔ Grok последовательности первый Grok turn после Haiku теряет кэш и платит cache_creation. Архитектурная плата за multi-provider, не утечка. Решится после Шага 4 (всё на Grok, переключений минимум).
2. **Estimator занижает Russian-текст ~2×** ([prepare-messages.ts:73-76](../../lib/ai/compaction/prepare-messages.ts#L73-L76)) — известно и задокументировано в коде. Compaction может не сработать когда middleware видит ниже soft threshold, но реальный payload выше. Не критично пока есть `realLastInputTokens` fallback из API.
