# HANDOFF — Серия Simply_xAI миграции

**Последнее обновление:** 2026-04-15 (вечер, конец сессии v3.90.1 + v3.90.2 + SSOT архитектурного документа)
**Текущая версия проекта:** 3.90.2
**Последние коммиты локального master:**
- `59eb33a` release(v3.90.2): TZ_SimplyReadDocumentTool + R-6 correction через SSOT
- `516d600` release(v3.90.1): TZ_SimplyChatModeInjection — `<current_mode>`/`<current_model>` через SSOT
- `86de8ad` docs(xai-migration): HANDOFF после ТЗ-XAI-3 + Stage 1 ErrorRecoveryUI
- `fc8a995` fix(error-recovery): TZ_ErrorRecoveryUI Stage 1
- `8dfac7f` release(v3.90.0): ТЗ-XAI-3 — KITT + Think на Grok + R-6 cleanup

Этот документ — **мост между сессиями**, не замена ROADMAP. За детальными задачами всегда иди в `TZ_xai_N/ROADMAP.md` или `SIMPLY_XAI_CHANGELOG.md`.

---

## ⛔ Правило №0 перед любой работой: «Семь раз отмерь — один раз отрежь»

**Это закон, не рекомендация.** Нарушение = процессный провал, и урок из этой сессии показывает что цена высокая.

**Перед любой реализацией:**

1. **Изучить официальную документацию** внешних технологий — WebSearch + WebFetch актуальной документации SDK/API/библиотек. Knowledge cutoff = май 2025, всё новое (xAI, Grok, AI SDK v6, провайдеры моделей) **обязательно** читать заново. Не полагаться на локальный README в `node_modules/` — только first-party docs
2. **Изучить лучшие практики** — WebSearch на «best practices for X», GitHub issues, Stack Overflow для современных решений
3. **ANALYSIS против реального кода** — прочитать все файлы зоны работы, свериться с SSOT документами (SIMPLY_ATTACHMENT_ARCHITECTURE.md, MIND_ARCHITECTURE.md, model-catalog.ts, CLAUDE.md)
4. **Только потом** — план, код, тесты

