# Simply — XAI Migration Notes

> Append-only лог. Новые записи добавляются сверху. Старые не редактируются.

**Соседние документы серии:**
- [SIMPLY_XAI_ROADMAP.md](SIMPLY_XAI_ROADMAP.md) — что планируем
- [SIMPLY_XAI_CHANGELOG.md](SIMPLY_XAI_CHANGELOG.md) — что реально сделано (append-only факт-лист)
- Этот файл — почему приняли такие решения

---

## 2026-04-16 — ТЗ-XAI-6 финализация + OpenRouter как dev-инструмент (серия Simply_xAI закрыта, v3.92.1)

**Контекст:** Владелец поправил вторую рамку о cleanup моего же ТЗ-XAI-6. Предыдущая рамка (commit `5c0a22e`) говорила «убираем OpenRouter + dead code». После разговора этой сессии **OpenRouter тоже остаётся** — как **dev-инструмент** для быстрого тестирования новых моделей.

### OpenRouter — dev-инструмент (зафиксировано владельцем 2026-04-16)

> **Дословная формулировка владельца:** «Не надо убирать OpenRouter, он нам всегда понадобится для тестирования моделей, мы пока не в продакшене, мы пока в стадии разработки и он нам всегда понадобится для тестирования какой-нибудь новой или другой модели.»

**Роль OpenRouter в архитектуре Simply:**

- **НЕ production-провайдер.** Нет active `taskId`, который бы routeил туда продуктовый трафик
- **dev-инструмент.** Один API-ключ → доступ к сотням моделей (GLM, Qwen, DeepSeek, Llama и т.д.) через один namespace. Нужен когда хочется быстро протестировать новую модель без регистрации отдельного аккаунта / ключа / биллинга
- **Используется через `/dev/models` override.** Если владелец хочет протестировать, например, «а что если simply-chat на DeepSeek?» — прописывает override, routing включает OpenRouter, получает empirical данные без продуктового rollout'а
- **Остаётся в каталоге, registry, env как есть.** `OPENROUTER_API_KEY` остаётся в Vercel

**Архитектурная константа серии обновляется:**
- Было: «3 провайдера» (Grok + MiniMax + Anthropic)
- Стало: **«4 провайдера — 3 production + 1 dev»** (production: Grok, MiniMax, Anthropic; dev-инструмент: OpenRouter)

### Финальный scope ТЗ-XAI-6 после двух correction'ов

**Предыдущие мои формулировки (обе неверные):**
1. (commit `2b0b131`) «cleanup MiniMax/OpenRouter» — MiniMax кухня by design, нельзя убирать
2. (commit `5c0a22e`) «OpenRouter + dead code» — OpenRouter dev-инструмент, тоже нельзя убирать

**Финальный scope:** **только dead code cleanup.** При реализации оказалось, что:

- `stripMiniMaxToolParts` — **уже удалён** в ТЗ-XAI-3 (commit из той сессии)
- `stripLegacyOpenAICompatToolParts` — **уже удалён** в ТЗ-XAI-3 (Q1 решение, Этап 2.3 ROADMAP)
- `isSimplyNonAnthropicModel` — **уже удалён** в ТЗ-XAI-3 (Этап 2.4 ROADMAP, R-6 резолв)
- `snapshot-creator.ts` — **уже удалён** в ADR 052 «ТЗ-CreateSnapshotAudit cleanup»

**Осталось для ТЗ-XAI-6:**

1. `clerk:snapshot` placeholder в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) — TaskId union (L46) + DEFAULT_TASK_MODELS (L139) + комментарий (L135-136). **Это висящая запись без call sites** — `snapshot-creator.ts` удалён, `getModel("clerk:snapshot")` никто не вызывает, но тип остался
2. `docs/decisions/038-cost-tracking-architecture.md:77` — строка `| Snapshot creator | Haiku | clerk:snapshot-creator |` в служебной таблице
3. `specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md:195` — строка `| clerk:snapshot | Claude Haiku 4.5 |` в таблице клерков

**Итого:** 3 строки кода + 2 строки docs. Весь ТЗ-XAI-6 — 5 строк.

### Версия bump: v3.92.1 (patch)

Минорное изменение — patch по semver. Не feature, не breaking.

### Мета-урок — вторая итерация правила cleanup

Первая итерация (эта же сессия выше): «MiniMax кухня by design, не подлежит удалению». Вторая (эта запись): «OpenRouter dev-инструмент, тоже не подлежит удалению».

**Общий паттерн:** я дважды предлагал cleanup провайдера исходя только из production-usage. Оба раза владелец поправил на уровне **use cases за пределами production** — у MiniMax это продуктовая роль (фоновые pipelines), у OpenRouter это dev workflow (тестирование новых моделей).

**Новое правило в memory (`feedback_cleanup_requires_full_context.md`):**

> **Перед предложением удалить компонент** (провайдер, функцию, dependency, env var) — спрашивать о **всех use cases, не только production trafficе**. Dev workflow, testing tooling, emergency fallback, A/B experimentation — это всё валидные причины оставить компонент. Grep по production коду показывает только часть картины. Формулировка вопроса к владельцу: «Используется ли это в dev/testing/fallback, или можно убирать?»

### Серия Simply_xAI — закрыта

После этого ТЗ серия **официально завершена**. Итоговая картина:

| ТЗ | Результат |
|---|---|
| ТЗ-XAI-1 | ✅ v3.88.0 — Фундамент (каталог, архитектурные решения) |
| ТЗ-XAI-2 | ✅ v3.89.0 — MIND pipeline → Grok |
| ТЗ-XAI-3 | ✅ v3.90.0 — KITT + Think → Grok + R-6 cleanup |
| ТЗ-SimplyChatModeInjection | ✅ v3.90.1 — плейсхолдеры через SSOT |
| ТЗ-SimplyReadDocumentTool + R-6 correction | ✅ v3.90.2 — adaptHistoryToCapabilities |
| ТЗ-ATTACH-1 | ✅ v3.91.0 — PDF text extraction при upload |
| ТЗ-XAI-4 | ✅ v3.92.0 — Utility/Pipeline batch миграция + scope expansion |
| ТЗ-XAI-5 | ✅ закрыт через scope expansion XAI-4 |
| **ТЗ-XAI-6** | ✅ **v3.92.1 — финальный cleanup dead code** (этот ТЗ) |

**Открыто для будущих веток серии xAI:**
- ТЗ-XAI-MA-1 — Multi-agent через Responses API + MCP (`expertise-multi-agent` taskId зарезервирован)
- ТЗ-XAI-COL-1 — Collections API для Библиотеки
- ТЗ-XAI-VOICE-1 — Voice Agent API

Это **новые направления**, не продолжение серии. Серия «миграция на xAI» закрыта.

### Финальная целевая архитектура (зафиксирована)

**4 роли · 3 production провайдера · 1 dev-инструмент:**

| Роль | Провайдер | Примеры taskId |
|---|---|---|
| Подсобка | Grok 4.1 Fast (xAI) | `util:*`, `clerk:*`, `briefing:filter`, `memory:extract-batch/consolidate/profile/dedup-verify` |
| Кухня | MiniMax M2.7 / M2.7-long | `briefing:author`, `briefing:section`, `briefing:podcast-script` |
| Зал | Grok 4.20 reasoning (xAI) | `simply-chat-think`, `expertise`, `create`, `meeting:summary`, `memory:extract` |
| Автор | Claude Opus / Sonnet / Haiku (Anthropic) | `professor:*`, `artifact:*`, `vision:ocr`, `service-chat:*` |
| Dev-инструмент | OpenRouter | — (только через `/dev/models` override) |

---

## 2026-04-16 — Философия серии «4 роли, 3 провайдера» + briefing cleanup + correction моих ошибочных утверждений о ТЗ-XAI-6

**Контекст:** Follow-up сессия после correction URL hallucination (commit `58d9d2e` + `eeba086` + `2b0b131`). Владелец сделал важную тематическую правку моей картины мира + попросил закрыть briefing хвосты реальной работой, а не документацией.

### Философия серии Simply_xAI — 4 роли, 3 провайдера (зафиксировано владельцем 2026-04-16)

> Формулировка владельца, приводится дословно для будущих сессий:

**Подсобка** — Grok 4.1 Fast. Фильтрация, заголовки, механика. Быстро, дёшево, надёжно.

**Кухня** — MiniMax M2.7. Брифинги, подкасты, фоновые pipeline. Работяга который готовит ночью, а утром гость получает готовое блюдо.

**Зал** — Grok 4.20. Всё что видит пользователь: чат, артефакты, экспертиза, документы. Качество, скорость, впечатление.

**Автор** — Claude Opus. Профессор. Бренд. Лицо Simply для тех кто хочет максимум. Как шеф-повар который выходит к гостю лично.

> Четыре роли, три провайдера, каждый на своём месте. Это философия Simply — мало элементов, каждый идеален.

**Ключевой вывод:** **MiniMax M2.7 и M2.7-long остаются в production by design**, не подлежат удалению в ТЗ-XAI-6. Briefing author / section / podcast-script — это **«кухня»**, они работают ночью через Vercel Cron, пользователь видит результат утром готовым. Экономика и качество на этой роли превосходят Grok (длинный output + специализация MiniMax на structured JSON в briefing контексте).

### Correction моих прежних ошибочных утверждений в документации

В коммите `2b0b131` я написал:
- «Блокер ТЗ-XAI-6 снят. Миграция briefing:author/section/podcast-script на Grok разблокирована»
- Вариант A в HANDOFF: «ТЗ-XAI-6 cleanup MiniMax/OpenRouter»
- CHANGELOG Post-Correction: «блокер ТЗ-XAI-6 снят после URL hallucination correction»

