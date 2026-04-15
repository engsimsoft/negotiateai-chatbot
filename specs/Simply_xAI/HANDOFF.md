# HANDOFF — Серия Simply_xAI миграции

**Последнее обновление:** 2026-04-16 (конец сессии — v3.91.0 + hygiene cleanup + регистрация нового хвоста)
**Текущая версия проекта:** 3.91.0
**Последние коммиты локального master:**
- `f6dbedd` docs(backlog): add TZ_SimplyContextUsageWidget — UI виджет контекста показывает не ту шкалу
- `6e6867b` chore(backlog): archive TZ_ATTACH_1 after v3.91.0 — hygiene cleanup
- `dbe6bdf` release(v3.91.0): TZ_ATTACH_1 — PDF text extraction при upload + fix project files v1→v2 legacy call
- `b46c5d1` docs(xai-migration): HANDOFF после v3.90.2 + SSOT архитектурного документа
- `59eb33a` release(v3.90.2): TZ_SimplyReadDocumentTool + R-6 correction через SSOT

Этот документ — **мост между сессиями**, не замена ROADMAP. За детальными задачами всегда иди в карточку ТЗ или `SIMPLY_XAI_CHANGELOG.md`.

---

## ⛔ Правило №0 перед любой работой: «Семь раз отмерь — один раз отрежь»

**Это закон, не рекомендация.** Нарушение стоит $1 лишнего ТЗ и +1 смены контекста (доказано на двух последних сессиях).

**Перед любой реализацией:**

1. **Изучить официальную документацию** внешних технологий — WebSearch + WebFetch актуальной документации SDK/API/библиотек. Knowledge cutoff = май 2025, всё новое (xAI, Grok, AI SDK v6, провайдеры моделей) **обязательно** читать заново. Не полагаться на локальный README в `node_modules/` — только first-party docs
2. **Изучить лучшие практики** — WebSearch на «best practices for X», GitHub issues, Stack Overflow для современных решений 2026
3. **ANALYSIS против реального кода** — прочитать все файлы зоны работы, свериться с SSOT документами (SIMPLY_ATTACHMENT_ARCHITECTURE.md, MIND_ARCHITECTURE.md, model-catalog.ts, CLAUDE.md)
4. **Только потом** — план, код, тесты

**Процессные уроки двух последних сессий (2026-04-15 и 2026-04-16):**

- **v3.90.2 patch** — я удалил `stripMediaPartsForTextModel` в ТЗ-XAI-3 с обоснованием «Grok умеет vision». Это не было верифицировано тестом. Pre-existing bug вылез через сутки → v3.90.2 hotfix. Стоимость: +1 ТЗ.
- **v3.91.0 serverExternalPackages эпопея** — я сделал `import { PDFParse } from "pdf-parse"` top-level. Build прошёл, crash случился в runtime при первом запросе. Переделал на dynamic import внутри функции (паттерн mammoth/xlsx) — **та же ошибка**. Оба подхода не работают для ESM-first пакетов с worker-dependencies. **Единственное** решение — `serverExternalPackages: ["pdf-parse"]`. Стоимость: 2 итерации + stale cache регрессия с DevPanel.

**Вывод:** ANALYSIS ≠ поверхностное чтение. Если в коде есть функция которая делает что-то «хрупкое» — 99% случаев она делает это **зачем-то**. Если существующий прецедент (projects/[id]/files/route.ts) использует `require("pdf-parse")` с `// eslint-disable no-require-imports` — это означает что top-level `import` **уже** пробовали и он не работает. Нужно читать existing workarounds как documented trade-offs.

---

## Прогресс серии

- [x] **ТЗ-XAI-1** — Фундамент (v3.88.0)
- [x] **ТЗ-XAI-2** — MIND pipeline → Grok (v3.89.0)
- [x] **ТЗ-XAI-3** — KITT + Think → Grok (v3.90.0, R-6 cleanup неполный → v3.90.2 correction)
- [x] **ТЗ-SimplyChatModeInjection** (вне серии, v3.90.1) — плейсхолдеры через SSOT model-catalog
- [x] **ТЗ-SimplyReadDocumentTool + R-6 correction** (v3.90.2) — `adaptHistoryToCapabilities` через SSOT
- [x] **ТЗ-ATTACH-1** — PDF text extraction при upload (v3.91.0) — **только что закрыт**
- [ ] **ТЗ-XAI-4** — Utility/Pipeline batch миграция (briefing, podcast, meeting, professor, title) ← **СЛЕДУЮЩИЙ**
- [ ] ТЗ-XAI-5 — Create/Expertise → Grok 4.20 (+ R-5 expertise single-agent)
- [ ] ТЗ-XAI-6 — Очистка MiniMax/OpenRouter
- [ ] ТЗ-XAI-COL-1 — Collections API для Библиотеки (после серии)

