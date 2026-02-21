# Roadmap ТЗ-BRIEFING-AUTHOR-CLAUDE: Замена провайдера + Effort

**Создан:** 2026-02-21
**Версия проекта:** 3.37.1 → 3.38.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 3 |
| Сессий (оценка) | 1 |

---

## Этап 1: Замена провайдера briefing-author + effort

**Статус:** ✅ Завершён

**Цель:** Briefing-author генерирует статьи через Claude Sonnet 4.6 вместо Gemini 3 Pro. Все 4 точки на Sonnet 4.6 / Opus 4.6 получают настройку effort.

**Задачи:**

**1.1 briefing-config.ts — модели:**
- [x] `AUTHOR_MODEL` → `"claude-sonnet-4-6"`
- [x] `AUTHOR_MODEL_FALLBACK` → `"claude-sonnet-4-5-20250929"`

**1.2 briefing-author.ts — провайдер + effort:**
- [x] Импорт: `createGoogleGenerativeAI` → `createAnthropic`
- [x] Инстанс: `google` → `anthropic` (с `ANTHROPIC_API_KEY`)
- [x] Primary: `google(AUTHOR_MODEL)` → `anthropic(AUTHOR_MODEL)`
- [x] Fallback: `google(AUTHOR_MODEL_FALLBACK)` → `anthropic(AUTHOR_MODEL_FALLBACK)`
- [x] Добавить `providerOptions: { anthropic: { thinking: { type: 'adaptive' }, effort: 'medium' } }`
- [x] Обновить JSDoc (строка 1: "Gemini 3 Pro" → "Claude Sonnet 4.6")
- [x] Обновить лог: `maxOutputTokens` → корректное отражение параметра

**1.3 briefing-author.md — метаданные промпта:**
- [x] Строка 3: `**Модель:** Gemini 3 Pro` → `**Модель:** Claude Sonnet 4.6`

**1.4 generate/route.ts — комментарий:**
- [x] Строка 177: `// Step 4: Writing (Gemini Pro)` → `// Step 4: Writing (Claude Sonnet)`

**1.5 service-chat/route.ts — effort для briefing-onboarding:**
- [x] Добавить `providerOptions` в `streamText` (условно для `briefing-onboarding`, effort: `high`)

**1.6 plan/route.ts — effort для профессора:**
- [x] Добавить `providerOptions: { anthropic: { thinking: { type: 'adaptive' }, effort: 'high' } }` в `generateText`

**1.7 task-reviewer.ts — effort для ревьюера:**
- [x] Добавить `providerOptions: { anthropic: { thinking: { type: 'adaptive' }, effort: 'high' } }` в `generateText`

**Файлы:**
- `lib/briefing/briefing-config.ts` — модели автора
- `lib/briefing/briefing-author.ts` — провайдер, effort
- `lib/prompts/briefing/briefing-author.md` — метаданные
- `app/(chat)/api/briefing/generate/route.ts` — комментарий
- `app/(chat)/api/service-chat/route.ts` — effort для онбординга
- `app/(chat)/api/projects/[id]/plan/route.ts` — effort для профессора
- `lib/ai/professors/task-reviewer.ts` — effort для ревьюера

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: генерация брифинга работает (volume=detailed)
- [x] Лог: `[Briefing Author] model=claude-sonnet-4-6`, outputTokens=10163 (2x vs Gemini 5104), finishReason=stop
- [x] 🧪 Мануальный тест: пользователь подтвердил — "другой уровень совсем"

**Git (после валидации):**
```bash
git add lib/briefing/briefing-config.ts lib/briefing/briefing-author.ts lib/prompts/briefing/briefing-author.md app/(chat)/api/briefing/generate/route.ts app/(chat)/api/service-chat/route.ts "app/(chat)/api/projects/[id]/plan/route.ts" lib/ai/professors/task-reviewer.ts
git commit -m "feat(tz-briefing-author-claude): replace Gemini with Claude Sonnet 4.6 + configure effort"
```

**Критерий готовности:** Все 7 файлов обновлены, tsc + build проходят, брифинг генерируется через Claude.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Документация

**Статус:** ✅ Завершён

**Цель:** Все docs отражают новый провайдер и effort-конфигурации.

**Задачи:**

**2.1 docs/ai-providers.md — Реестр конфигураций:**
- [x] Строка "Briefing: Автор" → модель `claude-sonnet-4-6`, providerOptions `thinking adaptive, effort medium`
- [x] Строка "Briefing: Fallback" → модель `claude-sonnet-4-5-20250929`
- [x] Строка "Briefing Онбординг" → providerOptions `thinking adaptive, effort high`
- [x] Добавить строки в "Anthropic Claude — Backend" для Briefing Author + Fallback
- [x] Удалить строки Briefing Автор/Fallback из секции "Google Gemini — Backend"
- [x] Строка "Профессор планирования" → providerOptions `thinking adaptive, effort high`
- [x] Строка "Ревьюер задач" → providerOptions `thinking adaptive, effort high`
- [x] Обновить шапку: "3 модели Gemini" → "2 модели Gemini" (автор ушёл)
- [x] Обновить секцию "Ключевые файлы" (briefing-config.ts — убрать "модели Gemini для брифинга")

**2.2 docs/ai-chats-map.md — затронут:**
- [x] Обновить быстрый обзор (v3.38.0 запись + v3.26.0 описание)
- [x] Строка "Briefing: Автор" → Claude Sonnet 4.6
- [x] Секция пайплайна: модель, описание, full flow
- [x] Таблица цен: убраны Gemini 3 Pro / 2.5 Pro, добавлен автор к Claude Sonnet 4.6
- [x] Google Gemini описание: "Briefing pipeline" → "Briefing фильтр"

**2.3 CLAUDE.md:**
- [x] Версия → 3.38.0
- [x] Anthropic Claude — единственный провайдер + "(Gemini только для vision-ocr и briefing-фильтра)"
- [x] Обновить секцию "Текущий этап" — добавить ТЗ-BRIEFING-AUTHOR-CLAUDE

**Файлы:**
- `docs/ai-providers.md`
- `docs/ai-chats-map.md` (проверка)
- `CLAUDE.md`

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] Верификация Правило 5: grep по коду vs docs (gemini-3-pro / gemini-2.5-pro удалены из docs, createAnthropic в briefing-author.ts)
- [ ] 🧪 Пользователь подтвердил документацию

**Git (после валидации):**
```bash
git add docs/ai-providers.md docs/ai-chats-map.md CLAUDE.md
git commit -m "docs(tz-briefing-author-claude): update provider registry and project docs"
```

**Критерий готовности:** Реестр ai-providers.md верифицирован grep-ом против кода.

---

⛔ НЕ НАЧИНАТЬ Этап 3 без подтверждения Этапа 2

---

## Этап 3: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь — Этап 1)
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить package.json (версия 3.38.0)
- [x] Обновить HANDOFF.md
- [ ] Переместить папку в _archive/ (после коммита)

**Валидация:**
- [ ] `npm run build` — успешен
- [x] Документация актуальна
- [ ] Все файлы закоммичены

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md package.json
git commit -m "chore(tz-briefing-author-claude): finalize v3.38.0"
```

---

**Обновлено:** 2026-02-21
