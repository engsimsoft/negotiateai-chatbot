# Roadmap ТЗ-FIX2: Research Progress Mode

**Создан:** 2026-02-26
**Версия проекта:** 3.51.0 → 3.52.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 5 |
| Сессий (оценка) | 3-5 |

**Ключевые решения (из ANALYSIS.md):**
- Progress: shared reference через closure (service-chat route ≠ chat route архитектура)
- Verified: server-side `Set<string>` URL + existing DB sources (не флаг `verified` в данных)
- Классификация: эвристика (tier по домену, fetchMethod по URL, language по контенту)
- Telegram: совмещённый deepResearch query (один call на тему)
- RSS discovery: парсить `<link rel="alternate">` из HTML при fetchUrl (бесплатно)

---

## Этапы

### Этап 1: Perplexity Client + Research Engine Core

**Статус:** ✅ Завершён

**Цель:** Создать серверный research engine — основную логику startResearch без UI и интеграции.

**Задачи:**
- [x] Извлечь Perplexity API call из `deep-research.ts:131-148` в shared utility `lib/ai/tools/perplexity-client.ts`
- [x] Обновить `deep-research.ts` — использовать shared utility вместо inline call
- [x] Создать `lib/briefing/research-engine.ts`:
  - [x] `researchTopics(topics[], onProgress?)` — main orchestrator, p-limit(3) по темам
  - [x] `researchSingleTopic(topic)` — один deepResearch call (включая telegram discovery), parse citations, verify each
  - [x] `extractCitations(perplexityResponse)` — URL из citations + text-based URL extraction
  - [x] `extractTelegramHandles(text)` — @username паттерны из текста Perplexity
  - [x] `verifySource(url)` — fetchPage + RSS discovery (`<link rel="alternate">`)
  - [x] `verifyTelegramChannel(handle)` — parseTelegramChannel wrapper
  - [x] `classifySource(url, content)` — эвристика: tier по домену, fetchMethod по URL/rssUrl, language по Cyrillic detection
- [x] Типы: `ResearchProgressEvent`, `TopicResearchResult`, `VerifiedSource`, `ResearchResult`

**Дополнительно (не в ТЗ):**
- [x] Добавлен `rssUrl?: string` в `FetchPageResult` (fetch-page.ts) — RSS discovery при fetchPage бесплатно
- [x] `discoverRssUrl()` helper в fetch-page.ts — парсит `<link rel="alternate">` до Readability (которая мутирует DOM)

**Файлы:**
- `lib/ai/tools/perplexity-client.ts` — **НОВЫЙ**: shared Perplexity API call
- `lib/ai/tools/deep-research.ts` — рефакторинг: использовать perplexity-client
- `lib/ai/tools/fetch-page.ts` — добавлен rssUrl в результат + discoverRssUrl()
- `lib/briefing/research-engine.ts` — **НОВЫЙ**: основная логика

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Unit-style проверка: researchTopics будет проверен в Этапе 2 при интеграции в startResearch tool
- [x] 🧪 Мануальный тест: deepResearch tool в чате работает (Экспертиза → "исследуй тему" → 10 источников, ответ сформирован)

**Git (после валидации):**
```bash
git add lib/ai/tools/perplexity-client.ts lib/ai/tools/deep-research.ts lib/briefing/research-engine.ts
git commit -m "feat(tz-fix2): research engine core + perplexity client extraction"
```

**Критерий готовности:** `researchTopics([{topicId: "ai", topicName: "AI", emoji: "🤖", briefingStyle: "tech"}])` возвращает реальные verified sources с tier/fetchMethod/language.

---

### Этап 2: Tool Integration + Progress Mechanism

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Интегрировать research engine как tool в service-chat, настроить progress streaming и verified URL protection.

**Задачи:**
- [x] Добавить `startResearch` tool в service-chat/route.ts `if (context === "briefing-onboarding")` блок:
  - [x] Input schema: `topics: Array<{topicId, topicName, emoji, briefingStyle}>`
  - [x] Execute: вызов `researchTopics()` с progress callback
  - [x] Server-side `verifiedSourceUrls: Set<string>` — заполняется в execute
