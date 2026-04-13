# ADR 051: Pipeline observability + targeted caching (ТЗ-CachePipelineMetrics)

**Статус:** Accepted
**Дата:** 2026-04-13
**Версия проекта:** 3.87.0
**Связанные ADR:** [049 MiniMax Anthropic-compat](./049-minimax-anthropic-compat-mode.md), [050 Cache breakpoints strategy](./050-cache-breakpoints-strategy.md)

---

## Контекст

После ТЗ-CacheAudit (v3.85.0) 3-breakpoint cache strategy была доказана в chat-routes (Simply Chat + task-expert): 54-74% экономии. Логичный follow-up — **применить тот же паттерн к pipelines** (briefing, podcast). SPEC ТЗ-CachePipelineMetrics (v1.0) изначально описывал именно это: расставить cache breakpoints во всех pipeline-вызовах.

В ходе работы ТЗ всплыла **вторая проблема**: pipelines хардкодят `cacheReadTokens: 0` + `as any` cast в usage logging → `/admin/cost-audit` занижает реальную стоимость на 10-25%. Плюс из TZ_LegacyChatCleanup Finding #2 пришёл недолог `getModel()` call-sites (util:title, OCR, clerks, service-chats). Эти две проблемы объединены в SPEC v2.0.

---

## Решение

### Разделяем две независимые ценности

**1. Observability fix (главная ценность, applicable везде):**
- Удалены хардкоды `cacheReadTokens: 0 as any` в `lib/podcast/script-generator.ts` — заменены на disjoint accumulator через `extractUsageForPricing()` helper
- Добавлен JSDoc над `ai_usage_log.inputTokens` колонкой — warning о том что поле GROSS (включает cache read/write), иначе SQL aggregations делают double counting
- `lib/ai/tools/request-suggestions.ts` — единственный непокрытый `getModel()` call-site в production коде, теперь вызывает `logUsage` через `waitUntil`
- 363 строки мёртвого `generateArticleMapReduce` удалены из `briefing-author.ts` — последствие rejected TZ_MapReduceBriefing (Map-Reduce + MiniMax streaming socket reuse bug). Dead code содержал hardcode fallback `{ cacheReadTokens: 0, cacheWriteTokens: 0, ... }` — удаление кардинально решает проблему, не замазывает её
- Пояснительные комментарии к legit `cacheReadTokens: 0` в `research-engine.ts` (Perplexity не имеет prompt caching) и `tts-gemini.ts` (Gemini TTS per-character pricing, `as any` — escape hatch для non-token providers). Оба — НЕ баги, фиксируем как паттерн

**2. Caching — targeted, не cross-pipeline:**
- **Оставлен:** cache breakpoints в `lib/podcast/script-generator.ts` (2 breakpoints: static system + last user через `providerOptions.anthropic.cacheControl` message-level)
- **Откачен:** cache breakpoints в `briefing-author.ts` и `briefing-section-author.ts`

### Почему podcast cache оставлен, а briefing — откачен

**Решающий фактор — реальная usage frequency vs 5-минутный Anthropic cache TTL.**

| Pipeline | Частота вызовов | Cache hit scenario | Решение |
|---|---|---|---|
| `briefing:author` | 1 раз в сутки | Никогда (24h >> 5min TTL). Cold write без read = чистый перерасход ~25% | ❌ Removed |
| `briefing:section-author` | 0-1 раз за сессию (per-section refresh ↻) | Только если user рефрешит 2+ секций burst'ом в 5 мин — edge case без данных о частоте | ❌ Removed (возвращается при появлении телеметрии burst-refresh) |
| `podcast:script` | N раз за сессию (N=3-5 тем), все в пределах 1-2 минут | Каждый вызов после первого попадает в cache TTL. Эмпирически подтверждено в Этапе 5 SQL: 30% экономии на втором вызове из двух | ✅ Kept |

**Эмпирические данные (из `ai_usage_log` за тестовую сессию 2026-04-13 15:40):**

```
podcast:script call 1 (15:40:15): inputTokens=2823, cacheWriteTokens=2823, cacheReadTokens=0
podcast:script call 2 (15:40:26): inputTokens=4125, cacheWriteTokens=1479, cacheReadTokens=2646
```

