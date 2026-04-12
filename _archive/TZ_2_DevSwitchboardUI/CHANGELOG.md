# Changelog ТЗ-2: Dev Switchboard UI

> Локальный лог изменений. В Фазе 4 будет перенесён в главный `CHANGELOG.md`.

---

## Сессия 2 — 2026-04-12 — Catalog refresh (коммит 1a98c64)

### Changed (lib/ai/model-catalog.ts)

Все цены верифицированы через WebFetch. Параллельные запросы к:
- `https://openrouter.ai/api/v1/models` — для OpenRouter моделей
- `https://docs.x.ai/docs/models` — для xAI Grok

**xAI Grok — 6 моделей, все переценены + добавлен cache:**
- `grok-4.20-0309-reasoning`, `-non-reasoning`, `-multi-agent-0309` — все $2/$6 с cache $0.20/M (было placeholder $3/$15, multi-agent ошибочно имел 2× markup)
- `grok-4-1-fast-reasoning`, `-non-reasoning` — добавлен cache $0.05/M (был 0)
- `grok-4` оставлен с educated-guess pricing (не в docs.x.ai)

**OpenRouter — 5 моделей:**
- `z-ai/glm-4.6` — $0.39/$1.90, ctx 204.8K, maxOut 204.8K (было $0.5/$1.5 / 200K / 16K)
- `z-ai/glm-5.1` — maxOut 65_500 → 65_535 (trivial)
- `qwen/qwen3.6-plus` — уже верно, только убран старый comment
- `z-ai/glm-4.6v` — **НОВЫЙ** vision-модель, 131K, $0.30/$0.90
- `z-ai/glm-5v-turbo` — **НОВЫЙ** vision-модель, 202.7K, $1.20/$4, cache $0.24
- **Удалено:** `qwen/qwen3.6-plus-preview` (не в /api/v1/models)
- **Удалено ранее:** `qwen/qwen3-max` (старая/дорогая)

**Новый preset:** `CAPS_OPENROUTER_VISION` (vision: true)

### Files
- lib/ai/model-catalog.ts

### Validated
- tsc --noEmit — 0 ошибок
- Мануальный тест: `simply-chat` override → `grok-4-1-fast-non-reasoning` → Grok ответил
- Мануальный тест: `simply-chat-vision` override → `grok-4-1-fast-reasoning` + картинка → Grok описал изображение
- `.env.local` — добавлен `XAI_API_KEY` (в .gitignore, не коммитится)

---

## Сессия 2 — 2026-04-12 — Kardinal SSOT refactor (коммит 882b525)

### Problem

Пользователь сообщил во время тестов: override `simply-chat → Haiku` не включает prompt caching (все токены как fresh). Анализ показал: `chat/route.ts` угадывал провайдера из `chatMode/think/hasAttachments`, а не резолвил через catalog.

### Changed

**lib/ai/model-catalog.ts:**
- Добавлен `supportsCompaction: boolean` в `ModelCapabilities` interface
- `CAPS_CLAUDE` → `supportsCompaction: true`, все остальные presets → false
- Haiku-записи (3 штуки) override `supportsCompaction: false` через spread + explicit
- 6 non-LLM capability-объектов дополнены `supportsCompaction: false`

**app/(chat)/api/chat/route.ts:**
- Одна точка резолюции `effectiveCatalogEntry` сразу после `activeTaskId`
- `effectiveProvider`, `isAnthropicModel`, `modelSupportsCompaction`, `needsSnapshotFallback` — все через catalog
- Убрано: `chatMode !== "simply" || think || hasAttachments` угадывание, `.includes("haiku")` fragile check
- `isHaikuChat` оставлен для state loading (before activeTaskId) с комментарием
- Snapshot injection теперь gates на `!modelSupportsCompaction` вместо `isHaikuChat`
- `isSimplyNonAnthropicModel` — через `effectiveProvider !== "anthropic"` вместо старого угадывания

### Validated

**End-to-end:** пользователь подтвердил через скриншот DevPanel:
```
Input (fresh): 9 958
Cache read:    16 315   ← ДОКАЗАТЕЛЬСТВО что фикс работает
Output:        168
Total:         26 441
Cost:          ₽1.24
```
До фикса строка `Cache read` вообще не появлялась бы.

### Files
- lib/ai/model-catalog.ts
- app/(chat)/api/chat/route.ts

---

## Сессия 2 — 2026-04-12 — /dev/models UI (коммит d716d61)

### Added

**app/(dashboard)/dev/models/page.tsx** — Server Component:
- Dev gate `notFound()` в prod
- Auth check
- Loads task-assignments, catalog, env-key status для 8 провайдеров
- Passes serializable data to client

**app/(dashboard)/dev/models/actions.ts** — 3 Server Actions:
- `setOverride(taskId, catalogId)`
- `clearTaskOverride(taskId)`
- `resetAllOverrides()`
- Каждая: `isSimplyDevMode` check + `writeOverridesFile` + `revalidatePath`

