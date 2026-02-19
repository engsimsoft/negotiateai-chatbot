# Анализ ТЗ-A2: Briefing Onboarding

**Дата анализа:** 2026-02-20

---

## Резюме

Заменяем заглушку `/briefing/setup` на интерактивный AI-онбординг. Через service-chat диалог пользователь рассказывает об интересах, AI через deepResearch находит персональные источники, превью обновляется в реальном времени, и профиль сохраняется в БД. Паттерн — split layout как у `projects/new`.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Паттерн projects/new** — ОК, split layout с live preview хорошо работает. Код `project-creation-client.tsx` отработан, паттерн `processedIdsRef` для дедупликации tool results надёжный.
- **Service-chat расширение** — ОК, добавление нового контекста `"briefing-onboarding"` в существующий route — штатная операция. Три существующих контекста (ben, project-creation, project-manager) показывают что паттерн масштабируется.
- **deepResearch + fetchUrl** — ОК, оба tool уже готовы к использованию (`lib/ai/tools/deep-research.ts`, `lib/ai/tools/fetch-url.ts`). Можно импортировать напрямую.
- **Промпт-файлы** — ОК, формат `.md` с `{{PLACEHOLDERS}}` и `.replace()` — существующий паттерн. Промпт v2 хорошо написан.
- **Mode injection** — ОК, архитектура аналогична `buildFullManagerPrompt()` с динамическим контентом по фазе.

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | **Нет таблицы для пользовательских тем** | Создать таблицу `BriefingTopics` (`userId`, `topicId`, `topicName`, `emoji`, `createdAt`) | В ТЗ-BR1 темы были в хардкод-каталоге `topics-catalog.ts`. Теперь AI создаёт кастомные темы (slug, имя, emoji). В `briefingSources` есть только `topicId` (varchar) без `topicName`/`emoji`. Генерация брифинга (`briefing-analyzer.ts`) использует `BriefingBlock.topicName`/`emoji` — их нужно откуда-то брать для каждого пользователя. Без таблицы придётся хранить в JSONB в settings — менее чисто. |
| 2 | «Удалить старые briefingSources пользователя» в saveBriefingProfile | Создать query `deleteAllBriefingSourcesByUser(userId)` | Сейчас есть только `deleteBriefingSource({ id })` — удаление по одному ID. Для reset при сохранении профиля нужен batch delete: `DELETE FROM "BriefingSources" WHERE "userId" = $1`. |
| 3 | Mode-injection шаблон использует Handlebars: `{{#each currentTopics}}` | Строить строки вручную (как Manager `buildFirstContactMode()`) | Кодовая база не использует template engines. Все подстановки — через `.replace()` на плоские строки. Для `edit` mode нужно программно строить блок с текущими темами/источниками, как `buildPlanPresentationMode()` строит список задач. |
| 4 | Один tool `saveBriefingProfile` для всего | Два tool: `updateBriefingPreview` (live preview) + `saveBriefingProfile` (финальное сохранение) | ТЗ говорит «превью обновляется в реальном времени при tool calls» + «отслеживать deepResearch — показывать найденные источники в превью ДО финального сохранения». Но deepResearch возвращает неструктурированный текст, а не JSON тем/источников. Без промежуточного tool клиент не знает какие темы/источники AI нашёл до финала. Паттерн projects/new: `updateProjectDraft` (live) + кнопка «Создать» (final). Рекомендую: `updateBriefingPreview({ topics, sources })` для live-обновления левой панели + `saveBriefingProfile` для записи в БД. |
| 5 | `maxDuration = 120` секунд | Сделать условным по контексту ИЛИ поднять глобально | `maxDuration` в route.ts (`export const maxDuration = 60`) — это Next.js serverless function timeout, глобальный для всего route. Нельзя задать per-request. Варианты: (а) поднять до 120 для всего route (другие контексты просто завершатся раньше), (б) вынести briefing-onboarding в отдельный route (ломает паттерн). Рекомендую вариант (а) — 120 это ceiling. |
| 6 | `stepCountIs(5)` | Сделать динамическим по контексту | Сейчас `stopWhen: stepCountIs(3)` глобально. Для briefing нужно 5+ (deepResearch на каждую тему + saveBriefingProfile). Рекомендую: `const maxSteps = context === "briefing-onboarding" ? 8 : 3;` — 8 шагов даст запас для 3-4 тем по deepResearch + fetchUrl + save. |

### ❓ Требует уточнения

1. **Claude Sonnet 4.6 — конкретный model ID?** ТЗ говорит `claude-sonnet-4-6`. Текущая модель `claude-sonnet` → `claude-sonnet-4-5-20250929`. Нужен ли реальный model ID `claude-sonnet-4-6-...`? Или это название для будущей модели? Если модели ещё нет в API Anthropic — я использую текущий Sonnet 4.5, а когда появится — поменяем ID.

2. **`generationTime`** — промпт не спрашивает про время доставки брифинга. В БД поле `generationTime` (default "06:00"). Онбординг не трогает? Оставляем default?

3. **Что показывать вернувшемуся юзеру?** ТЗ говорит mode "edit" загружает текущие настройки. Но если юзер нажал CTA на лендинге «Настроить мой брифинг» повторно — он попадает на `/briefing/setup` в mode "edit". Нужен ли отдельный вход для edit (кнопка «Изменить настройки» где-то в UI)? Или лендинг не показывается если профиль уже есть?

