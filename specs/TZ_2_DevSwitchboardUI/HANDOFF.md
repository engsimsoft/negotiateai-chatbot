# Передача сессии ТЗ-2: Dev Switchboard UI

**Дата:** 2026-04-12
**Сессия:** 2 (Этапы 1+2 + hotfix + SSOT refactor + catalog refresh)
**Контекст:** предыдущая сессия перегружена, смена нужна

---

## Статус этапов

- [x] **Этап 0: Baseline** — зелёный
- [x] **Этап 1: Backend overrides + Footer badge** — ✅ завершён, протестирован end-to-end
- [x] **Этап 2: Страница `/dev/models`** — ✅ завершён, протестирован с реальными моделями
- [ ] **Этап 3: Per-message Switcher в DevPanelDrawer** ← **следующий**
- [ ] **Этап 4: Polish + edge cases**
- [ ] **Этап 5: Финализация** (ADR, docs, version 3.84.0, архив)

## Коммиты этой сессии (на ветке `feature/simply-kitt`)

```
1a98c64  catalog refresh — Grok 4.20 dated IDs, verified OpenRouter prices, GLM vision models
882b525  fix: replace heuristic model checks with catalog capability flag (kardinal SSOT)
d716d61  feat: /dev/models page — full switchboard UI (Stage 2)
07ba690  hotfix: file-based overrides backend + /api/dev/set-override (Stage 1 rev3)
bc68967  feat: backend overrides + footer badge (Stage 1 rev1 — later superseded)
```

**Линия истории:** `bc68967` (cookie через next/headers) → пришлось переделывать из-за Next 15 sync-cookies error → `07ba690` (file-based) → `d716d61` (UI) → `882b525` (убрали угадывание isHaikuModel через catalog flag) → `1a98c64` (выверенные цены по WebFetch).

---

## Финальная архитектура (что уже работает)

### Backend overrides (Этап 1)

**SSOT:** файл `.simply-dev-overrides.json` в корне проекта. JSON вида `{ "simply-chat": "claude-haiku-4-5-20251001" }`. Добавлен в `.gitignore`.

**Два модуля:**
- `lib/ai/model-overrides.ts` — **client-safe**: dev-gate, parse/serialize, `registerOverridesReader` hook, `getActiveOverrides()` возвращает `{}` если reader не установлен
- `lib/ai/model-overrides-node.ts` — **server-only** (`import "server-only"`), `fs.readFileSync`/`fs.writeFileSync` backed reader + `writeOverridesFile`. Регистрирует себя в shared модуле при import.

**Side-effect import** в `app/(chat)/api/chat/route.ts`:
```ts
import "@/lib/ai/model-overrides-node";
```
Без этого import reader не зарегистрируется и getActiveOverrides вернёт `{}`.

**Зачем такое разделение:** `model-tiers.ts → getModel → model-overrides` — цепочка транзитивно попадает в клиентский бандл через `components/input/*`. Если бы `node:fs` был в shared модуле, webpack бы падал `UnhandledSchemeError`.

### UI /dev/models (Этап 2)

- `app/(dashboard)/dev/models/page.tsx` — Server Component: dev-gate (`notFound()` в prod), auth, грузит task-assignments + catalog + env-статусы всех 8 провайдеров
- `app/(dashboard)/dev/models/actions.ts` — 3 Server Action:
  - `setOverride(taskId, catalogId)`
  - `clearTaskOverride(taskId)`
  - `resetAllOverrides()`
  - Каждая проверяет `isSimplyDevMode` + `revalidatePath("/dev/models")`
- `app/(dashboard)/dev/models/dev-models-client.tsx` — Client Component с 4 секциями:
  1. LLM Providers (5)
  2. Raw Providers (3)
  3. Task Assignments — таблица всех 40 taskId с dropdown моделей, живой фильтр
  4. Model Catalog — полная сводка всех записей
- `app/api/dev/set-override/route.ts` — GET endpoint (legacy из Stage 1 hotfix, оставлен для curl-тестов)
- `middleware.ts` — bypass для `/api/dev/*` (защита на уровне endpoint через `isSimplyDevMode`)