**Архитектурное состояние:** после v3.90.2 + v3.91.0 **capability-agnostic через SSOT** работает для всей attachment зоны:
- v3.90.2 закрыл history adaptation через `adaptHistoryToCapabilities` (Decision 3 архитектурного документа)
- v3.91.0 закрыл upload extraction через Слой 0 (Decision 4)
- Обе реализации читают `capabilities`/`documentSupport` из `model-catalog.ts` как SSOT, не знают про конкретные провайдеры

Следующее место где SSOT нужен — **routing layer** (`simply-chat` vs `simply-chat-vision` taskId selection) — там ещё есть хардкод на `mediaType.startsWith("image")`. Это может быть частью ТЗ-XAI-5 или отдельной чистки.

---

## 🎯 Главный SSOT документ серии — прочитать ПЕРВЫМ

**[specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md](SIMPLY_ATTACHMENT_ARCHITECTURE.md)** — утверждённый 2026-04-15 архитектурный стандарт обработки вложений в Simply.

**Ключевой принцип:** «Максимум работы при загрузке файла, минимум при разговоре».

**Три слоя обработки:**
- **Слой 0** — серверное извлечение при upload ($0, без AI, миллисекунды). DOCX/XLSX/TXT/MD/CSV + **PDF (v3.91.0)** ✅
- **Слой 1** — KITT routing: текст → Grok, изображения/сканы PDF → Haiku
- **Слой 2** — Экспертиза (глубокий анализ с tools)
- **Слой 3** — Библиотека (RAG: MIND сейчас + Collections в будущем — ТЗ-XAI-COL-1)

**5 принятых решений — статус реализации:**
1. ✅ Гибрид Grok + Haiku для KITT (v3.90.0)
2. ✅ Haiku отвечает напрямую при вложении (не двухшаговый)
3. ✅ `adaptHistoryToCapabilities` через SSOT (v3.90.2)
4. ✅ PDF text extraction при upload (v3.91.0) ← **только что**
5. 🟡 Пороги размеров — эмпирически, продолжается калибровка (логирование `[PDF Extract] avgCharsPerPage` для empirical tuning, TZ_SimplyContextUsageWidget новый хвост связан)

---

## Следующая сессия: порядок действий

### Что читать на старте (15 минут)

Порядок важен — от общего к частному:

1. **[SIMPLY_ATTACHMENT_ARCHITECTURE.md](SIMPLY_ATTACHMENT_ARCHITECTURE.md)** — SSOT для всей attachment работы (10 минут)
2. **[SIMPLY_XAI_ROADMAP.md](SIMPLY_XAI_ROADMAP.md)** — актуальная карточка ТЗ-XAI-4 с открытыми вопросами
3. **[SIMPLY_XAI_CHANGELOG.md](SIMPLY_XAI_CHANGELOG.md)** — записи v3.91.0, v3.90.2, v3.90.1 наверху (не забывай что главный CHANGELOG = корневой)
4. **[SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md)** — уроки серии, особенно запись от 2026-04-16 про 3 webpack ESM мины
5. **[specs/_backlog/README.md](../_backlog/README.md)** — обзор открытых хвостов перед большим ТЗ (4 хвоста: ErrorRecoveryUI, SimplyContextUsageWidget, PromptsDeadCodeCleanup, SimplyChatRaceCondition)
6. **[MIND_ARCHITECTURE.md](MIND_ARCHITECTURE.md)** — только если правки памяти

### Что запустить до работы

```bash
# Проверить что всё компилится (версия 3.91.0, 13 коммитов ahead of origin)
npx tsc --noEmit

# Поднять dev server в фоне
npm run dev

# Проверить dev overrides — должно быть только expertise + create (область XAI-5)
cat .simply-dev-overrides.json
# Ожидается: {"expertise":"grok-4.20-0309-reasoning","create":"claude-haiku-4-5-20251001"}

# Git state
git log --oneline -5
# Должен быть f6dbedd на top, версия в package.json = 3.91.0
```

