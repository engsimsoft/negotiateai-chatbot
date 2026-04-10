# Передача сессии ТЗ-1: Core Registry

**Дата:** 2026-04-11
**Сессия:** 4 завершена — Этапы 1 + HOTFIX + 2 + 3 закоммичены

---

## Статус этапов

- [x] Фаза Анализ
- [x] Фаза Планирование
- [x] **Этап 1: Core Registry + Catalog + Task-assignments + миграция БД** — commit `836842a`
- [x] **HOTFIX: sanitizer + scrollbar** — commit `b4bce63`
- [x] **Этап 2: Миграция chat routes + service-chat + utils** — commit `5d629db`
- [x] **Этап 3: Миграция projects + clerks + professors + DevPanel в TaskChat** — commit `012145a`
- [ ] **Этап 4: Миграция pipelines (briefing, podcast, memory, meeting, vision-ocr)** ← **СЛЕДУЮЩИЙ**
- [ ] Этап 5: Очистка legacy wrappers + удаление TokenLens
- [ ] Этап 6: Финализация + ADR + docs

---

## Итоги сессии 4

### 4 коммита

| Коммит | Область | Файлов |
|---|---|---|
| `836842a` | Core Registry + catalog + task-assignments + getModel + БД migration (provider column) | 18 |
| `b4bce63` | HOTFIX: `stripIncompleteToolParts` + canonical single-scroll Conversation | 5 |
| `5d629db` | Этап 2: chat routes + service-chat + utils | 12 |
| `012145a` | Этап 3: projects + clerks + professors + thinking guard + DevPanel wrap | 15 |

### Статистика миграции

- **16 call-sites** переведены с `myProvider.languageModel()` / прямых импортов на `getModel(taskId)`
- **3 env-переменные удалены** — `PROFESSOR_MODEL`, `SUMMARIZER_MODEL`, `SNAPSHOT_CLERK_MODEL`
- **2 новых helper** в `getModel.ts` — `taskSupportsThinking()`, `getProviderForTask()`
- **1 hotfix function** — `stripIncompleteToolParts()` в `lib/utils.ts` защищает от отравленных tool calls в истории чата
- **0 breaking changes** — legacy wrappers в `providers.ts` остаются до Этапа 5

### Главные архитектурные достижения

1. **Live-validated переключение моделей** — одной строкой в `task-assignments.ts` переключили 8 taskId с Opus/Sonnet на Haiku во время теста Этапа 3, все call-sites подхватили через HMR без правок в коде. **Это именно тот use case, ради которого строился Core Registry.**

2. **`taskSupportsThinking(taskId)` как catalog-driven capability check** — вскрылась реальная проблема: `providerOptions.anthropic.thinking: adaptive` был hardcoded в 3 route-файлах. Haiku не поддерживает thinking → API 400 "adaptive thinking is not supported on this model". **Решено правильно, не костылём** — helper читает `capabilities.thinking` из model-catalog (SSOT), callers применяют providerOptions условно. Система переживёт любые смены моделей.

3. **DevPanel в TaskChat полностью работает** (валидировано живым тестом):
   - Скрин: `Sonnet 4.6 · 28.4k tok · ₽9.13 · 6.1s`
   - SQL доказательство в ai_usage_log: `modelId='claude-sonnet-4-6', provider='anthropic', costUsd='0.091300', durationMs=6081`
   - ₽9.13 = **корректная** сумма (fresh 22208×0.30/1000 + cache_write 6087×0.375/1000 + output 126×1.50/1000 = 6.66 + 2.28 + 0.19)
   - Provider column заполняется автоматически из моей миграции 0053

---

## Критические уроки для следующей сессии

⚠️ **Отсюда нельзя стартовать Этап 4 без вдумчивой проверки каждого шага.** В сессии 4 я допустил несколько ошибок, которые пользователь справедливо отловил:

### 1. Не предупредил о revert task-assignments

