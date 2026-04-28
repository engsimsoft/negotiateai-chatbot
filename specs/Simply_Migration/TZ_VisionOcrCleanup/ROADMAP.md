# Simply_Migration · Шаг 3 · Vision/OCR cleanup — ROADMAP

**SPEC:** `Simply_Migration_Step3_VisionOCR_SPEC.md`
**Размер:** ~1-2 часа, один PR (можно разбить на 2 коммита: cleanup + migration)

---

## Phase 1 — Audit (read-only, без изменений)

Цель Phase 1: подтвердить факты из SPEC на текущей кодовой базе и выявить сюрпризы до того как трогать код.

### 1.1 Подтвердить мёртвость `vision:ocr`

```bash
grep -rn "vision:ocr" --include="*.ts" --include="*.tsx" .
grep -rn "vision-ocr" --include="*.ts" --include="*.tsx" .
grep -rn "extractTextFromImage" --include="*.ts" --include="*.tsx" .
grep -rn "extractTextFromPDF" --include="*.ts" --include="*.tsx" .
```

**Ожидание:**
- `vision:ocr` — только в `lib/ai/task-assignments.ts` и (возможно) в UI `/dev/models`. Никаких active call sites.
- `vision-ocr` — только сам файл `lib/ai/vision-ocr.ts`.
- `extractTextFromImage` / `extractTextFromPDF` — только сам `lib/ai/vision-ocr.ts`.

**Если найдены неожиданные call sites** — STOP, не удалять, отчитаться в FINDINGS и расширить SPEC.

### 1.2 Прочитать `lib/ai/model-catalog.ts`

