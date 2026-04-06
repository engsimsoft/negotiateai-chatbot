# Roadmap ТЗ-PIPELINE1: Reliable Pipeline Observability

**Создан:** 2026-04-06
**Версия проекта:** 3.68.0 → 3.69.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 (0-4) |
| Текущий этап | 1 |
| Сессий (оценка) | 3-5 |

---

## Этап 0: Fix multi-step usage logging (все routes)

**Статус:** ✅ Завершён

**Цель:** Все streaming routes логируют TOTAL usage (сумму всех steps), а не usage последнего step-а. Artifacts получают logUsage.

**Контекст проблемы:**
- `onFinish: ({ usage })` в streamText/generateText возвращает usage ПОСЛЕДНЕГО step-а
- При multi-step (briefing-onboarding: 6 steps) теряем 74% tokens
- Доказано: Anthropic Console 159K vs БД 42K (2026-04-06)
- Artifacts (5 файлов) — 0 логирования при Sonnet 4.6

**Задачи:**

**0.1 — Исследовать API: как получить total usage в AI SDK v6**
- [x] `onFinish` callback получает `{ totalUsage }` (агрегат по всем steps) и `{ usage }` (только последний step)
- [x] Оптимальный паттерн: заменить `{ usage }` на `{ totalUsage }` в деструктуризации onFinish

**0.2 — Fix streaming routes (CRITICAL — 4 файла)**
- [x] `app/(chat)/api/service-chat/route.ts`: `onFinish: ({ totalUsage })` вместо `({ usage })`
- [x] `app/(chat)/api/chat/route.ts`: аналогично, все 4 места использования `usage` → `totalUsage`
- [x] `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`: аналогично
- [x] `app/(chat)/api/assistant/ben/route.ts`: аналогично

**0.3 — Artifacts: добавить logUsage (HIGH — 5 файлов, 0 логирования)**
- [x] `artifacts/text/server.ts` — `result.totalUsage` + logUsage (chatMode: "artifact:text")
- [x] `artifacts/markdown/server.ts` — аналогично (chatMode: "artifact:markdown")
- [x] `artifacts/excel/server.ts` — аналогично (chatMode: "artifact:excel")
- [x] `artifacts/presentation-reveal/server.ts` — аналогично (chatMode: "artifact:reveal")
- [x] `artifacts/presentation-pptx/server.ts` — аналогично (chatMode: "artifact:pptx")

**0.4 — Professor pipeline: проверка**
- [x] `lib/ai/professor-pipeline.ts` — single-step generateText (нет tools/maxSteps), текущий код ОК

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — accumulated usage
- `app/(chat)/api/chat/route.ts` — accumulated usage
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — accumulated usage
- `app/(chat)/api/assistant/ben/route.ts` — accumulated usage
- `artifacts/text/server.ts` — добавить logUsage
- `artifacts/markdown/server.ts` — добавить logUsage
- `artifacts/excel/server.ts` — добавить logUsage
- `artifacts/presentation-reveal/server.ts` — добавить logUsage
- `artifacts/presentation-pptx/server.ts` — добавить logUsage
- `lib/ai/professor-pipeline.ts` — проверка

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Проверка в браузере: отправить сообщение в настройках брифинга
- [ ] SQL: `SELECT SUM("inputTokens" + "cacheReadTokens") FROM ai_usage_log WHERE ...` ≈ Anthropic Console
- [ ] 🧪 Мануальный тест: briefing-onboarding → сравнить БД с Console

**Git (после валидации):**
```bash
git add app/(chat)/api/service-chat/route.ts app/(chat)/api/chat/route.ts app/(chat)/api/projects/ app/(chat)/api/assistant/ben/route.ts artifacts/
git commit -m "fix(tz-pipeline1): log total usage across all steps, add artifact usage logging"
```

**Критерий готовности:** БД total tokens ≈ Anthropic Console (допуск <10% — учитываем что failed requests не отдают usage).

---

## Этап 1: Retry-инфраструктура для pipeline

**Статус:** 🔄 В работе

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 0

