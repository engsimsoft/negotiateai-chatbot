# HANDOFF — Серия Simply_xAI миграции

**Последнее обновление:** 2026-04-15 (вечер, конец сессии XAI-3)
**Текущая версия проекта:** 3.90.0
**Последние коммиты:**
- `fc8a995` fix(error-recovery): TZ_ErrorRecoveryUI Stage 1 (post-release hotfix, не bump версии)
- `8dfac7f` release(v3.90.0): ТЗ-XAI-3 — KITT + Think на Grok + R-6 cleanup

Этот документ — **мост между сессиями**, не замена ROADMAP. За детальными задачами всегда иди в `TZ_xai_N/ROADMAP.md` или `SIMPLY_XAI_CHANGELOG.md`.

---

## Прогресс серии

- [x] **ТЗ-XAI-1** — Фундамент (v3.88.0) — удалён deprecated `grok-4`, notes про multi-agent, зафиксирована архитектура защиты контекста
- [x] **ТЗ-XAI-2** — MIND pipeline → Grok (v3.89.0) — 5 memory-задач на xAI split-стратегией, native `generateObject`, создан MIND_ARCHITECTURE.md
- [x] **ТЗ-XAI-3** — KITT + Think → Grok (v3.90.0) — `simply-chat` → Grok 4.1 Fast, `simply-chat-think` → Grok 4.20 (расширен scope), R-6 cleanup (80 строк strip-функций удалено)
- [ ] **ТЗ-XAI-4** — Utility/Pipeline batch миграция (briefing, podcast, meeting, professor, title) ← **СЛЕДУЮЩИЙ**
- [ ] ТЗ-XAI-5 — Create / Expertise → Grok 4.20 (+ R-5 expertise single-agent). **Сужен** — Think уже на Grok 4.20 после XAI-3
- [ ] ТЗ-XAI-6 — Очистка MiniMax/OpenRouter

---

## Следующая сессия: рекомендованный порядок

### Что читать на старте (5 минут)

1. `specs/Simply_xAI/HANDOFF.md` (этот файл)
2. `specs/Simply_xAI/SIMPLY_XAI_CHANGELOG.md` — записи ТЗ-XAI-3 (v3.90.0) и TZ_ErrorRecoveryUI Stage 1 наверху
3. `specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md` — карточка ТЗ-XAI-4 (сужено от XAI-5 — Think больше не в scope)
4. `specs/Simply_xAI/SIMPLY_XAI_NOTES.md` — запись 2026-04-15 «ТЗ-XAI-3 завершён» (уроки про дубликат функции, Grok 4.20 impressions, процессный урок про backlog)
5. `specs/Simply_xAI/MIND_ARCHITECTURE.md` — **только** если в ТЗ-XAI-4 будут правки памяти (вряд ли)

### Что запустить до работы

```bash
# Проверить что всё компилится (версия bumped до 3.90.0, 5 коммитов серии в master)
npx tsc --noEmit

# Поднять dev server (прошлая сессия закрыла его в процессе hard-restart debugging)
npm run dev

# Проверить `.simply-dev-overrides.json` — сейчас должно быть только expertise + create
cat .simply-dev-overrides.json
```

### Проверь memory рефлексы

`~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/MEMORY.md` — возможно в конце сессии 2026-04-15 будет новая запись про **grep-before-write-helper** (урок XAI-3 про дубликат `inlineTextFileParts` vs уже существующий `convertTextFilesInAllMessages`).

---

## Рекомендации по следующему шагу (по приоритету)

### 🥇 Вариант A — ТЗ-XAI-4 Utility/Pipeline batch миграция (основной путь)

**Это магистральная задача серии.** Самая большая по объёму (~12 call sites), но самая простая по риску — простые вызовы без providerOptions сложностей.

**Почему стоит взять первым делом:**
- Серия Simply_xAI должна завершиться, а каждое ТЗ держит инфраструктурное долго — чем быстрее дойдём до XAI-6, тем скорее сможем удалить MiniMax полностью
- Утилитарные вызовы (`util:title`, `util:project-summary`, `util:artifact-suggestions`) переводятся тривиально — одна строка в `task-assignments.ts` на каждый
- Briefing pipeline имеет больше движущихся частей но тоже предсказуем
- Professor pipeline требует продуктового решения (Opus vs Grok 4.20) — лучше принять его сейчас