Second call hit cache for 64% of input tokens (system prompt переиспользован). Cost второго вызова $0.0024 vs расчётных $0.0035 без кэша — **реальная экономия ~30%**.

**briefing:author test (тот же run, 15:38:59):** `inputTokens=4768, cacheWriteTokens=0, cacheReadTokens=0` — MiniMax не создал cache блок. Причина неясна (возможно, порог minimum cacheable tokens для этого pipeline pattern не достигнут), но даже если бы создал — следующий вызов через 24 часа, кэш давно expired. Пользы нет ни в гипотезе, ни на практике.

### Approach A, не B (для Phase 3 coverage)

SPEC v2.0 рассматривал два подхода к full `getModel()` coverage:
- **A (manual):** инструментировать каждый непокрытый call-site руками
- **B (middleware):** `getModelInstrumented(taskId)` wrapper через provider registry middleware

После аудита: **36 из 38 call-sites уже покрыты** (95%). Единственный непокрытый — `lib/ai/tools/request-suggestions.ts`. `lib/ai/professor-pipeline.ts` использует `saveAiUsageLog` напрямую (не через `logUsage` wrapper) но покрытие полных полей подтверждено через `extractUsageFields()` — функционально эквивалентно.

**Выбран Approach A** — middleware wrapper был бы overkill для одного missing call-site. Добавлять абстракцию без функциональной причины = костыль.

---

## Альтернативы (рассмотрены и отклонены)

### Альтернатива 1 — Cache breakpoints everywhere (первоначальный SPEC)

Расставить cache breakpoints во всех 5 pipeline-файлах (briefing-author, briefing-section-author, briefing-filter, podcast/script-generator, podcast/tts-gemini).

**Почему отклонена:** premature optimization. Первоначальная оценка «~70% экономии в briefing per-section refresh» была взята из `ANALYSIS.md` как гипотеза без данных о usage frequency. Эмпирический тест показал что кэш в briefing не работает (ни технически, ни из-за частоты вызовов). Откат — единственно разумный ход.

### Альтернатива 2 — Rollback ALL cache breakpoints including podcast

Убрать кэш везде, оставить только observability. Переделать cache в отдельном ТЗ.

**Почему отклонена:** podcast cache empirically proven to work в том же тесте что показал неработоспособность briefing cache. Откатывать доказанную экономию ради чистоты scope — жалко. ADR 050 паттерн работает; его нужно применять целенаправленно, не повсеместно.

### Альтернатива 3 — Middleware wrapper (Approach B) для full coverage

Создать `getModelInstrumented(taskId)` который автоматически подключает usage logging через provider registry middleware.

**Почему отклонена:** 95% call-sites уже покрыты ручной инструментацией. Единственный непокрытый call-site (request-suggestions) — 15 строк правки вручную. Middleware wrapper создаст абстракцию ради одного use case, скроет прямое поведение `getModel()` (важный SSOT после ТЗ-1), усложнит добавление новых call-sites в будущем. Ручная инструментация проще и прозрачнее.

---

## Последствия

### Положительные

- **`/admin/cost-audit` показывает правду для podcast pipeline.** До ТЗ: podcast:script записывал хардкод `cacheReadTokens: 0` → dashboard занижал реальную стоимость. После: реальные cache fields.
- **Реальная экономия на multi-topic подкастах** — ~30% на каждом вызове после первого. Для подкаста из 5 тем это ~20% на весь скрипт-generation этап.
- **`util:artifact-suggestions` попадает в `ai_usage_log`.** Раньше suggestion tool расходовал Sonnet tokens в чёрную — теперь виден в audit.
- **`inputTokens` gross-семантика задокументирована** на уровне schema.ts JSDoc. Будущий reviewer не сделает double counting в SQL аггрегациях.
- **363 строки dead code удалены** из briefing-author. Меньше мест для путаницы reviewer'ам.
- **Architectural honesty** — решили что pipeline caching работает только там где есть доказанная frequency. Применили to-the-point, не как blanket optimization.

### Нейтральные / trade-offs

