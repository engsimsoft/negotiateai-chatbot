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
