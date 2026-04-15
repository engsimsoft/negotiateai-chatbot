# TZ_SimplyReadDocumentTool + R-6 correction — readDocument cleanup + capability-aware history

**Статус:** ✅ Реализовано v3.90.2 (2026-04-15)
**Создано:** 2026-04-15 (из smoke-тестов ТЗ-XAI-3)
**Связано с:** ТЗ-XAI-3 (v3.90.0 — там обнаружено), [SIMPLY_ATTACHMENT_ARCHITECTURE.md](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) (принятое решение №3)
**Расширенный scope:** В процессе реализации обнаружено что первоначальный scope (убрать readDocument из Simply) покрывает только симптом, а реальная причина — неполная реализация R-6 из ТЗ-XAI-3 (неверное удаление `stripMediaPartsForTextModel` без замены через SSOT capabilities). Scope расширен до **dead code cleanup + R-6 correction одним коммитом**.

---

## Проблема

В Simply Chat (chatMode=simply) в active tools включён `readDocument` tool (он же `read-project-file` в [lib/ai/tools/read-project-file.ts](../../lib/ai/tools/read-project-file.ts)). Этот tool предназначен **только для чтения файлов из директории `knowledge/`** внутри проекта. При вызове с любым другим path (включая имя attached файла) возвращает ошибку:

```
Access denied: Only files in knowledge/ directory can be read
```

**Поведение Grok 4.1 Fast в Simply Chat:** когда пользователь прикрепляет text/plain файл и спрашивает «что в файле?», Grok **параллельно** делает две вещи:
1. Видит inline-содержимое файла в промпте (через `convertTextFilesInAllMessages`)
2. Замечает что в toolbox есть функция `readDocument` и **наивно вызывает её** по имени файла (например `test-valenok.txt`)

Tool справедливо отвечает `Access denied`, но ответ пользователю всё равно корректный — Grok использует inline-содержимое из промпта.

**Наблюдалось в ТЗ-XAI-3 smoke-тестах (2026-04-15):**
- Шаг 4 с `API_CHANGES.txt` (3540 chars) — tool call → error → корректный пересказ из inline
- Шаг 4b с `test-valenok.txt` (67 chars) — tool call → error → корректный отказ раскрыть секретное слово из inline

Под MiniMax M2.7 (предыдущий default Simply Chat) это **возможно вело себя иначе** — другие модели делают другие tool-selection решения. Владимир подтвердил что под MiniMax подобной проблемы не было замечено.

## Почему это не блокер миграции

1. Ответ пользователю **всё равно корректный** — inline-содержимое работает, tool call избыточен
2. Error из tool не ломает stream, просто загромождает DevPanel Tools секцию
3. Проблема не регрессия R-6, а reaction разной модели на тот же toolbox

## Три подхода к фиксу

### A. Убрать `readDocument` из active tools для Simply Chat

Самый простой. В [lib/ai/tools/chat-tools.ts](../../lib/ai/tools/chat-tools.ts) найти `getStandardTools` или `getActiveToolNames`, исключить `readDocument` из simply chatMode. Оставить для expertise/create/project где он имеет смысл (пользователь может работать с knowledge/ директорией).

**Pros:** минимальный delta, быстрый фикс, убирает путаницу раз и навсегда в Simply
**Cons:** если в будущем захотим дать пользователю Simply чтение knowledge/ файлов — снова включать

### B. Научить tool различать knowledge/ vs attached контексты

В самом tool добавить проверку: если path не начинается с `knowledge/`, **не возвращать error**, а вернуть осмысленное сообщение «этот файл уже в контексте сообщения, читать его не нужно».

**Pros:** сохраняет tool для других режимов, educational для модели
**Cons:** overengineered для текущей ситуации

### C. Правка промпта

В Simply Chat system prompt добавить инструкцию: «если пользователь прикрепил файл, его содержимое уже в контексте сообщения — не вызывай `readDocument`, читай напрямую».

**Pros:** product-level решение через prompt engineering
**Cons:** промпт удлиняется, все модели разные, может не работать для некоторых

## Рекомендация

**Вариант A** — самый чистый. Simply Chat — дворецкий, он не должен «лазить по файлам проекта». Attached файлы уже обработаны pipeline'ом конверсии text/plain → text part. Убрать `readDocument` из Simply active tools → убрать причину проблемы, не симптом (принцип R-6).

Если в будущем Simply получит функциональность «библиотека» (пользовательская knowledge/), тогда отдельное решение как встроить tool в UI.

## Приоритет

**Средний.** Не блокер, не регрессия, не влияет на корректность ответов. Но загромождает DevPanel Tools секцию ошибками, что мешает отладке и выглядит непрофессионально. Желательно сделать в ближайшие месяцы.

**Не в scope серии Simply_xAI** — это quality issue инструментов, не миграция моделей. Backlog живёт до приоритизации.

## Expanded scope: R-6 correction (обнаружено в процессе)

При audit выяснилось что tool `readDocument` — **всегда мёртвый код**, не только в Simply. SQL audit + git log показали:

1. Папка `knowledge/` удалена ещё в v2.0.0 (commit `62540ff` "cleanup: remove old MIR.TRADE files") — **126 файлов удалено**
2. Tool жёстко привязан к чтению из этой папки ([read-document.ts:22](../../lib/ai/tools/read-document.ts#L22)): `if (!normalizedPath.startsWith("knowledge/"))` → throw `Access denied`
3. Tool **всегда** возвращает ошибку независимо от вызывающего (Simply / Expertise / Create / Project)
4. Это не Simply-specific проблема, это legacy dead code из pre-Simply эпохи (MIR.TRADE business case)

**Следовательно Вариант B** (полное удаление `readDocument`) был корректным выбором, не расширение scope ради расширения.

### Вторая находка — R-6 был реализован неполно в XAI-3

При мануальном тесте (2026-04-15) появилась ошибка `AI_UnsupportedFunctionalityError: 'file part media type application/pdf' functionality not supported`. Причина: Grok 4.1 Fast не принимает PDF file parts, но в истории чата сидел PDF от предыдущего сообщения (которое корректно пошло на Haiku через vision routing). При follow-up текстовом сообщении, routing выбрал Grok (current message без attachment) → Grok загрузил историю → крашнулся на старом PDF file part.

**Root cause:** в ТЗ-XAI-3 удалена функция `stripMediaPartsForTextModel` с аргументом «Grok 4.1 Fast умеет vision → strip не нужен». Но это было **неверное утверждение** — capabilities Grok:
- `vision: true` → принимает `image/*` ✅
- `documentSupport.supported: false` → **не принимает `application/pdf`** ❌

Я смешал vision (изображения) и documentSupport (PDF) — это два разных capability в [model-catalog.ts](../../lib/ai/model-catalog.ts).

**Явное предупреждение в ROADMAP ТЗ-XAI-3 (строка 96):**
> «[R-6, критично] Полностью убрать `isSimplyNonAnthropicModel` + strip-функции. Заменить на явную проверку `capabilities.vision` из `model-catalog.ts` (SSOT). **НЕ полагаться на маршрутизацию «vision → Haiku спасёт» — это хрупкая логика. Убирать причину, а не симптом.**»

План говорил **правильную вещь**, но я реализовал её неполно — удалил strip-функции, но не добавил замену через capabilities SSOT. v3.90.0 прошёл smoke-тест потому что regressия с PDF в истории не тестировалась отдельно.

### Правильная реализация R-6 через SIMPLY_ATTACHMENT_ARCHITECTURE.md

Архитектурный документ ([SIMPLY_ATTACHMENT_ARCHITECTURE.md](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md), принятое решение №3) **буквально** описывает нужную функцию:

> «adaptHistoryToCapabilities — функция-адаптер. Если в истории остался file part который текущая модель не поддерживает (например, image part при модели без vision, или PDF part при Grok), заменяет на текстовый placeholder. Работает через capabilities из model-catalog (SSOT).»

Реализация в v3.90.2 — буквально такая функция в [chat/route.ts](../../app/(chat)/api/chat/route.ts), читает `effectiveCatalogEntry.capabilities` и заменяет:
- `image/*` file parts если `capabilities.vision === false` → text placeholder
- `application/pdf` file parts если `capabilities.documentSupport?.supported !== true` → text placeholder с инструкцией re-attach
- `text/plain` file parts — не трогает (обрабатывается раньше через `convertTextFilesInAllMessages`)

### Объединённый scope v3.90.2

1. **Dead code cleanup** — удаление `readDocument` tool из 6 мест (tool файл, registry, render block, promps) — **решает оригинальную задачу TZ_SimplyReadDocumentTool** и убирает путаницу Grok
2. **R-6 correction** — функция `adaptHistoryToCapabilities` + вставка в preparedHistory pipeline — **правильная реализация R-6 из ТЗ-XAI-3** через SSOT capabilities

Оба изменения связаны общей темой: **cleanup мёртвого legacy кода + capability-agnostic архитектура** через SSOT model-catalog.

## Ссылки

- [SIMPLY_ATTACHMENT_ARCHITECTURE.md](../Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md) — архитектурный стандарт (SSOT для всех решений по attachments)
- [SIMPLY_XAI_ROADMAP.md](../Simply_xAI/SIMPLY_XAI_ROADMAP.md) — дорожная карта миграции (строка 96 — предупреждение R-6)
- [lib/ai/tools/chat-tools.ts](../../lib/ai/tools/chat-tools.ts) — `getStandardTools`, `getActiveToolNames`
- [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) — `CAPS_GROK`, `CAPS_ANTHROPIC_*`, `ModelCapabilities` SSOT
- [SIMPLY_XAI_CHANGELOG.md](../Simply_xAI/SIMPLY_XAI_CHANGELOG.md) — запись ТЗ-XAI-3 где проблема зафиксирована
- commit `62540ff` — удаление knowledge/ папки в v2.0.0 ("cleanup: remove old MIR.TRADE files")
