# Находки ТЗ-MigrateArtifactPromptsToSkills

> Список нерешённых проблем, обнаруженных во время работы над ТЗ.
> После закрытия ТЗ — оформить как follow-up задачу в `_backlog/`.

## 🚩 Finding #1: PPTX/Reveal artifact не перерисовывается в холсте после `onUpdateDocument`

**Где:** `components/artifact-presentation-*.tsx` (frontend) + `data-pptxComplete` / `data-presentationDelta` event handlers
**Что:** После успешного `onUpdateDocument` для презентации:
- БД обновлена (новый JSON в `Document.content`)
- Blob URL обновлён (новый `.pptx` файл)
- Превью-картинки сгенерированы и залиты
- **НО** клиент в холсте показывает СТАРУЮ версию слайдов (превью + контент)

Подтверждено: при скачивании файла из обновлённого артефакта пользователь получает **новую** версию (blob URL свежий). То есть блокер именно в client-side state — он не подхватывает `data-pptxComplete` event или не инвалидирует кэш document.

Воспроизведение (Этап 7 ТЗ-MigrateArtifactPromptsToSkills, 2026-04-27, 13:33):
- doc id `3588b19e-759b-4aa9-91c3-99a611b84b66`, kind `presentation-pptx`
- update: «замени первый слайд на "Деловые переговоры 2026"»
- БД (createdAt 13:33:25) — первый слайд изменён ✅
- Холст в браузере — старый слайд «Искусственный интеллект» ❌
- Скачанный pptx — новый «Деловые переговоры 2026» ✅

**Почему проблема:** Пользователь думает что update не сработал → начинает спорить с моделью (модель тоже не видит факт изменения через `getDocument`-инструмент?), или жмёт refresh → артефакт может «исчезнуть» из видимого UI. UX полностью сломан для update презентаций.

**Предлагаемое решение:**
1. Проверить что `data-pptxComplete` / `data-presentationDelta` event handler в client-компоненте принудительно обновляет state (slides, pptxUrl, previewUrls)
2. Проверить React Query / SWR keys — возможно надо invalidate `documentId` после update
3. Сравнить с поведением `data-textDelta` / `data-markdownDelta` (они работают корректно — Этап 7 показал что text/markdown update отрисовывается)

**Влияние:** **high** (полностью ломает UX для update презентаций; работает только через скачивание)
**Обнаружено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills, мануальный смок-тест pptx update

---

## 🚩 Finding #2: AI выбирает `presentation-pptx` для запроса «Reveal.js презентация»

**Где:** Tool selection в `lib/ai/tools/create-document.ts` или соседних — выбор `kind` для презентаций
**Что:** На промпт «Сделай интерактивную Reveal.js презентацию про переговоры, 5 слайдов» AI сгенерировал `kind: presentation-pptx`, не `presentation-reveal`. Видимо, tool description / kind enum не разделяет эти типы достаточно явно.

Воспроизведение (Этап 7 ТЗ-MigrateArtifactPromptsToSkills, 2026-04-27): попытка создать reveal-артефакт привела к pptx-артефакту. Тест миграции для reveal через Simply Chat невозможно выполнить пока tool не различает типы.

**Почему проблема:** Reveal-артефакт практически недоступен для пользователя через AI-вызов — всегда получает pptx. Если в каталоге фич есть reveal — он dead через chat-канал.

**Предлагаемое решение:**
1. Уточнить tool description в `create-document.ts` — какие триггеры для каждого kind
2. Возможно, добавить в system prompt инструкцию различать «PowerPoint» (pptx) vs «интерактивная HTML/web-презентация» (reveal)
3. Альтернатива: схлопнуть один тип (если reveal в проекте deprecated)

**Влияние:** **medium** (одна фича недоступна через AI; если reveal используется в других контекстах — возможно ОК)
**Обнаружено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills, тест Тип-5

---

## 🚩 Finding #3: Chat input блокируется при висящем GET /api/document