Найти запись для `grok-4-1-fast-non-reasoning`. Зафиксировать:
- Существует ли запись вообще
- Установлен ли vision-флаг (как поле называется в проекте: `vision: true` / `capabilities.vision: true` / `supportsVision: true` / иное)
- Установлен ли pricing (input/output/cached)
- Сравнить с docs.x.ai (https://docs.x.ai/developers/models): pricing должен соответствовать актуальному

Записать в FINDINGS:
- `[Y/N] Запись существует`
- `[Y/N] Vision capability указана`
- `[Y/N] Pricing присутствует`
- Diff между текущим pricing и docs.x.ai (если запись есть)

### 1.3 Прочитать `lib/ai/task-assignments.ts`

Найти текущее значение `chat-vision`. Должно быть `claude-haiku-4-5-20251001`. Зафиксировать.

Найти запись `vision:ocr`. Зафиксировать модель (для контекста, потом удалим вместе с записью).

### 1.4 Прочитать UI `/dev/models`

Грубый поиск:
```bash
grep -rn "vision:ocr\|vision-ocr" app/ --include="*.ts" --include="*.tsx"
```

Найти где UI рендерит список taskId. Если из реестра (`task-assignments.ts`) — после удаления записи UI почистится сам. Если есть hardcoded list — записать file:line для Phase 2.

### 1.5 Проверить незакоммиченную правку `lib/ai/registry.ts`

```bash
git diff lib/ai/registry.ts
```

Зафиксировать в FINDINGS: какая логика затронута, относится ли к vision/OCR/Anthropic-cleanup.

**Решение:**
- Если правка относится к Шагу 3 — включить в этот PR
- Если не относится — **не трогать**, оставить как есть в working tree, не коммитить вместе с этой задачей

### 1.6 Прочитать docs

- `docs/ai-chats-map.md` — найти строки про `vision:ocr`, `chat-vision`, Haiku в vision-контексте
- `docs/ai-providers.md` — найти секцию Anthropic, упоминания vision/OCR

Зафиксировать file:line каждой строки для обновления в Phase 5.

### 1.7 Проверить PDF-fallback path (для риска R3)

Найти где обрабатывается PDF при отсутствии текстового слоя. Цель — понять:
- Передаётся ли в `chat-vision` модель **сырой PDF** (raw bytes, base64), или
- PDF предварительно растерится в JPG постранично перед отправкой в vision-модель

```bash
grep -rn "pdf-parse" lib/ --include="*.ts"
grep -rn "rasterize\|pdf-poppler\|pdf2pic\|pdfjs" lib/ --include="*.ts"
```

Зафиксировать в FINDINGS:
- Текущий путь PDF-fallback (1 предложение)
- Передаётся ли в Haiku PDF as-is или pre-processed image
- **Если PDF as-is** — после миграции на Grok 4.1 Fast non-reasoning сканы перестанут работать до Шага 4. Зафиксировать как known limitation в FINDINGS.
- **Если pre-rasterized** — миграция полностью прозрачна, R3 нулевой.

### 1.8 Phase 1 deliverable

Файл `FINDINGS.md` или ответ в чате с пунктами:
- 1.1 результаты grep (4 паттерна)
- 1.2 состояние `model-catalog.ts` для `grok-4-1-fast-non-reasoning`
- 1.3 текущие значения `chat-vision` и `vision:ocr` в `task-assignments.ts`
- 1.4 file:line UI-описания (если hardcoded)
- 1.5 решение по `registry.ts` (мерджить / не мерджить)
- 1.6 file:line строк docs для обновления
- 1.7 ответ на R3: pre-rasterize Y/N
- Любые сюрпризы → STOP, эскалация архитектору

---

## Phase 2 — Cleanup мёртвого кода

**Pre-condition:** Phase 1 пройдена, нет неожиданных call sites.

### 2.1 Удалить файл `lib/ai/vision-ocr.ts`

```bash
rm lib/ai/vision-ocr.ts
```

### 2.2 Удалить `vision:ocr` из `task-assignments.ts`

Удалить строку `"vision:ocr": "..."` из объекта.
Если есть type/enum `TaskId` где `vision:ocr` указан как литерал — убрать оттуда тоже.

### 2.3 Удалить упоминания из UI `/dev/models`

По результатам Phase 1.4:
- Если рендеринг из реестра — ничего не делать (уйдёт автоматически)
- Если hardcoded list — удалить запись

### 2.4 TypeScript check

```bash
pnpm typecheck
```

Должны вылезти все импорты-сироты `extractTextFromImage` / `extractTextFromPDF`. Удалить их в местах использования (по идее их нет — мы это проверили в Phase 1).

### 2.5 Build check

```bash
pnpm build
```

Должен пройти без ошибок.

### 2.6 Phase 2 commit (опционально)

Если разбивать PR на 2 коммита — здесь точка для commit «cleanup: remove dead vision/OCR code». Если один атомарный PR — продолжать.

---

## Phase 3 — Migration default `chat-vision` на Grok

### 3.1 Обновить `model-catalog.ts`

По результатам Phase 1.2:

**Случай А — запись `grok-4-1-fast-non-reasoning` отсутствует:**
Добавить запись по образцу других xAI-моделей в каталоге. Минимум:
- `id: "grok-4-1-fast-non-reasoning"`
- `provider: "xai"`
- vision capability флаг (как принято в проекте) = `true`
- `documentSupport` (если есть такое поле) — установить корректно (PDF: false, image: true)
- pricing input / output / cached input по docs.x.ai
- context window: 2_000_000

**Случай B — запись существует, но vision = false:**
Изменить на vision = true. Сверить pricing.

**Случай C — запись корректна:**
Ничего не делать в Phase 3.1.

### 3.2 Обновить default `chat-vision`

В `lib/ai/task-assignments.ts`:

```ts
// было
"chat-vision": "claude-haiku-4-5-20251001",

// стало
"chat-vision": "grok-4-1-fast-non-reasoning",
```

### 3.3 TS + build check

```bash
pnpm typecheck
pnpm build
```

Без ошибок.

---

## Phase 4 — Manual verification

`pnpm dev`. Войти под тестовым аккаунтом.

### 4.1 Test 1 — default vision path

1. Simply Chat с дефолтной моделью (Grok 4.1 Fast)
2. Загрузить JPEG (любая картинка)
3. Спросить «опиши картинку»
4. **Pass:** ответ приходит, в `ai_usage_log` (или DevPanel) запись с моделью `grok-4-1-fast-*`. Никаких `claude-haiku-*`.

### 4.2 Test 2 — fallback path через dev-override

1. `/dev/models`
2. Если в каталоге есть модель без vision capability — переключить какой-нибудь chat-режим на неё. Если все vision-capable — отметить тест как N/A и зафиксировать в отчёте.
3. Загрузить JPEG в этот режим
4. **Pass:** в логах видно triggered fallback на `chat-vision`, модель = `grok-4-1-fast-non-reasoning`

### 4.3 Test 3 — отсутствие регрессий

1. Обычный текстовый чат
2. **Pass:** работает как раньше

### 4.4 Test 4 — PDF (поведение задокументировано)

1. **Текстовый PDF** в чат → должен работать, без регрессии
2. **Сканированный PDF** (если есть тест-файл) → поведение зависит от ответа на R3:
   - pre-rasterize Y → работает
   - pre-rasterize N → деградация ответа, **это известное ограничение, Шаг 4 закроет**

Тест 4.2 — диагностический, **не блокирует приёмку**.

### 4.5 Записать результаты в `VERIFICATION.md` (или в PR description)

- Test 1 / 2 / 3 / 4.1 / 4.2 — Pass / Fail / N/A
- Если Fail — STOP, не коммитить, эскалация архитектору

---

## Phase 5 — Документация

### 5.1 `docs/ai-chats-map.md`

По результатам Phase 1.6:
- Удалить строку с `vision:ocr`
- Изменить `chat-vision`: `Claude Haiku 4.5` → `Grok 4.1 Fast non-reasoning`
- В разделе по провайдерам: убрать Anthropic из vision-сценариев

### 5.2 `docs/ai-providers.md`

- Секция Anthropic: убрать vision/OCR use case (оставить Профессор и иное)
- Секция xAI: добавить vision use case для Grok 4.1 Fast non-reasoning (default `chat-vision`)

### 5.3 Прочие docs (если найдены в Phase 1.6)

- `specs/Simply_xAI/SIMPLY_ATTACHMENT_ARCHITECTURE.md` если упоминает vision-fallback — синхронизировать

---

## Phase 6 — PR

### 6.1 Commit / commits

Вариант А — один атомарный коммит:
```
feat(migration-step-3): vision/OCR cleanup, switch chat-vision default to Grok 4.1 Fast

- Remove dead code: lib/ai/vision-ocr.ts, vision:ocr taskId
- Switch chat-vision default: claude-haiku-4-5 → grok-4-1-fast-non-reasoning
- Update model-catalog.ts vision capability if needed
- Update docs/ai-chats-map.md, docs/ai-providers.md
- Anthropic полностью уходит из vision-пути в чате (остаётся в Профессоре)
- Known limitation: scan PDF до Шага 4 — будет закрыто миграцией на xAI Files API

See specs/Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md, Блок 4
SPEC: specs/Simply_Migration/Simply_Migration_Step3_VisionOCR_SPEC.md
```

Вариант Б — разбить на 2 коммита (опционально, если упрощает review):
1. `chore(cleanup): remove dead vision:ocr code`
2. `feat(migration-step-3): switch chat-vision default to Grok 4.1 Fast`

### 6.2 Не пушить в master

Согласно правилу проекта — коммит остаётся в локальной master-ветке, push делается архитектором/Vladimir после ревью.

### 6.3 PR description (если когда-то будет push)

- Ссылка на SPEC и ROADMAP
- Резюме критериев приёмки (галочки)
- Результаты ручных тестов
- Известное ограничение R3 явно отмечено

---

## Что обновить в SIMPLY_STATUS.md после приёмки

(делает Vladimir, не Claude Code)

- Шаг 3 — закрыт
- Anthropic убран из vision-пути в чате
- Следующий шаг — **Шаг 4 (PDF на xAI Files API)**, который закрывает known limitation R3

---

## Что НЕ делать

- Не писать новый код vision/OCR — только удалять и переключать default
- Не трогать PDF pipeline (Шаг 4)
- Не трогать механизм capability-driven routing (`resolveActiveTaskId`) — он остаётся как страховка
- Не реализовывать pre-rasterize PDF в JPG как заплатку для R3 — Шаг 4 закроет архитектурно правильно
- Не пытаться удалить Haiku из `model-catalog.ts` — он может ещё использоваться в Профессоре
- Не смешивать с незакоммиченной правкой `registry.ts`, если она не относится к этой миграции
