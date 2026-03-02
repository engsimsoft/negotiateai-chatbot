# Roadmap ТЗ-CACHE2: Unified Usage Logging

**Создан:** 2026-03-02
**Версия проекта:** 3.62.0 → 3.63.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 (3 разработки + финализация) |
| Текущий этап | 4 (финализация) |
| Сессий (оценка) | 2-3 |
| Точек логирования | ~27 (6 fix + 17 AI SDK new + 4 raw API new) |

---

## Этап 1: Утилиты + исправить 6 существующих

**Статус:** ✅ Завершён

**Цель:** Создать `extractUsageFields()` + `logUsage()`, заменить ручное извлечение в 6 существующих вызовах на утилиту, передавать cache/thinking токены.

**Задачи:**

- [x] 1.1. Создать `lib/ai/usage-utils.ts`:
  - `extractUsageFields(usage): ExtractedUsage` — извлекает 5 полей из SDK usage
  - `logUsage(opts): Promise<void>` — fire-and-forget: extractUsageFields + calcCostUsd + saveAiUsageLog
  - Типы: `ExtractedUsage`, `LogUsageInput`
  - TODO комментарий для cacheWriteTokens (AI SDK v5 не пробрасывает)

- [x] 1.2. Исправить `app/(chat)/api/chat/route.ts`:
  - Заменить ручное извлечение на `extractUsageFields(usage)`
  - Расширить `usageLogMeta` тип (+ cacheReadTokens, cacheWriteTokens, thinkingTokens)
  - Все 5 полей передаются через spread `...usageFields`

