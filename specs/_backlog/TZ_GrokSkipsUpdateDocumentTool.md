# TZ_GrokSkipsUpdateDocumentTool

**Impact:** 🟥 high
**Найдено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills (2026-04-27)
**Источник:** FINDINGS #7 ТЗ-MigrateArtifactPromptsToSkills

## Проблема

Grok 4.1 Fast (используется в `simply-chat` task) в некоторых запросах **игнорирует** `updateDocument` tool и просто генерит ответ как обычный chat-message — артефакт не обновляется, пользователь видит «модель ничего не сделала».

## Воспроизведение (chat `3353a183`, 2026-04-27)

- **13:56:38** — модель **сама** создала text-артефакт `42573e5a` через `tool-createDocument` ✅
- **14:04:19** — пользователь написал: `Текстовый пост про пробежку перепиши в 3 раза короче, стиль с эмодзи сохрани`
- **14:04:25** — модель **проигнорировала** `updateDocument` tool, сгенерила сырой текст в чате: «Пробежка удалась! 🏃 5 км за 28 мин, солнце светит ☀️»
- В БД text-артефакт `42573e5a` **не обновился** — никакого `tool-updateDocument` в логах. Простой text response.

В контексте чата (14 message slice) есть `tool-createDocument` для `42573e5a`. Tool `updateDocument` доступен. Но модель решила «отвечу текстом».

## Где код

- Tool selection — внутри `streamText({ tools: ..., ... })` в [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts)
- Tool description — в `lib/ai/tools/update-document.ts`
- Модель — `grok-4-1-fast-non-reasoning` для simply-chat

## Гипотезы решения

1. **Усилить tool description:** добавить в description `updateDocument` явное правило «при просьбе перепиши/сократи/измени артефакт обязательно вызывай этот tool. НЕ генерируй текст в чате если в контексте есть tool-createDocument для соответствующего артефакта».

2. **Системный промпт simply-chat:** добавить инструкцию: «Если в видимой истории есть `tool-createDocument` и пользователь просит модификации — обязательно используй `updateDocument` tool, не генерируй текст напрямую».

3. **Перейти на reasoning-режим для Simply:** `grok-4-1-fast-reasoning` лучше планирует tool calls (но дороже). Возможно только когда пользователь нажал «Думать».

4. **Связано с TZ_SimplyChatMemoryRegression:** если бы модель видела весь контекст (не обрезанный extractedAt-фильтром), tool-call был бы более уверенным. Возможно решение TZ_SimplyChatMemoryRegression частично решит и это.

## Влияние

Поломан основной сценарий «отредактируй мой артефакт» в Simply Chat. Пользователь должен с явной формулировкой повторять запрос (не всегда срабатывает).

## Оценка

0.3-0.5 сессии (попробовать варианты 1-2, замерить hit rate)
