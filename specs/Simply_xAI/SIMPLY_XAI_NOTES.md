# Simply — XAI Migration Notes

> Append-only лог. Новые записи добавляются сверху. Старые не редактируются.

**Соседние документы серии:**
- [SIMPLY_XAI_ROADMAP.md](SIMPLY_XAI_ROADMAP.md) — что планируем
- [SIMPLY_XAI_CHANGELOG.md](SIMPLY_XAI_CHANGELOG.md) — что реально сделано (append-only факт-лист)
- Этот файл — почему приняли такие решения

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