### SSOT через catalog capability flag (рефакторинг 882b525)

**Проблема:** cache / compaction / media-strip логика в `chat/route.ts` угадывала провайдера из `chatMode === "simply" || think || hasAttachments`. Это ломалось при override (например, override `simply-chat → Haiku` → isAnthropicModel возвращал false → cacheControl не подставлялся).

**Решение:** `ModelCapabilities` расширен полем `supportsCompaction: boolean`. Все флаги в `chat/route.ts` теперь читают **catalog entry** для `activeTaskId`:
```ts
const effectiveCatalogEntry = activeTaskId
  ? getModelEntry(getModelIdForTask(activeTaskId))
  : undefined;
const effectiveProvider = effectiveCatalogEntry?.provider ?? "anthropic";
const isAnthropicModel = effectiveProvider === "anthropic";
const modelSupportsCompaction =
  effectiveCatalogEntry?.capabilities.supportsCompaction ?? false;
const needsSnapshotFallback =
  chatMode === "chat" && !modelSupportsCompaction;
```

Сняли с кода:
- `chatMode !== "simply" || think || hasAttachments` как детектор Anthropic
- `.includes("haiku")` как детектор Haiku
- `isHaikuChat` для snapshot injection (теперь gates на `!modelSupportsCompaction`)

**Протестировано end-to-end:** пользователь подтвердил что `Cache read: 16315` появляется в DevPanel при override simply-chat → Haiku. До фикса cache был 0.

### Catalog (рефрешено через WebFetch)

Все цены **проверены** через:
- `https://openrouter.ai/api/v1/models` — для OpenRouter моделей
- `https://docs.x.ai/docs/models` — для Grok моделей
- Скриншоты пользователя openrouter.ai/qwen/qwen3.6-plus — подтверждение

**OpenRouter (5 моделей):**
| ID | Type | Ctx | $/M in | $/M out | Cache |
|----|------|-----|--------|---------|-------|
| `z-ai/glm-4.6` | text | 204.8K | 0.39 | 1.90 | — |
| `z-ai/glm-5.1` | text | 202.7K | 0.95 | 3.15 | 0.475 |
| `z-ai/glm-4.6v` | vision | 131K | 0.30 | 0.90 | — |
| `z-ai/glm-5v-turbo` | vision | 202.7K | 1.20 | 4.00 | 0.24 |
| `qwen/qwen3.6-plus` | text | 1M | 0.325 | 1.95 | — |

**Удалили:** `qwen/qwen3-max` (дорогой legacy), `qwen/qwen3.6-plus-preview` (нет в `/api/v1/models`).

**xAI Grok (6 моделей, все с cache):**
| ID | Reasoning | $/M in | $/M out | Cached |
|----|-----------|--------|---------|--------|
| `grok-4.20-0309-reasoning` | ✓ | 2.00 | 6.00 | 0.20 |
| `grok-4.20-0309-non-reasoning` | — | 2.00 | 6.00 | 0.20 |
| `grok-4.20-multi-agent-0309` | ✓ | 2.00 | 6.00 | 0.20 |
| `grok-4-1-fast-reasoning` | ✓ | 0.20 | 0.50 | 0.05 |
| `grok-4-1-fast-non-reasoning` | — | 0.20 | 0.50 | 0.05 |
| `grok-4` | — | 2.00 | 6.00 | 0.20 (educated guess, нет в docs) |

**Новый preset:** `CAPS_OPENROUTER_VISION` с `vision: true` (для GLM 4.6V / 5V Turbo).

---

## Результаты мануальных тестов (подтверждены end-to-end)

