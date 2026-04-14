# ТЗ-XAI-3 — ROADMAP: KITT → Grok 4.1 Fast + R-6

**Создано:** 2026-04-15
**Статус:** Ожидает согласования Владимира перед началом работы
**Зависимости:** ANALYSIS.md согласован (Q1-Q5 отвечены 2026-04-15)
**Целевая версия:** v3.90.0

> Поэтапный план. Каждый этап заканчивается валидацией. Не переходить к следующему этапу без `[x]` на всех задачах текущего и подтверждения от Владимира где указано.

---

## Решения из ANALYSIS (зафиксированы)

| Q | Решение |
|---|---|
| Q1 | Удалить `stripLegacyOpenAICompatToolParts` полностью — БД не содержит legacy parts, страховать нечего |
| Q2 | `temperature: 0.7` для всего `chatMode === "simply"` (стабильность дворецкого, не провайдер-специфично) |
| Q3 | Сохранить inline-ветку для `text/plain` — выделить в `inlineTextFileParts()` helper |
| Q4 | SQL audit prod не нужен — БД пустая от legacy данных |
| Q5 | Scope подтверждён, см. §2 |

---

## Scope ТЗ-XAI-3

**Входит:**
1. `simply-chat` default → `grok-4-1-fast-non-reasoning`
2. **`simply-chat-think` default → `grok-4.20-0309-non-reasoning`** (расширение scope 2026-04-15 по запросу Владимира — нет смысла оставлять Sonnet на переходный период; вариант B reasoning остаётся доступным через `/dev/models`)
3. R-6 cleanup: удалить `isSimplyNonAnthropicModel`, `stripMediaPartsForTextModel`, `stripLegacyOpenAICompatToolParts`
4. Выделить `inlineTextFileParts()` helper для text/plain (провайдер-агностичный)
5. Упростить сборку `preparedHistory`
6. Temperature → 0.7 для `chatMode === "simply"` (всех трёх подроутов), 1.0 для остальных
7. Снять dev overrides `simply-chat` / `simply-chat-think` перед smoke-тестом
8. Smoke-тесты: текст, tools, фото, text/plain файл, think, MIND retrieve
9. Валидация: tsc + build
10. Финализация серии: CHANGELOG + NOTES + progress + version bump + commit
11. ТЗ-XAI-5 scope: сузить в ROADMAP серии — убрать `simply-chat-think`, остаются только Create + Expertise + R-5

**Не входит:**
- Create / Expertise миграция на Grok 4.20 (ТЗ-XAI-5)
- Удаление MiniMax namespace из registry (ТЗ-XAI-6)
- Удаление `vercel-minimax-ai-provider` package (ТЗ-XAI-6)
- Briefing/podcast/meeting миграция (ТЗ-XAI-4)
- Compaction API cleanup (остаётся живым для vision-маршрута на Haiku, финальная чистка в ТЗ-XAI-6 когда примется решение по vision)

---

## Этап 1 — Default моделей KITT на Grok

**Цель:** две строки в `task-assignments.ts`. Пока dev override активен, итоговое поведение не меняется — но код становится честным.

- [x] **1.1** В [lib/ai/task-assignments.ts](../../../lib/ai/task-assignments.ts) заменить `"simply-chat": "MiniMax-M2.7"` → `"simply-chat": "grok-4-1-fast-non-reasoning"`
- [x] **1.2** Заменить `"simply-chat-think": "claude-sonnet-4-6"` → `"simply-chat-think": "grok-4.20-0309-non-reasoning"`
- [x] **1.3** Обновлены inline-комментарии типов в `TaskId` (L27-29) + комментарий-блок перед defaults с обоснованием решения
- [x] **1.4** `npx tsc --noEmit` → 0 ошибок

**Чекпоинт:** ✅ валидация пройдена 2026-04-15. Переход к Этапу 2.

**Комментарий:** Одновременно с default swap добавлен комментарий в `DEFAULT_TASK_MODELS` перед блоком Simply Chat — зафиксировано продуктовое обоснование (KITT butler, Think = tier upgrade, vision остаётся на Haiku). Комментарий небольшой, но снимает непонимание «почему две разных Grok семьи для двух taskId» у будущих сессий.

---

## Этап 2 — R-6: очистка `chat/route.ts`