Я временно переключил все `project:expert:*` на Haiku для дешёвого теста, **вернул обратно к оригиналу перед коммитом**, но **не сказал об этом пользователю**. Пользователь тестировал после revert, получил Sonnet вместо ожидаемого Haiku, и справедливо возмутился. **Правильное поведение:** после любого изменения task-assignments явно сообщать пользователю текущее состояние.

### 2. Ошибся в арифметике ₽9.13

Я сам сказал «сумма не сходится» на основе неправильного расчёта (`6087 × 0.00375 = 22.83` вместо правильного `6087 × 0.375 / 1000 = 2.28`). Это дало пользователю ложный сигнал что есть баг, которого не было. **Правильное поведение:** не высказывать сомнения в корректности кода без двойной проверки формулы, или сразу проверять через SQL вместо устного пересчёта.

### 3. Шёл вперёд без остановки на проверку

Пользователь правильно указал: «почему ответ пришёл от Sonnet, почему сумму указано неправильно и ты предлагаешь идти дальше». **Правильное поведение:** при любом сомнении пользователя — полная остановка, пересчёт, SQL-проверка, честное объяснение, и только после этого движение вперёд.

---

## Следующая сессия: Этап 4 — Pipelines

### Файлы для миграции (9)

| # | Файл | taskId | Модель сейчас |
|---|---|---|---|
| 1 | [lib/briefing/briefing-filter.ts](../../lib/briefing/briefing-filter.ts) | `briefing:filter` | `minimaxM27Long` |
| 2 | [lib/briefing/briefing-author.ts](../../lib/briefing/briefing-author.ts) | `briefing:author` | `minimaxM27Long` |
| 3 | [lib/briefing/briefing-section-author.ts](../../lib/briefing/briefing-section-author.ts) | `briefing:section` | `minimaxM27Long` |
| 4 | [lib/podcast/script-generator.ts](../../lib/podcast/script-generator.ts) | `briefing:podcast-script` | `minimaxM27` |
| 5 | [lib/ai/memory/extract.ts](../../lib/ai/memory/extract.ts) | `memory:extract` + `memory:extract-batch` | `claudeSonnet` + `minimaxM27` |
| 6 | [lib/ai/memory/consolidate.ts](../../lib/ai/memory/consolidate.ts) | `memory:consolidate` | `minimaxM27` |
| 7 | [lib/ai/memory/profile.ts](../../lib/ai/memory/profile.ts) | `memory:profile` | `minimaxM27` |
| 8 | [lib/meeting/meeting-pipeline.ts](../../lib/meeting/meeting-pipeline.ts) | `meeting:summary` | `claudeSonnet` |
| 9 | [lib/ai/vision-ocr.ts](../../lib/ai/vision-ocr.ts) | `vision:ocr` | `claudeHaiku` |

Все эти файлы импортируют напрямую `minimaxM27`/`minimaxM27Long`/`claudeSonnet`/`claudeHaiku` из [lib/ai/providers.ts](../../lib/ai/providers.ts). Миграция по той же схеме что и Этап 3.

### Важные отличия от Этапа 3

- **MiniMax pipelines не имеют `providerOptions.anthropic.thinking`** — они могут работать без guard'а, но **всё равно** надо проверить каждый файл на `providerOptions` и применить `taskSupportsThinking()` если нужно
- **Briefing pipelines используют `minimaxM27Long`** — это специальный namespace в registry с 180s timeout. `getModel('briefing:filter')` должен возвращать именно long-timeout вариант. Проверить что task-assignments маппит на `MiniMax-M2.7-long` (alias) — это уже сделано в Этапе 1 ([task-assignments.ts:113-115](../../lib/ai/task-assignments.ts)).
- **Extract batch** использует MiniMax, а одиночный extract — Sonnet. Это два разных taskId (`memory:extract` + `memory:extract-batch`) — проверить что оба используются корректно в [lib/ai/memory/extract.ts](../../lib/ai/memory/extract.ts)
- **Mеeting pipeline** использует Deepgram transcription (non-LLM, raw fetch) + Claude Sonnet summarization. Мигрируется только часть с Sonnet.
- **vision-ocr** — недавно переведён с Gemini на Claude Haiku (есть необкоммиченные изменения в репе). Вероятно, это последнее что нужно обновить.