1. ✅ Baseline без override → MiniMax M2.7 в footer
2. ✅ Override через `/api/dev/set-override` → Claude Haiku в footer + жёлтый OVERRIDE badge
3. ✅ Override через UI `/dev/models` → переключение за 1 клик, Server Action 20-200ms, `revalidatePath` мгновенно
4. ✅ Override на Grok 4.1 Fast non-reasoning → реальный ответ от xAI через override
5. ✅ Override на Grok 4.1 Fast reasoning для `simply-chat-vision` + картинка → Grok успешно описал изображение (vision работает)
6. ✅ Cache read в DevPanel: Haiku с override показал `Cache read: 16 315` на 3-м сообщении — доказательство что `isAnthropicModel` через catalog flag включает cacheControl корректно
7. ✅ Prod smoke не делали — валидация только в dev (возможно делать на Этапе 4)

---

## OPEN QUESTIONS — НЕ ТРОГАТЬ без отдельного ТЗ

### 1. Кэш истории сообщений не работает

**Сейчас:** `cacheControl: { type: 'ephemeral' }` ставится только на system prompt. История предыдущих user/assistant сообщений летит fresh при каждом запросе. В длинном диалоге это съедает всю экономию.

**Почему open:** требует глубокого анализа Anthropic API (Anthropic поддерживает cache_control на любом content block, но конфигурация tricky для многошаговых диалогов). Возможно 2-3 отдельных ТЗ.

### 2. Grok / OpenRouter cache — не активирован

**Сейчас:** в каталоге для этих провайдеров проставлен `cachedInput` > 0 (GLM 5.1 $0.475, Grok 4.20 $0.20 и т.д.), но в `chat/route.ts` `cacheControl` подставляется **только** в branch `isAnthropicModel`. Grok/OpenRouter не получают инструкции на кэш.

**Что это значит на практике:**
- Cost display в DevPanel будет корректный для Anthropic
- Для Grok/OpenRouter override → `cache_read` в DevPanel всегда 0 → отображаемая стоимость = fresh price (недооценка реальной экономии, если провайдер кэширует автоматически; или отсутствие экономии если нужно явно активировать)

**Почему open:** каждый провайдер имеет своё API для кэша:
- xAI: `cache_control` parameter в request
- OpenRouter: `usage.prompt_tokens_details.cached_tokens` + провайдер-специфичные настройки
- AI SDK v6 интерфейс для caching не унифицирован между провайдерами

### 3. Grok vision — подтверждено только для `grok-4-1-fast-reasoning`

Из каталога: `CAPS_GROK` имеет `vision: true`. Практически проверена только одна модель (reasoning fast). Для остальных Grok — мы доверяем каталогу, но не тестировали. Если будут 400-errors при vision override на другие Grok — надо проверять x.ai docs.

### 4. `grok-4` не в docs.x.ai/docs/models

Оставил запись с пометкой. Если будет использоваться — может вернуть 404 «model not found». Safe default: предупредить в Этапе 4 polish.

---

## Следующая сессия: начни с

### Этап 3 — Per-message Switcher в DevPanelDrawer

**Цель:** маленький dropdown внутри существующего `DevPanelDrawer` под секцией MODEL, чтобы менять модель **не уходя** из чата на `/dev/models`. Переиспользует **всю** инфраструктуру Этапа 2 — те же Server Actions, тот же catalog.

**Файлы:**

1. **`components/dev-panel/sections/switchboard-section.tsx`** — новый.
   - Props: `data: DevPanelMessageData` (уже содержит `data.prompt.taskId`, `data.prompt.effectiveModelId`, `data.prompt.overrideActive`)
   - Если `data.prompt.taskId` не определён — секция скрыта
   - Показывает: `Task: <taskId>`, dropdown со всеми моделями каталога
   - Кнопки: `Apply` (setOverride), `Reset` (clearTaskOverride), ссылка `Open /dev/models →`
   - После Apply — **показать toast** «Override saved — reload next message to apply» (модель применится к СЛЕДУЮЩЕМУ сообщению, не к текущему)

2. **`components/dev-panel/dev-panel-drawer.tsx`** — вставить `<SwitchboardSection data={data} />` сразу после `<ModelSection />`

3. **Shared ModelSelect** — вынести из `app/(dashboard)/dev/models/dev-models-client.tsx` в `components/shared/model-select.tsx` (или inline — на ваше усмотрение). Используется в двух местах: `/dev/models` таблице И новом switchboard-section.