**Цель:** убрать три куска хрупкой логики, заменить на провайдер-агностичный helper для text/plain. Все изменения в одном файле [app/(chat)/api/chat/route.ts](../../../app/(chat)/api/chat/route.ts).

- [x] **2.1** Создана функция `inlineTextFileParts(messages)` (заменила `stripMediaPartsForTextModel`). Только инлайнит text/plain file parts, image/non-text file parts не трогает
- [x] **2.2** `stripMediaPartsForTextModel` удалена (заменена через единый Edit на `inlineTextFileParts`)
- [x] **2.3** `stripLegacyOpenAICompatToolParts` удалена целиком (не было доказанных legacy parts в БД)
- [x] **2.4** `isSimplyNonAnthropicModel` удалён + комментарий-блок над ним
- [x] **2.5** `preparedHistory` упрощено — один вложенный условник вместо двух, комментарий переписан
- [x] **2.6** Temperature → `chatMode === "simply" ? 0.7 : 1.0` с обновлённым комментарием про стабильность дворецкого
- [x] **2.7** `npx tsc --noEmit` → 0 ошибок

**Чекпоинт:** ✅ валидация пройдена 2026-04-15. Переход к Этапу 3.

**Комментарий:** Edit велись по одному (Edit tool требует уникальные строки), IDE диагностика ожидаемо ругалась после каждого промежуточного шага — это нормальный транзитный стейт. После финального Edit (temperature) диагностика чистая, `tsc --noEmit` пустой вывод = 0 ошибок.

---

## Этап 2.5 — Пост-регрессионный фикс text/plain history (2026-04-15)

**Контекст:** Шаг 4 теста прошёл (inlineTextFileParts сработала на новом сообщении), шаг 5 (Think) упал с `AI_UnsupportedFunctionalityError: 'file part media type text/plain' functionality not supported`. Владимир правильно заметил что это блокер тестов + поднял процессный упрёк про 9-й раз повторяющуюся проблему «error state блокирует следующее сообщение» — создан отдельный backlog [`specs/_backlog/TZ_ErrorRecoveryUI.md`](../../_backlog/TZ_ErrorRecoveryUI.md).

