# Аудит pipeline Briefing — для архитектора

**Создан:** 2026-04-26
**Заказчик:** архитектор (запрос пришёл через владельца в рамках финализации ТЗ-BriefingStuckRecovery)
**Назначение:** материал для проектирования Блока 8 «источники для Briefing» с учётом будущей миграции интернет-инструментов на xAI `web_search`

---

## 1. Pipeline onboarding (подбор источников)

```
User → /briefing/setup → service-chat "briefing-onboarding" (Claude Sonnet 4.6)
   ├─ taskId: service-chat:briefing-onboarding
   └─ AI вызывает tool startResearch (single-shot, без orchestration)
        ↓
researchTopics (lib/briefing/research-engine.ts:155)
   ├─ TOPIC_CONCURRENCY = 3 параллельных тем
   └─ для каждой темы:
        1. Perplexity sonar-pro (callPerplexity, 30s timeout)
           — единый запрос «сайты + Telegram-каналы» одним промптом
        2. extractCitations (URL из citations + regex по тексту)
        3. extractTelegramHandles (regex @username)
        4. Verify в параллель (VERIFY_CONCURRENCY = 5):
             • web URL → fetchPage (8s timeout) → snippet + RSS-discovery
             • TG handle → parseTelegramChannel (8s timeout, scrape t.me/s/)
        5. classifySource (tier по hardcoded спискам, fetchMethod, language)
   └─ ограничения per topic: max 12 web + 3 telegram
        ↓
saveBriefingProfile (lib/briefing/save-briefing-profile.ts)
   ├─ upsertBriefingSettings (timezone, language, maxItems, volume)
   ├─ deleteAllBriefingTopicsByUser → loop addBriefingTopic (НЕ в транзакции!)
   └─ deleteAllBriefingSourcesByUser → loop addBriefingSource (НЕ в транзакции!)
```

**Используемые модели:** только одна — `claude-sonnet-4-6` для service-chat. `researchTopics` — детерминированный server-side код БЕЗ LLM-оркестрации.

**Используемые инструменты:** `callPerplexity` (sonar-pro), `fetchPage` (общий с `fetchUrl` tool), `parseTelegramChannel` (общий с `readTelegramChannel` tool). Ни один briefing-код не использует AI-tool wrapper'ы (`webSearch`, `fetchUrl`, `readTelegramChannel` из `lib/ai/tools/*`) — все прямые вызовы базовых функций.

---

## 2. Pipeline создания брифинга

```
Triggers:
   ├─ Vercel Cron daily 0 5 UTC → /api/cron/briefing
   └─ User → /briefing → кнопка «Сгенерировать» → /api/briefing/generate (streaming)
        ↓
runBriefingPipeline (lib/briefing/briefing-pipeline.ts)
        ↓
Step 1 «connecting»:
   ├─ getBriefingSettings + getBriefingTopics + getBriefingSources (БД)
   ├─ если sources пуст → fallback к getDefaultSources (topics-catalog.ts, 2 source/topic)
   ├─ getPreviousBriefing (для дедупа) + deleteOldBriefingHistory({keepLast:1})
   └─ INSERT BriefingHistory(status='generating')   ← после моего ТЗ возвращает id
        ↓
Step 2 «fetching»:
   ├─ Promise.allSettled — параллельный fetch ВСЕХ источников
   └─ fetchSource (lib/briefing/source-fetchers/index.ts) → dispatcher по fetchMethod:
        • rss → fetchRSS — rss-parser, timeout 10s, freshness-фильтр 24ч
        • jina → fetchWeb → fetchPage cascade (Readability→semantic→Jina Reader, 15s)
        • telegram_parse → fetchTelegram → parseTelegramChannel (t.me/s/ scrape, 10s)
        ↓
Step 3 «filtering»:
   └─ filterContent (briefing-filter.ts) — модель grok-4-1-fast-non-reasoning
        — JSON list кандидатов с topicId/url/oneLinerSummary
        — лимит MAX_FILTER_CANDIDATES = 30
        — retryWithLogging, 3 attempts
        ↓
Step 4 «writing»:
   └─ generateArticle (briefing-author.ts) — streamText на MiniMax-M2.7-long
        (через namespace minimaxLong с AbortSignal.timeout(180_000))
        — Single-shot JSON со всеми секциями
        — лимит maxTokens по volume (compact/standard/detailed)
        — retryWithLogging, 3 attempts
        — Дедуп по topicId после parse
        ↓
Step 5 «save»:
   ├─ Inject simply-news section (если hasUpdate)
   ├─ verifyArticleUrls (compare со fetchedUrls + filterOutputUrls)
   └─ UPDATE BriefingHistory(id) status='ready' + briefingJson + metadata  ← после моего ТЗ
```