### Memory refresh

`~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/MEMORY.md` — прочитать полностью в начале. Критичные новые записи:

- **`feedback_backlog_russian_term.md`** (новая) — `_backlog/` по-русски «хвосты». В разговоре/HANDOFF/NOTES используем «хвост», в путях и commits — английский `backlog`. Владимир использует этот slang
- **`project_simply_chat_persistent.md`** — Simply Chat один persistent на userId. **Никогда** не писать «новый Simply чат», «в том же Simply чате»
- **`feedback_official_docs_first.md`** — Правило №0 выше
- **`feedback_no_external_architect.md`** — ANALYSIS против кода > ТЗ от стороннего архитектора
- **`project_simply_xai_migration.md`** — активная серия, не отвлекаться

---

## 🥇 Рекомендованный следующий шаг — ТЗ-XAI-4

### Что это

Batch миграция utility/pipeline call sites на Grok/Anthropic с MiniMax/OpenRouter. Цель — закрыть основное тело миграции до того как пойдём в XAI-5 (Create/Expertise) и XAI-6 (финальная чистка).

Ориентировочный scope (~12 call sites):
- **Briefing pipeline** — `lib/briefing/*` (generate, refresh-section, save-profile, simply-news)
- **Podcast pipeline** — `lib/podcast/*`
- **Meeting recorder** — `lib/meeting/*`
- **Professor pipeline** — `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (Opus-based, важное решение)
- **Title generation** — `app/(chat)/api/chat/[id]/generate-title/route.ts`
- **Service chats** — `app/(chat)/api/service-chat/route.ts` (возможно в scope, возможно отдельно)

### Открытые вопросы — адресовать до ROADMAP

**Q1: Professor pipeline — Opus vs Grok 4.20?**
Professor сейчас жжёт Opus (~$15/$75 per 1M). Grok 4.20 (~$2/$6) даёт 5-10x экономию. Но Professor — самая дорогая точка в Simply, именно там пользователи хотят «максимум мозгов». Может быть решение «Opus остаётся, все остальные pipelines переезжают на Grok 4.20». Нужен Владимир-ответ.

**Q2: Service chats — в scope XAI-4 или отдельно?**
`/api/service-chat` используется для KITT's onboarding, Ben intro, и т.д. Scope может раздуться, если Service chats тянут за собой agent prompt system. Альтернатива — отдельный маленький ТЗ.

**Q3: Briefing — variant Grok 4.1 Fast или 4.20?**
Briefing pipelines не time-critical (раз в день через cron), но должны давать хорошее качество. Grok 4.1 Fast достаточно для title generation, Briefing может требовать 4.20.

**Q4: MiniMax catalog audit — делать в XAI-4 или отдельно?**
В памяти `project_minimax_catalog_audit.md` — каталог содержит только M2.7+long, в docs 8 моделей. Для XAI-6 (MiniMax cleanup) нужно знать что именно удалять. Возможно audit попутно в XAI-4.

### Первые действия (по правилу №0)

```
1. Прочитать SIMPLY_XAI_ROADMAP.md секцию ТЗ-XAI-4 (10 мин)
2. Задать Владимиру Q1-Q4 перед началом работы
3. Audit call sites — grep "getModel(" в lib/briefing/, lib/podcast/, lib/meeting/
4. Прочитать task-assignments.ts — какие сейчас taskId у этих pipelines
5. Проверить модели в model-catalog — pricing сверка с docs.x.ai / docs.anthropic.com (правило №0!)
6. Создать specs/TZ_XAI_4_UtilityPipelines/ с ANALYSIS.md (открытые вопросы + таблица call sites + target mapping)
7. После ответов Владимира — ROADMAP → поэтапно код → мануальный тест → commit
```

**Эстимейт:** 1-2 сессии (много call sites, но каждый простой — getModel taskId change).

---

## Альтернативы (если XAI-4 откладывается)

### 🥈 Вариант B — TZ_SimplyContextUsageWidget (новый хвост, Medium impact)
Находка сессии 2026-04-16. UI виджет контекста в /simply показывает ложные 55% потому что делит на `contextWindow` модели (128K — возможно ошибка в model-catalog) вместо `SIMPLY_CONTEXT_LIMIT` (200K). Backend работает корректно, это UX-обман. **1 сессия.** Карточка: [specs/_backlog/TZ_SimplyContextUsageWidget.md](../_backlog/TZ_SimplyContextUsageWidget.md).

### 🥉 Вариант C — TZ_ErrorRecoveryUI Stage 2 (High impact)
Root cause через useChat state recovery. Долг из прошлой серии, 0.5 сессии.

### Вариант D — TZ_SimplyChatRaceCondition (Medium)
Partial unique index для `getOrCreateSimplyChat`. 0.5 сессии, но **миграция на prod БД требует аудита дубликатов ДО применения** (см. [TZ_SimplyChatRaceCondition.md](../_backlog/TZ_SimplyChatRaceCondition.md)).

### Вариант E — TZ_PromptsDeadCodeCleanup (Medium)
Чистка мёртвого кода в `lib/ai/prompts.ts`. 0.5 сессии, безрисковое.

---

## Архитектурные константы серии (не забыть)

1. **Защита контекста не привязана к размеру провайдерского окна.** Sliding window (140K) + Extract-on-compression (SIMPLY_CONTEXT_LIMIT 200K, SOFT 60%, HARD 80%) независимы. Compaction API живёт для Haiku vision через capability-check.
2. **Simply Chat «Думать» = tier upgrade.** `simply-chat` = Grok 4.1 Fast ($0.20/$0.50), `simply-chat-think` = Grok 4.20 non-reasoning ($2/$6). Reasoning вариант доступен через `/dev/models`.
3. **`reasoningEffort` не передавать** в Grok 4.1 Fast / 4.20 (reasoning и non-reasoning варианты) — эмпирически падает `Bad Request`. Только multi-agent принимает.
4. **`adaptHistoryToCapabilities` через SSOT model-catalog** — единственный механизм адаптации истории. Живёт в [chat/route.ts:252-344](../../app/(chat)/api/chat/route.ts#L252). Не изобретать новых strip-функций.
5. **Simply Chat = один persistent чат на пользователя** (после MIND/RAG). Все тесты **в** persistent чате, не «в новом» и не «в том же».
6. **`capabilities.vision` ≠ `documentSupport.supported`.** Grok 4.1 Fast: vision=true, documentSupport.supported=false. Путать — антипаттерн. Баг из-за этого в v3.90.2.
7. **`serverExternalPackages` для ESM-first пакетов с worker dependencies.** `lamejs` и теперь `pdf-parse` — оба требуют external declaration в `next.config.ts`. Паттерн `mammoth`/`xlsx` dynamic import работает **только** для CJS или ESM-lite пакетов. Для полноценных ESM — только external. Новое правило из v3.91.0.
8. **После изменения `next.config.ts` — чистый rebuild обязателен.** HMR не пересобирает `serverExternalPackages`/`env`/`outputFileTracingIncludes` секции чисто, оставляет скрытый state drift. Симптом — DevPanel пропал после serverExternalPackages change в v3.91.0 сессии. Фикс: `rm -rf .next && npm run dev`.
9. **«Хвосты» = `_backlog/`.** Русский жаргон для backlog items. В разговоре/HANDOFF/NOTES говорим «хвост», в путях и commits — английский `backlog`. Владимир использует этот slang.

---

## Критичное состояние для следующей сессии

### Dev-сервер в фоне

В конце сессии работал task `b3edlz59a` (clean rebuild после stale cache инцидента). Скорее всего остановится когда закроется эта сессия. На старте следующей сессии — `npm run dev` в background + проверка `http://localhost:3000 → HTTP 307`.