**Первые действия:**
1. Прочитать HANDOFF (этот файл) + SIMPLY_XAI_ROADMAP карточку XAI-4
2. Провести полный аудит кода — найти все call sites: grep `getModel(` в [lib/](../../lib/), [app/](../../app/)
3. Составить **ANALYSIS.md** в `specs/Simply_xAI/TZ_xai_4/` с разбивкой по группам (utility, briefing, clerk, professor, meeting, service-chat)
4. **Задать Владимиру 2-3 критичных продуктовых вопроса** перед ROADMAP (см. «Открытые вопросы XAI-4» ниже)
5. Согласовать ROADMAP → поэтапно реализовать → smoke test → коммит

**Эстимейт:** 1-2 сессии. Может быть одна длинная если Владимир сразу ответит на все вопросы.

### 🥈 Вариант B — TZ_ErrorRecoveryUI Stage 2 (root cause fix)

Stage 1 закрыл боль тестирования (пользователь видит hint). Stage 2 — это фундаментальный fix через useChat state recovery. Не блокер миграции, но давний долг.

**Scope:**
- Выяснить почему `clearError()` из useChat не восстанавливает state для `AI_UnsupportedFunctionalityError` и аналогов
- Возможно добавить auto-clearError после показа toast
- Покрыть не-ChatSDKError ошибки в `onError` (сейчас `if (error instanceof ChatSDKError)` отсекает всё остальное)
- Возможно добавить явную кнопку «Перезагрузить страницу» в DevPanel Errors секцию

**Почему можно отложить:** Stage 1 разблокировал тестирование, пользователь знает что делать. Serie приоритетнее. Stage 2 — между миграционными ТЗ или после серии.

### 🥉 Вариант C — TZ_SimplyReadDocumentTool

Quality issue про `readDocument` tool путающий Grok на attached файлах. Средний приоритет. Простой фикс — один-два варианта: убрать tool из Simply active list, или правка промпта. Один час работы максимум.

**Когда брать:** между большими ТЗ серии, когда захочется быстрой победы.

---

## Открытые продуктовые вопросы для ТЗ-XAI-4

Собрать эти вопросы в ANALYSIS.md до начала написания ROADMAP:

### Q1. Opus vs Grok 4.20 для Professor pipeline?

`professor:planning`, `professor:review`, `professor:pipeline-synthesize`, `professor:pipeline-analyze` сейчас на **Claude Opus 4.6**. Это самая дорогая и качественная модель в проекте. Пользуется редко (только когда пользователь создаёт проект и использует Professor mode).

**Три варианта:**
- **A. Оставить Opus.** Качество planning важнее экономии, редкое использование оправдывает стоимость. Anthropic остаётся в проекте для Opus + Haiku vision
- **B. Grok 4.20 non-reasoning.** В ~3× дешевле Opus, похожий уровень качества для structured planning, унифицирует стек на xAI
- **C. Grok 4.20 reasoning.** Если planning выигрывает от reasoning tokens — может быть уместно. Но дороже из-за reasoning overhead

**Моё предварительное мнение:** **A (оставить Opus)**. Причины: (1) Opus специально заточен под planning-типа задачи, (2) редкое использование, (3) Anthropic всё равно в проекте для Haiku vision — одной зависимостью меньше/больше не меняет стек. Но Владимир может захотеть унифицировать на xAI по идеологическим причинам.

### Q2. Professor `thinking: { adaptive, effort: "high" }` provider option