**Per-section refresh** (`/api/briefing/refresh-section`): отдельная функция `generateSection` (briefing-section-author.ts) с тем же системным промптом, режим `refresh` или `initial` (Map-Reduce). Та же модель `briefing:section` = MiniMax-M2.7-long.

**Cost breakdown (наблюдаемый):** filter ~₽0.12 (30%), author ~₽0.29 (70%), всего ~₽0.4 на брифинг.

---

## 3. Таблица типов источников

| Тип | Поддержан? | Чем читается | Известные проблемы |
|---|---|---|---|
| **RSS/Atom** | ✅ | `rss-parser` (lib/briefing/source-fetchers/rss-fetcher.ts), timeout 10s | Хабр RSS наблюдался 404 (26 апр); freshness-фильтр работает только если RSS отдаёт `pubDate`/`isoDate` |
| **Web (без RSS)** | ✅ | `fetchPage` cascade Readability→semantic→Jina Reader (lib/ai/tools/fetch-page.ts) | **publishedAt не извлекается** — freshness-фильтр на этих источниках не работает (5 warnings в каждом прогоне); cascade на anti-bot домены нестабилен |
| **Telegram public** | ✅ | `parseTelegramChannel` через scraping `t.me/s/{handle}` cheerio (lib/telegram/parser.ts) | Зависит от незаявленной HTML-структуры t.me; ломается на private каналах; нет API-альтернативы |
| **YouTube** | ❌ | — | Нет в коде |
| **Instagram** | ❌ | — | Нет в коде |
| **TikTok** | ❌ | — | Нет в коде |
| **X (Twitter)** | ❌ | — | Нет в коде |
| **Facebook** | ❌ | — | Нет в коде |
| **VK / VK Video** | ❌ | — | Нет в коде |
| **Substack newsletters** | ⚠️ через RSS | rss-parser (если у автора включён RSS) | Не выделено отдельно, обрабатывается как обычный RSS |

**Доступные `fetchMethod` в схеме БД:** `"rss" | "jina" | "telegram_parse"` (varchar). Любой новый тип источника требует расширения switch-кейса в `source-fetchers/index.ts:dispatcher` + миграции БД.

---

## 4. Найденные проблемы (с file:line)

### 🟥 P1 — критичный production-блокер