**Root cause двойной:**
1. [chat/route.ts:416](../../../app/(chat)/api/chat/route.ts#L416) `saveMessages` сохраняла `message.parts` (оригинал с file part), а не `processedMessage.parts` (после L385 конверсии). В БД летел file part → следующий запрос подтягивал его обратно из истории → xAI захлёбывался
2. Моя `inlineTextFileParts` проверяла `typeof p.text === "string"` — но rehydrated из БД parts имели только `.url`, не `.text` → функция пропускала их → file part доезжал до SDK

**Фикс:**
- [x] **2.5.1** Удалена `inlineTextFileParts` функция целиком
- [x] **2.5.2** `preparedHistory` использует `await convertTextFilesInAllMessages(cleanedHistory)` — уже существовавший async helper который умеет fetchить `part.url` по Vercel Blob и инлайнить содержимое. Он уже объявлен в файле, но до этого был unused (diagnostic hint ранее)
- [x] **2.5.3** `saveMessages` теперь сохраняет `processedMessage.parts` + `estimateMessageTokens(processedMessage.parts)` — БД будет всегда хранить text parts, никакие legacy file parts не попадут в историю для будущих чатов
- [x] **2.5.4** `npx tsc --noEmit` → 0 ошибок
- [ ] **2.5.5** Retry смоук-тесты: text/plain файл + Think кнопка → ожидается работа без ошибок

**Ключевой урок (для серийных NOTES):**
Моя функция `inlineTextFileParts` была дубликатом уже существующего `convertTextFilesInAllMessages` — я не проверил что именно уже есть в файле перед тем как писать свой helper. Diagnostic hint `"convertTextFilesInAllMessages is declared but value never read"` был виден сразу после первой правки Этапа 2, но я его проигнорировал как pre-existing noise. Оказалось это готовое решение для моей задачи, и пропуск сэкономленные минут обернулся регрессией + 30 минутами debug'а. **Правило:** при добавлении helper'а сначала grep на типовые имена в целевом файле, потом смотреть на diagnostic hints про unused declarations — они часто указывают на dead-but-useful code.

---

## Этап 3 — Build + подготовка к smoke-тестам

- [ ] **3.1** `npm run build` → успешен (ВНИМАНИЕ: build автоматически накатывает pending migrations через `tsx lib/db/migrate` — зафиксировано в memory `build_pipeline_auto_migration`. В этом ТЗ миграций нет, но привычка — предупреждать)
- [ ] **3.2** Проверить что dev server `bb2h4xfyd` ещё жив (`tail /tmp/claude-501/-Users-mactm-Projects-NegotiateAI-Chatbot/tasks/bb2h4xfyd.output`). Если мёртв — перезапустить `npm run dev` в background
- [ ] **3.3** **Снять dev overrides** — отредактировать `.simply-dev-overrides.json`:
  ```json
  {"expertise":"grok-4.20-0309-reasoning","create":"claude-haiku-4-5-20251001"}
  ```
  Удалить `simply-chat` и `simply-chat-think` записи — теперь они должны резолвиться через новый default (Grok) и сохранённый Sonnet соответственно. Expertise и create — не трогать, это ТЗ-XAI-4/XAI-5 зона
- [ ] **3.4** Открыть `/dev/models` в браузере, визуально подтвердить что:
  - `simply-chat` показывает effective = `grok-4-1-fast-non-reasoning`, **no override badge**
  - `simply-chat-think` показывает effective = `grok-4.20-0309-non-reasoning`, **no override badge**
  - `simply-chat-vision` показывает effective = `claude-haiku-4-5-20251001`, **no override badge**

**Чекпоинт:** overrides сняты, dev UI подтверждает честные defaults → Этап 4.

---

## Этап 4 — Smoke-тесты (мануальный)

**Перед каждым тестом:** очистить историю текущего Simply чата или создать новый, чтобы контекст не мешал интерпретации.

- [ ] **4.1 Текст-only:**
  - В Simply Chat (/simply) отправить: «Привет, какую модель ты используешь?»
  - **Ожидаю:** ответ от Grok 4.1 Fast. Могу проверить через:
    - DevPanel (нижний бар под ответом) → `grok-4-1-fast-non-reasoning`
    - Логи `[Chat API] Model selection: chatMode=simply, task=simply-chat, model=grok-4-1-fast-non-reasoning`
  - **Запрос Владимиру:** подтвердить OK, качество ответа приемлемое
- [ ] **4.2 Tools — простой:**
  - Отправить: «Сколько сейчас времени?» или «Найди информацию про Neon Postgres»
  - **Ожидаю:** Grok вызывает инструмент (getCurrentDateTime или fetchUrl), получает результат, отвечает пользователю. Function calling в Chat Completions работает
  - **Запрос Владимиру:** подтвердить OK
- [ ] **4.3 Vision — фото:**
  - Прикрепить скриншот или картинку, отправить «Что на картинке?»
  - **Ожидаю:** routing через `simply-chat-vision` → Claude Haiku 4.5. Логи: `task=simply-chat-vision, model=claude-haiku-4-5-20251001`
  - **Если вдруг упадёт на Grok** — это регрессия, hasAttachments сломался. Stop, debug.
  - **Запрос Владимиру:** подтвердить OK
- [ ] **4.4 text/plain файл:**
  - Загрузить `.txt` файл (создать заранее с коротким текстом), отправить «Что написано в файле?»
  - **Ожидаю:** routing через `simply-chat` → Grok 4.1 Fast. Содержимое файла инлайнится через новую `inlineTextFileParts` как `--- Файл: name.txt ---\n{content}\n--- Конец файла ---`. Grok видит контент, отвечает по сути
  - **Запрос Владимиру:** подтвердить OK
- [ ] **4.5 Think button:**
  - Отправить обычный текст с включённой кнопкой «Думать»
  - **Ожидаю:** routing через `simply-chat-think` → Grok 4.20 non-reasoning. Логи: `task=simply-chat-think, model=grok-4.20-0309-non-reasoning`. Ответ должен быть заметно умнее/подробнее чем без think (tier upgrade $0.20→$2, ×10 дороже input)
  - **Запрос Владимиру:** подтвердить качество tier upgrade чувствуется, решить нужен ли позже переход на `-reasoning` вариант (override через /dev/models)
- [ ] **4.6 MIND retrieve:**
  - Отправить сообщение, связанное с каким-то фактом, который у тебя уже есть в MIND (например «напомни что я решил про X»)
  - **Ожидаю:** DevPanel секция RAG показывает извлечённые факты, системный промпт содержит `<memory>` блок. Retrieval работает независимо от провайдера
  - **Запрос Владимиру:** подтвердить OK

**Чекпоинт:** все 6 сценариев OK от Владимира → Этап 5. Любой фейл → остановка, debug, повтор.

---

## Этап 5 — Финализация

- [ ] **5.1** Версия: bump в [package.json](../../../package.json) до `3.90.0`
- [ ] **5.2** Глобальный [CHANGELOG.md](../../../CHANGELOG.md) — добавить запись `## [3.90.0] - 2026-04-15 — ТЗ-XAI-3: KITT на Grok 4.1 Fast + R-6 cleanup` с описанием изменений
- [ ] **5.3** Серийный [SIMPLY_XAI_CHANGELOG.md](../SIMPLY_XAI_CHANGELOG.md) — append-only запись 2026-04-15 по ТЗ-XAI-3 (факт-лист)
- [ ] **5.4** Серийный [SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) — append-only запись:
  - Фикс R-6 (удаление strip-функций + inlineTextFileParts helper, 80 строк legacy кода удалено)
  - Смоук-тест findings: Grok tool-selection отличается от MiniMax (избыточный вызов `readDocument` на attached text/plain), зафиксировано как не-блокер XAI-3
  - Think button UX impressions (заполнится после шага 5 тестов)
- [ ] **5.4a** Создать backlog `specs/_backlog/TZ_SimplyReadDocumentTool.md` — описание проблемы `readDocument` tool в Simply Chat путает Grok с attached файлами. Предлагаемые подходы: (а) убрать tool из simply active list, (б) научить различать knowledge/ vs attached, (в) правка промпта
- [ ] **5.5** Серийный [SIMPLY_XAI_ROADMAP.md](../SIMPLY_XAI_ROADMAP.md) — обновить таблицу прогресса (ТЗ-XAI-3 → ✅), обновить описание ТЗ-XAI-3 фактом завершения
- [ ] **5.6** Обновить [HANDOFF.md](../HANDOFF.md) — снять галочку ТЗ-XAI-3, обновить прогресс серии, описать что сделано в последней сессии, настроить «следующая сессия начни с ТЗ-XAI-4»
- [ ] **5.7** Обновить [SIMPLY_STATUS.md](../../../SIMPLY_STATUS.md) — текущая версия v3.90.0, завершённое ТЗ-XAI-3
- [ ] **5.8** Обновить [CLAUDE.md](../../../CLAUDE.md) — upd "Активная серия" описание, "Завершены" секция (последняя запись)
- [ ] **5.9** Проверить что `.simply-dev-overrides.json` в `.gitignore` (не коммитится) — должен, но на всякий случай подтвердить
- [ ] **5.10** `git status` + `git diff` — осмотр перед коммитом
- [ ] **5.11** Предложить Владимиру commit message, ЖДАТЬ явного разрешения на commit (правило CLAUDE.md: никаких commits без разрешения)
- [ ] **5.12** После разрешения — коммит с форматом серии (см. предыдущие коммиты `ba9e928`, `1481141`). **Не пушить** (push — отдельная команда Владимира)

**Чекпоинт:** коммит создан локально, push держим до явной команды → ТЗ-XAI-3 закрыт.

---

## Риск-митигация per этап

| Этап | Главный риск | Mitigation |
|---|---|---|
| 1 | Задеть тип TaskId | `npx tsc --noEmit` ловит |
| 2 | Сломать конвертацию text/plain файлов | Smoke-тест 4.4 специально для этого |
| 2 | Сломать сборку preparedHistory | tsc + build + smoke 4.1-4.2 |
| 3 | Не снять override → smoke-тест врёт | Шаг 3.4 визуальная проверка /dev/models |
| 4 | Регрессия vision routing | Шаг 4.3 целенаправленно проверяет |
| 4 | Сломали MIND retrieval | Шаг 4.6 специально для этого |
| 5 | Закоммитить `.simply-dev-overrides.json` | Шаг 5.9 проверка .gitignore |

---

## Что пишу после завершения каждого этапа

После каждого `[x]` обновляю ROADMAP.md — ставлю галочку. После завершения этапа пишу короткий комментарий на этом месте с кратким резюме (что изменил, что прошло). Это делает ROADMAP живым логом а не статичным планом.

**Старт:** после согласования Владимиром этого ROADMAP.