- [x] 1.3. Исправить `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (только onFinish, НЕ guardian):
  - Заменить ручное извлечение на `extractUsageFields(usage)`
  - Все 5 полей через spread

- [x] 1.4. Исправить `lib/ai/professor-pipeline.ts` — analyze phase:
  - `...extractUsageFields(analyzeResult.usage)` в saveAiUsageLog

- [x] 1.5. Исправить `lib/ai/professor-pipeline.ts` — execute phase:
  - `...extractUsageFields(executeResult.usage)` в saveAiUsageLog

- [x] 1.6. Исправить `lib/ai/professor-pipeline.ts` — synthesize phase:
  - `...extractUsageFields(synthUsage)` в saveAiUsageLog

**Файлы:**
- `lib/ai/usage-utils.ts` — **новый**
- `app/(chat)/api/chat/route.ts` — изменение
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — изменение
- `lib/ai/professor-pipeline.ts` — изменение

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: отправить 2+ сообщения в чат → cacheReadTokens > 0 подтверждено
- [x] 🧪 Мануальный тест пользователем — подтверждён

**Git (после валидации):**
```bash
git add lib/ai/usage-utils.ts app/\(chat\)/api/chat/route.ts app/\(chat\)/api/projects/\[id\]/tasks/\[taskId\]/chat/route.ts lib/ai/professor-pipeline.ts
git commit -m "feat(tz-cache2): usage utils + fix 6 existing logging points"
```

**Критерий готовности:** Все 6 существующих вызовов передают 5 полей, `cacheReadTokens > 0` видны в БД после 2+ сообщений в чате.

---

## Этап 2: Все AI SDK точки (Anthropic + Gemini)

**Статус:** ✅ Завершён

**Цель:** Добавить `saveAiUsageLog` во все AI SDK точки (streamText / generateText / generateObject).

**Задачи:**

**Streaming routes (Anthropic):**

- [x] 2.1. `app/(chat)/api/service-chat/route.ts` — chatMode `service:${context}`
- [x] 2.2. `app/(chat)/api/assistant/ben/route.ts` — chatMode `legacy:ben`

**generateText/generateObject routes (Anthropic):**

- [x] 2.3. `app/(chat)/api/projects/[id]/plan/route.ts` — chatMode `professor:planner`
- [x] 2.4. `lib/ai/professors/task-reviewer.ts` — chatMode `professor:reviewer`
- [x] 2.5. `lib/ai/clerks/snapshot-creator.ts` — chatMode `clerk:snapshot`
- [x] 2.6. `lib/ai/clerks/task-summarizer.ts` — chatMode `clerk:summarizer`
- [x] 2.7. `app/(chat)/api/projects/[id]/analyze-file/route.ts` — chatMode `clerk:file-analyzer`
- [x] 2.8. `app/(chat)/api/projects/[id]/generate-summary/route.ts` — chatMode `clerk:project-summary`
- [x] 2.9. `app/(chat)/actions.ts` — chatMode `util:generate-title`
- [x] 2.10. `app/(chat)/api/chat/[id]/generate-title/route.ts` — chatMode `util:auto-naming`

**Briefing (Anthropic):**

- [x] 2.11. `lib/briefing/briefing-author.ts` — chatMode `briefing:author`
- [x] 2.12. `lib/briefing/briefing-section-author.ts` — chatMode `briefing:section-author`

**Gemini (AI SDK):**

- [x] 2.13. `lib/briefing/briefing-filter.ts` — chatMode `briefing:filter`
- [x] 2.14. `lib/podcast/script-generator.ts` — chatMode `podcast:script`
- [x] 2.15. `lib/ai/vision-ocr.ts` — chatMode `util:vision-ocr` (userId optional — caller is tool context)

**Meeting (Anthropic):**

- [x] 2.16. `lib/meeting/meeting-pipeline.ts` `summarizeTranscript` — chatMode `meeting:summarize`

**Файлы (изменения):**
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/assistant/ben/route.ts`
- `app/(chat)/api/projects/[id]/plan/route.ts`
- `lib/ai/professors/task-reviewer.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts` (проброс userId)
- `lib/ai/clerks/snapshot-creator.ts`
- `lib/ai/clerks/task-summarizer.ts`
- `app/(chat)/api/projects/[id]/analyze-file/route.ts`
- `app/(chat)/api/projects/[id]/generate-summary/route.ts`
- `app/(chat)/actions.ts`
- `app/(chat)/api/chat/[id]/generate-title/route.ts`
- `lib/briefing/briefing-author.ts`
- `lib/briefing/briefing-section-author.ts`
- `lib/briefing/briefing-filter.ts`
- `lib/briefing/briefing-pipeline.ts` (проброс userId)
- `lib/podcast/script-generator.ts`
- `lib/podcast/podcast-pipeline.ts` (проброс userId)
- `lib/ai/vision-ocr.ts`
- `lib/meeting/meeting-pipeline.ts`
- `app/(chat)/api/meeting/regenerate/route.ts` (проброс userId)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: `SELECT "chatMode", COUNT(*) FROM ai_usage_log GROUP BY "chatMode" ORDER BY COUNT(*) DESC` — новые chatMode появились (legacy:ben, util:auto-naming)
- [x] Браузер: отправить сообщение в service-chat (Бен) → проверить запись с `chatMode = 'service:ben'` ← legacy:ben подтверждён
- [x] Браузер: Deep Research (Perplexity) → `tool:deep-research` ✓
- [x] Браузер: Briefing → `briefing:author`, `briefing:filter` ✓
- [x] Браузер: Meeting → `meeting:summarize`, `meeting:transcribe` ✓ (+ фикс modelId deepgram)
- [x] Браузер: Projects (plan) → `professor:planner` ✓
- [x] Браузер: Projects (expert) → `project:expert` ✓
- [x] Браузер: Projects (complete) → `clerk:summarizer`, `professor:reviewer` ✓
- [x] Браузер: Projects (file) → `clerk:file-analyzer` ✓
- [x] Браузер: Projects (manager) → `service:project-manager` ✓
- [x] Браузер: Projects (creation) → `service:project-creation` ✓
- [x] Браузер: Podcast → `podcast:script`, `podcast:tts` ✓
- [x] 🧪 Мануальный тест пользователем — подтверждён