### Активные dev overrides

```json
{"expertise":"grok-4.20-0309-reasoning","create":"claude-haiku-4-5-20251001"}
```
Область ТЗ-XAI-5. `simply-chat` / `simply-chat-think` — без overrides, дефолты честно указывают на Grok 4.1 Fast / 4.20 non-reasoning.

### MCP postgres сервер — отключился во время сессии

**К концу сессии `mcp__postgres__query` tool стал недоступен** (вместе со множеством других MCP-инструментов — GitHub, Gmail, Calendar, Drive). Для SQL-проверок в следующей сессии — либо reconnect MCP server, либо использовать `psql` через Bash, либо Drizzle Studio.

### Git state

**13 коммитов ahead of origin/master.** Все локально, не отпушены. Push — отдельная команда Владимира.

```
f6dbedd docs(backlog): add TZ_SimplyContextUsageWidget — UI виджет контекста показывает не ту шкалу
6e6867b chore(backlog): archive TZ_ATTACH_1 after v3.91.0 — hygiene cleanup
dbe6bdf release(v3.91.0): TZ_ATTACH_1 — PDF text extraction при upload + fix project files v1→v2 legacy call
b46c5d1 docs(xai-migration): HANDOFF после v3.90.2 + SSOT архитектурного документа
59eb33a release(v3.90.2): TZ_SimplyReadDocumentTool + R-6 correction через SSOT
516d600 release(v3.90.1): TZ_SimplyChatModeInjection — <current_mode>/<current_model> через SSOT
86de8ad docs(xai-migration): HANDOFF после ТЗ-XAI-3 + Stage 1 ErrorRecoveryUI
fc8a995 fix(error-recovery): TZ_ErrorRecoveryUI Stage 1
8dfac7f release(v3.90.0): ТЗ-XAI-3 — KITT + Think на Grok + R-6 cleanup
2272e67 docs(xai-migration): HANDOFF после ТЗ-XAI-2 для следующей сессии
1481141 release(v3.89.0): ТЗ-XAI-2 — MIND pipeline миграция на Grok
6fd1fbb docs(xai-migration): CHANGELOG серии + verified Grok params
ba9e928 release(v3.88.0): ТЗ-XAI-1 — фундамент миграции на xAI
```