**Это была неверная рамка.** Миграция briefing:author на Grok **никогда не планировалась** — только я в своей картине мира хотел убрать MiniMax. Реальная цель серии **с самого начала** была гибридная: Grok для подсобки и зала, MiniMax для кухни, Anthropic для автора. ТЗ-XAI-6 scope правильно звучит так:

- **Оставить:** MiniMax namespaces `minimax` + `minimaxLong`, записи M2.7 и M2.7-long в каталоге, active taskIds (`briefing:author`, `briefing:section`, `briefing:podcast-script`)
- **Удалить:** OpenRouter namespace целиком (0 active taskIds после миграции), dead strip functions (`stripMiniMaxToolParts`, `stripLegacyOpenAICompatToolParts`, `isSimplyNonAnthropicModel`), `clerk:snapshot` dead code per ADR 052
- **Удалить env:** `OPENROUTER_API_KEY` (после подтверждения что нет usages), `MINIMAX_API_KEY` **НЕ удалять** — активно используется в кухне

**Следующие корректировки HANDOFF/CHANGELOG сделаны в той же сессии:**
- `HANDOFF.md` — вариант A переформулирован «ТЗ-XAI-6 cleanup OpenRouter + dead code» с явным «MiniMax остаётся by design — кухня»
- `CHANGELOG.md` Post-Correction запись — убрана неверная рамка про «MiniMax discharge»
- Архитектурная константа №18 в HANDOFF (см. ниже) — «4 роли, 3 провайдера by design»

### Briefing хвосты closure (TZ_ServiceChatNotOverridable закрыт)

Хвост утверждал 3 дыры, при реализации:

**Дыра 1 — ложная.** «UI `/dev/models` не показывает service-chat:*» — автор grep'ал директорию `/dev/models/` и не нашёл match'ей. Но UI получает taskIds через `ALL_TASK_IDS` import из `lib/ai/task-assignments.ts`, прямых упоминаний в директории UI и не должно быть. Все 4 service-chat taskIds (`ben`, `project-creation`, `project-manager`, `briefing-onboarding`) уже присутствуют в `DEFAULT_TASK_MODELS` (task-assignments.ts:174-177) и автоматически рендерятся в UI. Ничего делать не требовалось.

**Дыра 2 — реальная, починена.** `app/(chat)/api/service-chat/route.ts` не импортировал `@/lib/ai/model-overrides-node` → reader `.simply-dev-overrides.json` не регистрировался → dev-panel overrides для всех 4 service chats молча игнорировались. Фикс — +1 side-effect import line с подробным комментарием. Теперь briefing-onboarding (и остальные 3 service chats) переключаемые через `/dev/models` override.

**Дыра 3 — реальная, починена (docs).** `docs/ai-chats-map.md` overview-таблица не разделяла briefing-onboarding (service chat, UI, пользователь видит) от briefing pipeline (backend, cron). Добавлены явные маркеры «Service chat» vs «Backend pipeline (кухня)» в overview-строках. Briefing Onboarding section в детальном блоке получила важное предисловие что она **архитектурно независима** от pipeline, и новую строку «Dev override» в таблице параметров.

### Мета-урок для будущих сессий

1. **Хвосты с «N дыр» чаще бывают «1 дыра + N-1 предположений»** — при closing'е готовиться к тому что scope может быть меньше чем заявлено в оригинальной формулировке. Сверять каждую заявленную дыру против реального кода, а не принимать на веру
2. **Проверять claim «UI не показывает X»** — если UI динамически импортирует из SSOT-списка, отсутствие match в конкретной директории не значит отсутствия функциональности. Grep по папке — недостаточный индикатор
3. **Философия продукта живёт в NOTES, не HANDOFF.** HANDOFF — оперативный документ «где мы сейчас», NOTES — append-only история «почему приняли такие решения». Философия серии — это ответ на «почему», место ей в NOTES

### Вторая итерация мета-правила empirical_test_before_model_blame

Предыдущая итерация (2026-04-16 утро): «валидируй метрику перед выводами о моделях». Эта итерация (2026-04-16 вечер): **«проверяй также свои собственные рамки интерпретации продукта перед техническими решениями»**. Моё «cleanup MiniMax» было не ошибкой кода, не ошибкой метрики — это была ошибка на уровне **«что вообще является проблемой»**. Я смешал «технический долг» (OpenRouter, dead code) с «продуктовыми решениями» (MiniMax в кухне). Владелец поправил на уровне философии серии — это тот слой который выше Rule №0 «изучи документацию».

---

## 2026-04-16 — Correction: URL hallucination была не галлюцинацией, а metric bug (3 раунда диагноза)

**Контекст:** Follow-up сессия после v3.92.0 release. Владимир вернулся с альтернативной гипотезой о корне «URL hallucination в briefing:author». В процессе верификации выяснилось что предыдущий диагноз (мой же, в v3.92.0 CHANGELOG) был неверным на архитектурном уровне — проблемы, которой мы искали, не существовало.

### Три раунда диагноза

**Раунд 1 (моя ошибка, сессия ТЗ-XAI-4 Этап 3, 2026-04-15 вечер):**
DevPanel Pipeline Trace показал 10/11 (91%) fabricated URLs в briefing:author на MiniMax. Первичная диагностика — «MiniMax weakness на structured URL attribution». Владелец немедленно поправил: «Sonnet и Gemini исторически на этой роли тоже галлюцинировали, метрика `fabricated` добавлена специально как universal детектор».

Проведён empirical test hot-fix'нутого briefing route:
- MiniMax-M2.7: 10/11 (91%) fabricated
- Grok 4.20 non-reasoning: 9/11 (82%) fabricated

Marginal 9% разница при 4.4× цене. Вывод (ошибочный): «4 модели одинаково плохо = architectural prompt issue, не model weakness. Решение — `generateObject` + `z.enum([...allowedUrls])`». Зафиксировано в [TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md), HANDOFF, CHANGELOG v3.92.0 как High-impact блокер ТЗ-XAI-6.

Memory-правило `feedback_empirical_test_before_model_blame.md` было добавлено — правильное, но остановилось на полпути.

**Раунд 2 (гипотеза Владимира, follow-up сессия):**
«Галлюцинация не в author, а раньше — в `service-chat:briefing-onboarding` (Sonnet). Sonnet выдумывает RSS-источники по памяти, фетчер качает 404, автор работает с кривыми данными». Гипотеза связывала три хвоста в один investigation: [TZ_ServiceChatNotOverridable](../_backlog/TZ_ServiceChatNotOverridable.md) (UI dev panel не покажет onboarding selector), [TZ_DevOverridesSideEffectImportAudit](../_backlog/TZ_DevOverridesSideEffectImportAudit.md) (service-chat/route.ts без reader import → empirical test заблокирован), [TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md).

Верификация против кода:
- Промпт `briefing-onboarding.md` v11 — корректен. `<source_discovery>` запрещает называть источники по памяти, `<self_check>` § 1-2 проверяет каждый ответ, L353 «deepResearch недоступен: скажи честно. Не выдумывай источники», L399 «Все источники проверены через инструменты. Битых источников быть не может».
- `BriefingSources` в БД (5 источников Владимира): Simon Willison's Weblog, Хабр — ИИ, TechSparks, AI of the Day, Сиолошная (seeallochnaya) — все 7 URL (5 feed + 2 RSS) **живы HTTP 200 с контентом 88-508 KB**. Нет ни одного выдуманного.
- Sonnet сработал правильно. Гипотеза Раунда 2 опровергнута.

**Раунд 3 (реальный root cause):**
Проверил 11 article-level URLs из реального briefing `09b01675` (тот самый empirical test Grok 4.20, 9/11 fabricated по метрике). Все 11 URL — **живы HTTP 200 с контентом 15-346 KB**. А метрика в БД говорит 82% fabricated. **Противоречие.**