**Где:** UI компонент чата + artifact-pane (вероятно `components/multimodal-input.tsx` / artifact load state)
**Что:** Когда `GET /api/document?id=...` висит в timeout (например, Neon ConnectTimeoutError 10s) — input в чате становится недоступным для ввода/отправки. Пользователь не может ни задать вопрос, ни закрыть артефакт без F5.

Воспроизведение (Этап 7 ТЗ-MigrateArtifactPromptsToSkills, 2026-04-27): в логах видно `GET /api/document?id=720fd6d6 500 in 10856ms` (Neon timeout) → пользователь сообщил «не могу в чате ничего написать» при открытом артефакте.

**Почему проблема:** В период сетевых проблем с БД пользователь полностью теряет возможность работать в чате. Должен быть либо timeout с graceful UI fallback («не удалось загрузить артефакт, попробуй позже»), либо неблокирующая загрузка артефакта (input доступен независимо).

**Предлагаемое решение:**
1. Поставить timeout 5s на artifact fetch с UI-сообщением об ошибке
2. Расцепить состояние input ↔ artifact loading — input должен быть доступен всегда, кроме периода streaming-ответа модели

**Влияние:** **medium** (проявляется только при сбоях Neon/сети, но в этот период полностью блокирует UX)
**Обнаружено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills, скриншот владельца 13:35

---

## 🚩 Finding #4: MIND extract — атомарность нарушена, потеря памяти при провале Voyage upload