### Pre-existing untracked файл (НЕ ТРОГАТЬ без команды)

```
?? specs/TZ_RAG_SimplyRAG/AUDIT_REPORT.md   # Был untracked ещё до серии
```

---

## Что сделано в этой сессии (2026-04-16)

**Одна плотная сессия закрыла ТЗ-ATTACH-1 + зарегистрировала новый хвост + hygiene cleanup закрытого ТЗ.**

### ТЗ-ATTACH-1 (v3.91.0, commit `dbe6bdf`)

**Реализация Слоя 0 из SIMPLY_ATTACHMENT_ARCHITECTURE.md для PDF.** 10 файлов, +523/-18 строк.

**Added:**
- [lib/pdf/extract-pdf-text.ts](../../lib/pdf/extract-pdf-text.ts) (45 строк) — shared helper через pdf-parse v2 API (`new PDFParse({data}).getText()` возвращает `{text, total, pages}`, один вызов даёт и текст и pageCount). Эвристика scan detection: `pageCount >= 2 ? avgCharsPerPage < 30 : text.length < 100` (special case для 1-page). Логирование `[PDF Extract]` для empirical tuning.
- PDF branch в [upload route](../../app/(chat)/api/files/upload/route.ts) после `isDocumentFile` — rename `.pdf` → `.txt`, contentType `text/plain`, truncate 50K chars с маркером (**только** при реальном обрезании, Владимир явно требовал «не пугать на 90% документов»), graceful catch → fall-through на native upload для encrypted/corrupt/scan.

**Fixed (side-effect finding в том же коммите):**
- [projects/[id]/files/route.ts](../../app/(chat)/api/projects/[id]/files/route.ts) использовал **v1 legacy API** (`pdfParse(buffer)` function call) на установленном v2 package → silent catch месяцами возвращал `undefined` → `metadata.extractedContent` в БД project files **никогда не заполнялся**. Переключён на shared helper `extractPdfText`. Связанный scope (Q5 = A), один коммит вместо двух.

**Infra:**
- [next.config.ts](../../next.config.ts): `serverExternalPackages: ["lamejs", "pdf-parse"]`. **3 попытки webpack/ESM interop провалились** — top-level static import, dynamic import в функции (паттерн mammoth/xlsx), все ломались на `Object.defineProperty called on non-object`. Единственное рабочее решение — объявить pdf-parse external, Next резолвит через Node `require` на runtime. **Паттерн зеркалит `lamejs`** который уже там по той же причине.

**Validation:**
- ✅ `npx tsc --noEmit` → 0 ошибок после каждого из 3 этапов
- ✅ `npm run build` → v3.91.0 compiled в 9.8s
- ✅ **Реальные тесты:**
  - Текстовый PDF (GDI_Калибровка 20 стр, 45K chars): Grok 4.1 Fast inline, без маркера
  - Большой PDF (LPS-3000 110 стр, 3.7 MB, 112K chars): truncate до 50K + маркер, Grok inline ответил
  - **Multi-PDF в одном сообщении** — тоже работает