Root cause в [lib/ai/pipeline-trace.ts:368-381](../../lib/ai/pipeline-trace.ts#L368) — функция `classifyUrl()`:

```ts
function classifyUrl(url, fetchedUrls, filterOutputUrls) {
  if (fetchedUrls.has(url)) return "fetcher";       // ✓ verified
  if (filterOutputUrls?.has(url)) return "filter";  // 🟡 modified
  return "fabricated";                               // 🟥 AI выдумал
}
```

`fetchedUrls = new Set(allItems.map(it => it.url))` — naive Set без нормализации. Любая форматная разница между URL фетчера и URL в статье → `fabricated`:

- RSS Habr отдаёт `https://habr.com/ru/articles/1023812/?utm_campaign=1023812&utm_source=habrahabr&utm_medium=rss`, author правильно убирает UTM → `https://habr.com/ru/articles/1023812/` → **string mismatch → fabricated**
- Atom feed Simon Willison'а даёт `https://simonwillison.net/2026/Apr/15/gemini-31-flash-tts/#atom-everything`, author правильно убирает anchor → **string mismatch → fabricated**
- Trailing slash, `www.`, `http` vs `https`, порядок query params — любое несовпадение → fabricated

### Фикс

`normalizeUrlForComparison()` pure-функция в том же файле: strip hash, drop tracking params (utm_*, fbclid, gclid, ref, mc_*, yclid, _ga, igshid, msclkid), lowercase hostname без www., protocol→https, sorted query params, no trailing slash. `verifyArticleUrls()` нормализует оба Set'а once, `classifyUrl()` нормализует incoming URL.

Commit `58d9d2e`, 66 insertions / 6 deletions. Smoke test 8/8 PASS: OLD метрика 88% fabricated → NEW метрика 25% (2 control cases с реально выдуманными URL).

### Что отменяется

- **TZ_BriefingAuthorUrlHallucination** (архивируется как superseded): `generateObject` + `z.enum([...allowedUrls])` подход НЕ нужен. Он бы force-matched метрику через схему, но реальной проблемы галлюцинации URL нет. Избыточная сложность без пользы.
- **Блокер ТЗ-XAI-6** «briefing:author остаётся на MiniMax до закрытия URL hallucination» снимается. Можно планировать полный cleanup MiniMax registry/catalog в следующем ТЗ.
- **Перекос в архитектурных константах HANDOFF серии**: «briefing author/section/podcast-script архитектурно проблематичны» теперь ложная предпосылка. Обновляю в следующем коммите.

### Что остаётся валидным

- **TZ_ServiceChatNotOverridable** — по-прежнему валидная проблема (UI dev panel не показывает service-chat селекторы). Связь с URL hallucination больше нет, но сам по себе хвост нужен.
- **TZ_DevOverridesSideEffectImportAudit** — по-прежнему High-impact (6+ routes без reader import). Grok 4.20 instruction-following лучше Sonnet — переключение всё равно пригодится в будущих миграциях onboarding.
- **Memory-правило `feedback_empirical_test_before_model_blame.md`** — подтверждено второй итерацией. **Усиливается:** недостаточно протестировать 2 модели, нужно ещё валидировать **саму метрику** на которую опираешься. Новая формулировка в memory.

### Усвоенный мета-урок

Правило Rule №0 «семь раз отмерь» не охватило **проверку измерительного инструмента**. Два раза подряд (раунд 1 мой, раунд 2 Владимира) мы строили модели объяснения на основе цифры «82-91% fabricated», не спросив: **а что именно считает эта цифра?** Ответ оказался: «наивный `Set.has()` без нормализации». Это fundamentally разный мир объяснений.

**Правило усиливается:** перед тем как делать выводы о модели / промпте / архитектуре на основе метрики в DevPanel / observability слое — прочитать код метрики, понять что именно она считает, и на каких edge cases даст ложный результат. Цена нарушения в этой сессии — один ненужный хвост в backlog + несколько часов диагностики.

### Благодарность Владимиру

Гипотеза Раунда 2 (onboarding галлюцинация) оказалась неверной, но именно она заставила меня дойти до кода метрики. Без альтернативной гипотезы я бы продолжил верить в свой же диагноз из Раунда 1. Rule №0 работает только когда кто-то в команде сомневается в предпосылках.

---

## 2026-04-16 — Multi-agent reservation correction + dead code cleanup (post-2ca1ac5 follow-up)

**Контекст:** Короткая follow-up сессия после `2ca1ac5` (HANDOFF после Этапов 2+3). Владелец ревью текущего state SSOT и нашёл одну ошибку фрейминга, плюс попросил почистить мёртвые константы.

### Multi-agent НЕ deprecated, а RESERVED

В `2ca1ac5` я (предыдущая итерация Claude Code) после переключения `expertise → grok-4.20-0309-reasoning` пометил запись `grok-4.20-multi-agent-0309` в каталоге и `docs/ai-chats-map.md` как **«⚠ Не используется»**. Это была **архитектурная ошибка фрейминга** — Владелец указал:

> Multi-agent — это **не замена** expertise, а **отдельный premium-режим** рядом с ним. Toggle «Команда агентов» по паттерну кнопки «Думать». Через Responses API, не через Chat Completions. Реализация — отдельная большая работа (MCP сервер, auth layer, observability адаптер, UI прогресса агентов). Полностью расписано в `BRAINSTORM_GrokMultiAgent.md` и в ROADMAP как ТЗ-XAI-MA-1.

**Решение:** зарезервировать `expertise-multi-agent` как taskId placeholder в task-assignments.ts. Это:
1. Type-системой закрепляет имя — никто не сможет случайно переиспользовать
2. Делает namespace видимым в SSOT — будущему разработчику сразу понятно что место занято
3. Связывает запись каталога `grok-4.20-multi-agent-0309` с конкретным taskId, а не оставляет её «висеть в воздухе»
4. Соответствует архитектурному принципу — когда фича запланирована и оформлена в BRAINSTORM, её следы должны быть в SSOT, не только в документах

**Реализованные правки:**
- [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) — `| "expertise-multi-agent"` в TaskId union + `"expertise-multi-agent": "grok-4.20-multi-agent-0309"` в `DEFAULT_TASK_MODELS` с подробным RESERVED-комментарием
- [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) — переписан `notes` на записи multi-agent: вместо «expertise переведён, запись остаётся для аудита» теперь «RESERVED под taskId expertise-multi-agent, реализация в ТЗ-XAI-MA-1»
- [docs/ai-chats-map.md](../../docs/ai-chats-map.md) — добавлен row в overview-таблицу + chatMode routing + исправлен row в таблице моделей: 🔒 Reserved вместо ⚠ Не используется
- Cross-reference в ROADMAP под ТЗ-XAI-MA-1

**Валидация:** `getModel("expertise-multi-agent")` сейчас зарезолвится в каталог через registry — ничего не ломается. Call sites нет, никто не вызывает. Регистрация типа — pure documentation gesture.

**Урок:** При снятии модели с активного использования различать **«deprecated» (удалить когда чисто)** vs **«reserved» (намеренно зарезервировано под будущую фичу)**. Эти два состояния выглядят одинаково в коде (запись в каталоге без активного call site), но семантически разные. Reserved нужно явно маркировать в SSOT через placeholder taskId + комментарий, чтобы будущая сессия не пометила как мёртвый код.

### Dead briefing constants cleanup

Параллельно: в [lib/briefing/briefing-config.ts](../../lib/briefing/briefing-config.ts) удалены `FILTER_MODEL` и `AUTHOR_MODEL` — наследие от ТЗ-Briefing-1. После миграции `briefing:filter` на Grok 4.1 Fast (commit `ceadd17`) эти константы перестали импортироваться (грэп подтвердил 0 ссылок в `lib/` и `app/`), но дезинформировали будущего читателя. Удалены без последствий — `npx tsc --noEmit` 0 ошибок.

### Audit metadata bug — уже починен в 2ca1ac5

При сверке нашёл, что `app/(chat)/api/meeting/regenerate/route.ts:91` использовал хардкод `modelId: "claude-sonnet-4-6"` в audit metadata. После моего переключения `meeting:summary → Grok 4.20 reasoning` это начало бы писать лживое значение в БД. **Хорошая новость:** этот фикс уже применён в HEAD (676d50d / 2ca1ac5), мой Edit в этой сессии оказался noop. Note для будущих сессий: при переключении модели `taskId X` — обязательно грэпать на хардкод `claude-sonnet-4-6` / любой target-modelId по audit metadata блокам и заменять на `getModelIdForTask("X")`.

### DevPanel display labels для Grok моделей

В трёх компонентах ([model-section.tsx](../../components/dev-panel/sections/model-section.tsx), [dev-panel-footer.tsx](../../components/dev-panel/dev-panel-footer.tsx), [timeline-section.tsx](../../components/dev-panel/sections/timeline-section.tsx)) у `MODEL_DISPLAY` map'а не было записей для Grok моделей — fallback показывал raw modelId типа `grok-4.20-0309-reasoning`. Добавлены красивые лейблы для всех 5 Grok вариантов + MiniMax-long. Косметика, но прямо в scope текущей миграции — после переключения 11 taskId на Grok DevPanel становится главным интерфейсом наблюдения за реальной маршрутизацией для Владельца.

---

## 2026-04-16 — ТЗ-XAI-4 Этапы 2+3 + scope expansion + 4 hot-fixes

**Контекст:** Одна плотная сессия, закрывшая Этап 2 (6 taskId подсобки на Grok 4.1 Fast), Этап 3 (meeting:summary на Grok 4.20), + неожиданное расширение scope решениями Владимира в IDE по empirical-данным из тестов.

### Этап 2 — 6 taskIds подсобки (commit `ceadd17`)

- 6 taskId → `grok-4-1-fast-non-reasoning`: `briefing:filter`, `clerk:task-summary`, `clerk:file-analyzer`, `util:title`, `util:project-summary`, `util:artifact-suggestions`
- `docs/ai-chats-map.md` синхронизирован (8 правок)
- SQL confirmed 3/6: `clerk:file-analyzer` (3 calls), `util:title` (logged as `util:auto-naming`), `briefing:filter` — все на Grok 4.1 Fast ✅
- HANDOFF cleanup — убраны 2 устаревших MCP disconnection блока
- Rule №0 smoke test streamObject array mode на Grok 4.1 Fast (отдельная запись ниже) прошёл до кода

### Этап 3 + scope expansion — Владимир в IDE после empirical findings (commit `<this>`)

После Этапа 2 Владимир напрямую в IDE расширил scope на основе empirical данных сессии, обошёл последовательное прохождение Этапов 3/4 и принял 5 решений сразу:

| taskId | До | Стало | Причина |
|---|---|---|---|
| `simply-chat-think` | grok-4.20-0309-**non-reasoning** | grok-4.20-0309-**reasoning** | пересмотр Q1 ТЗ-XAI-3 решения по empirical данным (reasoning variant даёт лучший результат на multi-step задачах) |
| `expertise` | grok-4.20-multi-agent-0309 | grok-4.20-0309-**reasoning** | **R-5 resolved** (было в scope XAI-5) — multi-agent через Chat Completions работает как обычный 4.20, миграция на reasoning variant |
| `create` | MiniMax-M2.7 | grok-4.20-0309-**reasoning** | **scope XAI-5 выполнен** — «зал», пользователь видит результат в реальном времени, качество важнее экономии |
| `memory:extract` | grok-4.20-0309-non-reasoning | grok-4.20-0309-**reasoning** | mission-critical task, нужен интеллект reasoning |
| `meeting:summary` | claude-sonnet-4-6 | grok-4.20-0309-**reasoning** | **Этап 3 ТЗ-XAI-4 выполнен** — длинные транскрипты встреч |

Плюс важное архитектурное добавление в `docs/ai-chats-map.md` header:

> **⚠️ Важно для разработчиков:** Этот документ описывает **чаты и UI**, а не является реестром моделей. Единственный источник правды по моделям — [`task-assignments.ts`](../lib/ai/task-assignments.ts). Если таблицы расходятся — **правда в коде**, а документ устарел.

Это ставит SSOT в коде выше документа и задаёт правило приоритета для будущих расхождений.

### SQL-подтверждение scope за сессию (включая Владимирские правки)

| taskId | Confirmed model via SQL |
|---|---|
| `simply` (simply-chat) | grok-4-1-fast-non-reasoning ✅ (было из XAI-3) |
| `clerk:file-analyzer` | grok-4-1-fast-non-reasoning ✅ (3 calls) |
| `util:title` (as `util:auto-naming`) | grok-4-1-fast-non-reasoning ✅ |
| `briefing:filter` | grok-4-1-fast-non-reasoning ✅ |
| `memory:extract` | grok-4.20-0309-non-reasoning (на момент теста, до Владимирского variant switch) |
| `project:expert` | grok-4.20-0309-non-reasoning (через dev override в проекте) |
| `professor:planner` | grok-4.20-0309-non-reasoning (hot-fix plan route + dev override) |
| `expertise` (override) | grok-4-1-fast-non-reasoning (в тестовом режиме через dev override) |
| `briefing:author` empirical test | grok-4.20-0309-non-reasoning (через dev override для URL hallucination test) |
| `service:briefing-onboarding` | claude-sonnet-4-6 (вне scope) |
| `service:project-manager` | claude-haiku-4-5 (вне scope) |
| `service:project-creation` | claude-sonnet-4-6 (вне scope) |
| `artifact:markdown` | claude-sonnet-4-6 (вне scope, остался) |

Не триггерились в тесте: `clerk:task-summary`, `util:project-summary`, `util:artifact-suggestions` — но scope принят Владельцем (Gate C Вариант A).

### Hot-fix 1: plan/route.ts (commit `d9d3488`)

**2 pre-existing бага в одном месте** — обнаружены во время тестирования professor:planning с 3× 187s timeout.

**Баг 1:** `app/(chat)/api/projects/[id]/plan/route.ts` не импортировал `@/lib/ai/model-overrides-node` → dev override `professor:planning → Haiku` молча игнорировался → все 3 попытки шли на Opus. **Identical `bytesWritten=20223` в 3 попытках** = deterministic, не сеть/VPN.

**Баг 2:** Claude Opus 4.6 `maxOutputTokens` по умолчанию = **128_000** (из `@ai-sdk/anthropic/dist/index.mjs:4544` + `model-catalog.ts:254`). 128K легитимно (Anthropic поднял с 32K → 128K 2026-04-12), но **Anthropic требует streaming для `max_tokens > 21333`** (docs.anthropic.com/en/api/errors#long-requests). `generateText` non-streaming → first chunk не успевает за 60s fetch timeout → socket close × 3 retry = 180s fail.

**Фикс:** 1 import line + `maxOutputTokens: 16000`. После этого + override на Grok 4.20 non-reasoning: планирование прошло за 26.6s / $0.028.

**Бонусная валидация:** Grok 4.20 non-reasoning справился с multi-step reasoning + structured JSON output на professor:planning task. Это повлияло на Владимирский IDE edit `simply-chat-think` на reasoning variant — empirical данные о способностях Grok 4.20 reasoning в multi-step задачах.

### Hot-fix 2: briefing routes (commit `<this>`)

Та же архитектурная дыра в 3 briefing backend routes:

- [app/(chat)/api/briefing/generate/route.ts](../../app/(chat)/api/briefing/generate/route.ts)
- [app/(chat)/api/briefing/refresh-section/route.ts](../../app/(chat)/api/briefing/refresh-section/route.ts)
- [app/api/cron/briefing/route.ts](../../app/api/cron/briefing/route.ts)

Ни один не импортировал `model-overrides-node` → override для `briefing:author` в dev panel игнорировался. Это блокировало empirical test альтернативной модели (был бы фейковый тест).

**Фикс:** по 1 import line в каждый. После этого override `briefing:author → grok-4.20-0309-non-reasoning` сработал, SQL подтвердил, empirical данные получены.

**Известная global issue:** `_archive/TZ_DeadModelSelectors/FINDINGS.md:36` говорит «reader в 4 местах». Hot-fix Этапа 2 закрыл 4 места (plan + 3 briefing). `app/(chat)/api/service-chat/route.ts` **точно не имеет** (grep подтвердил). Нужен глобальный audit — хвост `TZ_DevOverridesSideEffectImportAudit` на Этапе 4.

### Empirical test briefing:author — модель НЕ решает URL hallucination (важно!)

**Симптом:** DevPanel Pipeline Trace показал **10 из 11 URL в статье как Fabricated** (MiniMax).

**Моя ошибочная первая диагностика:** написал «это MiniMax-specific weakness на structured URL attribution». **Владелец немедленно поправил:** «эту роль раньше выполняли Sonnet и Gemini — они тоже галлюцинировали, именно поэтому метрика `fabricated` была добавлена как детектор в принципе, не model-specific».

**Empirical test (возможен благодаря hot-fix briefing routes):**

| Run | Модель | Duration | Cost | Fabricated |
|---|---|---|---|---|
| 19:06 | MiniMax-M2.7 | 137.3s | $0.010 | **10/11 (91%)** |
| 19:16 | grok-4.20-0309-non-reasoning | **15.6s** | $0.044 | **9/11 (82%)** |

Marginal 9% улучшение при 4.4× цене. Plus Sonnet и Gemini исторически тоже. **4 разные модели (Sonnet, Gemini, MiniMax, Grok 4.20) одинаково плохо** — это не model issue, это architectural (prompt + presentation + lack of schema enforcement).

**Новое правило в memory** (`feedback_empirical_test_before_model_blame.md`): не диагностировать AI-output проблему как «model weakness» без empirical теста на 2+ моделях.

**Хвост:** [TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md) **High impact**. Рекомендованное решение — **structured output через `generateObject` с `z.enum([...allowedUrlsFromFilter])`** (URL физически не могут быть сгенерированы вне списка). 1-2 сессии.

### 4 новых хвоста в backlog (все найдены в этой сессии, все pre-existing)

1. 🟥 **[TZ_BriefingAuthorUrlHallucination](../_backlog/TZ_BriefingAuthorUrlHallucination.md)** — 82-91% fabricated URLs, architectural, empirical confirmed across 4 models
2. 🟧 **[TZ_ServiceChatNotOverridable](../_backlog/TZ_ServiceChatNotOverridable.md)** — 3 дыры: UI coverage + backend import gap + docs briefing-onboarding/pipeline confusion
3. 🟧 **[TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md)** — DevPanel footer скрывает nested subcalls cost
4. 🟧 **[TZ_TaskExpertChatInputMissingOnFirstOpen](../_backlog/TZ_TaskExpertChatInputMissingOnFirstOpen.md)** — useChat state bug, требует hard reload

Плюс **3 запланированных хвоста** для создания на финализации (после полного audit'а):
- `TZ_DevOverridesSideEffectImportAudit` — global audit backend routes
- `TZ_ProfessorPlanStreaming` — переход plan route на streamText (long-term fix max_tokens timeout)
- `TZ_MaxOutputTokensAudit` — явный `maxOutputTokens` для всех generateText/streamText вызовов

### Уроки этой сессии для серии

1. **xAI prompt caching автоматически** (смола тест streamObject, 160/405 tokens cached без `providerOptions.xai.cacheControl`). Не нужна ручная настройка, сервер кэширует system prompt сам.
2. **Grok 4.20 reasoning = сильная модель для multi-step tool-calling** — подтверждено empirically на professor:planning, project:expert, briefing:author. Этот empirical bar повлиял на Владимирские IDE edits `simply-chat-think` и `memory:extract` на reasoning variants.
3. **Override mechanism global gap** — не все backend routes импортируют reader. Требует systemic audit + архитектурное решение (middleware? auto-register? instrumentation.ts?). Хот-фикс закрыл 4 routes, но это не решение a-la-permanent.
4. **Empirical test перед model-blame** — новое правило в memory. Sonnet/Gemini/MiniMax/Grok 4.20 все 4 одинаково плохо справляются с URL attribution = архитектура, не модели.
5. **Scope consolidation snap** — весь session закрылся 3 коммитами по паттерну v3.91.0: feat(scope) + fix(hot-fix) + docs(backlog). Плюс session-closing commit с Владимирскими IDE edits и NOTES entry. HANDOFF отдельно.
6. **Документация ≠ SSOT** — Владимир добавил в `ai-chats-map.md` header warning что правда в коде. Правильный architectural stance для быстро меняющихся mapping-документов.
7. **Scope expansion в IDE** — Владелец как product owner может расширить scope ТЗ напрямую в коде, обходя формальные этапы, когда empirical данные дают достаточно уверенности. Scope ТЗ-XAI-4 после Этапа 2+3 расширился с 7 точек на ~12 реально изменённых taskIds.

---

## 2026-04-16 — ТЗ-XAI-4 Этап 1: streamObject smoke test PASSED (Grok 4.1 Fast)

**Контекст:** В ANALYSIS обсуждения по ТЗ-XAI-4 вылез риск для `util:artifact-suggestions` — это единственная точка в scope ТЗ, которая использует **`streamObject` с `output: "array"` mode** ([lib/ai/tools/request-suggestions.ts:49](../../lib/ai/tools/request-suggestions.ts#L49)). docs.x.ai заявляет «structured outputs», но явно не специфицирует streamObject array mode в AI SDK v6. Решение — изолированный smoke test до любых правок task-assignments (Rule №0 «семь раз отмерь»).

### Результат: PRIMARY PASS на первой попытке

**Тест:** [scripts/test-grok-streamObject.ts](../../scripts/test-grok-streamObject.ts) (удалён после прохождения per паттерн v3.91.0)

**Схема — копия реальной из requestSuggestions:**
```ts
z.object({
  originalSentence: z.string(),
  suggestedSentence: z.string(),
  description: z.string(),
})
```

**Prompt:** короткий текст с 4 грамматическими ошибками (grew/grown, has/have, is make/is to make, did/achieved).

**Результат через `registry.languageModel("xai:grok-4-1-fast-non-reasoning")`:**
- ✅ `elementStream` yielded **4 элемента**, все 4 — корректные исправления грамматики
- ✅ Все элементы прошли Zod `safeParse` без ошибок
- ✅ `usage` promise резолвится: `inputTokens: 405`, `outputTokens: 210`, `totalTokens: 615`
- ✅ Duration: **3304ms** (приемлемо для UX streaming)

### Бонусная находка: xAI делает prompt caching автоматически

В usage resolved объекте увидели:
```
cachedInputTokens: 160
inputTokenDetails: { noCacheTokens: 245, cacheReadTokens: 160 }
```

Из 405 input tokens **160 закэшированы автоматически** на стороне xAI — без каких-либо `providerOptions.xai.cacheControl` с нашей стороны. Это поведение сервера, не клиентская оптимизация. В `request-suggestions.ts` text документа + system prompt частично хитятся при последующих вызовах в пределах окна провайдера.

**Следствие:** усилия на explicit caching для xAI в нашем коде — не нужны. Сервер сам кэширует повторяющийся system prompt. Заметно упрощает миграцию (не надо тянуть `cacheReadTokens` в `logUsage`, он просто доступен в usage объекте как есть).

**TODO backlog:** возможно добавить логирование `cachedInputTokens` в `ai_usage_log` для xAI-моделей, чтобы `/admin/cost-audit` видел реальную стоимость с учётом caching. Это отдельная задача, вне scope ТЗ-XAI-4.

### Решение для Этапа 2

- `util:artifact-suggestions` → `grok-4-1-fast-non-reasoning` (**primary, не fallback**)
- Q-A fallback (Вариант 3 — Grok 4.20) не потребовался
- Scope ТЗ-XAI-4 остаётся 7 точек без изменений
- Этап 2 можно запускать с confidence

### Урок для серии

**streamObject array mode на xAI работает out-of-the-box через AI SDK v6.** Для будущих ТЗ серии (XAI-5: create + expertise, XAI-6: cleanup) — аналогичные `streamObject` вызовы миграции не должны требовать smoke test. ТЗ-XAI-2 подтвердил `generateObject` (MIND pipeline), ТЗ-XAI-4 подтвердил `streamObject` (request-suggestions). Структурированные outputs через AI SDK v6 xAI provider — проверенный паттерн.

**Memento:** если в будущем смотреть на docs.x.ai и видеть только «structured outputs» без упоминания `streamObject` — это нормально. AI SDK v6 xAI provider реализует весь spectrum structured output APIs (generateObject, streamObject с object/array modes) через base Chat Completions + JSON mode.

---

## 2026-04-16 — ТЗ-ATTACH-1 завершён (v3.91.0)

**Что сделано кратко:** Слой 0 из SIMPLY_ATTACHMENT_ARCHITECTURE.md реализован для PDF. Текстовые PDF извлекаются через pdf-parse v2 в `text/plain` при upload, сканы остаются как `application/pdf` → Haiku. Shared helper `lib/pdf/extract-pdf-text.ts` + интеграция в upload route + починка сломанного v1-API legacy call в project files route.

### Решения по 5 открытым вопросам (все ответы от Владимира в один шаг)

Q1 pdf-parse v2 — уже установлена, mehmet-kozan pure TS rewrite с breaking API change от v1 → v2 (`new PDFParse({data}).getText()`). Prior к этому ТЗ [projects/[id]/files/route.ts:86-96](../../app/(chat)/api/projects/[id]/files/route.ts#L86) использовала **v1 signature на v2 package** → `pdfParse(buffer)` как function call на класс → throw → silent catch → `metadata.extractedContent` всегда undefined → **месяцы молчаливой деградации**. Нашлось во время ANALYSIS, починено в том же коммите (Q5 решение = A).

Q2 эвристика — `pageCount >= 2 ? avgCharsPerPage < 30 : text.length < 100`. Специальный случай для 1-page потому что avg на одной странице ненадёжен. Порог 30 chars/page как старт, логирование для эмпирической калибровки.

Q3 truncate — 200 KB (~50K chars) симметрично project files cap. **Маркер обрезания показывается только если реально обрезали** — Владимир прямо указал «не пугать пользователя на 90% документов». 45K документ проходит без маркера, 110K — с ним.

Q4 encrypted/corrupt — graceful catch → fall-through на native PDF upload → Haiku нативно. Без red errors в UX.

Q5 чинить project files в этом же ТЗ — Владимир выбрал A (связанный scope). Обоснование: обе проблемы (новая PDF extraction + сломанный v1 call) — один клубок «capability-agnostic PDF upload», разделение на два коммита удвоило бы тесты без пользы.

### Серия багов в процессе реализации — три разных webpack/ESM мины

**Мина 1: `import { PDFParse } from "pdf-parse"` top-level → crash.** pdf-parse v2 `type: "module"` ESM-first. Next.js RSC webpack bundler пытается статически проанализировать named imports и падает с `Object.defineProperty called on non-object` при eval модуля на первом запросе. Dev server не красный флажок на build, ломается только в runtime первой загрузки.

**Мина 2: `await import("pdf-parse")` dynamic import тоже crash.** Переделал helper на паттерн проекта (mammoth/xlsx style): dynamic import внутри async функции. Логика: webpack не бандлит статически → резолвит на runtime. **Не помогло.** Webpack всё равно пытается включить pdf-parse в bundle даже через dynamic import и ломается на тех же internals. Ошибка та же, но теперь поймана try/catch в upload route → graceful fallback на Haiku → **вылез Second Hand Crash**.

**Мина 3 (уже pre-existing, не моя):** graceful fallback отправил PDF на Haiku как native → Haiku API `A maximum of 100 PDF pages may be provided` → AI_APICallError → стрим onError → UI висяк без ошибки. Pre-existing gap в UX защите для больших scan-PDF. Не блокер v3.91.0, но зафиксирован как edge case в NOTES: 100+ page scan PDF → Haiku crash. Защита добавляется либо cap в upload route, либо `adaptHistoryToCapabilities` check на page count в Haiku branch — отдельный stage/ТЗ.

### Правильный фикс — `serverExternalPackages`

Решение — добавить `"pdf-parse"` в `serverExternalPackages` в `next.config.ts` рядом с `lamejs` (который уже там по той же причине). Это говорит Next **не бандлить вовсе**, резолвить через Node `require` на runtime. После этого **top-level static import снова работает** — webpack видит package external, пропускает.

**Урок:** `mammoth`/`xlsx` паттерн «dynamic import внутри функции» работает только для CJS packages или ESM-lite. Для полноценных ESM packages с worker-dependencies (как pdf-parse v2 который тянет `pdfjs-dist/legacy`) — нужен именно `serverExternalPackages`. Я потратил одну итерацию на неверное предположение что dynamic import универсален.

### Stale .next cache → DevPanel пропал

После цикла правок next.config.ts + kill -9 dev server + restart, при тестах на уже рабочей реализации Владимир заметил что **DevPanel footer перестал показываться** под новыми сообщениями (старые сообщения сохраняли footer из localStorage). Симптом: visually DevPanel «исчез» после моих последних изменений.

Root cause — **stale webpack chunks в `.next/`**. Серия restart с изменяющейся конфигурацией оставила в кэше частично невалидные manifests/chunks. Client bundle был частично pre-my-changes, серверный — post. В логах все Chat API calls были 200 OK, emit через dataStream тоже происходил, но client-side парсер batches либо не запускался, либо крашился тихо на десериализации, которую я не мог увидеть без F12.

**Фикс:** `rm -rf .next/` + `npm run dev` с нуля + hard reload в браузере. Всё вернулось. Multi-PDF в одном сообщении тоже работает.

**Урок:** после изменения `next.config.ts` (особенно `serverExternalPackages`, `env`, `outputFileTracingIncludes`) — **обязательно** чистый rebuild. Dev server HMR не пересобирает эти секции чисто, оставляет скрытый state drift. Правило в backlog не фиксирую как «блокер», но держу в голове как default при любой будущей next.config правке.

**Анти-паттерн который я чуть не сделал:** в момент паники про пропавший DevPanel я начал читать client-side код `dev-panel-provider.tsx` → `parseBatches` → `debug-events.ts` в поиске регрессии моего кода. Ничего там не менялось, и грепы подтвердили что регрессии нет. **Правильная эскалация была простая** — `rm -rf .next && restart`, проверка 30 секунд, которая либо доказывает либо исключает cache. Сделал бы это первым — сэкономил бы шаг чтения кода.

### Scope consolidation — правильный выбор (опять)

Два разных бага в одном ТЗ (новая PDF extraction + фикс project files v1→v2) — скоуп-консолидация снова окупилась. Разделение: два коммита, два мануальных теста, два CHANGELOG-записи, разная user-invocation. Связанный скоуп: один helper, один commit, один тест, одна история. Паттерн работает когда обе задачи по сути одна инженерная идея (здесь — «все PDF идут через SSOT extractor»).

### Связь с архитектурным документом

v3.90.2 закрыл history adaptation через `adaptHistoryToCapabilities` (Decision 3). v3.91.0 закрыл upload extraction через Слой 0 (Decision 4). Вместе они дают **capability-agnostic через SSOT** для всей attachment зоны: и upload pipeline, и history pipeline читают capabilities из model-catalog и не знают про конкретные модели/провайдеры. Следующее место где SSOT нужен — routing layer (`simply-chat` vs `simply-chat-vision` taskId selection) — там всё ещё есть хардкод на типы. Но это уже ТЗ-XAI-5 или отдельное.

---

## 2026-04-15 — ТЗ-XAI-3 завершён (v3.90.0)

**Что сделано кратко:** KITT + Think перешли на xAI Grok (4.1 Fast + 4.20 соответственно), удалено 80 строк R-6 зоопарка strip-функций, зафиксированы два backlog-айтема (error recovery UI, readDocument tool quality).

### Расширение scope: Think тоже в XAI-3

Первоначальный план (до сессии): XAI-3 трогает только `simply-chat`, Think уходит в XAI-5. Владимир поймал мою экономически-слабую логику: «а зачем Sonnet на переходный период? Мы же только тестируем, никаких продуктивных задач не решаем, зачем жечь деньги». Правильный довод. Scope расширен: Think default → `grok-4.20-0309-non-reasoning` прямо в XAI-3. ТЗ-XAI-5 сузилось до Create + Expertise + R-5.

### Variant A vs B для Think: принят A (non-reasoning)

Из двух вариантов `grok-4.20-0309-non-reasoning` vs `grok-4.20-0309-reasoning` Владимир выбрал **A**. Обоснование продуктовое: пользователь нажимает «Думать» → ожидает умный ответ, а не UX-паузу с bubble «модель размышляет». Мгновенный умный ответ > отложенный умный ответ. Variant B остаётся доступным через `/dev/models` без коммита — если после эксплуатации захочется dramaturgy паузы, одна запись в override файле.

**Подтверждение на smoke-тесте:** Владимир после Think-теста написал «разница была невероятно крутая». Non-reasoning вариант даёт достаточно ощутимый tier upgrade от 4.1 Fast без добавления reasoning paused tokens.

### Compaction/caching блоки — живы для Haiku vision, не трогаем

Владимир спросил «что за проблема в Compaction/prompt caching блоках, почему ты их не трогаешь». Объяснение пошло по-человечески без жаргона: эти фичи — Anthropic-специфичные, мы включаем флажки через `providerOptions.anthropic.*`, xAI их игнорирует (как китайская открытка в русском письме). Но они **живы для vision-маршрута** — simply-chat-vision всё ещё использует Haiku 4.5, для которого эти фичи дают реальную экономию (кэшированный системный промпт ~3000 токенов не оплачивается на каждый photo-запрос). Удаление этого блока возможно **только когда vision уйдёт с Claude полностью** — это ТЗ-XAI-6 или отдельное решение.

Владимир согласился: «мы теперь не используем автоматическое сжатие из коробки от Anthropic для Grok, но оно работает для Haiku — ок, не трогаем».

### Регрессия на шаге 5 — урок про дубликат функции

Первый Think-тест упал с `AI_UnsupportedFunctionalityError: 'file part media type text/plain' functionality not supported`. Root cause двойной:

1. `saveMessages` сохраняла оригинальные `message.parts` (с file part для text/plain), а не уже-сконвертированные `processedMessage.parts`. Баг существовал давно — но маскировался тем что под Sonnet (think default) Anthropic принимал file parts. Grok не принимает → баг вылез
2. Моя initial `inlineTextFileParts` была **дубликатом уже существующей `convertTextFilesInAllMessages`** в том же файле. Diagnostic hint `"declared but never read"` про готовую функцию был прямо перед глазами при каждом Edit — я его проигнорировал как "pre-existing noise". Оказалось это готовый async helper который умеет fetch'ить Vercel Blob URL → инлайнить text content. Моя самодельная функция проверяла `typeof p.text === "string"` которое не срабатывало для rehydrated из БД parts (у них был только `.url`, не `.text`)

**Фикс (30 минут debug):**
- Удалён мой дубликат
- `preparedHistory` → `await convertTextFilesInAllMessages(cleanedHistory)` (async переход через await)
- `saveMessages` → `processedMessage.parts` + `estimateMessageTokens(processedMessage.parts)`

**Правило на будущее (зафиксировать в feedback memory?):** при добавлении helper'а в целевой файл — grep на типовые имена функций + **внимательно** смотреть diagnostic hints про `"declared but never used"`. Они часто указывают на готовый dead-but-useful код. Выигрыш 2 минуты grep + 2 минуты анализа hint = экономия 30 минут debug.

### Процессный урок — дисциплина бэклога

Владимир поднял **9-кратный** упрёк про проблему «error state в useChat блокирует следующее сообщение, нужна перезагрузка страницы». Каждый раз обещано «починим», не чинилось, воспроизводилось. Это **не забывчивость, а системный фейл дисциплины бэклога** — проблема откладывалась устно без записи → забывалась.

Исправлено: создан [specs/_backlog/TZ_ErrorRecoveryUI.md](../_backlog/TZ_ErrorRecoveryUI.md) **прямо в сессии**, до технического фикса регрессии. Внутри — история, стадии, Владимир'ов минимальный фикс как Stage 1 («показать в красном флаге текст про перезагрузку страницы»), root cause как Stage 2.

**Правило на будущее:** любая повторяющаяся не-блокер-проблема = немедленно в backlog, даже если фикс откладывается. Устные «потом починим» = сигнал к немедленной backlog-записи.

### xAI implicit caching — приятный бонус

На MIND retrieve тесте DevPanel показал `Cache read: 6520 tokens` при `Input (fresh): 300`. Это **implicit cache у xAI** — OpenAI-совместимые провайдеры эмитят `prompt_tokens_details.cached_tokens` автоматически без нашей конфигурации. Мы отказались от Anthropic cache через `isAnthropicProtocolModel` гейт под Grok, но xAI даёт свой кэш **бесплатно и автоматически**. Наш cost calculator (`extractUsageForPricing`) уже парсит это поле и применяет cached pricing ($0.05/1M вместо $0.20/1M). Итоговая стоимость запроса ₽0.04 отражает экономию.

Не требует никаких правок — просто наблюдение которое хорошо документировать.

### `readDocument` tool путает Grok с attached файлами

На смоук-тестах 4 и 4b Grok вызывал `readDocument` tool на имя attached файла (`API_CHANGES.txt`, `test-valenok.txt`), получал `Access denied: Only files in knowledge/ directory can be read`, но параллельно инлайн-содержимое файла уже было в промпте → ответ всё равно корректный. Quality issue tool-selection у Grok, не блокер миграции.

Backlog: [TZ_SimplyReadDocumentTool.md](../_backlog/TZ_SimplyReadDocumentTool.md). Три подхода: (а) убрать из active tools для simply, (б) научить tool различать knowledge/ vs attached, (в) правка промпта. Решение — в отдельной сессии после серии Simply_xAI.

---

## 2026-04-14 — Workflow серии: три документа вместо шести локальных CHANGELOG

Владимир: предложил один CHANGELOG на всю серию миграции вместо локальных `CHANGELOG.md` внутри каждой папки `TZ_xai_N/`. Для одиночных ТЗ локальный changelog избыточен (есть глобальный проектный), а для серии из 6 ТЗ ценность факт-листа высока: передача смены, оформление документации, аудит без перебора commit history.

**Принятое решение:** три документа на всю серию, не на каждое ТЗ:
- `SIMPLY_XAI_ROADMAP.md` — forward-looking план (живой)
- `SIMPLY_XAI_CHANGELOG.md` — что реально сделано per ТЗ (append-only факт-лист) ← **новый**
- `SIMPLY_XAI_NOTES.md` — почему решили так (append-only лог решений)

Локальных `CHANGELOG.md` внутри `TZ_xai_N/` папок **не создаём** — дублирование ухудшает читаемость серии. В папке ТЗ остаются только SPEC / ANALYSIS / ROADMAP.

**Это нарушение стандартного шаблона `specs/_template/`** (там есть `CHANGELOG.md` и `HANDOFF.md` на каждое ТЗ) — но для серии эти файлы агрегируются вверх. Стандартный шаблон применяется к одиночным ТЗ без изменений.

**Workflow будущего Claude Code при входе в серию:**
1. `SIMPLY_XAI_CHANGELOG.md` (5 сек → знает что уже сделано)
2. `SIMPLY_XAI_ROADMAP.md` прогресс-таблица (5 сек → знает что следующее)
3. `SIMPLY_XAI_NOTES.md` последние 2-3 записи (30 сек → понимает контекст)
4. `TZ_xai_N/ANALYSIS.md` + `ROADMAP.md` текущего ТЗ (1 мин → детали)

---

## 2026-04-14 — Кнопка «Думать» в Simply Chat — продуктовая семантика

Владимир уточнил смысл кнопки «Думать» — я был неправ в своём последнем объяснении, когда интерпретировал её как «переключение reasoning режима той же модели».

**Правильное понимание:**
- **Без кнопки** → дефолтная модель (после миграции: `grok-4-1-fast-non-reasoning`, $0.20/$0.50 per 1M)
- **С кнопкой** → сильная модель (после миграции: Grok 4.20, $2/$6 per 1M — в 10 раз дороже, заметно сильнее)

Это **тировый апгрейд модели**, не технический reasoning mode. Имя «Думать» — продуктовая метафора для пользователя («используй умную модель»).

**Зачем так:** пользователь сразу видит разницу в качестве ответа, value proposition кнопки очевиден.

**Открытый вопрос (решим при старте ТЗ-XAI-5):** какой вариант Grok 4.20 для кнопки «Думать»?
- **A. `grok-4.20-0309-non-reasoning`** — чистый tier upgrade, быстрый ответ, только input/output токены
- **B. `grok-4.20-0309-reasoning`** — tier upgrade + физическое чувство паузы на reasoning, дополнительно тратит reasoning tokens (по ставке output, $6/1M)

Оба стоят одинаково за input/output. Разница в дополнительных reasoning tokens у варианта B + в UX (пользователь видит задержку «модель думает» у B, практически мгновенный ответ у A).

**Зафиксировано в памяти:** `project_think_button_semantics.md` — чтобы будущий Claude Code не интерпретировал кнопку как reasoning toggle.

---

## 2026-04-14 — Verified Grok parameter reference (источник правды для всех ТЗ серии)

Сводка проверенных параметров xAI Grok моделей. Используем как SSOT при планировании и реализации любого ТЗ серии Simply_xAI. Опровергнутые утверждения (в том числе из внешних AI-консультаций и брейнсторма) помечены явно.

### Семейства моделей и их варианты

| Family | Reasoning variant | Non-reasoning variant | Multi-agent variant |
|---|---|---|---|
| Grok 4.20 | `grok-4.20-0309-reasoning` | `grok-4.20-0309-non-reasoning` | `grok-4.20-multi-agent-0309` |
| Grok 4.1 Fast | `grok-4-1-fast-reasoning` | `grok-4-1-fast-non-reasoning` | — |

### providerOptions для AI SDK v6 `@ai-sdk/xai`

| Параметр | Reasoning variant | Non-reasoning variant | Multi-agent variant |
|---|---|---|---|
| `xai.reasoningEffort: "low" \| "high"` | ❌ **Bad Request** (empirical 2026-04-14) | ❌ **Bad Request** (empirical 2026-04-14) | ✅ Принимает `low/medium/high/xhigh` — управляет числом агентов (low/medium = 4, high/xhigh = 16) |
| `temperature` (0–2) | ✅ | ✅ | ✅ |
| `top_p` | ✅ | ✅ | ✅ |
| `presence_penalty` | ❌ не поддерживается reasoning-моделями | ✅ | ❌ |
| `frequency_penalty` | ❌ не поддерживается reasoning-моделями | ✅ | ❌ |
| Автоматические reasoning tokens в `usage.outputTokenDetails.reasoningTokens` | ✅ emitted без конфигурации (empirical: ~93 tokens на простом тесте) | `0` | ✅ |

### Эмпирический тест 2026-04-14 (через @ai-sdk/xai напрямую)

Скрипт `scripts/test-grok-reasoning-effort.ts` (удалён после, одноразовый). 4 вызова × минимальный промпт «2+2=?»:

```
1. grok-4-1-fast-reasoning     БЕЗ reasoningEffort  → ✅ text="4", in=166, out=94, reasoning=93
2. grok-4-1-fast-reasoning     С reasoningEffort    → ❌ Bad Request
3. grok-4-1-fast-non-reasoning БЕЗ reasoningEffort  → ✅ text="4", in=178, out=1,  reasoning=0
4. grok-4-1-fast-non-reasoning С reasoningEffort    → ❌ Bad Request
```

**Заключение:** формулировка docs.x.ai «`reasoning_effort` is not supported by `grok-4.20` or `grok-4-1-fast`» означает **целые семейства** (оба варианта). Чтобы настроить глубину reasoning — **нет способа** для этих моделей. Либо принимаешь автоматический reasoning, либо берёшь non-reasoning variant.

### Опровергнутые утверждения

| Источник | Утверждение | Реальность |
|---|---|---|
| BRAINSTORM_GrokMultiAgent.md §10.1 | «Reasoning-варианты grok-4.20 и grok-4.1 Fast принимают `reasoning.effort: low/medium/high`» | ❌ Empirical: оба варианта возвращают Bad Request |
| Внешняя AI-консультация | «`presence_penalty = 0.1` для KITT / `frequency_penalty = 0.2` для «Создать»» | ❌ Для reasoning-моделей параметры не работают. Для non-reasoning работают, но эмпирический эффект не проверен |
| Внешняя AI-консультация | «Имена агентов Harper/Benjamin/Lucas/Grok-капитан с ролями креатив/аналитика/проверка/синтез» | ❌ Галлюцинация. В docs.x.ai таких имён и ролей нет — только абстрактные «leader agent» и «sub-agents» |
| BRAINSTORM §10.1 | «`max_tokens` до 30 000 для Grok 4.20» | ❌ Не подтверждено. `max_tokens` deprecated → `max_completion_tokens`. Потолок в docs.x.ai не раскрыт. Каталог держит 16K как консервативный дефолт |

### Следствия для ТЗ серии

- **ТЗ-XAI-2 (MIND → grok-4-1-fast-non-reasoning):** не передавать `reasoningEffort`, `presence_penalty` и `frequency_penalty` можем использовать но незачем
- **ТЗ-XAI-3 (KITT + Think):** simply-chat → non-reasoning, simply-chat-think → reasoning; в обоих случаях **не передавать** `reasoningEffort` — кнопка «Думать» просто использует reasoning-variant, глубина reasoning'а автоматическая
- **ТЗ-XAI-5 (Create/Expertise):** та же история — не передаём `reasoningEffort`
- **ТЗ-XAI-MA-1 (будущее):** multi-agent variant — единственное место где `reasoningEffort` валиден; `low/medium` = 4 агента, `high/xhigh` = 16

### Уроки методологии

1. **Брейнсторм от AI-модели — черновик**, не спецификация. Даже если в нём есть секция «verified against docs» с цитатами — цитаты могут быть вырваны из двусмысленного контекста
2. **Эмпирический тест за $0.01 спасает недели** неправильного ТЗ. 30 секунд в терминале > долгий спор с документацией
3. **Ирония:** брейнсторм в §10.2 корректно разоблачил галлюцинации про имена агентов и `presence_penalty`, но в §10.1 допустил аналогичную ошибку про reasoning-варианты. Никто не застрахован от собственных blind spots

---

## 2026-04-15 — ТЗ-XAI-2 завершён (v3.89.0)

**Split strategy для MIND:** Владимир поймал мою лень в первоначальной оценке (я предложил все 5 задач на Grok 4.1 Fast, ссылаясь на IFBench флагмана). Ответил корректно: «нельзя приписывать рейтинги 4.20 модели Fast; извлечение фактов это не простая задача». Принятая стратегия: mission-critical `memory:extract` на сильной Grok 4.20, механические задачи на Grok 4.1 Fast. Экономия vs Sonnet ~15× при сохранении качества входа в память.

**Native generateObject на xAI подтверждён** — smoke test 2 кейсов (базовая schema + `.nullable()` поле) оба прошли. Бонус-рефакторинг `batchExtractFacts` и `runConsolidation` возможен: убрали legacy `generateText + JSON.parse + Zod` workaround, заменили на native `generateObject`. Удалилось ~28 строк legacy парсинг-логики.

**End-to-end smoke test через Simply Chat (5 сообщений при временно пониженных EXTRACT_THRESHOLD_SOFT=0.001, EXTRACT_PAUSE_MS=0):**
- 13 фактов извлечено Grok 4.1 Fast, 10 active + 3 superseded
- Dedup-verify на русском работает: semantic match «работает над проектом Simply» ≈ «разработчик приложения Simply» (similarity 0.715)
- Категоризация корректная (`fact/decision/preference/task`), confidence 0.8-1.0
- Возврат к production defaults (0.6 / 10 мин) перед коммитом

**Side-effects от тестирования:**
1. `getOrCreateSimplyChat` race condition (SELECT+INSERT без unique constraint) — проявился после `TRUNCATE CASCADE` тестовой БД. 3 параллельных запроса из дашборда создали 3 simply chats. Зафиксирован в [specs/_backlog/TZ_SimplyChatRaceCondition.md](../../specs/_backlog/TZ_SimplyChatRaceCondition.md) — чиним после завершения серии Simply_xAI, строгий фокус держим
2. **One-message lag** в Simply Chat MIND extract подтверждён Владимиром как known behavior (не баг). Причина: `batchExtractFacts` вызывается до `saveMessages` в том же request handler'е → messagesFromDb не содержит текущую пару. Зафиксировано в [MIND_ARCHITECTURE.md §2](MIND_ARCHITECTURE.md) — чтобы будущие сессии не гонялись за несуществующим багом

**Что НЕ было живьём проверено (и почему):**
- `memory:extract` (Grok 4.20) — в simply chatMode отключён by design (ТЗ-MinimaxCleanup v3.77.0). Триггерится в expertise/create/project, проверится при обычной эксплуатации
- `memory:consolidate` и `memory:profile` event chain не дошёл до ≥10 фактов подряд за один batch extract — проверится при нормальной нагрузке или через test script по сценариям C/D в MIND_ARCHITECTURE.md

**Защита через /dev/models:** любой из 5 memory-taskId можно переключить на другую модель через switchboard за секунды, без коммитов. Defaults в task-assignments — стартовые точки, не финальный выбор. Это снимает давление «правильного выбора» в момент миграции.

**Workflow новшества подтверждены:**
- Smoke test перед рефакторингом — must-have (повторил паттерн ТЗ-XAI-1 с reasoningEffort)
- Очистка dev-БД перед живым тестом — полезно (даёт чистый сигнал работает/не работает), но надо учитывать что это обнажает скрытые race conditions (см. R-5)
- MIND_ARCHITECTURE.md как living reference — инвестиция на всю серию, не одноразовый артефакт

---

## 2026-04-14 — ТЗ-XAI-1 завершён (v3.88.0)

**Что сделано:**
- Удалена deprecated запись `grok-4` из `lib/ai/model-catalog.ts` (SQL-аудит подтвердил 0 исторических записей в ai_usage_log)
- Обновлён header xAI секции каталога — зафиксировано архитектурное решение что `contextWindow` задаётся под рабочий бюджет качества, не под провайдерский потолок
- Добавлены `notes` на `grok-4.20-multi-agent-0309` — multi-agent variant не поддерживает client-side function calling через Chat Completions, expertise будет переключён в ТЗ-XAI-5
- Обновлены `docs/ai-providers.md` и `docs/model-catalog-ops.md`
- Закрыт backlog `TZ_GrokContextWindowAudit` (перемещён в `specs/_backlog/_archive/`)
- Обновлены `SIMPLY_STATUS.md` и `CHANGELOG.md`

**Что НЕ сделано (и почему):**
- `contextWindow` у xAI записей НЕ изменён — 256K/128K заведомо больше рабочего бюджета 140K, провайдерский потолок архитектурно иррелевантен
- Эмпирический тест контекста НЕ проведён — отменён как отвечающий на неправильный вопрос
- `task-assignments.ts` НЕ тронут — переключение taskId это ТЗ-XAI-2+

**Валидация:**
- `npx tsc --noEmit` — 0 ошибок
- `grep grok-4` по коду — нет живых ссылок
- `grok-4` в SQL-аудите ai_usage_log — 0 записей

**Следующий шаг:** ТЗ-XAI-2 — MIND pipeline (5 call sites в `lib/ai/memory/*`) переключить на Grok 4.1 Fast non-reasoning. Бонус-рефакторинг: 2 call sites (`batchExtractFacts`, `runConsolidation`) сейчас используют `generateText + JSON.parse + Zod` как MiniMax workaround — под Grok можно переписать на native `generateObject`.

---

## 2026-04-14 — Новая схема работы: без внешнего архитектора

Владимир: внешний архитектор делает много ошибок, а в WORKFLOW мы часто воспринимаем написанные ТЗ как источник правды и просто внедряем. Этого больше не делаем.

**Новая схема:**
1. Владимир словами описывает цель
2. Claude Code читает код + документацию → пишет ANALYSIS.md
3. Владимир отвечает на вопросы, корректирует допущения
4. Claude Code пишет SPEC и ROADMAP сам, на основе согласованного понимания
5. Grok 4.20 Multi-Agent (веб-подписка Владимира) используется как факт-чекер для узких xAI-вопросов, НЕ как архитектурный консультант

**Принцип:** Grok для фактов, Claude Code для архитектуры и кода, Владимир для продукта и смысла.

**Фокус:** строго идём по серии Simply_xAI до полного завершения миграции. Не отвлекаемся на другие проекты, другие баги, другие ТЗ. Зафиксировано в memory.

---

## 2026-04-14 — Коррекция архитектурного допущения (Владимир)

ТЗ-XAI-1 ANALYSIS предлагал эмпирический тест контекстного окна Grok за ~$10 чтобы подтвердить 2M и обосновать отказ от Compaction в ТЗ-XAI-3.

**Владимир поймал ошибку:** допущение «2M окно → компрессия не нужна» неверно само по себе, независимо от результата теста. Причины:

1. **Вечный чат** заполнит любое окно — 256K за неделю, 2M за пару месяцев. Защита нужна всегда
2. **Модели деградируют** на ~30-50% заявленного окна (Lost in the Middle, Liu et al. 2023). Реальный рабочий бюджет при 2M окне ≈ 400-600K, а не 2M
3. **Будущие модели** могут иметь 256K окно и быть лучше по качеству. Привязывать архитектуру к размеру окна → переделывать каждый раз

**Правильная архитектура для ТЗ-XAI-3:**

| Слой | Статус | Обоснование |
|---|---|---|
| Sliding window (CONTEXT_BUDGET) | **Оставить** (140-180K) | Рабочий бюджет качества, провайдер-независимый |
| Extract-on-compression (60%/80%) | **Оставить без изменений** | Основной механизм обработки вечного чата |
| Compaction API (Anthropic server) | Уже no-op для xAI через `isAnthropicProtocolModel` проверку — **не трогать, это мёртвый но безвредный код под Grok** |

`SIMPLY_CONTEXT_LIMIT` **не привязываем** к провайдерскому окну. Она должна быть там, где модель ещё думает хорошо.

**Следствия:**
- Эмпирический тест отменён — он отвечал на неправильный вопрос
- `contextWindow` в catalog у xAI записей НЕ трогаем в ТЗ-XAI-1 — текущие 256K/128K заведомо больше рабочего бюджета
- ТЗ-XAI-3 SPEC переформулирован: вместо «убрать Compaction потому что 2M» — «Compaction уже мёртвый код под Grok, основная работа — R-6 (убрать `isSimplyNonAnthropicModel`)»

---

## 2026-04-14 — Коррекция R-6 (ревью Claude Code)

Claude Code указал: архитектор недооценил риск R-6. Фраза «strip не должен помешать, потому что vision идёт на Haiku» — хрупкая логика, ломается при любом рефакторинге маршрутизации.

**Правильное решение для ТЗ-XAI-3:** Полностью убрать `isSimplyNonAnthropicModel` + все strip-функции. Заменить на проверку `capabilities.vision` из model-catalog (SSOT). Не надеяться на маршрутизацию — убрать причину проблемы.

**Урок:** Не оправдывать костыль тем что "другой код его обойдёт". Убирать причину, не симптом.

---

## 2026-04-14 — Аудит ТЗ-XAI-1 (Claude Code)

**Вывод:** ТЗ-XAI-1 на ~60% уже сделано в предыдущих ТЗ (CoreRegistry, DevSwitchboardUI). Реальной работы мало — удалить мёртвый `grok-4`, проверить pricing.

### Открытые вопросы

**Q1. contextWindow 2M или 256K?**  
Каталог: 256K. xAI docs: 2M. ТЗ-XAI-3 опирается на 2M для отказа от Compaction.  
→ Решение: эмпирический тест перед ТЗ-XAI-3 (~30 мин, ~$6-10).  
→ Статус: ожидает тест.

**Q2. grok-4 deprecated** — 0 потребителей, мёртвая запись.  
→ Решение: удалить сейчас в ТЗ-XAI-1.

**Q3. maxOutput 16000** — не подтверждено документацией.  
→ Решение: оставить, поправим если упрёмся.

### Критические находки

**🚨 R-5: expertise → multi-agent = нерабочий маршрут**  
`expertise` указывает на `grok-4.20-multi-agent-0309`, вызывается через Chat Completions. Multi-agent работает ТОЛЬКО через Responses API → сейчас работает как обычный Grok 4.20. В ai_usage_log — 1 вызов за всю историю.  
→ Решение для ТЗ-XAI-5: явно переключить на `grok-4.20-0309`. Multi-agent — отдельная будущая ветка.

**🚨 R-6: isSimplyNonAnthropicModel стрипает изображения**  
chat/route.ts:919 стрипает image/file parts для любого не-Anthropic провайдера. При переключении KITT на Grok — начнёт молча стрипать.  
→ Контекст: Vision-маршрут остаётся на Haiku, запросы с вложениями пойдут на Haiku. Но проверить маршрутизацию.  
→ Решение для ТЗ-XAI-3: убрать `isSimplyNonAnthropicModel`, заменить на capabilities.vision из каталога.

### Бонусы для будущих ТЗ

- **ТЗ-XAI-2:** Grok `generateObject` native → упростить 2 call sites, убрать `JSON.parse` workaround
- **ТЗ-XAI-4:** `professor:review` — убрать `anthropic.thinking.adaptive` (Grok reasoning автоматический)
- **ТЗ-XAI-4:** `podcast-script` — `cacheControl: ephemeral` напрямую → обернуть в провайдер-проверку

---

## 2026-04-14 — Стратегическая сессия (начало серии)

### Принятые решения

1. **Chat Completions — основа.** Responses API только для multi-agent. Портабельность, tools без изменений.
2. **Compaction не нужен при 2M окне.** Sliding window (140K) + Extract-on-compression достаточны.
3. **Qwen отменён.** Галлюцинации на изображениях через OpenRouter. Vision остаётся на Haiku 4.5.
4. **Два провайдера:** xAI (фундамент) + Anthropic (vision + Opus). Чёткие роли.
5. **Grok 4.1 Fast non-reasoning для KITT.** $0.20/$0.50, без reasoning tokens.
6. **`reasoning_effort` не передавать** для Grok 4.20 и 4.1 Fast — ошибка. Только для multi-agent.
7. **Маленькие ТЗ.** Изолированные, тестируемые шаги.

### Исследования проведены

- Документация `@ai-sdk/xai@3.0.82` — полностью изучена
- Документация xAI API (models, pricing, tools, multi-agent, reasoning, Responses API) — изучена
- Два аудита от Claude Code: (1) архитектура моделей, (2) контекст-менеджмент — получены и проанализированы
- Brainstorm Multi-Agent + MCP — проанализирован, решения зафиксированы
