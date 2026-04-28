# Simply_Migration · Шаг 3 · Vision/OCR cleanup — SPEC

**Серия:** `Simply_Migration` (концепт — `specs/Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md`, Блок 4)
**Шаг в серии:** 3 из 11 (Фаза А — закрыть боль и подготовить полигон)
**Зависимости:** ТЗ-1 (BR-AUTHOR-KIMI) и ТЗ-2 (MigrateArtifactPromptsToSkills) — закрыты
**Блокирует:** Шаг 4 (PDF на xAI Files API)

---

## 1. Цель

Убрать мёртвый код Vision/OCR на Anthropic и перевести единственный активный vision-fallback (`chat-vision`) с Claude Haiku на Grok 4.1 Fast non-reasoning. После этого шага Anthropic полностью уходит из обработки картинок. PDF pipeline в этом шаге не трогается — он закрывается отдельно Шагом 4.

Цель не «сэкономить» (экономия мизерная) — цель **унификация экосистемы**. Один провайдер на все vision-задачи в чате (xAI), без серой зоны «иногда Grok, иногда Haiku по случайности маршрутизации».

---

## 2. Скоуп

### 2.1 Что входит

1. **Удаление мёртвого кода `vision:ocr`:**
   - Файл `lib/ai/vision-ocr.ts` целиком (содержит `extractTextFromImage` и `extractTextFromPDF` — 0 call sites по аудиту Claude Code от 25.04.2026)
   - Запись `vision:ocr` из SSOT `lib/ai/task-assignments.ts`
   - Упоминания в UI `/dev/models` (если описание taskId рендерится из реестра — само исчезнет; если есть отдельный list — почистить)

2. **Переключение default-модели `chat-vision`:**
   - Было: `claude-haiku-4-5-20251001`
   - Стало: `grok-4-1-fast-non-reasoning`
   - Точка изменения: `lib/ai/task-assignments.ts`

3. **Подтверждение vision capability в каталоге:**
   - В `lib/ai/model-catalog.ts` запись `grok-4-1-fast-non-reasoning` должна иметь флаг vision-capable (название поля — как принято в проекте: `vision: true` / `capabilities.vision: true` / иное). Если отсутствует — добавить с pricing согласно xAI docs.

4. **Обновление документации:**
   - `docs/ai-chats-map.md` — убрать строку `vision:ocr`, обновить `chat-vision` на Grok 4.1 Fast non-reasoning, убрать упоминание Anthropic в vision-сценариях
   - `docs/ai-providers.md` — синхронно: убрать vision use case у Anthropic (если он там был), добавить vision use case у xAI Grok 4.1 Fast non-reasoning

### 2.2 Что не входит (явно out of scope)

- **PDF pipeline.** `pdf-parse`, эвристика «30 символов на страницу», route для PDF-вложений — не трогаются. Это Шаг 4 (миграция на xAI Files API).
- **Механизм capability-driven routing.** Логика `resolveActiveTaskId` (или как называется), которая фолбэчит на `chat-vision` при отсутствии vision-способности у текущей модели — остаётся как есть. Это страховка для dev-override через `/dev/models`, она нужна.
- **Anthropic в режимах Профессор / Проекты.** Их миграция отдельной серии, не в этом шаге.
- **Незакоммиченная правка `lib/ai/registry.ts` от прошлой сессии.** Если Phase 1 audit покажет, что она не относится к vision/OCR — оставить как есть для отдельного коммита, не смешивать.
- **Voice/STT/audio-vision сценарии.** Их в Simply нет, упоминаю явно чтобы не было разночтений.

---

## 3. Контекст и обоснование

### 3.1 Картина «как сейчас»

| Сценарий | Путь сегодня | Модель |
|---|---|---|
| Картинка JPEG/PNG в чате (Simply / Expertise / Create) | Default-модель режима имеет vision → ответ напрямую | Grok 4.1 Fast / Grok 4.20 |
| Картинка JPEG/PNG в чате при dev-override на текстовую модель | Capability check → fallback на `chat-vision` | **Claude Haiku 4.5** ← убираем |
| Текстовый PDF в чате | pdf-parse → текст inline → default модель | Grok |
| Сканированный PDF (без текстового слоя) в чате | pdf-parse → пусто → fallback на `chat-vision` | **Claude Haiku 4.5** ← см. п.5 (риск/known limitation) |
| Standalone OCR через `vision:ocr` | Никогда не вызывается | Мёртвый код |

### 3.2 Картина «как станет» (после Шага 3, до Шага 4)

| Сценарий | Путь | Модель |
|---|---|---|
| Картинка JPEG/PNG в чате | Default-модель режима имеет vision → ответ напрямую | Grok (без изменений) |
| Картинка JPEG/PNG при dev-override на текстовую модель | Fallback на `chat-vision` | **Grok 4.1 Fast non-reasoning** |
| Текстовый PDF | pdf-parse → текст inline → default | Grok (без изменений до Шага 4) |
| Сканированный PDF | pdf-parse → пусто → fallback на `chat-vision` | **Grok 4.1 Fast non-reasoning** — см. риск R3 |
| Standalone OCR | — | Удалено |