- ✅ **Автотесты** (temporary `scripts/test-pdf-extract-scenarios.ts`, удалён после валидации):
  - Scan PDF (synthetic 1-page/0-text): `isLikelyScan=true`
  - Corrupt PDF (random bytes): `Invalid PDF structure` throw → graceful fallback

### Hygiene cleanup (commit `6e6867b`)

ТЗ-ATTACH-1 закрыт в v3.91.0, но backlog-учёт не был обновлён в том же коммите. Отдельный атомарный patch:
- `specs/TZ_ATTACH_1_PdfUpload/` → `_archive/TZ_ATTACH_1_PdfUpload/` (git mv)
- `specs/_backlog/TZ_ATTACH_PdfExtractionAtUpload.md` удалён (-144 строк)
- `specs/_backlog/README.md`: убрана строка High impact
- `_archive/BACKLOG_CLOSED.md`: добавлена запись

**Урок:** при закрытии ТЗ hygiene backlog должен быть **частью** того же release commit, не отдельной post-факто уборкой. В следующем ТЗ применять это правило.

### Новый хвост TZ_SimplyContextUsageWidget (commit `f6dbedd`)

Найден Владимиром после закрытия ATTACH-1 во время обсуждения Extract-on-compression триггеров.

**Проблема:** модальный виджет в /simply показывает `70 347 / 128 000 — 55% окна модели` → ложная тревога «вот-вот предел». Реально `70K / SIMPLY_CONTEXT_LIMIT 200K = 35%`, до SOFT (120K) ещё 50K запаса.

**Два бага в одном виджете:**
1. Знаменатель привязан к `contextWindow` модели вместо `SIMPLY_CONTEXT_LIMIT`. Нарушает правило «защита контекста не привязана к провайдерскому окну». Плюс 128K для Grok 4.1 Fast подозрительное — возможно ошибка в [model-catalog.ts](../../lib/ai/model-catalog.ts), нужен audit против docs.x.ai
2. «Расход за сессию» без определения термина «сессия» — с открытия страницы? С последнего extract? Без определения числа не интерпретируются

**Приоритет:** Medium. Backend работает корректно, это UX-обман не блокер. Но виджет был разработан специально, ложное «55%» обесценивает работу. Карточка: [specs/_backlog/TZ_SimplyContextUsageWidget.md](../_backlog/TZ_SimplyContextUsageWidget.md), 138 строк.

### Stale .next cache регрессия (починена в сессии)

Во время валидации после `serverExternalPackages` change + серии kill/restart dev server, Владимир заметил **DevPanel footer перестал показываться** под новыми сообщениями (старые сохраняли footer из localStorage). Server отвечал 200 OK, emit через dataStream работал, но client parser не запускался или крашился тихо.

**Root cause:** stale webpack chunks в `.next/`. Серия restart с изменяющимся config оставила частично невалидные manifests. Client bundle был частично pre-changes, серверный — post.

**Фикс:** `rm -rf .next && npm run dev` + hard reload в браузере. Multi-PDF тест после этого подтвердил что всё работает.

**Зафиксировано** как архитектурная константа №8 + в [SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md) запись от 2026-04-16.

### Memory обновления

- `feedback_backlog_russian_term.md` (новая) — «хвосты» как русский slang для backlog. Владимир использует это слово в общении, зафиксировано чтобы будущие сессии понимали терминологию
- `MEMORY.md` индекс — строка про backlog terminology

---

## Блокеры / Открытые вопросы

- [ ] **ТЗ-XAI-4 открытые вопросы** (адресовать до ROADMAP):
  - Q1: Opus vs Grok 4.20 для Professor pipeline
  - Q2: Service chats — в scope или отдельно
  - Q3: Briefing variant Grok 4.1 Fast или 4.20
  - Q4: MiniMax catalog audit попутно или отдельно
- [ ] **TZ_SimplyContextUsageWidget** — новый хвост, не блокер, Medium приоритет
- [ ] **TZ_SimplyChatRaceCondition** — долг из миграционной сессии, в backlog
- [ ] **TZ_ErrorRecoveryUI Stage 2** — root cause, в backlog
- [ ] **MCP servers disconnected** — postgres/github/gmail/calendar/drive tools недоступны. Если для следующей сессии нужны SQL-проверки — либо reconnect MCP, либо psql через Bash

