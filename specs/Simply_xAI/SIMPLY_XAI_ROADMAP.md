# Simply — Дорожная карта миграции на xAI

**Создано:** 2026-04-14  
**Обновлено:** 2026-04-14  
**Статус:** В работе  
**Серия:** ТЗ-XAI-1 → ТЗ-XAI-6 (+ будущие расширения)

> Живой документ. Обновляется после завершения каждого ТЗ.

---

## Стратегия

**Откуда:** MiniMax M2.7 + Anthropic Sonnet/Haiku + OpenRouter (зоопарк провайдеров, костыли, падения)

**Куда:** xAI Grok + Anthropic Haiku/Opus (два серьёзных провайдера, чёткие роли)

**Принцип:** Chat Completions API — индустриальный стандарт. Смена провайдера за минуты. Responses API — только для будущего multi-agent (отдельная ветка).

---

## Целевая архитектура провайдеров

| Роль | Модель | Провайдер | API |
|---|---|---|---|
| KITT (дворецкий, основной чат) | Grok 4.1 Fast (non-reasoning) | xAI | Chat Completions |
| MIND pipeline (extract, consolidate, profile) | Grok 4.1 Fast (non-reasoning) | xAI | Chat Completions |
| Думать (кнопка) | Grok 4.20 | xAI | Chat Completions |
| Создать | Grok 4.20 | xAI | Chat Completions |
| Экспертиза | Grok 4.20 | xAI | Chat Completions |
| Vision/OCR (вложения в чате) | Claude Haiku 4.5 | Anthropic | Messages API |
| Профессор (проекты, premium) | Claude Opus | Anthropic | Messages API |
| Briefing pipeline | Grok 4.1 Fast / 4.20 | xAI | Chat Completions |
| Meeting/Podcast | Grok 4.1 Fast | xAI | Chat Completions |
| Utility (title, suggestions, summaries) | Grok 4.1 Fast | xAI | Chat Completions |
| Embeddings | Voyage AI | Voyage | Без изменений |

---

## Дорожная карта

### ТЗ-XAI-1 — Фундамент
**Статус:** ✅ Завершён 2026-04-14 (v3.88.0, commit `ba9e928`)
**Зависимости:** нет
**Риск:** минимальный (фактически нулевой)

**Суть:** Актуализировать каталог xAI моделей, зафиксировать архитектурные решения для следующих ТЗ серии. Ноль изменений поведения — все taskId остаются на текущих моделях.

**Что сделано:**
- Удалена deprecated `grok-4` запись (SQL-аудит: 0 исторических записей в ai_usage_log)
- Добавлены `notes` на `grok-4.20-multi-agent-0309` — зафиксировано что multi-agent не работает через Chat Completions
- Header xAI секции каталога обновлён с архитектурным обоснованием (contextWindow под рабочий бюджет качества, не под провайдерский потолок)
- Обновлены `docs/ai-providers.md`, `docs/model-catalog-ops.md`
- Закрыт backlog `TZ_GrokContextWindowAudit` → `specs/_backlog/_archive/`
- Зафиксированы для следующих ТЗ серии: R-5 (XAI-5 expertise переключить на non-reasoning), R-6 (XAI-3 убрать `isSimplyNonAnthropicModel`)

**Что НЕ сделано (и почему):**
- contextWindow у xAI записей не изменялся — привязка архитектуры к размеру провайдерского окна признана антипаттерном (вечный чат + Lost in the Middle)
- Эмпирический тест контекстного окна отменён — отвечал на неправильный вопрос

**Подробности:** [TZ_xai_1/](TZ_xai_1/) · [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) запись 2026-04-14

---

### ТЗ-XAI-2 — MIND pipeline → Grok 4.1 Fast
**Статус:** 📋 Планируется  
**Зависимости:** ТЗ-XAI-1  
**Риск:** низкий  

**Суть:** Переключить 6 вызовов generateText/generateObject в MIND pipeline (extract, extract-batch, dedup-verify, consolidate, profile) на Grok 4.1 Fast non-reasoning.

**Почему первый:** Нет tools, нет providerOptions, одноразовые вызовы (не многоходовые). Самый безопасный шаг для проверки что xAI работает в нашем pipeline.

**Ключевые вопросы:**
- Проверить: поддерживает ли Grok `generateObject` напрямую (structured outputs) или нужен паттерн `generateText + JSON.parse + Zod` как с MiniMax
- Пересчитать пороги Extract (L2) в `context-limits.ts` под 2M окно Grok

---