**Цель:** Pipeline AI-вызовы: скрытые SDK retry отключены, каждая попытка логируется, fallback Sonnet 4.5 убран.

**Задачи:**

**1.1 — Retry-обёртка**
- [x] Создать `lib/ai/retry-with-logging.ts`: retryWithLogging() с per-attempt logging

**1.2 — briefing-author.ts: maxRetries:0 + retry-обёртка**
- [x] maxRetries: 0, retryWithLogging (maxAttempts: 3), убран fallback Sonnet 4.5

**1.3 — briefing-section-author.ts: аналогично**
- [x] maxRetries: 0, retryWithLogging (maxAttempts: 3), убран fallback

**1.4 — briefing-filter.ts: только maxRetries:0**
- [x] maxRetries: 0 (без обёртки — Gemini Flash дёшев)

**1.5 — script-generator.ts: maxRetries:0**
- [x] maxRetries: 0 (свой content-based retry сохранён)

**1.6 — Удалить fallback config**
- [x] `lib/briefing/briefing-config.ts`: AUTHOR_MODEL_FALLBACK удалён

**Файлы:**
- `lib/ai/retry-with-logging.ts` — **новый**
- `lib/briefing/briefing-config.ts` — удалить AUTHOR_MODEL_FALLBACK
- `lib/briefing/briefing-author.ts` — maxRetries:0, retry-обёртка, убрать fallback
- `lib/briefing/briefing-section-author.ts` — аналогично
- `lib/briefing/briefing-filter.ts` — maxRetries:0
- `lib/podcast/script-generator.ts` — maxRetries:0

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Проверка: генерация брифинга завершается успешно (нет regression)
- [ ] SQL: briefing:author записи содержат usage за все попытки
- [ ] 🧪 Мануальный тест: генерация брифинга → проверить что pipeline не crash-ит

**Git (после валидации):**
```bash
git add lib/ai/retry-with-logging.ts lib/briefing/ lib/podcast/script-generator.ts
git commit -m "feat(tz-pipeline1): retry infrastructure, maxRetries:0, remove Sonnet 4.5 fallback"
```

**Критерий готовности:** Pipeline работает с maxRetries:0, retry-обёртка логирует каждую попытку.

---

## Этап 2: Базовые фиксы (Controller + Perplexity)

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Pipeline stream не crash-ит, Perplexity usage логируется.

**Задачи:**

**2.1 — Fix "Controller is already closed"**
- [x] `app/(chat)/api/briefing/generate/route.ts`:
  - safeEnqueue wrapper + closed flag + try/catch в finally

**2.2 — Perplexity logUsage в research-engine**
- [x] НЕ НУЖНО: `researchTopics()` — dead code (не импортируется нигде).
  Perplexity в онбординге вызывается через tool `deepResearch` (`deep-research.ts`),
  который уже логирует через `logUsage` (chatMode: "tool:deep-research").
  Подтверждено в БД: записи tool:deep-research с sonar-pro существуют.

**Файлы:**
- `app/(chat)/api/briefing/generate/route.ts` — safeEmit
- `lib/briefing/research-engine.ts` — userId + logUsage
- Возможно: caller service-chat route — пробросить userId в research

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Проверка: генерация брифинга не crash-ит (воспроизвести scenario когда раньше падал)
- [ ] SQL: `SELECT * FROM ai_usage_log WHERE "chatMode" = 'briefing:research'` — записи есть
- [ ] 🧪 Мануальный тест: настройка брифинга (онбординг с research) → проверить БД

**Git (после валидации):**
```bash
git add app/(chat)/api/briefing/generate/route.ts lib/briefing/research-engine.ts
git commit -m "fix(tz-pipeline1): safe stream controller + perplexity usage logging"
```

**Критерий готовности:** Pipeline не crash-ит, Perplexity usage залогирован.

---

## Этап 3: DevPanel для pipeline брифинга

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** На странице брифинга видно всё: каждый AI-вызов, retry attempts, fetch URLs, галлюцинации модели.

**Задачи:**

**3.1 — Расширить trace типы**
- [x] `lib/ai/pipeline-trace.ts`: добавлен `AiCallAttempt` + `attempts?` в `AiCallTrace`