---

## Команды для проверки состояния

```bash
# Типы и билд
npx tsc --noEmit
npm run build  # ⚠ auto-runs migrations — предупреждать владельца ДО запуска

# Dev server
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Git log
git log --oneline -13  # 13 локальных коммитов ahead of origin

# Live xAI модели в task-assignments
grep -E "grok|Grok" lib/ai/task-assignments.ts

# Sanity-check новых файлов
ls -la lib/pdf/extract-pdf-text.ts
ls -la _archive/TZ_ATTACH_1_PdfUpload/
ls -la specs/_backlog/TZ_SimplyContextUsageWidget.md

# Verify pdf-parse в serverExternalPackages
grep "serverExternalPackages" next.config.ts
# Ожидается: serverExternalPackages: ["lamejs", "pdf-parse"],
```

---

## Накопленный опыт серии

1. **Правило №0 — семь раз отмерь.** Цена нарушения в v3.90.2: +1 ТЗ. Цена нарушения в v3.91.0: +2 итерации webpack interop + stale cache регрессия.
2. **Эмпирический smoke test перед рефакторингом — обязателен.** Трижды в серии спасал от неверных решений.
3. **ANALYSIS против реального кода > ТЗ от внешнего архитектора.** SPEC/ROADMAP писать самостоятельно после чтения кода.
4. **`/dev/models` switchboard снимает давление.** Defaults — стартовые точки, финальный выбор через override.
5. **Живые документы серии > локальные HANDOFF/CHANGELOG per ТЗ.** ROADMAP + CHANGELOG + NOTES + MIND_ARCHITECTURE + SIMPLY_ATTACHMENT_ARCHITECTURE дают полную картину.
6. **Side-effects от тестирования → backlog, не фикс сразу.** Исключение — если side-effect это системный bug связанный с текущим scope (v3.90.2 + v3.91.0 case).
7. **Grep before writing helper.** При добавлении функции в большой файл — grep типовых имён часто указывают на готовый код.
8. **Процессная дисциплина backlog.** Повторяющаяся не-блокер-проблема = немедленно в backlog. Устное «потом починим» без записи = сигнал к записи. **Hygiene cleanup закрытых ТЗ = часть release commit, не отдельная уборка.**
9. **Scope consolidation — правильный паттерн** когда две проблемы часть одного клубка legacy (v3.90.2 dead readDocument + R-6, v3.91.0 new PDF extract + fix v1 legacy).
10. **SSOT через model-catalog capabilities.** Никаких хардкодных флагов, никаких strip-функций через имя провайдера. Adapter через capabilities = единственный способ.
11. **Simply Chat = один persistent чат.** Терминология «в том же», «в этом», «новый» — запрещена.
12. **`serverExternalPackages` для ESM пакетов с workers.** pdf-parse и lamejs — оба требуют external declaration. Паттерн mammoth/xlsx dynamic import работает только для CJS или ESM-lite.
13. **После `next.config.ts` изменений — чистый rebuild.** HMR не пересобирает эти секции чисто. `rm -rf .next && npm run dev`.
14. **«Хвосты» = `_backlog/`.** Русский slang, в разговоре используем, в путях оставляем английское.

---

## Рекомендованный старт следующей сессии

```
1. Прочитать этот HANDOFF (5-10 мин)
2. Прочитать SIMPLY_ATTACHMENT_ARCHITECTURE.md (10 мин)
3. Прочитать memory/MEMORY.md целиком (2 мин)
4. npm run dev в background + проверить http://localhost:3000
5. Прочитать специфично раздел ТЗ-XAI-4 в SIMPLY_XAI_ROADMAP.md
6. Audit call sites — grep "getModel(" в lib/briefing/, lib/podcast/, lib/meeting/, professor pipeline
7. WebSearch актуальных docs.x.ai / docs.anthropic.com pricing (правило №0!)
8. Создать specs/TZ_XAI_4_UtilityPipelines/ANALYSIS.md
9. Задать Владимиру Q1-Q4 открытые вопросы
10. После ответов — ROADMAP → поэтапно код → тест → commit → архив
```

Эта сессия завершена. Следующему Claude Code — удачной работы. **Семь раз отмерь, один раз отрежь.** И после любой правки `next.config.ts` — `rm -rf .next && npm run dev`.
