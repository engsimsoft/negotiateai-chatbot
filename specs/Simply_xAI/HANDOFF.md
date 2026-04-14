# HANDOFF — Серия Simply_xAI миграции

**Последнее обновление:** 2026-04-15
**Текущая версия проекта:** 3.90.0
**Последний коммит серии (ожидаемый):** release(v3.90.0): ТЗ-XAI-3 (commit hash появится после git commit)

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

## Следующая сессия: начни с

1. **Прочитай в этом порядке (5 минут):**
   - `specs/Simply_xAI/HANDOFF.md` (этот файл)
   - `specs/Simply_xAI/SIMPLY_XAI_CHANGELOG.md` — что реально уже сделано (запись ТЗ-XAI-3 сверху)
   - `specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md` — карточка ТЗ-XAI-4
   - `specs/Simply_xAI/SIMPLY_XAI_NOTES.md` — запись 2026-04-15 «ТЗ-XAI-3 завершён» (уроки)
   - `specs/Simply_xAI/MIND_ARCHITECTURE.md` — **только** если в ТЗ-XAI-4 будут правки касающиеся памяти
2. **Проверь memory рефлексы:** `~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/MEMORY.md` — возможно новая запись про дубликат функций / grep before writing helper
3. **Первая задача ТЗ-XAI-4:** составить ANALYSIS переключения ~12 лёгких utility/pipeline вызовов на Grok. Подшаги: сначала utility (`util:title`, `util:project-summary`, `util:artifact-suggestions`), потом briefing pipeline (author, section, filter, podcast-script), потом professor/clerk с адаптацией `providerOptions.anthropic.thinking` (Grok reasoning автоматический — параметр убирается)
4. **Не начинай код до ANALYSIS** — новая схема работы без внешнего архитектора требует ANALYSIS против реального кода + вопросы пользователю до SPEC/ROADMAP

---

## Что сделано в последней сессии (2026-04-15, ТЗ-XAI-3)

Одна сессия закрыла третий ТЗ серии.

**Основное:**
- `simply-chat` default `MiniMax-M2.7` → `grok-4-1-fast-non-reasoning`
- `simply-chat-think` default `claude-sonnet-4-6` → `grok-4.20-0309-non-reasoning` (расширение scope — Владимир поймал что Sonnet на переходный период = жечь деньги)
- R-6 cleanup: удалены `stripMediaPartsForTextModel` (28 строк), `stripLegacyOpenAICompatToolParts` (40 строк, SQL-аудит: 0 legacy parts), флаг `isSimplyNonAnthropicModel`, упрощён `preparedHistory`, temperature `chatMode === "simply" ? 0.7 : 1.0`
- **Pre-existing bug найден и починен:** `saveMessages` сохраняла оригинальные `message.parts` вместо `processedMessage.parts` → на следующем запросе БД возвращала file parts → Grok падал с `AI_UnsupportedFunctionalityError`. Фикс: использовать `processedMessage.parts` + `convertTextFilesInAllMessages` вместо самодельного дубликата
- Backlog: [TZ_ErrorRecoveryUI.md](../_backlog/TZ_ErrorRecoveryUI.md) (после 9-кратного упрёка от Владимира) + [TZ_SimplyReadDocumentTool.md](../_backlog/TZ_SimplyReadDocumentTool.md) (quality issue tool-selection)

**Smoke test 6 сценариев:** все ✅ после фикса регрессии. Владимир подтвердил «разница с Think невероятно крутая» — tier upgrade вариант A (non-reasoning) работает продуктово.

---

## Критическое состояние для следующей сессии

### Dev-сервер в фоне
- Процесс `buf187m9t` — `npm run dev` на `http://localhost:3000`
- Если сессия восстанавливается — проверь жив ли сервер через `tail /tmp/claude-501/.../tasks/buf187m9t.output` или `curl http://localhost:3000`
- Если мёртв — запускать заново `npm run dev` в background

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
(TBD) release(v3.90.0): ТЗ-XAI-3 — KITT + Think на Grok + R-6 cleanup
1481141  release(v3.89.0): ТЗ-XAI-2 — MIND pipeline миграция на Grok
6fd1fbb  docs(xai-migration): CHANGELOG серии + verified Grok params
0ecc6fa  docs(xai-migration): синхронизация статусов после завершения ТЗ-XAI-1
ba9e928  release(v3.88.0): ТЗ-XAI-1 — фундамент миграции на xAI
```

Push никаких коммитов Владимир ещё не давал — остаются в локальном master, ahead of origin/master on 5+ commits после XAI-3 коммита.