- [x] Progress callback: shared reference паттерн (ref object, не let — обход TS narrowing):
  - [x] `const progressRef = { write: null }` перед tool definitions
  - [x] Установка в `createUIMessageStream` execute callback
  - [x] `dataStream.write({ type: "research-progress", data: event })` через closure
- [x] Обновить `saveBriefingProfile` execute:
  - [x] Загрузить existing sources из БД (`getBriefingSources`)
  - [x] Фильтрация: принимать URL из `verifiedSourceUrls` Set ИЛИ из existing DB sources
  - [x] Console.warn при отклонении unverified sources
- [x] Добавить `startResearch` в Guardian `MONITORED_TOOLS` (tool-call-guardian.ts)
- [x] Добавить алиасы для startResearch в Guardian patterns (RU: "исследование источников", "поиск источников", EN: "start research")

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — tool definition, progress ref, saveBriefingProfile validation
- `lib/ai/tool-call-guardian.ts` — добавить startResearch в мониторинг

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Проверка в браузере: в briefing setup → отправить сообщение → проверить server logs что startResearch вызывается и возвращает данные
- [x] Проверка: saveBriefingProfile отвергает фейковые URL (проверить через console.log / server logs)
- [x] 🧪 Мануальный тест: пройти онбординг брифинга, проверить что модель вызывает startResearch
- [x] Hotfix сессия 4: исправлены 3 бага клиентской ошибки (анализ архитектора):
  - БАГ 1: `research-progress` → `data-research-progress` + `transient: true` (AI SDK v5 протокол)
  - БАГ 2: `consumeStream()` перенесён внутрь `createUIMessageStream execute` (race condition)
  - БАГ 3: типизация progressRef (`data-${string}`), убран `as any`

**Git (после валидации):**
```bash
git add app/(chat)/api/service-chat/route.ts lib/ai/tool-call-guardian.ts
git commit -m "feat(tz-fix2): startResearch tool + progress mechanism + verified URL protection"
```

**Критерий готовности:** startResearch вызывается моделью, возвращает реальные данные, saveBriefingProfile фильтрует unverified. Server logs подтверждают.

---

### Этап 3: Client Progress UI

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** Клиент показывает структурированный прогресс во время работы startResearch.

**Задачи:**
- [x] Добавить consumption data stream events в `briefing-setup-client.tsx`:
  - [x] Использовать `onData` callback в `useChat` (AI SDK v5 `ChatInit.onData`)
  - [x] Парсить `data-research-progress` events → state management
  - [x] State: `Map<topicId, TopicProgress>` с `useState`
- [x] Создать `ResearchProgressCard` компонент:
  - [x] Список тем с фазами: ⏳ searching → 🔍 verifying (N found) → ✓ done (M verified)
  - [x] Анимация (framer-motion, аналогично briefing-generation-progress)
  - [x] Показывать в чате вместо typing indicator
  - [x] "Анализирую и готовлю ответ…" спиннер после завершения всех тем (UX fix: dead zone)
- [x] Рендерить ResearchProgressCard когда `startResearch` tool активен
- [x] `activeResearchTopics` derived state: скрывает прогресс когда all done + !isLoading
- [x] BriefingChatPanel: conditional render (progress card vs typing indicator)

**Файлы:**
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — `onData` callback, `researchProgress` state, `activeResearchTopics` derived
- `app/(dashboard)/briefing/setup/components/research-progress-card.tsx` — **НОВЫЙ**: UI прогресса + "Анализирую" индикатор
- `app/(dashboard)/briefing/setup/components/briefing-chat-panel.tsx` — `researchTopics` prop, conditional render

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: при онбординге виден прогресс "Исследую источники → ✓ N источн."
- [x] Браузер: после завершения research — спиннер "Анализирую и готовлю ответ…"
- [x] Браузер: прогресс скрывается когда ответ приходит
- [x] 🧪 Мануальный тест: полное прохождение онбординга с видимым прогрессом — OK

**Git (после валидации):**
```bash
git add app/(dashboard)/briefing/setup/
git commit -m "feat(tz-fix2): research progress UI in briefing onboarding"
```

