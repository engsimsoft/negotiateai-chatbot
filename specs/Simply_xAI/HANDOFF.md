# HANDOFF — Серия Simply_xAI миграции

**Последнее обновление:** 2026-04-15
**Текущая версия проекта:** 3.89.0
**Последний коммит серии:** `1481141 release(v3.89.0): ТЗ-XAI-2`

Этот документ — **мост между сессиями**, не замена ROADMAP. За детальными задачами всегда иди в `TZ_xai_N/ROADMAP.md` или `SIMPLY_XAI_CHANGELOG.md`.

---

## Прогресс серии

- [x] **ТЗ-XAI-1** — Фундамент (v3.88.0) — удалён deprecated `grok-4`, notes про multi-agent, зафиксирована архитектура защиты контекста
- [x] **ТЗ-XAI-2** — MIND pipeline → Grok (v3.89.0) — 5 memory-задач на xAI split-стратегией, native `generateObject`, создан MIND_ARCHITECTURE.md
- [ ] **ТЗ-XAI-3** — KITT (Simply Chat) → Grok 4.1 Fast + R-6 cleanup ← **СЛЕДУЮЩИЙ**
- [ ] ТЗ-XAI-4 — Utility/Pipeline batch миграция (briefing, podcast, meeting, professor, title)
- [ ] ТЗ-XAI-5 — Think/Create/Expertise → Grok 4.20 (+ R-5 expertise c multi-agent на non-reasoning)
- [ ] ТЗ-XAI-6 — Очистка MiniMax/OpenRouter

---

## Следующая сессия: начни с

1. **Прочитай в этом порядке (5 минут):**
   - `specs/Simply_xAI/HANDOFF.md` (этот файл)
   - `specs/Simply_xAI/SIMPLY_XAI_CHANGELOG.md` — что реально уже сделано
   - `specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md` — карточка ТЗ-XAI-3
   - `specs/Simply_xAI/SIMPLY_XAI_NOTES.md` — последние 3-4 записи (решения, verified facts)
   - `specs/Simply_xAI/MIND_ARCHITECTURE.md` — **только** если в ТЗ-XAI-3 будут правки касающиеся памяти
2. **Проверь memory рефлексы:** `~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/MEMORY.md` — новые правила зафиксированы (no external architect, Simply_xAI focus, keep docs simple, think-button semantics)
3. **Первая задача ТЗ-XAI-3:** провести ANALYSIS переключения Simply Chat на Grok 4.1 Fast non-reasoning + критический R-6 (убрать `isSimplyNonAnthropicModel` + связанные strip-функции, заменить на проверку `capabilities.vision` из каталога SSOT)
4. **Не начинай код до ANALYSIS** — новая схема работы без внешнего архитектора требует ANALYSIS против реального кода + вопросы пользователю до SPEC/ROADMAP

---

## Что сделано в последней сессии (2026-04-14 → 2026-04-15)

Две сессии подряд, закрыты ТЗ-XAI-1 и ТЗ-XAI-2:

**ТЗ-XAI-1 (v3.88.0):**
- Удалена deprecated `grok-4` запись из каталога (SQL-аудит: 0 потребителей)
- Добавлены notes на `grok-4.20-multi-agent-0309` (multi-agent не поддерживает client-side function calling через Chat Completions → R-5 для XAI-5)
- Header xAI секции каталога обновлён архитектурным обоснованием
- Closed backlog `TZ_GrokContextWindowAudit` (тест отвечал на неправильный вопрос)
- Создана структура серии: SIMPLY_XAI_ROADMAP.md, SIMPLY_XAI_NOTES.md, SIMPLY_XAI_CHANGELOG.md
- Мемори рефлексы: no external architect, Simply_xAI focus, keep docs simple
- Коммиты: `ba9e928`, `0ecc6fa`

**ТЗ-XAI-2 (v3.89.0):**
- 5 memory-задач → xAI split-стратегией: `memory:extract` → Grok 4.20, остальные → Grok 4.1 Fast
- Бонус-рефакторинг: `batchExtractFacts` + `runConsolidation` переписаны с legacy `generateText + JSON.parse + Zod` на native `generateObject` (smoke test verified)
- Dead import `calcCostUsd` убран
- Создан `MIND_ARCHITECTURE.md` — 11-секционный living reference для всей серии
- Live smoke test через Simply Chat: 5 сообщений, 13 фактов извлечено, 3 dedup+supersede, 0 ошибок
- Два side-effect: `getOrCreateSimplyChat` race condition (backlog), one-message lag (known behavior, not a bug)
- Memory рефлексы: think-button semantics
- Коммиты: `6fd1fbb`, `1481141`