**Где:** [lib/ai/memory/extract.ts:235-246](lib/ai/memory/extract.ts#L235-L246) (`batchExtractFacts`)
**Что:** Поток extract:
```ts
for (const fact of facts) {
  try {
    await processAndStoreFact(...);   // Voyage embedding upload + DB save
  } catch (error) {
    console.error("failed to store fact ...");  // ловим, продолжаем
  }
}
// Mark ALL batch messages as extracted (even if no facts found)
await markMessagesExtracted(batch.map((m) => m.id));
```

Проблема: если `processAndStoreFact` упал (например, Voyage 403) — ошибка проглатывается через try/catch, цикл продолжается. После цикла **безусловно** ставится `extractedAt = NOW()` для всех сообщений батча. Комментарий «even if no facts found» написан под кейс «LLM не нашёл фактов», но логически покрывает и кейс «факты были, но запись провалилась».

**Последствия (продемонстрированы Этапом 7, 2026-04-27):**
- Сообщения батча получили `extractedAt!=null` → исключены из inline-истории simply-chat (фильтр `WHERE extractedAt IS NULL` в [lib/db/queries.ts:523](lib/db/queries.ts#L523))
- Факты в БД/Voyage не записаны (Voyage 403)
- MIND retrieve по эмбеддингу не находит ничего (потому что вектора нет)
- **Память сообщения потеряна безвозвратно** — модель в чате говорит «не помню»

**Подтверждение по БД (Этап 7, чат `3353a183-...`):** 188 сообщений всего, 176 `extractedAt!=null` (отфильтровано), 12 видимо. Среди этих 12 нет ни одного из «текстового артефакта про утреннюю пробежку» — значит он попал в extracted-batch, но вместе с этим в Voyage его эмбеддинга нет (403).

**Предлагаемое решение (атомарность):**
- Не помечать `extractedAt`, если в батче была хотя бы одна `processAndStoreFact` ошибка (кроме случая `facts.length === 0` — тогда нечего сохранять, можно метить)
- Или: переход на 2-фазное сохранение — сначала пишем факты в БД без вектора, помечаем extracted; отдельный job поднимает не-векторизованные и пытается сделать embedding. При провале — повтор.
- Или: idempotent retry с экспоненциальным backoff внутри `processAndStoreFact`.

**Влияние:** **high** — каждый сетевой сбой Voyage = безвозвратная потеря памяти пользователя. Учитывая что владелец на финском VPN регулярно ловит Voyage 403 (memory `voyage_vpn_finland`) — это уже происходило и будет происходить.
**Обнаружено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills, диалог владельца про потерю памяти про Тип-1 артефакт

---

## 🚩 Finding #5: Critical — Simply Chat «помнит только последнее сообщение». Слишком агрессивная ExtractCompression

**Где:** [lib/db/queries.ts:520-533](lib/db/queries.ts#L520-L533) (`getMessagesByChatId` с `excludeExtracted=true` для simply-chat) + [lib/ai/memory/extract.ts](lib/ai/memory/extract.ts) (MIND extract job помечает сообщения как extracted) + [lib/ai/memory/retrieve.ts](lib/ai/memory/retrieve.ts) (retrieve через Voyage embeddings)

**Что:** Архитектура Simply Chat для memory:
1. Все сообщения чата с `extractedAt IS NOT NULL` **исключаются из inline-контекста** (хардкод-фильтр в SQL)
2. Они должны компенсироваться через MIND retrieve — поиск релевантных фактов через Voyage embedding similarity
3. На практике retrieve поднимает 5-10 фактов, что **в разы меньше** информации чем оригинальные сообщения

Контекст модели grok-4-1-fast = **200 000 токенов**. Использовано на момент инцидента: **7 156 токенов** (≈3.5% окна — `system: 4256 + history: 1832 + new: 26 + mind: 180 + tools: 1334`). При том в БД 192 сообщения чата на ~50k токенов суммарно — **в 4 раза меньше окна модели**. История бы целиком помещалась в контекст без всякой компрессии.

Воспроизведение (Этап 7 ТЗ-MigrateArtifactPromptsToSkills, 2026-04-27, чат `3353a183-37f5-498e-b461-c2e87ff65ef1`):
- 192 сообщения в БД, 190 `extractedAt IS NOT NULL`, **2 свежих видимо** для simply-chat
- Пользователь спросил «помнишь artefact про утреннюю пробежку?» (созданный 30 минут назад в этом же чате) — модель ответила «не помню, не храню историю между сессиями»
- Ранее в той же сессии модель **создавала** этот артефакт через `tool-createDocument` — но 30 минут спустя сообщение помечено `extractedAt!=null`, исчезло из inline-контекста
- MIND retrieve поднял 5 фактов, но факта про этот конкретный артефакт среди них не было

**Почему проблема:**
- UX-катастрофа: пользователь физически не может вести долгий разговор — модель «забывает» через несколько обменов
- Ассистент создаёт артефакты, потом не может их редактировать через AI tool, потому что не помнит что они существуют (Finding #6 — Grok пропускает updateDocument tool — частично следствие этого)
- Ситуация усугубляется при провалах Voyage (Finding #4) — потерянная память не восстанавливается даже частично

**Гипотезы решения (для отдельного ТЗ):**
1. **Адаптивный фильтр:** не применять `excludeExtracted=true` пока inline-история помещается в `soft_threshold` (сейчас 100k tokens). Только при превышении — переключаться на extracted-фильтр + retrieve. Сжимать только когда **реально нужно**.
2. **Гибрид:** всегда грузить последние N=50-100 сообщений независимо от `extractedAt`, плюс retrieve фактов для всего что старше. Дифференциация по recency, не по флагу extract.
3. **Усилить retrieve:** поднимать 20-30 фактов вместо 5-10 (запас токенов есть), и/или включать retrieve в режиме «грубого захвата» по кодекс-keyword (artifact title, ID, имена) поверх семантического embedding-поиска.
4. **MIND extract intelligence:** сейчас extract схлопывает 50 сообщений в N фактов. Возможно, факты слишком общие/абстрактные. Нужны facts с привязкой к конкретным entities (artifact id, document title, project id) для надёжного retrieve.

**Влияние:** **CRITICAL** — основной UX поломан. Это не угол, не edge case — это центральный сценарий «помнишь, мы вчера обсуждали X».
**Обнаружено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills, 2026-04-27, диалог владельца про потерю памяти

---

## 🚩 Finding #6: Runtime Error — `getChatUrl: chatMode "undefined"` при submit формы

**Где:** [components/multimodal-input.tsx:196](components/multimodal-input.tsx#L196) → [lib/utils.ts:92](lib/utils.ts#L92) (`getChatUrl` throw-ит при unknown chatMode)

**Что:** В компоненте `PureMultimodalInput.submitForm` вызов `window.history.replaceState({}, "", getChatUrl(chatId, chatMode))` падает с runtime error если `chatMode === undefined`. По коду [components/multimodal-input.tsx:86](components/multimodal-input.tsx#L86) prop `chatMode?: string` помечен как опциональный — то есть родительский компонент может его не передать и компилятор не возражает. Но `getChatUrl` целенаправленно падает на `undefined` (комментарий в utils.ts: «Лучше упасть громко, чем тихо сгенерить ссылку на 404»).

Воспроизведение: открыт **существующий** артефакт в холсте `/simply` → попытка отправить любое сообщение через input → красный error overlay «getChatUrl: неизвестный chatMode "undefined"». Call stack: form submit → onSubmit → submitForm → getChatUrl. Блокирует **полностью** input в этом состоянии, F5 помогает временно.

**Почему проблема:** Артефакты постоянно открыты в Simply UI, и при таком state пользователь не может отправить сообщение. Это происходит **на нашей текущей master-версии**, не редкое стечение обстоятельств.

**Гипотезы решения (для отдельного ТЗ):**
1. Контракт-fix в `multimodal-input.tsx`: `chatMode: string` (без `?`), проверять на уровне TS чтобы родители всегда передавали
2. В `submitForm` — fallback: `if (!chatMode) return;` или дефолт `"simply"` для главной (если URL `/simply`)
3. Найти конкретный path где артефакт-view не передаёт `chatMode` через props (вероятно `components/artifact.tsx` или родитель `multimodal-input` внутри артефакт-pane)

**Влияние:** **high** — пользователь блокируется при попытке писать в чат с открытым артефактом. Постоянное состояние в Simply.
**Обнаружено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills, скриншот владельца с runtime error

---

## 🚩 Finding #7: Grok 4.1 Fast пропускает `updateDocument` tool, генерит ответ как обычный chat-message

**Где:** Поведение модели в `simply-chat` task ([app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts)) с `model = grok-4-1-fast-non-reasoning`

**Что:** Поток (подтверждено по логам и БД, 2026-04-27, чат `3353a183`):
- 13:56 — модель **сама создала** text-артефакт `42573e5a` через `tool-createDocument` ✅
- 14:04 — пользователь написал «Текстовый пост про пробежку перепиши в 3 раза короче, стиль с эмодзи сохрани»
- 14:04 — модель **проигнорировала** `updateDocument` tool, сгенерила сырой текст в чате: «Пробежка удалась! 🏃 5 км за 28 мин, солнце светит ☀️»

Артефакт **существует** в БД и в slice контекста (на момент 14:04 в 14 message slice есть `tool-createDocument` для `42573e5a`). Tool `updateDocument` доступен. Но модель решила **сгенерить новый текст в чате**, не вызывая tool.

**Почему проблема:** Пользователь видит «модель ничего не сделала» (артефакт не обновлён), вынужден вручную копировать текст или повторять запрос с явной формулировкой. UX поломан для редактирования артефактов через короткие/неоднозначные запросы.

**Гипотезы решения (для отдельного ТЗ):**
1. Усилить tool description `updateDocument` с явным «при просьбе перепиши/сократи/измени артефакт всегда вызывай этот tool, не отвечай текстом»
2. Перейти на `grok-4-1-fast-reasoning` для simply-chat (reasoning-режим лучше планирует tool calls)
3. Добавить в system prompt simply-chat правило: «Если в видимой истории есть `tool-createDocument` и пользователь просит модификации — обязательно использовать `updateDocument` tool, не генерить текст напрямую»
4. Связано с Finding #5: если бы модель видела весь контекст (не обрезанный extractedAt-фильтром), tool-call был бы более уверенным

**Влияние:** **high** — поломан основной сценарий «отредактируй мой артефакт» в Simply Chat
**Обнаружено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills, попытка протестировать text update артефакта

---

## Note: миграция промптов работает корректно

Server-side update реально применяется (БД + blob + preview). Это подтверждает что замена inline промпта на `loadArtifactSkill()` не сломала save-флоу. Все 5 типов create-промптов и 4 проверенных update-промпта работают как до миграции. Проблемы выше — **существующие bugs**, которые миграция просто **выявила** через мануальный тест.