**app/(dashboard)/dev/models/dev-models-client.tsx** — Client Component:
- 4 секции: LLM Providers, Raw Providers, Task Assignments, Model Catalog
- Таблица 40 taskId с inline ModelSelect (grouped by provider)
- Capability warning icons (vision tasks на non-vision моделях)
- Live filter по taskId/model
- Header badge «N overrides active» + Reset All кнопка
- Pricing в RUB/1K tokens

**ENV key source (server-side only):** ANTHROPIC_API_KEY, MINIMAX_API_KEY, XAI_API_KEY, OPENROUTER_API_KEY, VOYAGE_API_KEY, DEEPGRAM_API_KEY, PERPLEXITY_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY.

### Validated
- tsc --noEmit — 0 ошибок
- npm run build — /dev/models 9.41 kB first-load JS
- Пользователь тестировал: переключение через dropdown, reset одной задачи, reset all — всё работает

### Files
- app/(dashboard)/dev/models/page.tsx
- app/(dashboard)/dev/models/actions.ts
- app/(dashboard)/dev/models/dev-models-client.tsx

---

## Сессия 1 rev 3 — 2026-04-12 — Этап 1 hotfix (file-based backend)

### Changed
- Переписан backend с cookies на file-based: `.simply-dev-overrides.json` в корне
- `lib/ai/model-overrides.ts` — убраны cookie-helpers, оставлены только shared utilities + reader callback
- `lib/ai/model-overrides-node.ts` — теперь использует `fs.readFileSync`/`fs.writeFileSync`, никакого AsyncLocalStorage / next/headers
- `app/api/dev/set-override/route.ts` — новый endpoint для мутации файла через URL
- `app/(chat)/api/chat/route.ts` — убрана обёртка `runWithOverridesFromRequest`, заменена на side-effect `import "@/lib/ai/model-overrides-node"`
- `middleware.ts` — bypass для `/api/dev/*` (защита на уровне endpoint)
- `.gitignore` — добавлен `.simply-dev-overrides.json`

### Validated
- Мануальный тест: `curl` → файл → Simply Chat → footer показывает **Haiku 4.5 + ⚙ OVERRIDE** (скриншот от пользователя)
- `tsc --noEmit` — 0 ошибок
- prod-гейт работает — `isSimplyDevMode=false` отключает читаемость файла

### Why three attempts
1. **next/headers.cookies()** — Next 15 превратил API в async-only, sync-доступ бросает в dev
2. **AsyncLocalStorage + cookie header** — работало технически, но Chrome DevTools манипуляции с cookies ненадёжны (spec chars, hot-reload, path/domain)
3. **File on disk** — финальное решение, работает из коробки, stable through hot-reloads

---

## Сессия 1 — 2026-04-12 — Фаза 1 + 2 (Анализ + Планирование) + Этапы 0–1

### Added
- `specs/TZ_2_DevSwitchboardUI/SPEC.md` — копия ТЗ
- `specs/TZ_2_DevSwitchboardUI/ANALYSIS.md` — анализ + 6 согласованных вопросов
- `specs/TZ_2_DevSwitchboardUI/ROADMAP.md` — план по 5 этапам
- `specs/TZ_2_DevSwitchboardUI/CHANGELOG.md` — этот файл
- `specs/TZ_2_DevSwitchboardUI/HANDOFF.md` — стартовый контекст
- `lib/ai/model-overrides.ts` — SSOT для cookie-based overrides (parse/serialize/gate/cookie opts)
- Публичные хелперы в `getModel.ts`: `isTaskOverridden(taskId)`, `getCurrentOverrides()`

### Changed
- `lib/ai/getModel.ts`:
  - `lookupOverride()` — реализация через `next/headers.cookies()` с dev-gate + try/catch для background scope
  - Добавлен `readOverridesFromCookie()` helper
- `lib/ai/debug-events.ts`:
  - `DebugPromptData` расширен: `taskId?`, `overrideActive?`, `defaultModelId?`, `effectiveModelId?`
- `app/(chat)/api/chat/route.ts`:
  - Хоистинг `activeTaskId: TaskId | null` из двух мест в одно (устраняет 17 строк дублирующей логики)
  - `emitDebugPrompt` получает override info
  - onFinish переиспользует `activeTaskId` вместо повторной резолюции
- `components/dev-panel/dev-panel-footer.tsx`:
  - Жёлтый badge «⚙ OVERRIDE» + tooltip при `data.prompt.overrideActive`
- `components/dev-panel/sections/model-section.tsx`:
  - Строки «Task ID» и «Override: default → effective»

### Files
- lib/ai/model-overrides.ts
- lib/ai/getModel.ts
- lib/ai/debug-events.ts
- app/(chat)/api/chat/route.ts
- components/dev-panel/dev-panel-footer.tsx
- components/dev-panel/sections/model-section.tsx