**1.1 MiniMax briefing:author silent hang (наблюдается с 23 апреля)**
- **Где:** [lib/briefing/briefing-author.ts:210](../../lib/briefing/briefing-author.ts#L210) — `streamText({ model: getModel("briefing:author") })`. Резолвится в `minimaxLong:MiniMax-M2.7` namespace ([lib/ai/getModel.ts:124](../../lib/ai/getModel.ts#L124)) с `AbortSignal.timeout(180_000)` ([lib/ai/registry.ts:42](../../lib/ai/registry.ts#L42)).
- **Симптом:** pipeline доходит до Author stage, log пишет `[Briefing] volume: standard`, после этого тишина >11 минут. **AbortSignal.timeout НЕ срабатывает** (должен был на 180с).
- **Что проверено:** прямой `curl` на `https://api.minimax.io/anthropic/v1/messages` — HTTP 200 за 6.4с, ответ корректный (содержит `thinking` блок + `text`). API живой, ключ валиден. Provider-пакет `vercel-minimax-ai-provider@0.0.2` правильно пробрасывает `fetch` опцию (проверено grep'ом по dist).
- **Корневая причина (гипотеза):** регрессия в `ai@6.0.168` (апгрейд от 2026-04-23, commit `97af934`, фикс xAI зависания). MiniMax возвращает Anthropic-protocol stream с reasoning chunks (`type: thinking`), AI SDK 6.0.168 не может это распарсить или ждёт неприходящего close события.
- **Сходство с памятью владельца:** `feedback_sdk_regression_check` ([memory](../../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/feedback_sdk_regression_check.md)) — точно такой паттерн уже наблюдался ранее на xAI; первым шагом проверять installed-vs-latest patch-версии SDK.
- **Последний успешный прогон:** 2026-04-23 19:04 UTC, MiniMax-M2.7, briefing:author, durationMs=162161 (162с — близко к timeout). После этой даты НИ ОДНОГО успешного briefing:author вызова в `ai_usage_log`.
- **Влияние:** briefing **полностью неработоспособен в production** с 23 апреля. Watchdog Этапа 1 текущего ТЗ это маскирует (помечает hung row 'failed' через 10 мин), но не лечит.
- **НЕ В SCOPE текущего ТЗ.** Требует отдельного расследования: либо downgrade `ai` SDK до 6.0.116, либо upgrade MiniMax provider до версии совместимой с 6.0.168, либо миграция модели на Grok (как сделано для Filter в ТЗ-XAI-4 scope expansion).

### 🟧 P2 — функциональные деградации

**2.1 publishedAt отсутствует для всех web (не-RSS) источников**
- **Где:** [lib/briefing/source-fetchers/web-fetcher.ts:41](../../lib/briefing/source-fetchers/web-fetcher.ts#L41) — `warnings.push("publishedAt not available for web source [${sourceName}]")` для каждого fetch.
- **Последствие:** `FRESHNESS_HOURS = 24` фильтр в [lib/briefing/source-fetchers/rss-fetcher.ts:39](../../lib/briefing/source-fetchers/rss-fetcher.ts#L39) применяется только к RSS-items. Web-источники проходят без freshness-проверки → старые статьи смешиваются со свежими; модель в filter-stage не видит дату.
- **Источников затронуто наблюдаемо:** Simon Willison's Weblog, AI-Stat.ru, Artificial Analysis, Anthropic News, Anthropic Engineering (5 warnings из 7 fetched URLs в последнем прогоне).

**2.2 Хабр RSS 404 (наблюдается с 26 апреля)**
- **Где:** [lib/briefing/topics-catalog.ts:46-52](../../lib/briefing/topics-catalog.ts#L46), [:79-83](../../lib/briefing/topics-catalog.ts#L79), [:252-258](../../lib/briefing/topics-catalog.ts#L252) — три записи Habr используют URL `https://habr.com/ru/rss/hub/<hub>/all/?fl=ru`.
- **Последствие:** один источник по теме `ai` молча выпадает (RSS fetch returns 404). 1 error в trace summary.

### 🟨 P3 — архитектурные хвосты

**3.1 `saveBriefingProfile` не атомарен**
- **Где:** [lib/briefing/save-briefing-profile.ts:51-78](../../lib/briefing/save-briefing-profile.ts#L51-L78).
- **Что:** `deleteAllBriefingTopicsByUser` → loop `addBriefingTopic` без `db.transaction(...)`. То же для sources.
- **Риск:** падение в середине loop (network glitch, DB hiccup) → пользователь остаётся с пустым/частичным профилем. Восстановление только через повторный onboarding.

**3.2 Tier классификация — hardcoded списки доменов**
- **Где:** [lib/briefing/research-engine.ts:101-143](../../lib/briefing/research-engine.ts#L101-L143) — `FLAGSHIP_DOMAINS` (16 шт.), `RESPECTED_DOMAINS` (~22 шт.).
- **Что:** любой не-перечисленный домен → `tier: "niche"` автоматически. Новые/региональные/нишевые источники без user-customization не получают повышенный приоритет в Author-стейдже.
- **Не блокер**, но ограничивает квалификацию свежих источников.

**3.3 Нет валидации URL при ручном редактировании источников**
- **Где:** [lib/briefing/save-briefing-profile.ts:67-77](../../lib/briefing/save-briefing-profile.ts#L67-L77) — `addBriefingSource` без HTTP-probe.
- **Что:** если пользователь добавит битый/опечатанный URL через UI редактирования профиля, источник попадёт в БД и будет ронять ежедневный fetch навсегда.
- **research-engine верифицирует только при автодискавери** (Phase 3 verifySource), при ручном вводе — нет.

**3.4 `/api/briefing/latest` — orphan endpoint**
- **Где:** [app/(chat)/api/briefing/latest/route.ts](../../app/(chat)/api/briefing/latest/route.ts).
- **Что:** GET-handler авторизован, делает запрос в БД, отдаёт JSON. **Никем не вызывается** (`grep -rn "api/briefing/latest"` — 0 hits в client/server коде). Page Server Component `/briefing` напрямую дёргает `getBriefingHistory`.
- Записан в FINDINGS.md текущего ТЗ — кандидат на удаление в follow-up.

**3.5 Concurrency cron ↔ ручная кнопка**
- Гонка cron-запуска и user-triggered `/api/briefing/generate` для одного userId. Оба INSERT'нут 'generating' (после моего ТЗ — обновят свои ID). После завершения один прогон UPDATE'нёт свой row на 'ready', другой — тоже на 'ready' или 'failed'.
- В backlog: `TZ_BriefingConcurrencyGuard` (создаётся в финализации текущего ТЗ).

**3.6 Telegram-парсер хрупкий**
- **Где:** [lib/telegram/parser.ts](../../lib/telegram/parser.ts) — scrape `t.me/s/{channel}` HTML через cheerio.
- **Что:** работает для публичных каналов, но любое изменение Telegram HTML-разметки ломает парсинг. Bot API не альтернатива (не даёт читать чужие public-каналы без явного member-инвайта).
- **Не баг сейчас**, но фактор риска при росте Telegram как источника.

### 🟩 P4 — мелкие хвосты

**4.1 Нет fallback при anti-bot/captcha/403 для web**
- [lib/ai/tools/fetch-page.ts](../../lib/ai/tools/fetch-page.ts) cascade `Readability → semantic → Jina Reader`. Если все три не отдадут — `errors.push` и source молча пропускается без явного флага «заблокировано на стороне источника».
- Невозможно по trace отличить «сайт лежит» от «сайт нас банит».

**4.2 Hardcoded конкуренси не масштабируется**
- `TOPIC_CONCURRENCY = 3` × `VERIFY_CONCURRENCY = 5` = 15 параллельных HTTP-запросов в onboarding. При 10+ topics × 6 sources/topic — растягивается. `CRON_CONCURRENCY_LIMIT = 3` пользователя в крон.

**4.3 Volume управление spread'ом ответа Author**
- [lib/briefing/briefing-author.ts:196](../../lib/briefing/briefing-author.ts#L196) — `MAX_TOKENS_BY_VOLUME` управляет `maxOutputTokens`. Документация в task-assignments комментариях ([task-assignments.ts:308](../../lib/ai/task-assignments.ts#L308)) предупреждает: «call site сохраняет dynamic MAX_TOKENS_BY_VOLUME, это значение = fallback + документация» — лёгкая дивергенция SSOT.

---

## 5. Связь Briefing с общими интернет-инструментами Simply

| Компонент Simply | Использует Briefing? | Точка связи | Влияние миграции |
|---|---|---|---|
| `lib/ai/tools/fetch-page.ts` | ✅ через `web-fetcher.ts:3` и `research-engine.ts:18` | прямой импорт `fetchPage()` | Любая миграция/замена `fetchPage` сразу затронет briefing fetcher и research-engine |
| `lib/ai/tools/perplexity-client.ts` | ✅ через `research-engine.ts:14` | `callPerplexity()` для onboarding-discovery | Замена Perplexity sonar-pro на xAI Live Search (`web_search`) затронет качество автоподбора |
| `lib/telegram/parser.ts` | ✅ через `telegram-fetcher.ts:3` и `research-engine.ts:19` | `parseTelegramChannel()` | Если будет введён Telegram Bot API/MTProto layer — нужна сверка |
| `lib/ai/tools/web-search.ts` (Brave) | ❌ | — | Briefing использует Perplexity, не Brave |
| `lib/ai/tools/fetch-url.ts` (AI-tool wrapper) | ❌ | — | Briefing использует базовую `fetchPage`, не tool wrapper |
| `lib/ai/tools/read-telegram-channel.ts` (AI-tool wrapper) | ❌ | — | Briefing использует базовую `parseTelegramChannel`, не tool wrapper |
| `lib/ai/tools/deepResearch.ts` | ❌ | — | Briefing не использует deepResearch tool, хотя research-engine описывается как «Replaces LLM-orchestrated tool chains (deepResearch → fetchUrl → readTelegramChannel)» — это бывшая архитектура, заменена на детерминированный код |

**Вывод для архитектора:** миграция интернет-инструментов на xAI `web_search` затронет Briefing **через `fetchPage` и `callPerplexity`** на уровне базовых функций, не через tool-wrapper. Если новая архитектура заменит эти базовые функции — briefing будет работать «бесплатно». Если только tool-wrapper'ы — briefing нужно отдельно адаптировать.

---

## 6. Резюме

### Точно работает (до 23 апреля было стабильно)

- RSS-источники с корректным фидом (рабочая лошадка — большинство default sources)
- Публичные Telegram-каналы (через t.me/s/ scraping)
- Onboarding pipeline (Perplexity sonar-pro + fetchPage + parseTelegramChannel — алгоритмически корректен)
- Filter stage на Grok 4.1 Fast non-reasoning (стабилен)
- UI: BriefingCard, /briefing page, sidebar, saved topics, podcast button

### Точно сломано прямо сейчас (production)

- **briefing:author** — silent hang на MiniMax-M2.7-long через AI SDK 6.0.168 (наблюдается с 23 апреля; ни одного успешного прогона). Маскируется watchdog'ом из текущего ТЗ.
- **briefing:section** — та же модель, аналогично сломана.
- **briefing:podcast-script** — на MiniMax-M2.7 (короткое имя), та же провайдерская связка → аналогично подозрительна.
- **Хабр RSS 404** — три записи в catalog (мелкий fix).
- **publishedAt для web-источников** — структурная проблема, freshness-filter частично не работает.

### Неоднозначно

- Telegram parser живучесть — пока работает, но HTML t.me/s/ — незаявленный API.
- Tier классификация — hardcoded; ОК для узкого SAaS, ограничивает рост охвата источников.
- Конкуренси — захардкожено, не масштабируется при росте sources.

### Что НЕ покрывается текущей реализацией (для Блока 8)

- YouTube (channels, RSS feeds, transcripts, Supadata)
- Instagram (accounts, reels)
- TikTok (creators, videos)
- X (Twitter) аккаунты
- Facebook страницы
- VK Video, ВКонтакте паблики
- LinkedIn newsletters
- Substack как явный тип (сейчас обрабатывается как RSS)
- Mastodon / Bluesky аккаунты

Любой из них требует:
1. Новый `fetchMethod` enum-значение в schema БД (миграция).
2. Новый fetcher в `lib/briefing/source-fetchers/`.
3. Расширение `dispatcher` в `index.ts`.
4. Возможно — новый AI-tool для discovery в onboarding (если Perplexity sonar-pro слабо находит этот тип).

---

## 7. Что я НЕ делал (по запросу архитектора)

- Не предлагал архитектурных решений.
- Не писал код.
- Не правил `task-assignments.ts` или `topics-catalog.ts`.

Только аудит и отчёт. Решение по Блоку 8 — за архитектором.