**Процессный урок этой сессии (2026-04-15):** при ТЗ-XAI-3 я удалил `stripMediaPartsForTextModel` с обоснованием «Grok умеет vision». Это **не было верифицировано** через эмпирический тест с PDF. В ROADMAP серии ([SIMPLY_XAI_ROADMAP.md:96](SIMPLY_XAI_ROADMAP.md#L96)) было явное предупреждение «НЕ полагаться на маршрутизацию, убирать причину, а не симптом». Я понял его неправильно и пропустил разделение `capabilities.vision` vs `documentSupport.supported`. Через сутки pre-existing bug вылез на реальном тесте → потребовался v3.90.2 patch. **Цена: +1 ТЗ, +1 смены контекста, +1 сессия**.

**Вывод:** ANALYSIS против кода ≠ поверхностное чтение. Если в коде есть функция которая что-то делает хрупкое — 99% случаев она делает это **зачем-то**. Удаление без замены через SSOT — антипаттерн. Правило закреплено в SIMPLY_XAI_NOTES.md и в памяти.

---

## Прогресс серии

- [x] **ТЗ-XAI-1** — Фундамент (v3.88.0) — удалён `grok-4`, notes про multi-agent, архитектура защиты контекста зафиксирована
- [x] **ТЗ-XAI-2** — MIND pipeline → Grok (v3.89.0) — 5 memory-задач на xAI split-стратегией, native `generateObject`, MIND_ARCHITECTURE.md
- [x] **ТЗ-XAI-3** — KITT + Think → Grok (v3.90.0) — `simply-chat` → Grok 4.1 Fast, `simply-chat-think` → Grok 4.20, R-6 cleanup (неполный — см. v3.90.2)
- [x] **ТЗ-SimplyChatModeInjection** (вне серии, v3.90.1) — плейсхолдеры `<current_mode>`/`<current_model>` через SSOT model-catalog
- [x] **ТЗ-SimplyReadDocumentTool + R-6 correction** (v3.90.2) — `adaptHistoryToCapabilities` через SSOT + удаление dead `readDocument` tool
- [ ] **ТЗ-ATTACH-1** — PDF text extraction при upload (**СЛЕДУЮЩИЙ**) ← приоритет из нового архитектурного документа
- [ ] ТЗ-XAI-4 — Utility/Pipeline batch миграция (briefing, podcast, meeting, professor, title)
- [ ] ТЗ-XAI-5 — Create/Expertise → Grok 4.20 (+ R-5 expertise single-agent)
- [ ] ТЗ-XAI-6 — Очистка MiniMax/OpenRouter
- [ ] ТЗ-XAI-COL-1 — Collections API для Библиотеки (после серии)

---

## 🎯 Главный новый SSOT документ серии — прочитать ПЕРВЫМ

**[specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md](SIMPLY_ATTACHMENT_ARCHITECTURE.md)** — утверждённый 2026-04-15 архитектурный стандарт обработки вложений в Simply. Составлен Владимиром с архитекторами.

**Ключевой принцип:** «Максимум работы при загрузке файла, минимум при разговоре».

**Три слоя обработки:**
- **Слой 0** — серверное извлечение при upload ($0, без AI, миллисекунды). DOCX/XLSX/TXT/MD/CSV уже работают. **PDF — запланировано в ТЗ-ATTACH-1**
- **Слой 1** — KITT routing: текст → Grok, изображения/PDF → Haiku (гибрид без sticky)
- **Слой 2** — Экспертиза (глубокий анализ с tools)
- **Слой 3** — Библиотека (RAG: MIND сейчас + Collections в будущем)

**5 принятых решений, не пересматриваются до завершения миграции:**

1. Гибрид Grok + Haiku для KITT
2. Haiku отвечает напрямую при вложении (один вызов, не двухшаговый)
3. **`adaptHistoryToCapabilities` через SSOT model-catalog — единственный механизм адаптации истории.** Никаких хардкодных strip-функций. Реализовано в v3.90.2
4. PDF text extraction при upload — приоритетное улучшение (ТЗ-ATTACH-1), не блокирует миграцию xAI
5. Пороги размеров — эмпирически, не с потолка

**Почему этот документ критичен для следующей сессии:** ТЗ-ATTACH-1 — прямая реализация Слоя 0 для PDF из этого документа. Всё что ты будешь делать должно сверяться с принятыми решениями. Документ помечен как «архитектурный стандарт... изменения только при пересмотре архитектуры, не при каждом ТЗ».

Ссылка на документ уже добавлена в [CLAUDE.md](../../CLAUDE.md) секцию «Техническая (AI) — архитектурные стандарты» как обязательное чтение. Загружается автоматически в каждой сессии.

---

## Следующая сессия: порядок действий

### Что читать на старте (15 минут)

Порядок важен — от общего к частному:

1. **[SIMPLY_ATTACHMENT_ARCHITECTURE.md](SIMPLY_ATTACHMENT_ARCHITECTURE.md)** — SSOT для всей attachment работы (10 минут)
2. **[SIMPLY_XAI_ROADMAP.md](SIMPLY_XAI_ROADMAP.md)** — карточка ТЗ-ATTACH-1 (строки 108+), обновлённая прогресс-таблица
3. **[specs/_backlog/TZ_ATTACH_PdfExtractionAtUpload.md](../_backlog/TZ_ATTACH_PdfExtractionAtUpload.md)** — детальный scope следующего ТЗ с открытыми вопросами
4. **[SIMPLY_XAI_CHANGELOG.md](SIMPLY_XAI_CHANGELOG.md)** — записи v3.90.1, v3.90.2, XAI-3 наверху
5. **[SIMPLY_XAI_NOTES.md](SIMPLY_XAI_NOTES.md)** — уроки сессии
6. **[MIND_ARCHITECTURE.md](MIND_ARCHITECTURE.md)** — только если правки памяти (в ATTACH-1 не должно быть)

### Что запустить до работы

```bash
# Проверить что всё компилится (версия 3.90.2, 9 коммитов в master ahead of origin)
npx tsc --noEmit

# Поднять dev server в фоне (предыдущий остановлен в конце сессии после коммита)
npm run dev

# Проверить dev overrides — должно быть только expertise + create (область XAI-5)
cat .simply-dev-overrides.json
# Ожидается: {"expertise":"grok-4.20-0309-reasoning","create":"claude-haiku-4-5-20251001"}

# Проверить что ATTACH-1 backlog stub на месте
ls -la specs/_backlog/TZ_ATTACH_PdfExtractionAtUpload.md
```

### Memory refresh

`~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/MEMORY.md` — прочитать полностью в начале. Критичные записи:

- **`project_simply_chat_persistent.md`** — Simply Chat один persistent на userId. **Никогда** не писать «новый Simply чат», «в том же Simply чате» и т.п. Владимир напоминал 12+ раз
- **`feedback_official_docs_first.md`** — Правило №0 выше
- **`feedback_no_external_architect.md`** — ANALYSIS против кода > ТЗ от стороннего архитектора
- **`project_simply_xai_migration.md`** — активная серия, не отвлекаться

---

## 🥇 Рекомендованный следующий шаг — ТЗ-ATTACH-1

### Почему это приоритет из архитектурного документа

Текущее состояние (после v3.90.2):
- PDF при загрузке → файл как `application/pdf` в Vercel Blob → роутинг `simply-chat-vision` → Haiku 4.5 обрабатывает нативно
- **Каждый** вопрос про PDF стоит токенов Haiku ($0.80/$4 per 1M) даже если PDF чисто текстовый
- Grok 4.1 Fast ($0.20/$0.50) мог бы обрабатывать текстовый PDF в 4-8× дешевле, но он не принимает PDF file parts (xAI Files API не интегрирован)

Целевое состояние (после ТЗ-ATTACH-1):
- PDF при загрузке → сервер извлекает текст библиотекой → если `>30 chars/page` → конверт в `text/plain` → маршрут `simply-chat` (Grok 4.1 Fast inline)
- Сканированные PDF (мало текста) → остаются как `application/pdf` → Haiku (как сейчас)
- Один механизм, SSOT, **capability-agnostic через документ**

### Scope из backlog stub

Полный scope в **[specs/_backlog/TZ_ATTACH_PdfExtractionAtUpload.md](../_backlog/TZ_ATTACH_PdfExtractionAtUpload.md)**. Краткая версия:

1. **Выбор PDF library** — проверить что уже в `node_modules/` (`pdfjs-dist`, `pdf-parse`, `unpdf`). Свериться с [lib/ai/vision-ocr.ts](../../lib/ai/vision-ocr.ts) (`extractTextFromPDF`) — какая библиотека уже используется для Claude Vision PDF. Критерии: работает на Vercel serverless, без нативных зависимостей, корректно с кириллицей
2. **Эвристика scan detection** — `avgCharsPerPage = text.length / pageCount`. Стартовый порог 30 chars/page, уточнить эмпирически на реальных PDF Владимира
3. **Интеграция в [app/(chat)/api/files/upload/route.ts](../../app/(chat)/api/files/upload/route.ts)** — добавить PDF branch рядом с существующими DOCX (мамот)/XLSX (xlsx) ветками на строках 96-140
4. **Обновить analyze-document SKILL** — теперь PDF inline как DOCX
5. **Adapter в `adaptHistoryToCapabilities`** — оставить PDF placeholder branch (мёртвый но безвредный fallback для сканированных PDF после conversion/Haiku в истории)

### Первые действия

```
1. Прочитать SIMPLY_ATTACHMENT_ARCHITECTURE.md (10 мин)
2. Прочитать backlog stub TZ_ATTACH_PdfExtractionAtUpload.md (5 мин)
3. Прочитать upload route.ts (существующая DOCX/XLSX логика, 5 мин)
4. Прочитать lib/ai/vision-ocr.ts (что используется для Haiku PDF, 5 мин)
5. ls node_modules/ — что из PDF библиотек уже есть, чтобы не тянуть новое
6. WebSearch документацию выбранной библиотеки (правило №0!) — best practices, Vercel serverless compatibility, cyrillic support
7. Создать specs/TZ_ATTACH_1_PdfUpload/ с ANALYSIS.md
8. Задать Владимиру открытые вопросы перед ROADMAP:
   - Q1: Какая PDF library? (ответ через аудит node_modules + WebSearch)
   - Q2: Порог scan detection? (рекомендовать 30 chars/page как старт)
   - Q3: Ограничение на размер PDF? (есть в документе — «большие документы → Экспертиза», пороги эмпирически — решить стартовые)
   - Q4: Handling encrypted PDF? (graceful fallback на Haiku при ошибке)
9. После ответов Владимира — ROADMAP → поэтапно код → мануальный тест → commit
```

**Эстимейт:** 1-2 сессии. Потенциально одна если выбор библиотеки очевиден и Vladimir отвечает быстро.

---

## Альтернативы (если ATTACH-1 откладывается)

### 🥈 Вариант B — ТЗ-XAI-4 (основной путь серии)
Utility/Pipeline batch миграция ~12 call sites. Описан в [SIMPLY_XAI_ROADMAP.md:132+](SIMPLY_XAI_ROADMAP.md). Открытые вопросы:
- Q1: Opus vs Grok 4.20 для Professor pipeline
- Q2: Service chats в scope или отдельно
- Q3: Briefing pipeline variant Grok

### 🥉 Вариант C — TZ_SimplyChatRaceCondition (долг из сессии)
Partial unique index + `onConflictDoNothing` для `getOrCreateSimplyChat`. 0.5 сессии. См. [specs/_backlog/TZ_SimplyChatRaceCondition.md](../_backlog/TZ_SimplyChatRaceCondition.md). ⚠️ **Миграция на prod БД требует аудита дубликатов ДО применения.**

### Вариант D — TZ_ErrorRecoveryUI Stage 2
Root cause через useChat state recovery. Не блокер, давний долг.

---

## Архитектурные константы серии (не забыть)

1. **Защита контекста не привязана к размеру провайдерского окна.** Sliding window (140K) + Extract-on-compression независимы. Compaction API живёт для Haiku vision через capability-check
2. **Simply Chat «Думать» = tier upgrade.** `simply-chat` = Grok 4.1 Fast ($0.20/$0.50), `simply-chat-think` = Grok 4.20 non-reasoning ($2/$6). Variant non-reasoning подтверждён smoke-тестом как продуктовое решение. Reasoning вариант доступен через `/dev/models`
3. **`reasoningEffort` не передавать** в Grok 4.1 Fast / 4.20 (reasoning и non-reasoning варианты) — эмпирически падает `Bad Request`. Только multi-agent принимает
4. **`adaptHistoryToCapabilities` через SSOT model-catalog** — единственный механизм адаптации истории. Живёт в [chat/route.ts:252-344](../../app/(chat)/api/chat/route.ts#L252), читает `effectiveCatalogEntry?.capabilities`. Не изобретать новых strip-функций
5. **Simply Chat = один persistent чат на пользователя** (после MIND/RAG). Новые «диалоги» только в /expertise /create /projects. Все тесты в Simply — **в** persistent чате, не «в новом» и не «в том же»
6. **`capabilities.vision` ≠ `documentSupport.supported`.** Первое про изображения (image/*), второе про PDF (application/pdf). Grok 4.1 Fast: vision=true, documentSupport.supported=false. Путать — антипаттерн

---

## Критичное состояние для следующей сессии

### Dev-сервер в фоне
- В конце сессии закрыт (два рестарта в ходе сессии, последний `bcoqbg9od`)
- На старте следующей сессии — `npm run dev` в background + проверить что HMR пересобирает чисто
- Если внезапные `ConnectTimeoutError` при DB запросах — hard restart (stale Neon connection pool)

### Активные dev overrides
```json
{"expertise":"grok-4.20-0309-reasoning","create":"claude-haiku-4-5-20251001"}
```
Область ТЗ-XAI-5. `simply-chat` / `simply-chat-think` — без overrides, дефолты честно указывают на Grok.

### Git state
**9 коммитов ahead of origin/master.** Все локально, не отпушены. Push — отдельная команда Владимира когда будет готов.

```
59eb33a  release(v3.90.2): TZ_SimplyReadDocumentTool + R-6 correction через SSOT
516d600  release(v3.90.1): TZ_SimplyChatModeInjection — <current_mode>/<current_model> через SSOT
86de8ad  docs(xai-migration): HANDOFF после ТЗ-XAI-3 + Stage 1 ErrorRecoveryUI
fc8a995  fix(error-recovery): TZ_ErrorRecoveryUI Stage 1
8dfac7f  release(v3.90.0): ТЗ-XAI-3 — KITT + Think на Grok + R-6 cleanup
2272e67  docs(xai-migration): HANDOFF после ТЗ-XAI-2 для следующей сессии
1481141  release(v3.89.0): ТЗ-XAI-2 — MIND pipeline миграция на Grok
6fd1fbb  docs(xai-migration): CHANGELOG серии + verified Grok params
ba9e928  release(v3.88.0): ТЗ-XAI-1 — фундамент миграции на xAI
```

### Pre-existing untracked файлы (НЕ ТРОГАТЬ без команды)
```
?? specs/TZ_RAG_SimplyRAG/AUDIT_REPORT.md   # Был untracked ещё до этой сессии
```

---

## Что сделано в этой сессии (2026-04-15, v3.90.1 + v3.90.2 + SSOT anchors)

**Одна плотная сессия закрыла два долга + зафиксировала новый архитектурный стандарт.**

### ТЗ-SimplyChatModeInjection (v3.90.1, commit `516d600`)
Плейсхолдеры `<current_mode>` и `<current_model>` в [lib/prompts/chat/simply-chat.md](../../lib/prompts/chat/simply-chat.md) подменяются композером через SSOT model-catalog (displayName из `getModelEntry(getModelIdForTask(activeTaskId))`). Было: два легаси-`modelMap` с Claude-псевдонимами эпохи до xAI/MiniMax. `activeTaskId` computation поднят в [chat/route.ts](../../app/(chat)/api/chat/route.ts) до prompt-building. `buildChatPrompt/Expertise/Create` принимают опциональный `activeTaskId`. Regex-replace вместо точного match — дефолты в .md безопасно редактируются.

**Валидация:** 5/5 мануальных тестов (simply/think/vision/expertise-override/create-override). Бонус-подтверждение `.txt` attachment не регрессировал.

### ТЗ-SimplyReadDocumentTool + R-6 correction (v3.90.2, commit `59eb33a`)

**Объединённый cleanup двух связанных проблем одним коммитом.** 20 файлов, +1071/-420.

**(1) Dead readDocument tool удалён:**
- Git audit (`62540ff` cleanup 2.0.0) показал что папка `knowledge/` удалена ещё в v2.0.0 «cleanup: remove old MIR.TRADE files» (126 файлов). Tool жёстко привязан к этой папке через security check — всегда возвращал `Access denied` в любом режиме
- Удалён [lib/ai/tools/read-document.ts](../../lib/ai/tools/read-document.ts) (243 строки), render block в [components/message.tsx](../../components/message.tsx) (52 строки), 4 места в [lib/ai/tools/chat-tools.ts](../../lib/ai/tools/chat-tools.ts), упоминания в 3 промптах
- `analyze-document` SKILL переписан под modern pipeline (inline text + parseExcel)

**(2) R-6 correction через `adaptHistoryToCapabilities`:**
- **Pre-existing bug:** в ТЗ-XAI-3 я удалил `stripMediaPartsForTextModel` с обоснованием «Grok умеет vision → логика умирает». Это было **ошибочное упрощение** — я смешал `capabilities.vision` (image/*) и `documentSupport.supported` (application/pdf). Grok 4.1 Fast vision=true но documentSupport=false (xAI Files API не интегрирован). Результат: любой follow-up текстового сообщения после PDF attachment → Grok crash с `AI_UnsupportedFunctionalityError`
- **Правильная реализация:** новая функция `adaptHistoryToCapabilities(messages, capabilities)` в [chat/route.ts:252-344](../../app/(chat)/api/chat/route.ts#L252). Читает `effectiveCatalogEntry.capabilities` из SSOT model-catalog, заменяет `image/*` без vision и `application/pdf` без documentSupport на текстовые placeholder-ы. Интеграция в preparedHistory pipeline через gate на `chatMode === "simply"`
- **Буквальная реализация принятого решения №3** из утверждённого 2026-04-15 архитектурного документа SIMPLY_ATTACHMENT_ARCHITECTURE.md

**(3) SSOT anchor-ы для архитектурного документа:**
- [SIMPLY_XAI_ROADMAP.md](SIMPLY_XAI_ROADMAP.md) — добавлена секция «Архитектурные стандарты» + новый этап ТЗ-ATTACH-1 между XAI-3 и XAI-4
- [CLAUDE.md](../../CLAUDE.md) — документ в навигации как обязательное чтение при работе с attachments
- [specs/_backlog/TZ_ATTACH_PdfExtractionAtUpload.md](../_backlog/TZ_ATTACH_PdfExtractionAtUpload.md) — stub следующего ТЗ
- [specs/_backlog/README.md](../_backlog/README.md) — реструктурирован (High/Medium impact)

**Валидация:** 6/6 мануальных тестов в Simply Chat. **Главный тест:** текстовый follow-up после PDF в истории → Grok отвечает через placeholder, нет crash. **Бонус — cross-model continuity:** продолжение разговора после того как описание PDF сделано Haiku → follow-up идёт на Grok через placeholder → работает бесшовно. Это именно то что документ называет «общая память между моделями».

### Процессный урок сессии (зафиксирован в памяти)

Владимир подготовил с архитекторами SIMPLY_ATTACHMENT_ARCHITECTURE.md **после** того как я начал v3.90.2 hotfix для pre-existing bug. При сверке оказалось что моя реализация **уже соответствует** принятому решению №3 документа буквально — именно функция `adaptHistoryToCapabilities` через SSOT. То есть документ валидировал мой подход. Но также выявил что в ТЗ-XAI-3 я нарушил правило «убирать причину через SSOT, не симптом» — удалил strip-функции без замены.

**Уроки:**
1. **ANALYSIS против кода должен быть глубоким, не поверхностным.** Если функция делает что-то «хрупкое» — она делает это зачем-то. Удаление без замены через SSOT = антипаттерн
2. **Capabilities ≠ один флаг.** Два разных capability (vision и documentSupport) — это два разных concept. Унифицировать через discriminated union в каталоге — единственный правильный путь
3. **Scope consolidation бывает правильным.** readDocument cleanup и R-6 correction — оба про capability-agnostic cleanup. Разделение удвоило бы тесты без пользы. Один коммит, связный scope

### Memory обновления

- `project_simply_chat_persistent.md` — усилен раздел «терминология». Фразы «в том же Simply чате», «в этом Simply чате», «новый Simply чат» **запрещены**. Владимир повторял это 12+ раз — больше не забывать

---

## Блокеры / Открытые вопросы

- [ ] **ТЗ-ATTACH-1 открытые вопросы** — адресовать до ROADMAP (см. раздел «Следующий шаг» выше):
  - Выбор PDF library (через аудит node_modules + WebSearch)
  - Порог scan detection (стартовое 30 chars/page, уточнять эмпирически)
  - Ограничение на размер PDF (из документа «большие документы → Экспертиза», пороги эмпирически)
  - Handling encrypted PDF (graceful fallback на Haiku при ошибке)
- [ ] **Opus vs Grok 4.20 для Professor pipeline** — вопрос для ТЗ-XAI-4, не этой сессии
- [ ] **Service chats в scope XAI-4?** — вопрос для ТЗ-XAI-4, не этой сессии
- [ ] **TZ_SimplyChatRaceCondition** — долг из миграционной сессии, в backlog, ждёт приоритизации
- [ ] **TZ_ErrorRecoveryUI Stage 2** — root cause, в backlog

---

## Команды для проверки состояния

```bash
# Типы и билд
npx tsc --noEmit
npm run build

# Dev server
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Git log
git log --oneline -12

# Live xAI модели в task-assignments
grep -E "grok|Grok" lib/ai/task-assignments.ts

# Sanity-check архитектурный документ присутствует
ls -la specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md
```

---

## Накопленный опыт серии

1. **Правило №0 — семь раз отмерь.** Официальная документация + лучшие практики + ANALYSIS против кода **до** любой реализации. Цена нарушения в этой сессии: v3.90.2 patch через сутки после XAI-3
2. **Эмпирический smoke test перед рефакторингом — обязателен.** Трижды в серии спасал от неверных решений (reasoningEffort в XAI-1, generateObject в XAI-2, convertTextFilesInAllMessages dup в XAI-3)
3. **ANALYSIS против реального кода > ТЗ от внешнего архитектора.** SPEC/ROADMAP писать самостоятельно после чтения кода — быстрее и точнее
4. **`/dev/models` switchboard снимает давление.** Defaults — стартовые точки, финальный выбор через override
5. **Живые документы серии > локальные HANDOFF/CHANGELOG per ТЗ.** ROADMAP + CHANGELOG + NOTES + MIND_ARCHITECTURE + **SIMPLY_ATTACHMENT_ARCHITECTURE** дают полную картину
6. **Side-effects от тестирования → backlog, не фикс сразу.** Исключение — если side-effect это системный bug связанный с текущим scope (v3.90.2 case)
7. **Grep before writing helper.** При добавлении функции в большой файл — grep типовых имён + diagnostic hints про `"declared but never used"` часто указывают на готовый код
8. **Процессная дисциплина backlog.** Повторяющаяся не-блокер-проблема = немедленно в backlog. Устное «потом починим» без записи = сигнал к записи
9. **Scope consolidation — правильный паттерн** когда две проблемы часть одного клубка legacy. Разделение на два коммита удвоит тесты без выигрыша
10. **SSOT через model-catalog capabilities.** Никаких хардкодных флагов `isSimplyNonAnthropicModel`, никаких strip-функций через имя провайдера. Adapter через capabilities = единственный способ
11. **Simply Chat = один persistent чат.** Терминология «в том же», «в этом», «новый» — запрещена. Владимир 12+ раз повторял

---

## Рекомендованный старт следующей сессии

```
1. Прочитать этот HANDOFF (5-10 мин)
2. Прочитать SIMPLY_ATTACHMENT_ARCHITECTURE.md (10 мин) — SSOT для всей работы
3. Прочитать memory/MEMORY.md целиком (2 мин)
4. npm run dev в background + проверить http://localhost:3000
5. Прочитать backlog stub TZ_ATTACH_PdfExtractionAtUpload.md
6. ls node_modules/ на PDF libraries (pdf-parse, pdfjs-dist, unpdf)
7. WebSearch актуальной документации найденной библиотеки (правило №0!)
8. Создать specs/TZ_ATTACH_1_PdfUpload/ANALYSIS.md
9. Задать Владимиру 4 открытых вопроса
10. После ответов — ROADMAP → поэтапно код → тест → commit → архив
```

Эта сессия завершена. Следующему Claude Code — удачной работы. **Семь раз отмерь, один раз отрежь.**