### 3.3 Картина «после Шага 4» (для понимания траектории, не часть этого ТЗ)

Все PDF (и текстовые, и сканы) пойдут через xAI Files API + `attachment_search`. Fallback на `chat-vision` для PDF станет неактуальным. `chat-vision` останется только для image-сценариев при dev-override.

---

## 4. Технические факты для реализации

### 4.1 Vision у Grok 4.1 Fast non-reasoning (источник: docs.x.ai)

- **Поддержка:** image understanding, multimodal input
- **Форматы:** JPG/JPEG, PNG (PDF — не поддерживается напрямую как файл)
- **Передача:** base64 data-URI или публичный URL
- **Размер на изображение:** 256–1792 токена (≈1610 для 512×512)
- **Контекст модели:** 2M токенов
- **Pricing (на момент написания, проверить актуальность в `model-catalog.ts`):** input $0.20/1M, output $0.50/1M, cached input существенно ниже

### 4.2 Формат сообщений через `@ai-sdk/xai`

AI SDK абстрагирует разницу между провайдерами. Для image part используется стандартный формат:

```ts
{
  role: 'user',
  content: [
    { type: 'text', text: '...' },
    { type: 'image', image: imageUrlOrBuffer, mediaType: 'image/jpeg' }
  ]
}
```

`@ai-sdk/xai` сам конвертирует в xAI-специфичный формат (`image_url.url` для Chat Completions API или `input_image.image_url` для Responses API). **На уровне нашего кода миграция Haiku → Grok прозрачна** — message-формат не меняется.

### 4.3 Что Grok 4.1 Fast non-reasoning **не умеет**

- PDF как файл (только image)
- TIFF, HEIC, WEBP (нужен JPG/PNG)
- Видео-кадры

Это критично для пункта 5.R3 ниже.

---

## 5. Риски и митигации

| # | Риск | Уровень | Митигация |
|---|---|---|---|
| **R1** | Скрытый импорт `vision-ocr.ts` или taskId `vision:ocr` не пойман прошлым аудитом | 🟢 Низкий | Phase 1 повторный grep на 4 паттерна (`vision:ocr`, `vision-ocr`, `extractTextFromImage`, `extractTextFromPDF`). Если 0 hits — удаление безопасно. Если есть — расширить скоуп Phase 2. |
| **R2** | Grok 4.1 Fast non-reasoning отсутствует в `model-catalog.ts` или там нет vision capability | 🟡 Средний | Phase 1: прочитать `model-catalog.ts`. Если запись отсутствует или `vision: false` — добавить/исправить в Phase 3 (это часть скоупа, не блокер). Сверить pricing с docs.x.ai. |
| **R3** | **Сканированные PDF (без текстового слоя) после Шага 3 теряют OCR.** Haiku 4.5 ел PDF нативно; Grok 4.1 Fast — только JPG/PNG. Между Шагом 3 и Шагом 4 у пользователей может быть окно деградации для PDF-сканов | 🟡 Средний | **Принять как known limitation на короткий период между Шагом 3 и Шагом 4.** Не делать заплатку (rasterize PDF в JPG). Шаг 4 (xAI Files API) закрывает это полностью и архитектурно правильно. Phase 1 проверяет: что именно сейчас передаётся в Haiku при PDF-fallback (raw PDF / extracted bytes / pre-rasterized images). Если pre-rasterize уже происходит на стороне Simply перед отправкой — риск нулевой; если нет — фиксируем в SPEC как явный проектный выбор. |
| **R4** | Незакоммиченная правка `lib/ai/registry.ts` пересекается с миграцией | 🟢 Низкий | Phase 1: `git diff lib/ai/registry.ts` → решить: смешивать или нет. По умолчанию **не смешивать**. |
| **R5** | TS impacts: после удаления `vision-ocr.ts` остаются импорт-сироты | 🟢 Низкий | `pnpm typecheck` поймает на Phase 2.4. Удалить ремни сразу. |
| **R6** | Capability-driven routing после смены default может вести себя иначе для edge-cases | 🟢 Низкий | Phase 4 ручной тест с dev-override. Если регрессия — откат отдельным коммитом, не трогая удаление мёртвого кода. |
| **R7** | UI `/dev/models` ломается из-за отсутствующего taskId | 🟢 Низкий | Phase 1 проверяет, как UI рендерит taskId. Если из реестра — само починится. Если есть hardcoded list — поправить. |

---

## 6. Критерии приёмки

Чек-лист, по которому Шаг 3 считается закрытым:

1. ✅ Файл `lib/ai/vision-ocr.ts` отсутствует в репозитории
2. ✅ `lib/ai/task-assignments.ts` не содержит `vision:ocr` ни как ключ, ни как значение
3. ✅ Default-модель `chat-vision` = `grok-4-1-fast-non-reasoning`
4. ✅ В `lib/ai/model-catalog.ts` запись `grok-4-1-fast-non-reasoning` имеет vision capability и корректный pricing
5. ✅ `pnpm typecheck` без ошибок
6. ✅ `pnpm build` без ошибок
7. ✅ `grep -r "claude-haiku-4-5" lib/` не возвращает hits, связанных с vision/OCR (Haiku может остаться в Профессоре — это ок)
8. ✅ **Manual test default-path:** в Simply Chat с дефолтной моделью загрузить JPEG → ответ от Grok (видеть в `ai_usage_log` или DevPanel)
9. ✅ **Manual test fallback-path:** через `/dev/models` переключить какой-нибудь chat-режим на текстовую модель → загрузить JPEG → fallback срабатывает на `chat-vision` → видеть в логах модель `grok-4-1-fast-non-reasoning`
10. ✅ **Manual test регрессии:** обычный текстовый чат — без изменений
11. ✅ `docs/ai-chats-map.md` обновлён
12. ✅ `docs/ai-providers.md` обновлён
13. ✅ Commit message по convention проекта (один атомарный или разбитый на 2: cleanup + migration — на усмотрение Claude Code, если разбиение упрощает review)

---

## 7. Тестирование (ручное)

### 7.1 Тест 1 — default vision path

**Цель:** убедиться что обычный пользовательский путь не сломан.

1. `pnpm dev`
2. Зайти в Simply Chat (default — Grok 4.1 Fast)
3. Загрузить любой JPEG (скриншот, фото)
4. Спросить «что на картинке»
5. **Ожидание:** ответ приходит, в `ai_usage_log` запись с моделью `grok-4-1-fast-*` (не `claude-haiku-*`)

### 7.2 Тест 2 — fallback path через dev-override

**Цель:** проверить что capability-driven routing корректно фолбэчит на новый default `chat-vision`.

1. Открыть `/dev/models`
2. Найти любой режим (например Simply Chat) и переключить его модель на текстовую без vision capability (если в каталоге есть такая модель — например MiniMax если ещё не вычищен, или специально добавленная заглушка)
3. Если все модели в каталоге vision-capable — этот тест отметить как N/A и зафиксировать в отчёте
4. Загрузить JPEG в этом режиме
5. **Ожидание:** в логах видно что был сделан fallback на `chat-vision`, модель `grok-4-1-fast-non-reasoning` обработала картинку

### 7.3 Тест 3 — отсутствие регрессий в текстовом чате

**Цель:** убедиться что текстовый flow не задет.

1. Обычный текстовый запрос в Simply Chat
2. **Ожидание:** ответ как раньше, никаких ошибок

### 7.4 Тест 4 — PDF (известное ограничение)

**Цель:** зафиксировать поведение для PDF между Шагом 3 и Шагом 4.

1. Загрузить **текстовый PDF** в чат → должен работать (pdf-parse → текст inline → Grok). Без регрессии.
2. Загрузить **сканированный PDF** (если есть тестовый файл) → ожидание зависит от Phase 1 ответа на R3:
   - Если pre-rasterize уже работает на стороне Simply — должно работать
   - Если нет — деградация ответа допустима, фиксируем в SPEC как known limitation, Шаг 4 закроет

Тест 4.2 не блокирует приёмку Шага 3 — это документация поведения.

---

## 8. Документация для обновления

### 8.1 `docs/ai-chats-map.md`

- Удалить строку про `vision:ocr` (если есть)
- Изменить запись `chat-vision`: `Claude Haiku 4.5` → `Grok 4.1 Fast non-reasoning`
- В разделе провайдеров: убрать Anthropic из секции «vision/OCR» если она была

### 8.2 `docs/ai-providers.md`

- Anthropic: оставить только Профессор (и иное, если есть). Убрать упоминание vision use case.
- xAI: добавить vision/OCR use case на Grok 4.1 Fast non-reasoning (default `chat-vision`)

### 8.3 Прочее (если есть)

- Если в репозитории есть `specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md` или аналогичные docs — синхронизировать упоминания vision-fallback.
- CHANGELOG / commit message: описать что Anthropic полностью уходит из image-обработки в чате, PDF-сценарий закрывается Шагом 4.

---

## 9. Ссылки

- Концепт миграции: `specs/Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md`, Блок 4
- WORKFLOW: `specs/WORKFLOW.md`
- Шаблон ТЗ: внутренний стандарт серии
- xAI vision docs: `https://docs.x.ai/developers/model-capabilities/images/understanding`
- xAI models page: `https://docs.x.ai/developers/models`
- xAI Grok 4.1 Fast announcement: `https://x.ai/news/grok-4-1-fast`

---

## 10. Размер ТЗ и ожидание

Маленькое ТЗ, ~1-2 часа работы Claude Code включая ручные тесты. Один атомарный PR.

После приёмки → переход к **Шагу 4 (PDF на xAI Files API)**. Шаг 4 закроет известное ограничение R3.