---

## Критическое состояние для следующей сессии

### Dev-сервер в фоне
- Процесс `bb2h4xfyd` — `npm run dev` на `http://localhost:3000`
- Если сессия восстанавливается — проверь жив ли сервер через `tail -20 /tmp/claude-501/.../tasks/bb2h4xfyd.output`
- Если мёртв — запускать заново `npm run dev` в background когда понадобится

### Активные dev overrides
Файл `.simply-dev-overrides.json` (в корне проекта, `.gitignore`):
```json
{
  "expertise": "grok-4.20-0309-reasoning",
  "create": "claude-haiku-4-5-20251001",
  "simply-chat": "grok-4-1-fast-non-reasoning",
  "simply-chat-think": "grok-4-1-fast-reasoning"
}
```

**Важно:** overrides `simply-chat` и `simply-chat-think` УЖЕ переводят Simply Chat на Grok через `/dev/models`. В ТЗ-XAI-3 когда будем менять defaults в `task-assignments.ts` — итоговое поведение не изменится (overrides уже держат Grok), но код будет чище (default = Grok, override не нужен).

**Следствие:** при тестировании ТЗ-XAI-3 нельзя полагаться на видимое поведение в браузере как на подтверждение что defaults работают — нужно снять overrides через `/dev/models` UI перед smoke тестом, либо прочитать логи на предмет `Model selection` строк.

---

## Архитектурные константы серии (не забыть)

1. **Защита контекста не привязана к размеру провайдерского окна.** Sliding window (140K) + Extract-on-compression остаются independently. Вечный чат + Lost in the Middle делают провайдерское окно архитектурно иррелевантным. **Compaction API уже no-op для non-Anthropic провайдеров** через `isAnthropicProtocolModel` check — удалять в XAI-3 не требуется, оставим до XAI-6
2. **Simply Chat «Думать» = тировый апгрейд модели (4.1 Fast → 4.20)**, НЕ переключение reasoning режима той же модели. Это продуктовая метафора. Открытый вопрос для ТЗ-XAI-5: какой variant 4.20 (reasoning или non-reasoning) — решим в XAI-5
3. **`reasoningEffort` не передавать** ни reasoning ни non-reasoning вариантам Grok 4.1 Fast / 4.20 — empirical тест показал Bad Request для обоих. Только multi-agent variant принимает (управляет числом агентов), но мы его не используем
4. **Все memory defaults — стартовые точки, не финальный выбор.** Любой таск переключается через `/dev/models` switchboard без коммита. Мониторить качество через `/context` dashboard — если Grok 4.20 хуже Sonnet на extract, откатить через override за секунды

---

## Критичные вопросы и риски для ТЗ-XAI-3

### R-6 (высокий приоритет, уже зафиксирован в ROADMAP серии)