- **Briefing остаётся без кэша.** Если в будущем change the UX и briefing начнёт запускаться несколько раз подряд (например, user кликает «regenerate» подряд) — нужно пересмотреть. Но сейчас нет таких данных.
- **briefing-section-author без кэша.** Гипотетический burst-refresh scenario проигран за неимением метрик реального паттерна use. Если телеметрия покажет что user часто делает ↻ на 3+ секциях подряд — добавить кэш будет 5 строк.
- **request-suggestions middleware остался ручной.** Если в будущем всплывут ещё 5+ непокрытых call-sites — возможно переход на Approach B оправдан. Сейчас — no.

### Отрицательные

- **Не-универсальное решение.** Cache strategy pipelines не single pattern, а per-pipeline decision based on frequency. Менее элегантно, чем blanket apply, но соответствует реальности.
- **Потенциальная future cache в briefing откладывается.** Если usage pattern изменится — придётся помнить о возможности. Митигировано: в commit message'ах и этом ADR зафиксированы условия при которых возвращать кэш.

---

## Критерии успеха (post-ТЗ validation)

1. ✅ **SQL check:** podcast:script в `ai_usage_log` после v3.87.0 показывает non-zero `cacheReadTokens` для второго и последующих вызовов в одной сессии — **подтверждено в Этапе 5 теста**
2. ✅ **No regression:** briefing generates как раньше (просто без cacheControl markers) — подтверждено manual smoke test Этапа 1 и Этапа 2
3. ✅ **Dead code removed:** `generateArticleMapReduce` и 4 его helpers не существуют в working tree
4. ⏸ **request-suggestions logged:** требует UI-теста (инструмент advice on document) для окончательного подтверждения — оставлено как follow-up manual check, не блокер
5. ✅ **Documentation:** ADR 051 + JSDoc (schema.ts, research-engine.ts, tts-gemini.ts) задокументированы

---

## Урок / процесс

**Урок 1 — Frequency аudit перед cache optimization.**

Я расставил cache breakpoints в 4 файлах до того как проверить реальную usage frequency каждого pipeline. Это было premature optimization. Правильный процесс — сначала собрать данные (cron schedule, telemetry, UX sessions) и только потом оптимизировать.

В ANALYSIS.md v1 была таблица с гипотетическими «~70% экономии» — это была оценка без данных, которую я не обозначил как гипотезу. Должен был.

**Урок 2 — Empirical test раньше full implementation.**

Cache breakpoints надо было эмпирически проверить на 1 pipeline (например podcast) **до** того как раскатывать на 4. Это сэкономило бы один commit rollback.

**Урок 3 — Respectful rollback.**

Когда owner (не программист) задал правильный архитектурный вопрос про frequency — это был важный сигнал. Правильная реакция: не защищать предыдущее решение, а переоценить и откатить если нужно. Rollback — не неудача, а нормальная часть процесса.

---

## Итоговые файлы (v3.87.0)

### Изменены (kept)

- `lib/podcast/script-generator.ts`:
  - Cache breakpoints (2): static system + last user, `generateText` + `providerOptions.anthropic.cacheControl`
  - Disjoint accumulator через `extractUsageForPricing()`
  - Removed `as any` cast в `logUsage`
  - Trace block с реальными cache fields
- `lib/ai/tools/request-suggestions.ts`: добавлен `waitUntil(logUsage(...))` для `streamObject.usage` promise
- `lib/db/schema.ts`: JSDoc над `inputTokens` колонкой `ai_usage_log`
- `lib/briefing/research-engine.ts`: комментарий-объяснение Perplexity legit `cacheReadTokens: 0`
- `lib/podcast/tts-gemini.ts`: комментарий-объяснение Gemini TTS legit `as any` (per-character pricing)

### Изменены (reverted)

- `lib/briefing/briefing-author.ts`: убран `messages[]` с providerOptions, вернулся к `system:` + `prompt:` форме. Плюс 363 строки dead code (`generateArticleMapReduce` + helpers) удалены
- `lib/briefing/briefing-section-author.ts`: убран `messages[]` с providerOptions, вернулся к `system:` + `prompt:` форме

### Не тронуты (ранее-помеченные как «bugs», оказались корректны)

- `lib/briefing/research-engine.ts` `cacheReadTokens: 0` — Perplexity math correct
- `lib/podcast/tts-gemini.ts` `{ inputTokens: 0 } as any` — non-token billing escape hatch

---

**Автор:** Claude Opus 4.6 (с архитектурной коррекцией по владельческому review)