**Критерий готовности:** Все AI SDK вызовы логируют usage. SQL-запрос показывает новые chatMode записи.

---

## Этап 3: Non-AI-SDK провайдеры (Perplexity, Deepgram, TTS)

**Статус:** ✅ Завершён

**Цель:** Добавить логирование для Perplexity (raw fetch), Deepgram (raw fetch), Gemini TTS (raw API).

**Задачи:**

**Perplexity:**

- [x] 3.1. `lib/ai/tools/deep-research.ts` — chatMode `tool:deep-research`
  - userId пробрасывается через factory params → chat-tools.ts + service-chat route
  - Маппинг: `promptTokens → inputTokens`, `completionTokens → outputTokens`

- [~~] 3.2. `lib/briefing/research-engine.ts` — **ПРОПУЩЕН** (dead code, `researchTopics` не вызывается из production кода)

**Deepgram:**

- [x] 3.3. `lib/meeting/deepgram-transcribe.ts` — chatMode `meeting:transcribe`
  - Zero tokens, durationMs from API response

**Podcast TTS:**

- [x] 3.4. `lib/podcast/tts-gemini.ts` — chatMode `podcast:tts`
  - Zero tokens, durationMs from trace
  - userId пробрасывается: podcast-pipeline → podcast/index.ts → tts-gemini.ts

**Файлы:**
- `lib/ai/tools/deep-research.ts`
- `lib/ai/tools/chat-tools.ts` (проброс userId)
- `app/(chat)/api/service-chat/route.ts` (проброс userId)
- `lib/meeting/deepgram-transcribe.ts`
- `lib/meeting/meeting-pipeline.ts` (проброс userId к Deepgram)
- `lib/podcast/tts-gemini.ts`
- `lib/podcast/index.ts` (проброс userId к TTS)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: Deep Research tool → `tool:deep-research` ✓ (проверено в Этап 2)
- [x] Браузер: Meeting → `meeting:transcribe` ✓ (фикс modelId: UUID → "deepgram-nova-3"), `meeting:summarize` ✓
- [x] Браузер: Podcast → `podcast:script`, `podcast:tts` ✓ (проверено в Этап 2)
- [x] SQL: все chatMode из конвенции присутствуют
- [x] 🧪 Мануальный тест пользователем — подтверждён

**Критерий готовности:** Все AI-вызовы в системе логируются. Полная видимость расходов.

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Задачи:**

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (usage-utils.ts, chatMode конвенция, версия 3.63.0)
- [x] Обновить package.json: 3.62.0 → 3.63.0

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Нет. logUsage() — utility, chatMode — naming convention
- [x] docs/architecture.md нужно обновить? → Нет. usage-utils — utility, не архитектурный слой
- [x] docs/ai-chats-map.md нужно обновить? → Нет. chatMode — internal logging label
- [x] docs/ai-providers.md нужно обновить? → Нет. Провайдеры не менялись

**Проверка БД:**
```sql
-- Полнота chatMode
SELECT "chatMode", COUNT(*) as cnt,
       ROUND(AVG("inputTokens")) as avg_input,
       ROUND(AVG("outputTokens")) as avg_output,
       ROUND(AVG("cacheReadTokens")) as avg_cache_read,
       ROUND(AVG("thinkingTokens")) as avg_thinking
FROM ai_usage_log
GROUP BY "chatMode"
ORDER BY cnt DESC;

-- Cache tokens работают
SELECT COUNT(*) as total,
       COUNT(*) FILTER (WHERE "cacheReadTokens" > 0) as with_cache
FROM ai_usage_log
WHERE "createdAt" > NOW() - INTERVAL '1 day';
```

**Завершение:**
- [x] Финальное мануальное тестирование (пользователь) — 18 endpoints проверены в БД
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна (проверено по чеклисту выше)