**Проблема:** в [chat/route.ts:919](../../app/(chat)/api/chat/route.ts#L919) есть условие:
```ts
const isSimplyNonAnthropicModel =
  chatMode === "simply" && effectiveProvider !== "anthropic";
```

Оно триггерит `stripMediaPartsForTextModel` (убирает image/file parts из истории) для любого не-Anthropic провайдера в simply chatMode. **Когда в XAI-3 переключим Simply Chat на Grok — эта функция начнёт молча стрипать изображения, хотя Grok 4.1 Fast поддерживает vision.**

**Правильное решение (зафиксировано в [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) запись 2026-04-14 «Коррекция R-6»):**
- Полностью убрать `isSimplyNonAnthropicModel` + `stripMediaPartsForTextModel` + `stripLegacyOpenAICompatToolParts`
- Заменить на проверку `capabilities.vision` из `model-catalog.ts` (SSOT)
- НЕ полагаться на маршрутизацию «vision → Haiku спасёт» — это хрупкая логика

### Vision маршрут
Текущий routing: `simply-chat-vision` (при attachments) → `claude-haiku-4-5-20251001`. Это **не трогаем** в XAI-3 — Haiku остаётся для vision до будущих решений. Проверить что routing в [chat/route.ts:598-608](../../app/(chat)/api/chat/route.ts#L598) не ломается после R-6 cleanup.

### Compaction API block
[chat/route.ts:902-913](../../app/(chat)/api/chat/route.ts#L902) — `compactionOptions` собирается через `supportsCompaction` check, который смотрит на `effectiveCatalogEntry.capabilities.supportsCompaction`. Для xAI моделей в каталоге `supportsCompaction: false` → блок становится `undefined` → `providerOptions` в streamText получает `undefined` → no-op. **Ничего удалять не надо**, проверится само при переключении.

### Tools остаются
Simply Chat tools работают через function calling — Grok 4.x это полноценно поддерживает (verified в ТЗ-XAI-1). Никаких strip функций tools не трогать.

---

## Блокеры / Открытые вопросы

- [ ] Перед стартом XAI-3 снять dev overrides на simply-chat / simply-chat-think через `/dev/models` UI, чтобы смоук-тест отражал реальные defaults
- [ ] При создании ANALYSIS для XAI-3 — прочитать chat/route.ts:900-970 целиком (routing + strip functions + cache breakpoint logic), там много движущихся частей
- [ ] Решение какую модель для `util:title` — Haiku сейчас, но при миграции можно думать: Haiku работает (дёшево, быстро, качественно), оставлять или переводить? Не блокер XAI-3 но всплывёт в XAI-4

---

## Pre-existing untracked файлы (НЕ ТРОГАТЬ без команды)

```
?? SIMPLY_PROMPTS_AND_MODEL_CONFIG.md       # Файл Владимира — он его открывал в IDE, Claude Code не видел содержимого
?? specs/TZ_RAG_SimplyRAG/AUDIT_REPORT.md   # Был untracked ещё до серии
```

Если `SIMPLY_PROMPTS_AND_MODEL_CONFIG.md` окажется частью серии миграции — спросить Владимира и подхватить в коммит XAI-3.

---

## Команды для проверки состояния

```bash
# Убедиться что типы и билд в порядке
npx tsc --noEmit

# Проверить dev server жив ли (если процесс bb2h4xfyd ещё работает)
# tail /tmp/claude-501/-Users-mactm-Projects-NegotiateAI-Chatbot/tasks/bb2h4xfyd.output

# Проверить git log серии
git log --oneline -10

# Убедиться в восстановленных defaults MIND
grep -E "EXTRACT_THRESHOLD|EXTRACT_PAUSE_MS" lib/ai/context-limits.ts
# Ожидаемо: 0.6 и 10 * 60 * 1000
```

---

## Ключевые решения серии (накопленный опыт)

1. **Эмпирический smoke test перед рефакторингом — обязателен.** Дважды в серии спасал от неверных решений: `reasoningEffort` в XAI-1 + `generateObject` в XAI-2. Стоимость ~$0.002-0.01, экономия часы
2. **ANALYSIS против реального кода > ТЗ от внешнего архитектора.** Писать SPEC/ROADMAP самостоятельно после чтения кода — быстрее и точнее чем брать готовые ТЗ извне
3. **`/dev/models` switchboard снимает давление.** Defaults в коде это стартовые точки, финальный выбор делается в эксплуатации через override файл. Это позволяет не устраивать paralysis analysis в момент ТЗ
4. **Живые документы серии > локальные HANDOFF/CHANGELOG per ТЗ.** Три файла на серию (ROADMAP + CHANGELOG + NOTES) + MIND_ARCHITECTURE как reference дают полную картину без дублирования
5. **Side-effects от тестирования заносятся в backlog, не чинятся сразу.** `getOrCreateSimplyChat` race condition проявилась при nuke БД — зафиксирована в backlog, фикс после серии. Строгий фокус не размывается

---

## История коммитов серии

```
1481141  release(v3.89.0): ТЗ-XAI-2 — MIND pipeline миграция на Grok
6fd1fbb  docs(xai-migration): CHANGELOG серии + verified Grok params
0ecc6fa  docs(xai-migration): синхронизация статусов после завершения ТЗ-XAI-1
ba9e928  release(v3.88.0): ТЗ-XAI-1 — фундамент миграции на xAI
```

Push никаких коммитов Владимир ещё не давал — остаются в локальном master, ahead of origin/master on 4 commits.