### План Этапа 4

1. Прочитать каждый из 9 файлов перед правкой — **не доверять моим заметкам выше без проверки**
2. Мигрировать по одному файлу → tsc после каждого → grep verify → не идти дальше пока чисто
3. `npm run build` после всех миграций
4. **Чистый restart dev-сервера** (`pkill next` + `rm -rf .next` + `npm run dev`)
5. Мануальный тест каждого pipeline (briefing generation → podcast → memory extract → meeting record → vision OCR)
6. **НЕ торопиться.** Если пользователь заметит что-то странное — **полная остановка**, SQL-проверка через `ai_usage_log`, honest debugging, и только потом движение вперёд
7. Commit + обновить ROADMAP/HANDOFF/CHANGELOG

### Как тестировать дёшево

- **MiniMax pipelines** (briefing filter/author/section, podcast script, memory consolidate/profile, memory extract batch) — уже самые дешёвые, тест не вредит
- **Memory extract** (одиночный, Sonnet) — можно временно переключить на Haiku через одну строку в task-assignments, проверить, вернуть
- **Meeting summary** (Sonnet) — можно временно переключить на Haiku
- **Vision OCR** (Haiku) — уже дёшево

**Урок из сессии 4:** если делаешь temp-переключение для дешёвого теста — **явно предупреди пользователя** и держи в todo список "вернуть обратно перед commit".

---

## Known issues (не блокируют Этап 4)

1. **Planning prompt не совместим с Haiku output format.** Когда planning временно переключался на Haiku в сессии 4, модель оборачивала ответ в markdown fence и теряла `<plan_json>` тег. Это **не infrastructure** — это domain-specific prompt engineering, будет решено при переписывании промптов под cross-model support (отдельное ТЗ после ТЗ-1). Сейчас `professor:planning` на Opus — работает.

2. **DevPanel полный e2e тест в TaskChat пройден** (коррекция: валидирован живым тестом на Sonnet 4.6 с реальной задачей в конце сессии 4).

3. **MiniMax thinking через Anthropic providerOptions не работает** — `providerOptions.anthropic.thinking` работает только на Anthropic provider. Для MiniMax нужен native reasoning config. Для полной cross-provider поддержки нужен per-model providerOptions builder в catalog — отдельная задача после ТЗ-1. Этап 4 не требует этой фичи — MiniMax pipelines не используют adaptive thinking.

---

## Состояние на момент передачи

- **Рабочая ветка:** `feature/simply-kitt`
- **Последний commit:** `012145a` (Этап 3)
- **Незакоммиченные изменения:** только посторонние (pre-existing, не от меня):
  - `.DS_Store`, `dev-panel/dev-panel-footer.tsx`, `dev-panel/sections/model-section.tsx` — ТЗ-MiniMax display names
  - `lib/ai/memory/types.ts` — ТЗ-SaveFactV2 metadata types
  - `lib/ai/vision-ocr.ts` — Gemini→Haiku переход (будет мигрирован в Этапе 4)
  - `specs/TZ_SlidingWindow/*` — удалённые файлы архивного ТЗ
- **Dev-сервер:** запущен в background, может быть killed к началу следующей сессии — поднять через `npm run dev`
- **БД:** все миграции применены, колонка `ai_usage_log.provider` заполняется автоматически через `logUsage({ provider })`
- **tsc/build:** чисто, 0 ошибок

---

## Блокеры / Вопросы

Нет. Этап 4 можно начинать в любой момент после короткого warm-up (прочитать этот файл + ROADMAP.md + CHANGELOG.md).