**3.2 — Передать retry attempts в trace**
- [x] `lib/briefing/briefing-author.ts` — attempts передаются в ai trace (if > 1)
- [x] `lib/briefing/briefing-section-author.ts` — аналогично

**3.3 — Расширить Pipeline Trace Drawer**
- [x] Retry History: inline в StagesSection — если attempts > 1, показывает каждую попытку с ✓/✗ и ошибкой
- [x] Stages, Fetches, Cost Breakdown — уже были реализованы в ТЗ-DEV2, работают

**3.4 — URL verification UI (детекция галлюцинаций)**
- [x] Новая секция `UrlVerificationSection` в drawer: per-URL список с ✓/✗ маркерами
- [x] `urlVerification` prop пробрасывается footer → drawer
- [x] Footer уже показывал "URLs: N✓ M✗" в summary — работает
- [x] `briefing-page-client.tsx` — передаёт `urlVerification` из `initialBriefingTrace`

**3.5 — Section refresh trace display**
- [x] УЖЕ РЕАЛИЗОВАНО в ТЗ-DEV2: `briefing-article-view.tsx` показывает inline trace (tokens, cost, duration) после refresh

**Файлы:**
- `lib/ai/pipeline-trace.ts` — расширить AiCallTrace (attempts)
- `lib/briefing/briefing-author.ts` — передать attempts в trace
- `lib/briefing/briefing-section-author.ts` — аналогично
- `components/dev-panel/pipeline-trace-drawer.tsx` — stages, retries, fetches, URL verification
- `components/dev-panel/pipeline-trace-footer.tsx` — URL counter
- `components/briefing/briefing-page-client.tsx` — section trace display
- `components/briefing/briefing-article-view.tsx` — inline trace

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: PipelineTraceDrawer показывает per-stage breakdown с токенами и стоимостью
- [ ] Браузер: retry history видна (если были retry)
- [ ] Браузер: URL verification — зелёные/красные маркеры
- [ ] Браузер: footer показывает "URLs: N✓ M✗"
- [ ] Браузер: section refresh показывает inline trace
- [ ] 🧪 Мануальный тест: полная генерация в dev mode → открыть DevPanel → проверить все секции

**Git (после валидации):**
```bash
git add lib/ai/pipeline-trace.ts lib/briefing/ components/dev-panel/ components/briefing/
git commit -m "feat(tz-pipeline1): pipeline DevPanel with retry visibility and hallucination detection"
```

**Критерий готовности:** DevPanel показывает каждый AI-вызов, retry, fetch, и выдуманные URLs.

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Дымовой тест (cost accuracy):**
- [ ] Реальная генерация брифинга в dev mode
- [ ] SQL: total usage за генерацию
- [ ] Anthropic Console: total за тот же период
- [ ] Сверка: допуск < 5% (или обоснование почему больше)
- [ ] Если расхождение > 5% — анализ root cause и фикс
- [ ] Скриншот DevPanel с результатами

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (retry-with-logging, изменённые компоненты, artifacts logging)
- [ ] Обновить package.json (версия 3.69.0)

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR: `docs/decisions/NNN-retry-with-logging.md` — maxRetries:0 + свой retry, почему
- [ ] ADR: `docs/decisions/NNN-total-usage-accumulation.md` — onStepFinish accumulation vs result.totalUsage
- [ ] docs/architecture.md — retry-with-logging модуль
- [ ] docs/ai-providers.md — удалён AUTHOR_MODEL_FALLBACK
- [ ] docs/ai-chats-map.md — artifact chatModes добавлены

**Верификация docs против кода (Правило 5):**
- [ ] `docs/ai-providers.md` → Реестр конфигураций: fallback model удалён
- [ ] `docs/ai-chats-map.md` → chatMode конвенция: artifact:* добавлены
- [ ] `CLAUDE.md` → пути файлов актуальны (retry-with-logging.ts)

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Cost accuracy: БД ≈ Console (< 5% delta)
- [ ] DevPanel работает корректно
- [ ] Документация актуальна (проверено по чеклисту выше)