4. **Server Actions** — уже готовы: `@/app/(dashboard)/dev/models/actions` экспортирует `setOverride`, `clearTaskOverride`, `resetAllOverrides`. Можно импортировать прямо из `switchboard-section.tsx`.

**Gotcha:** Server Actions из `(dashboard)/dev/models/actions.ts` expect dev gate. Import в client component работает — Next.js умеет вызывать server actions из client.

**Валидация:**
- tsc + manual test: в Simply Chat открыть footer → секция Switchboard видна → Select другую модель → Apply → отправить **новое** сообщение → footer показывает новую модель + OVERRIDE badge
- Ссылка `Open /dev/models →` работает
- Reset рядом с Apply — снимает override

### Этап 4 — Polish

- Toast + undo через `sonner` (проверить что установлен)
- Capability warning в dropdown (simple эвристика: `vision` в taskId → warning если `!caps.vision`)
- Dev-link в app-sidebar только при `NEXT_PUBLIC_SIMPLY_DEV_MODE=true`
- Prod smoke: `SIMPLY_DEV_MODE=false npm run build && npm start` → `/dev/models` 404

### Этап 5 — Финализация

Пройти по `DOCUMENTATION_GUIDE.md`. Ключевые пункты:
- ADR `docs/decisions/048-dev-switchboard-ui.md` — описать архитектурные решения + open questions (кэш-гэпы)
- `CLAUDE.md` → Структура кода → добавить `app/(dashboard)/dev/models/*` + `lib/ai/model-overrides*.ts`
- `SIMPLY_STATUS.md` → отметить ТЗ-2 завершённым
- `package.json` → 3.83.0 → 3.84.0
- Главный `CHANGELOG.md` ← перенести из локального
- Переместить `specs/TZ_2_DevSwitchboardUI/` → `_archive/TZ_2_DevSwitchboardUI/`

---

## Что знать про окружение

**Dev-сервер:**
- Запущен в фоне (background task id меняется при каждом restart, смотри текущий в открытой сессии)
- Output логируется в `/private/tmp/claude-501/.../tasks/<task-id>.output`
- Monitor task фильтрует `[Chat API]`, `error`, `override`, `dev/models` → нотификации в чат

**Правило:** НЕ запускать `npm run build` пока `npm run dev` активен — они конфликтуют за `.next/`, dev-сервер получает `Cannot find module './vendor-chunks/...js'`. Лечится `rm -rf .next && npm run dev`.

**ENV:** `SIMPLY_DEV_MODE=true`, `NEXT_PUBLIC_SIMPLY_DEV_MODE=true`, `ANTHROPIC_API_KEY`, `MINIMAX_API_KEY`, `XAI_API_KEY` (новый, добавлен в этой сессии), `OPENROUTER_API_KEY`, `VOYAGE_API_KEY`, `DEEPGRAM_API_KEY`, `PERPLEXITY_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`.

**Voyage AI блокирует финский VPN (403).** Memory retrieval делает graceful degradation. Лечится переключением VPN на US. Не код.

---

## Блокеры / Вопросы

1. ✅ Все 6 вопросов из ANALYSIS.md закрыты
2. ⚠️ Кэш-гэпы (см. OPEN QUESTIONS выше) — решено не трогать в скоупе ТЗ-2, вынести в отдельное ТЗ после финализации
3. ⚠️ Grok `grok-4` статус неясен — оставлен с educated guess pricing, может понадобиться удалить в Этапе 4

---

## Версия проекта

Текущая: `3.83.0`
Цель после завершения ТЗ-2: `3.84.0`

---

## Текущие открытые терминальные задачи

- Dev-сервер в фоне — смотри свежие task-id в Monitor
- Monitor task — тоже активен, отлавливает ошибки и Chat API события

При необходимости:
- Остановить monitor: `TaskStop` на его task-id
- Перезапустить dev: kill процессы next-server + `npm run dev 2>&1` с `run_in_background: true`
- Очистить `.next` если есть vendor-chunks ошибки: `rm -rf .next`