[lib/ai/professors/task-reviewer.ts:136](../../lib/ai/professors/task-reviewer.ts#L136) использует `providerOptions.anthropic.thinking`. Под Anthropic это включает extended thinking. Под xAI этот параметр не существует → упадёт `Bad Request`.

**Что делать:**
- Если Q1 = Опус → параметр остаётся, ничего не меняется
- Если Q1 = Grok → параметр убирается (Grok рассуждает автоматически), комментарий в коде что параметр был для Anthropic

### Q3. Service chats (ben, project-creation, project-manager, briefing-onboarding) — в scope XAI-4?

Эти 4 сервисных чата сейчас на Haiku/Sonnet. В memory зафиксировано что **Бен будет deprecated** (не инвестировать время). Остальные три:
- `project-creation` — помогает при создании проекта
- `project-manager` — менеджер внутри проекта
- `briefing-onboarding` — онбординг для брифинга

**Вариант A.** Перевести на Grok 4.1 Fast — они короткие, не требуют тяжёлой модели. Унифицирует провайдер для UI-чатов.
**Вариант B.** Отложить — service chats отдельная подсистема, миграцию можно сделать в XAI-6 или отдельном ТЗ после серии.

**Моё мнение:** **A** — инкрементально, одна строка в task-assignments на каждый. Ben оставляем на Haiku (будет deprecated — зачем менять).

### Q4. Briefing pipeline — какой variant Grok?

`briefing:filter`, `briefing:author`, `briefing:section` сейчас на **MiniMax-M2.7-long** (180s timeout через namespace). MiniMax обрабатывает длинные статьи.

**Вопрос:** Grok 4.1 Fast non-reasoning справится или нужен 4.20?

**Мои размышления:** Briefing filter — это классификация/фильтрация списка новостей, задача простая → 4.1 Fast. Briefing author — генерация связного текста статьи на 800-1500 слов → тоже 4.1 Fast должен справиться (у Grok большой output window). Section refresh — ещё проще. Лучше принять 4.1 Fast как default, мониторить качество через `/dev/models` override доступен.

### Q5. Podcast script — кэшинг перенос

[lib/podcast/script-generator.ts:122](../../lib/podcast/script-generator.ts#L122) использует `cacheControl: ephemeral` напрямую — это Anthropic-специфичная конфигурация которая сломает Grok. Надо обернуть в провайдер-проверку **ИЛИ** просто убрать (xAI implicit caching работает без настройки, что мы видели на MIND тестах XAI-3).

---

## Блокеры / Риски которые надо держать в голове

- **TZ_ErrorRecoveryUI Stage 2** — не блокер, но если в середине XAI-4 снова вылезет error state и заблокирует тесты — Stage 1 подсказка сработает и спасёт
- **Neon connection pool stale** — если в ходе работы будут внезапные `ConnectTimeoutError` при DB запросах, это может быть stale connection pool в Node. Решение: hard restart dev server (kill -9 если надо). Зафиксировано как наблюдение из этой сессии, не баг
- **Service chats в scope?** — Q3 выше, решение Владимира нужно до ROADMAP
- **Opus vs Grok 4.20 для Professor?** — Q1, решение Владимира нужно до ROADMAP

---

## Что сделано в последней сессии (2026-04-15, ТЗ-XAI-3 + TZ_ErrorRecoveryUI Stage 1)

Одна плотная сессия закрыла третий ТЗ серии **и** додела Stage 1 TZ_ErrorRecoveryUI поверх.

### ТЗ-XAI-3 (v3.90.0, commit `8dfac7f`)

- `simply-chat` default `MiniMax-M2.7` → `grok-4-1-fast-non-reasoning`
- `simply-chat-think` default `claude-sonnet-4-6` → `grok-4.20-0309-non-reasoning` (расширение scope — Владимир поймал что Sonnet на переходный период = жечь деньги)
- R-6 cleanup: удалены `stripMediaPartsForTextModel` (28 строк), `stripLegacyOpenAICompatToolParts` (40 строк, SQL-аудит: 0 legacy parts), флаг `isSimplyNonAnthropicModel`, упрощён `preparedHistory`, temperature `chatMode === "simply" ? 0.7 : 1.0`
- **Pre-existing bug найден и починен:** `saveMessages` сохраняла оригинальные `message.parts` вместо `processedMessage.parts` → на следующем запросе БД возвращала file parts → Grok падал с `AI_UnsupportedFunctionalityError`. Фикс: использовать `processedMessage.parts` + `convertTextFilesInAllMessages` вместо самодельного дубликата `inlineTextFileParts` (который я сам же в сессии создал и потом удалил — урок про grep перед написанием helper'а)
- Backlog создан: [TZ_ErrorRecoveryUI.md](../_backlog/TZ_ErrorRecoveryUI.md) (после 9-кратного упрёка от Владимира) + [TZ_SimplyReadDocumentTool.md](../_backlog/TZ_SimplyReadDocumentTool.md) (quality issue tool-selection `readDocument`)

**Smoke test 6 сценариев:** все ✅ после фикса регрессии (1. Grok 4.1 Fast текст, 2. function calling, 3. vision → Haiku, 4. text/plain inline, 5. Think → Grok 4.20, 6. MIND retrieve 5/5 injected). Владимир подтвердил «разница с Think невероятно крутая» — tier upgrade вариант A (non-reasoning) работает продуктово. MIND retrieve показал бонус: xAI implicit caching эмитит `cached_tokens` без нашей конфигурации → экономия на длинных диалогах.

### TZ_ErrorRecoveryUI Stage 1 (hotfix на v3.90.0, commit `fc8a995`)

Минимальный фикс — 2 string concat в [components/chat.tsx](../../components/chat.tsx):
- `onError` useChat callback — дописан hint «Чтобы продолжить, перезагрузите страницу: Cmd+R (Mac) или Ctrl+R (Windows).»
- 60s timeout timer — аналогичный hint

**Live-проверено через WiFi off trigger:** Владимир специально отключил WiFi → NeonDB timeout → `onError` сработал → новый текст появился в красном toast. Stale connection pool после восстановления WiFi рассосался сам за минуту.

**Не закрыто Stage 2:** root cause через useChat state recovery остаётся в backlog. Не блокер — Stage 1 даёт пользователю workaround (знает что делать — перезагрузить страницу).

### Процессный урок сессии

Владимир поднял **9-кратный** упрёк про error-state проблему. Системный фейл: проблема откладывалась устно без backlog-записи → забывалась → повторялась. Исправлено прямо в сессии: backlog создан до технического фикса регрессии. Правило зафиксировано в ROADMAP/NOTES: повторяющаяся не-блокер-проблема = немедленно в backlog, устное «потом починим» = сигнал к записи.

---

## Критическое состояние для следующей сессии

### Dev-сервер в фоне
- **Умер на конце сессии** в процессе hard-restart debugging stale connection pool. Task ID `b4pxr83ey` остановлен через TaskStop
- На старте следующей сессии — `npm run dev` в background и проверка `curl http://localhost:3000` (должно быть 307)
- `.simply-dev-overrides.json` — оставил только expertise/create (simply-chat и simply-chat-think снимались во время smoke-тестов XAI-3, новые defaults теперь честно указывают на Grok)

### Активные dev overrides
Файл `.simply-dev-overrides.json` (в корне проекта, `.gitignore`):
```json
{"expertise":"grok-4.20-0309-reasoning","create":"claude-haiku-4-5-20251001"}
```

Только два override — expertise и create. Это область ТЗ-XAI-5 (как и было). `simply-chat` / `simply-chat-think` overrides были сняты перед smoke-тестом XAI-3, defaults теперь честно указывают на Grok.

---

## Архитектурные константы серии (не забыть)

1. **Защита контекста не привязана к размеру провайдерского окна.** Sliding window (140K) + Extract-on-compression остаются independently. Compaction API живёт для vision-маршрута на Haiku через capability-check — удалять только когда vision полностью уйдёт с Claude (ТЗ-XAI-6 или отдельное решение)
2. **Simply Chat «Думать» = tier upgrade.** `simply-chat` = Grok 4.1 Fast ($0.20/$0.50), `simply-chat-think` = Grok 4.20 non-reasoning ($2/$6, ×10 input). Variant non-reasoning (A) подтверждён smoke-тестом как продуктовый tier upgrade. Variant reasoning (B) доступен через `/dev/models` если нужна UX-пауза
3. **`reasoningEffort` не передавать** ни reasoning ни non-reasoning вариантам Grok 4.1 Fast / 4.20 — empirical тест показал Bad Request для обоих. Только multi-agent variant принимает (управляет числом агентов)
4. **Cache/Compaction блоки в chat/route.ts — живы для Haiku.** Не трогать в XAI-4/XAI-5. Финальная чистка в XAI-6 или отдельном решении после vision migration

---

## Критичные вопросы и риски для ТЗ-XAI-4

### Объём работы
~12 «лёгких» вызовов в разных файлах. Группировка:

**Utility (самое простое):**
- `util:title` — автонейминг чата (сейчас Haiku → Grok 4.1 Fast Cheap)
- `util:project-summary` — суммаризация проекта
- `util:artifact-suggestions` — request-suggestions tool (сейчас Sonnet)

**Briefing pipeline:**
- `briefing:filter` — AI фильтр источников
- `briefing:author` — автор статьи
- `briefing:section` — per-section refresh
- `briefing:podcast-script` — сценарий подкаста

**Clerks (вспомогательные):**
- `clerk:task-summary`
- `clerk:snapshot`
- `clerk:file-analyzer`

**Professor pipeline:**
- `professor:planning` — Opus-based планирование
- `professor:review` — **использует `providerOptions.anthropic.thinking: { adaptive, effort: "high" }`** — при переключении на Grok этот параметр нужно убрать (Grok рассуждает автоматически)
- `professor:pipeline-analyze/execute/synthesize`

**Meeting:**
- `meeting:summary` — Sonnet → Grok 4.1 Fast

### Риски XAI-4

- **`professor:review` providerOptions.anthropic.thinking** — убрать перед переключением на Grok, иначе xAI SDK упадёт
- **`podcast-script` `cacheControl: ephemeral`** — используется напрямую на сообщениях, обернуть в провайдер-проверку
- **Opus-based задачи (`professor:planning`, `professor:review`, `professor:pipeline-synthesize`, `professor:pipeline-analyze`)** — вопрос: оставляем Opus или тоже уводим на Grok 4.20? Opus дороже и медленнее, но даёт качественный скачок для planning. Решение Владимира нужно на этапе ANALYSIS
- **Service chats** (ben, project-creation, project-manager, briefing-onboarding) — тоже в scope XAI-4 или отдельный ТЗ?

---

## Блокеры / Открытые вопросы

- [ ] **Opus vs Grok 4.20 для Professor pipeline** — решение Владимира в ANALYSIS XAI-4
- [ ] **Service chats в scope XAI-4?** — уточнить у Владимира
- [ ] **TZ_ErrorRecoveryUI Stage 1** — не блокер миграции, но желательно сделать между ТЗ серии. Владимир хотел минимум — текст «перезагрузите страницу» в красном флаге ошибки

---

## Pre-existing untracked файлы (НЕ ТРОГАТЬ без команды)

```
?? SIMPLY_PROMPTS_AND_MODEL_CONFIG.md       # Файл Владимира — он его открывал в IDE, Claude Code не видел содержимого
?? specs/TZ_RAG_SimplyRAG/AUDIT_REPORT.md   # Был untracked ещё до серии
```

---

## Команды для проверки состояния

```bash
# Убедиться что типы и билд в порядке
npx tsc --noEmit
npm run build

# Проверить dev server жив ли
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Проверить git log серии
git log --oneline -10

# Список live xAI моделей в task-assignments
grep -E "grok|Grok" lib/ai/task-assignments.ts
```

---

## Ключевые решения и уроки серии (накопленный опыт)

1. **Эмпирический smoke test перед рефакторингом — обязателен.** Трижды в серии спасал от неверных решений: `reasoningEffort` в XAI-1, `generateObject` в XAI-2, `convertTextFilesInAllMessages` дубликат в XAI-3 (урок через регрессию)
2. **ANALYSIS против реального кода > ТЗ от внешнего архитектора.** Писать SPEC/ROADMAP самостоятельно после чтения кода — быстрее и точнее
3. **`/dev/models` switchboard снимает давление.** Defaults в коде — стартовые точки, финальный выбор делается в эксплуатации через override файл
4. **Живые документы серии > локальные HANDOFF/CHANGELOG per ТЗ.** Три файла на серию (ROADMAP + CHANGELOG + NOTES) + MIND_ARCHITECTURE как reference дают полную картину
5. **Side-effects от тестирования → backlog, не фикс сразу.** `getOrCreateSimplyChat` race + error recovery UI + readDocument tool — всё в backlog без расширения текущего ТЗ
6. **Grep before writing helper (урок XAI-3).** При добавлении функции в большой файл — grep на типовые имена + внимательно смотреть diagnostic hints про `"declared but never used"`. Они часто указывают на готовый dead-but-useful код
7. **Процессная дисциплина backlog.** Повторяющаяся не-блокер-проблема = немедленно в backlog, даже если фикс откладывается. «Потом починим» без записи = сигнал к немедленной backlog-записи

---

## История коммитов серии

```
fc8a995  fix(error-recovery): TZ_ErrorRecoveryUI Stage 1 — hint о перезагрузке (post-release)
8dfac7f  release(v3.90.0): ТЗ-XAI-3 — KITT + Think на Grok + R-6 cleanup
2272e67  docs(xai-migration): HANDOFF после ТЗ-XAI-2 для следующей сессии
1481141  release(v3.89.0): ТЗ-XAI-2 — MIND pipeline миграция на Grok
6fd1fbb  docs(xai-migration): CHANGELOG серии + verified Grok params
0ecc6fa  docs(xai-migration): синхронизация статусов после завершения ТЗ-XAI-1
ba9e928  release(v3.88.0): ТЗ-XAI-1 — фундамент миграции на xAI
```

**Push не выполнялся** — все коммиты в локальном master, 7 ahead of origin/master. Push — отдельная команда Владимира когда будет готов публиковать серию в remote.
