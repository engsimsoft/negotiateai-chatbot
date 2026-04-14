# TZ_SimplyReadDocumentTool — readDocument tool путает Grok с attached файлами

**Статус:** Backlog, средний приоритет
**Создано:** 2026-04-15 (из smoke-тестов ТЗ-XAI-3)
**Связано с:** ТЗ-XAI-3 (v3.90.0 — там обнаружено)

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

## Ссылки

- [lib/ai/tools/read-project-file.ts](../../lib/ai/tools/read-project-file.ts) — реализация tool
- [lib/ai/tools/chat-tools.ts](../../lib/ai/tools/chat-tools.ts) — `getStandardTools`, `getActiveToolNames`
- [SIMPLY_XAI_CHANGELOG.md](../Simply_xAI/SIMPLY_XAI_CHANGELOG.md) — запись ТЗ-XAI-3 где проблема зафиксирована