4. **После сохранения → «Сгенерировать первый брифинг»** → `POST /api/briefing/generate`. Этот endpoint уже существует (ТЗ-BR1). Но генерация может быть долгой (30-60 сек). Показывать loading? Или просто редиректить на `/briefing` где карточка покажет статус?

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| deepResearch таймаут при 3-4 вызовах подряд | Средняя | Высокое — юзер ждёт | stepCountIs(8) + maxDuration 120. Prompt уже содержит fallback: «используй аварийный каталог» |
| Perplexity API недоступен | Низкая | Высокое — core flow сломан | Prompt edge case: «Поиск временно недоступен. Настрою по базовым темам.» + topics-catalog.ts как fallback |
| 120s maxDuration недостаточно для 4 deepResearch + fetchUrl | Средняя | Среднее | Prompt ограничивает до 2-4 источников на тему. Параллельные вызовы невозможны (sequential tool calling). Можно объединить темы в один deepResearch запрос |
| Миграция БД (новая таблица) на production | Низкая | Низкое | Drizzle migration + `npm run db:migrate`. Новая таблица — безопасная операция, не затрагивает существующие |

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-А1 (BriefingLanding) — `/briefing` лендинг с CTA «Настроить»
- [x] ТЗ-BR1 (MorningBriefingBackend) — DB schema, queries, generate endpoint
- [x] ТЗ-PX+FU (DeepResearch + FetchUrl) — tools готовы
- [x] Промпт от PE — приложен к ТЗ (briefing-onboarding-v2.md)

**Затронутые файлы (создание/модификация):**

**Создание:**
- `lib/prompts/service-chats/briefing-onboarding.md` — основной промпт
- `lib/prompts/service-chats/briefing-onboarding-mode-injection.md` — mode injection шаблоны
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — Client Component (split layout)
- `app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx` — левая панель
- `app/(dashboard)/briefing/setup/components/briefing-chat-panel.tsx` — правая панель (или переиспользовать ProjectChatPanel)
- `components/service-chat/configs/briefing-onboarding.ts` — конфиг
- `lib/db/schema.ts` — новая таблица `BriefingTopics` (миграция)

**Модификация:**
- `app/(dashboard)/briefing/setup/page.tsx` — заменить заглушку на Server Component с auth + mode detection
- `app/(chat)/api/service-chat/route.ts` — новый контекст, prompt builder, tools, model, maxDuration, stepCount
- `lib/db/queries.ts` — новые queries (topics CRUD, bulk delete sources)
- `lib/ai/providers.ts` — новая модель claude-sonnet-4-6 (если доступна)
- `components/service-chat/configs/index.ts` — экспорт нового конфига
- `components/briefing/briefing-page.tsx` — возможно: условный рендер (лендинг vs redirect) если профиль уже есть

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Основные паттерны уже отработаны (service-chat, split layout, tool sync). Но: миграция БД, новый промпт с mode injection, интеграция deepResearch в service-chat (первый раз), live preview с промежуточными результатами — всё это требует аккуратной реализации. Оценка: 3-4 сессии.

---

## Архитектурное решение: таблица BriefingTopics

Текущая схема (ТЗ-BR1) хранит темы в хардкод-каталоге `topics-catalog.ts`. Онбординг создаёт кастомные темы. Предлагаю:

```sql
CREATE TABLE "BriefingTopics" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES "User"("id"),
  "topicId"   VARCHAR(50) NOT NULL,     -- slug: "formula-1", "ai-business"
  "topicName" VARCHAR(100) NOT NULL,    -- "Формула-1", "AI для бизнеса"
  "emoji"     VARCHAR(10) NOT NULL,     -- "🏎️", "🤖"
  "createdAt" TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX "briefing_topics_user_topic_idx"
  ON "BriefingTopics"("userId", "topicId");
```

**Связь:** `BriefingSources.topicId` → `BriefingTopics.topicId` (логическая, не FK — оба привязаны к userId).

**Queries:**
- `getBriefingTopics(userId)` → BriefingTopic[]
- `deleteAllBriefingTopicsByUser(userId)` → void
- `addBriefingTopic({ userId, topicId, topicName, emoji })` → BriefingTopic

---

## Ответы на вопросы

> Заполнено архитектором 2026-02-20

1. **Claude Sonnet 4.6 model ID:** `claude-sonnet-4-6` — подтверждён, модель вышла 17 февраля, доступна в API. Добавить как отдельный entry в providers.ts.
2. **generationTime в онбординге:** Default "07:00" (не "06:00"). Промпт не спрашивает — правильно, это для Фазы Г (cron). Просто default в settings.
3. **Повторный вход в setup (edit):** Лендинг НЕ показывается если профиль есть. `/briefing` → последний выпуск или "нет выпусков". Кнопка "Настройки" → `/briefing/setup` в mode "edit". Заложено в ТЗ-А1.
4. **Flow после сохранения (генерация):** Success card в превью + кнопка "Сгенерировать первый брифинг" → redirect на `/briefing` с простым loading state. Полноценный progress UI в ТЗ-А5.

**Дополнительные решения архитектора:**
- stepCountIs для briefing-onboarding: **8** (не 5, запас для 3-4 deepResearch + fetchUrl + save)
- Все 6 рекомендаций приняты без изменений
- BriefingTopics: добавить `orderIndex` для порядка тем