### ТЗ-XAI-3 — KITT (Simply Chat) → Grok 4.1 Fast
**Статус:** 📋 Планируется  
**Зависимости:** ТЗ-XAI-1, желательно после ТЗ-XAI-2  
**Риск:** средний (главный route, tools, providerOptions)  

**Суть:** Переключить основной чат (chatMode=simply, текст без вложений) на Grok 4.1 Fast non-reasoning через Chat Completions.

**Что меняется:**
- model → `grok-4-1-fast-non-reasoning`
- Cache breakpoints (`providerOptions.anthropic.cacheControl`) — уже провайдер-aware через `isAnthropicProtocolModel` в [chat/route.ts:929](../../app/(chat)/api/chat/route.ts#L929), под xAI этот блок уже no-op. Специально ничего убирать не надо
- Compaction API (`providerOptions.anthropic.contextManagement`) — аналогично, уже gracefully no-op для xAI. **Это мёртвый но безвредный код** — оставляем как есть до ТЗ-XAI-6 (финальная чистка)
- **[R-6, критично]** Полностью убрать `isSimplyNonAnthropicModel` + связанные strip-функции (`stripMediaPartsForTextModel`, `stripLegacyOpenAICompatToolParts`). Заменить на явную проверку `capabilities.vision` из `model-catalog.ts` (SSOT). НЕ полагаться на маршрутизацию «vision → Haiku спасёт» — это хрупкая логика. Убирать причину, а не симптом. См. [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) (2026-04-14)
- Tools остаются как есть — function calling работает в Chat Completions
- **Защита контекста НЕ трогается**: sliding window (`CONTEXT_BUDGET`) + Extract-on-compression остаются как основной механизм обработки вечного чата. `SIMPLY_CONTEXT_LIMIT` НЕ привязываем к провайдерскому окну — она задаёт рабочий бюджет качества, где модель ещё думает хорошо. Размер провайдерского окна (256K, 2M — неважно) архитектурно иррелевантен: вечный чат заполнит любое, модели деградируют на 30-50% заявленного. См. [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) (2026-04-14, коррекция Владимира)

**Что НЕ меняется:**
- Vision маршрут (вложения) — остаётся на Haiku
- Кнопка "Думать" — отдельно в ТЗ-XAI-5
- Tools — без изменений

---

### ТЗ-XAI-4 — Utility/Pipeline → Grok
**Статус:** 📋 Планируется  
**Зависимости:** ТЗ-XAI-1  
**Риск:** низкий  

**Суть:** Массовое переключение ~12 "лёгких" вызовов: briefing (author, section, filter), meeting-summary, podcast-script, professor-pipeline (3 шага), clerk-task-summary, professor-review, project-summary, title-generation, artifact handlers.

**Подшаги:**
1. Сначала utility (title, suggestions, summaries) — простые, без providerOptions
2. Потом briefing pipeline — проверить работу стриминга
3. Потом professor/clerk — адаптировать `providerOptions.anthropic.thinking` → убрать или заменить на xAI reasoning

**Примечание:** professor-review использует `anthropic: { thinking: { adaptive, effort: "high" } }`. Для Grok reasoning активен автоматически — параметр просто убирается.

---

### ТЗ-XAI-5 — Think / Create / Expertise → Grok 4.20
**Статус:** 📋 Планируется  
**Зависимости:** ТЗ-XAI-3 (KITT должен работать)  
**Риск:** средний  

**Суть:** Переключить три premium-режима на Grok 4.20 через Chat Completions.

**Что меняется:**
- simply-chat-think → Grok 4.20 (reasoning автоматический, `reasoning_effort` не передавать)
- **[R-5, зафиксировано в ТЗ-XAI-1 ANALYSIS]** expertise → **`grok-4.20-0309-non-reasoning`** (явно, не multi-agent). Сейчас expertise указывает на `grok-4.20-multi-agent-0309`, но вызывается через Chat Completions — multi-agent работает только через Responses API → фактически сейчас это обычный Grok 4.20, просто с дороже выглядящим именем. В `ai_usage_log` за всю историю — 1 вызов. Переключение на single-agent variant — фиксация реального поведения
- create → Grok 4.20 (с нашими tools через function calling)

**Ключевой момент:** Expertise сейчас использует deepResearch (Perplexity). Оставляем — это наш tool, работает через function calling. Встроенный web_search от xAI — дополнительная опция на будущее.

**Multi-agent отложен** в отдельную будущую ветку ТЗ-XAI-MA-1 через Responses API + MCP сервер для custom tools. См. [BRAINSTORM_GrokMultiAgent.md](BRAINSTORM_GrokMultiAgent.md).

---

### ТЗ-XAI-6 — Очистка
**Статус:** 📋 Планируется  
**Зависимости:** все предыдущие ТЗ завершены и проверены  
**Риск:** низкий (удаление мёртвого кода)  

**Суть:** Удалить всё что осталось от старых провайдеров.

**Удалить из registry.ts:** namespace `minimax`, `minimaxLong`, `openrouter`  
**Удалить из model-catalog.ts:** все MiniMax и OpenRouter записи  
**Удалить из task-assignments.ts:** все ссылки на удалённые модели  
**Удалить файлы/функции:**
- `stripMiniMaxToolParts` (если не убрано в ТЗ-XAI-3)
- `stripLegacyOpenAICompatToolParts`
- `isSimplyNonAnthropicModel`
- `stripMediaPartsForTextModel` (если vision идёт на Haiku — может ещё нужна, проверить)
- `vercel-minimax-ai-provider` dependency из package.json
- Старые ADR / docs если ссылаются только на удалённых провайдеров

**Удалить env vars:** `MINIMAX_API_KEY` из Vercel (после подтверждения что всё работает)

**НЕ удалять:** `@ai-sdk/anthropic` (нужен для Haiku + Opus), `ANTHROPIC_API_KEY`

---

## Будущие расширения (не в текущей серии)

| ID | Название | Зависимости | Описание |
|---|---|---|---|
| ТЗ-XAI-MA-1 | Multi-Agent Экспертиза | ТЗ-XAI-5 + A/B тест | Responses API + MCP сервер для custom tools в режиме multi-agent |
| ТЗ-XAI-COL-1 | Collections (Библиотека) | ТЗ-XAI-1 | Grok Collections API для RAG документов пользователя |
| ТЗ-XAI-VOICE-1 | Voice Agent | — | Grok Voice Agent API для голосового режима |

---

## Решения принятые в ходе планирования (2026-04-14)

1. **Chat Completions — основа.** Responses API только для multi-agent. Причина: портабельность, наши tools работают без изменений, стандартный формат.

2. **Защита контекста остаётся как есть независимо от провайдера.** Sliding window (140K) + Extract-on-compression — основа обработки вечного чата. Размер провайдерского окна (256K, 2M — неважно) архитектурно иррелевантен: вечный чат заполнит любое, модели деградируют на 30-50% заявленного (Lost in the Middle). Compaction API уже провайдер-aware, под Grok становится мёртвым но безвредным кодом. **Коррекция Владимира 2026-04-14:** изначальная формулировка «2M → Compaction не нужен» была неверной.

3. **Qwen отменён.** Тест показал галлюцинации на изображениях через OpenRouter. Vision остаётся на Haiku 4.5 — проверен, работает.

4. **Haiku 4.5 остаётся для vision.** Anthropic всё равно остаётся в проекте (Opus для Профессора). Один ключ, одна зависимость.

5. **Grok 4.1 Fast non-reasoning для KITT.** Быстрый, дешёвый ($0.20/$0.50), не тратит токены на reasoning. Для дворецкого идеально.

6. **`reasoning_effort` не передавать** для Grok 4.20 и Grok 4.1 Fast — вернёт ошибку. Reasoning автоматический. Этот параметр только для multi-agent.

7. **Маленькие ТЗ.** Каждый шаг изолирован и тестируем. Claude Code не срезает углы если задача конкретная.

---

## Прогресс

| ТЗ | Статус | Дата начала | Дата завершения | Примечания |
|---|---|---|---|---|
| ТЗ-XAI-1 | ✅ Завершён | 2026-04-14 | 2026-04-14 | v3.88.0 — удалён grok-4, notes про multi-agent, зафиксирована архитектура защиты контекста |
| ТЗ-XAI-2 | 📋 План | — | — | MIND pipeline → Grok 4.1 Fast, бонус-рефакторинг JSON.parse → generateObject |
| ТЗ-XAI-3 | 📋 План | — | — | KITT + R-6 (убрать isSimplyNonAnthropicModel) |
| ТЗ-XAI-4 | 📋 План | — | — | Utility/Pipeline batch миграция |
| ТЗ-XAI-5 | 📋 План | — | — | Think/Create/Expertise + R-5 (expertise с multi-agent на non-reasoning) |
| ТЗ-XAI-6 | 📋 План | — | — | Очистка MiniMax/OpenRouter |
