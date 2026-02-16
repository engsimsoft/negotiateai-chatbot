# Анализ ТЗ-C4: Переключение AI-провайдера на Anthropic Claude

**Дата анализа:** 2026-02-16

---

## Резюме

Переключение всего AI-бэкенда Simply с Google Gemini на Anthropic Claude через прямой API (`@ai-sdk/anthropic`). Затрагивает ~20 файлов: конфигурация провайдера, маппинг моделей, API routes, клерки, pipeline, UI-компоненты. Ключевая инфраструктурная задача без изменения бизнес-логики.

---

## Вопросы для уточнения

> Все вопросы решены на этапе анализа.

1. **[thinkingConfig]:** Убрать Gemini `providerOptions.google.thinkingConfig`? **Решено:** Да, удалить. Claude работает без extended thinking.
2. **[text/plain]:** Включить `convertTextFilePartsInMessage` обратно? **Решено:** Да, Claude может не поддерживать text/plain как file attachment.
3. **[API Key]:** Ключ готов? **Решено:** Да, workspace Simply_1, ключ добавлен в .env.local.
4. **[vision-ocr]:** Трогаем ли vision-ocr.ts? **Решено:** Нет, свой Google экземпляр, не через myProvider.

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Tool calls формат отличается (Claude vs Gemini) | Средняя | Высокое | Vercel AI SDK абстрагирует, но проверить в браузере |
| text/plain attachments не работают | Средняя | Среднее | convertTextFilePartsInMessage включён обратно |
| Streaming edge cases | Низкая | Среднее | `@ai-sdk/anthropic` поддерживает streamText, проверить |
| Professor Pipeline (Opus) медленнее/дороже | Низкая | Низкое | Opus дороже Gemini Pro, но качественнее |
| Zod schema reject запросов с новыми model IDs | Средняя | Высокое | Обновить schema.ts (шаг 8a) |

---

## Зависимости

**Что нужно до начала:**
- [x] ANTHROPIC_API_KEY создан (workspace Simply_1)
- [x] ANTHROPIC_API_KEY добавлен в .env.local
- [ ] `npm install @ai-sdk/anthropic` — шаг 0
- [ ] ANTHROPIC_API_KEY добавлен в Vercel Environment Variables (для deploy)

**Затронутые компоненты (полный список — 18 файлов):**
- `lib/ai/providers.ts` — основной провайдер
- `lib/prompts/types.ts` — ModelId тип
- `lib/prompts/builder/composer.ts` — defaultModel fallbacks
- `lib/ai/models.ts` — UI-список моделей
- `lib/ai/model-tiers.ts` — модели проектов
- `lib/ai/entitlements.ts` — доступные модели
- `lib/prompts/agents/ben/config.yaml` — конфиг Бена
- `app/(chat)/api/chat/schema.ts` — Zod валидация
- `app/(chat)/api/chat/route.ts` — providerOptions, model logic, text/plain
- `lib/ai/professor-pipeline.ts` — модели pipeline
- `app/(chat)/api/service-chat/route.ts` — getModelId()
- `app/(chat)/api/projects/[id]/generate-summary/route.ts` — model ID
- `lib/ai/clerks/task-summarizer.ts` — env fallback
- `lib/ai/professors/task-reviewer.ts` — env fallback
- `lib/ai/clerks/snapshot-creator.ts` — env fallback
- `components/input/input-context.tsx` — defaultModelId
- `components/input/compact-input.tsx` — defaultModelId

**НЕ затрагивается:**
- `lib/ai/vision-ocr.ts` — свой Google экземпляр
- Документация (`docs/`, ADR, `_archive/`)

---

## Оценка

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Чистая замена model IDs и провайдера. Нет новой бизнес-логики. Все изменения точечные. Vercel AI SDK абстрагирует различия провайдеров. Основной риск — edge cases в runtime.

---

## Ответы на вопросы

> Все решены до начала разработки (см. раздел "Вопросы для уточнения").
