# ADR 048: Dev Switchboard UI

**Дата:** 2026-04-12
**Статус:** Принято
**ТЗ:** ТЗ-2 Dev Switchboard UI (v3.84.0)

## Контекст

Core Model Registry (ТЗ-1, v3.83.0) ввёл единую точку `getModel(taskId)` с stub-функцией `lookupOverride`. Нужен UI для разработчика: переключать модели для любой из 39 задач в dev-окружении без правки кода.

## Решение

### Override mechanism: file-based (не cookies)

**`.simply-dev-overrides.json`** в корне проекта — плоский JSON `{ "taskId": "catalogId" }`.

Два модуля:
- `model-overrides.ts` — client-safe: dev-gate, parse, reader callback
- `model-overrides-node.ts` — server-only: `fs.readFileSync/writeFileSync`, регистрирует себя в shared модуле при import

Side-effect import в `chat/route.ts`:
```ts
import "@/lib/ai/model-overrides-node";
```

### Почему не cookies

1. **next/headers** в Next 15 — async-only API, sync access бросает
2. **Chrome DevTools** ненадёжен для cookie-манипуляций (spec chars, hot-reload)
3. **AsyncLocalStorage** + cookie header — работало, но сложно и хрупко

File-based решение: zero-dependency, stable through hot-reloads, работает из коробки.

### UI: три уровня

1. **`/dev/models`** — полная карта (Server Component + Client): 40 задач, каталог, ENV-статусы, Server Actions
2. **DevPanel Switchboard** — per-message quick switcher в drawer (shared `ModelSelect`)
3. **Footer badge** — жёлтый «OVERRIDE» при активном override

### Catalog SSOT для capabilities

`chat/route.ts` резолвит `effectiveCatalogEntry` через каталог, не угадывает из chatMode/think/attachments. Флаги `isAnthropicModel`, `modelSupportsCompaction`, `needsSnapshotFallback` — все через catalog entry.

### Dev-gate: три уровня изоляции

1. `lookupOverride()` → silent null если `!isSimplyDevMode`
2. `/dev/models` page → `notFound()` если `!isSimplyDevMode`
3. Server Actions → `throw` если `!isSimplyDevMode`

## Последствия

**Плюсы:**
- Переключение модели = 1 клик, без правки кода
- Нулевое влияние на prod (triple dev-gate)
- Нулевое влияние на сигнатуры `getModel()` (39 call-sites не тронуты)
- Shared `ModelSelect` переиспользуется в двух местах

**Минусы:**
- File-based = только local dev (не работает на Vercel)
- Raw-fetch сервисы (Perplexity, Deepgram, Voyage, Gemini TTS) не переключаемы — отдельное ТЗ

**Известные ограничения:**
- Grok/OpenRouter cache не активирован в code — отдельное ТЗ
- Tiered pricing (Qwen 3.6 Plus >256K) не поддержан в каталоге

## Файлы

- `lib/ai/model-overrides.ts`, `lib/ai/model-overrides-node.ts`
- `lib/ai/getModel.ts` — lookupOverride
- `app/(dashboard)/dev/models/` — page, actions, client
- `components/dev-panel/sections/switchboard-section.tsx`
- `components/shared/model-select.tsx`
- `docs/model-catalog-ops.md` — workflow для аудита каталога

---

## ⚠️ ЯВНО: зачем нужна эта панель и что она НЕ обязана делать

**Назначение:** инструмент разработчика для быстрого переключения модели в любом из 26 call-sites `getModel(taskId)` **на локальной машине** без правки кода. Цель — тестировать поведение чатов/пайплайнов на разных моделях.

**Только dev. Не prod.**

Триггер на трёх уровнях (`isSimplyDevMode === "true"` из `SIMPLY_DEV_MODE=true` в `.env.local`):
1. `lookupOverride()` в `getModel.ts` → silent null
2. `/dev/models` page → `notFound()`
3. Server Actions → `throw`

В production (`SIMPLY_DEV_MODE` не установлен) **файл `.simply-dev-overrides.json` физически не читается** — панель считается архитектурно отсутствующей.

### ⛔ НЕ заводить в backlog «production coverage» для этой панели

Любая находка типа «side-effect import в X файлах из Y, в production это пробел» — **неверна по смыслу**. В production этой фичи нет. Никакой «20 call-sites молча игнорируют override в production» не существует — в production `isOverridesAllowed()` возвращает false **раньше** чем reader вообще вызывается.

Один side-effect import `import "@/lib/ai/model-overrides-node"` в `chat/route.ts` достаточен: в dev Next.js работает одним Node-процессом, модуль `model-overrides.ts` загружается один раз, `activeOverridesReader` — module-local переменная в shared instance, видна всем 26 call-sites `getModel()` через транзитивный импорт того же модуля.

### Если нужен override для какого-то taskId

Открыть `/dev/models` → найти строку ровно с именем taskId из `lib/ai/task-assignments.ts` (например `simply-chat`, `briefing:author`, `clerk:task-summary`) → выбрать модель из каталога → Save. UI пишет в `.simply-dev-overrides.json`. Reader читает файл на каждый `getModel()` вызов — изменения подхватываются мгновенно без перезапуска.

### Постскриптум (2026-04-14, сессия 3)

В `_archive/TZ_DeadModelSelectors/FINDINGS.md` есть Finding #2, утверждающий что «scattered side-effect imports — high-impact architectural concern». Этот finding **неверен**: он сформулирован как production-проблема для dev-only фичи. В сессии 2026-04-14 session 3 попытка его исправить (перенос side-effect import в `instrumentation.ts`) была проведена и полностью откачена без последствий для кода. См. `_archive/TZ_OverridesReaderCentralization/HANDOFF.md` для полного разбора.

**Правило для будущего:** перед заведением любой находки в FINDINGS.md — сверять с действующими ADR. Если ADR явно декларирует ограничение (как здесь «только local dev»), то «отсутствие покрытия за пределами ограничения» — это реализация дизайна, а не долг.