**Критерий готовности:** Пользователь видит живой прогресс по каждой теме. Не пустой экран. ✅

---

### Этап 4: DEV Mode + data-model-info

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Цель:** DEV Mode в service-chat + model info badge для отладки.

**Задачи:**
- [x] Создать `lib/prompts/builder/dev-mode-inject.ts`:
  - [x] `injectDevMode(systemPrompt: string, context: string): string`
  - [x] Если `SIMPLY_DEV_MODE !== 'true'` — возвращает промпт без изменений
  - [x] Если true — загружает `dev-mode.md`, добавляет + `<dev_reminder>` в конец
  - [x] Кеширование dev-mode.md в модульной переменной
- [x] Обновить `lib/prompts/builder/composer.ts`:
  - [x] Import `injectDevMode` из нового модуля
  - [x] Заменить inline dev mode logic на `injectDevMode(parts.join('\n\n'), chatMode)`
- [x] Добавить в `service-chat/route.ts`:
  - [x] Import и вызов `injectDevMode(systemPrompt, context)` перед streamText
  - [x] `dataStream.write({ type: "data-model-info", data: { modelId, modelName } })` внутри execute
- [x] Добавить обработку `data-model-info` в клиенте:
  - [x] `briefing-setup-client.tsx` — `onData` callback для `data-model-info` → `devModelName` state
  - [x] `briefing-chat-panel.tsx` — badge модели под аватаром "S" (font-mono, text-[10px])

**Файлы:**
- `lib/prompts/builder/dev-mode-inject.ts` — **НОВЫЙ**: extracted utility
- `lib/prompts/builder/composer.ts` — рефакторинг: использовать utility
- `app/(chat)/api/service-chat/route.ts` — DEV mode injection + data-model-info emit
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — `devModelName` state + onData
- `app/(dashboard)/briefing/setup/components/briefing-chat-panel.tsx` — dev badge prop + render

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] При `SIMPLY_DEV_MODE=true`: briefing onboarding показывает `[DEV]` в ответах + badge "Sonnet 4.6"
- [x] 🧪 Мануальный тест: подтверждено пользователем (скриншот)

**Git (после валидации):**
```bash
git add lib/prompts/builder/dev-mode-inject.ts lib/prompts/builder/composer.ts app/(chat)/api/service-chat/route.ts app/(dashboard)/briefing/setup/
git commit -m "feat(tz-fix2): dev mode extraction + service-chat integration + data-model-info"
```

**Критерий готовности:** DEV Mode работает в briefing-onboarding и в обычном чате. Один код, два контекста. ✅

---

### Этап 5: Финализация

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md → 3.52.0
- [x] Обновить CLAUDE.md (новые файлы: research-engine, perplexity-client, dev-mode-inject, research-progress-card)
- [x] Обновить package.json → 3.52.0

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Да: `docs/decisions/024-research-engine-pattern.md` (серверная оркестрация вместо LLM, verified URL set, progress via closure ref, DEV mode extraction)
- [x] docs/architecture.md → обновлён (briefing + research engine, dev-mode-inject в builder/)
- [x] docs/ai-tools.md → обновлён (startResearch tool, v3.52.0, 15 инструментов)
- [x] docs/ai-chats-map.md → не нужно (модели не изменились)
- [x] docs/ai-agents.md → не нужно (PE зона)
- [x] docs/design-system.md → не нужно (нет новых страниц)

**⛔ Верификация docs против кода (Правило 5):**
- [x] `ai-providers.md` → Реестр конфигураций сверен с grep-ом (providers.ts не изменялся)
- [x] `ai-chats-map.md` → модели не изменялись, актуально
- [x] `CLAUDE.md` → пути файлов и описания актуальны

**Завершение:**
- [x] Финальное мануальное тестирование:
  - [x] Create mode: полный онбординг с прогрессом — ОК (проверено на Этапах 2, 3)
  - [x] Edit mode: deepResearch в режиме Экспертиза — ОК (проверено ранее)
  - [x] DEV mode: badge + [DEV] строки — ОК (проверено на Этапе 4)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add [все docs файлы] package.json CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md
git commit -m "chore(tz-fix2): finalize v3.52.0 — Research Progress Mode"
```
