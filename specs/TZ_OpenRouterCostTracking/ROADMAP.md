# Roadmap ТЗ_OpenRouterCostTracking

**Создан:** 2026-04-13
**Версия проекта:** 3.87.0 → 3.87.1 (patch — single bug fix)
**Статус:** ⬜ Не начат

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 4 |
| Сессий (оценка) | 1 (~1-1.5 часа) |
| Тип | Bug fix (pre-existing, не регрессия) |

---

## Этап 0 — Pre-flight + empirical confirmation

**Цель:** убедиться что baseline чистый и подтвердить гипотезу о формате `response.modelId` для OpenRouter моделей через живой запрос.

**Задачи:**

- [ ] `git status` — clean после v3.87.0 (должен быть чистый)
- [ ] `npx tsc --noEmit` — 0 ошибок (контрольный)
- [ ] **Empirical confirmation:** добавить временный `console.log("[debug]", { rawModelId: response?.modelId })` на line 1061 `app/(chat)/api/chat/route.ts`
- [ ] Через `/dev/models` переключить `simply-chat` на `qwen/qwen3.6-plus` override
- [ ] Отправить тестовый запрос в Simply Chat
- [ ] Прочитать dev-сервер log → увидеть реальный формат (гипотеза: `openrouter:qwen/qwen3.6-plus` с префиксом)
- [ ] Убрать временный console.log
- [ ] Зафиксировать реальный формат в CHANGELOG ТЗ — это ground truth для дизайна фикса

**Валидация этапа:** гипотеза подтверждена или опровергнута. Если опровергнута — **stop и пересмотреть ANALYSIS.md**, не идти на Этап 1.

**Git:** не нужен (только диагностика).

---

## Этап 1 — Implementation

**Цель:** добавить `normalizeModelId` helper и применить в catalog lookup. Один атомарный коммит.

### Задачи

- [ ] **1.1** В `lib/ai/model-catalog.ts` добавить:
  - `const KNOWN_REGISTRY_PREFIXES = new Set([...])` — список провайдеров из registry.ts (anthropic, minimax, minimaxLong, xai, openrouter)
  - `export function normalizeModelId(raw: string): string` — strip prefix если в known set
- [ ] **1.2** Модифицировать `getModelEntry`:
  ```ts
  export function getModelEntry(id: string): ModelEntry | undefined {
    return CATALOG[normalizeModelId(id)];
  }
  ```
  Это обеспечивает SSOT защиту: все call-sites через `getModelEntry` автоматически получают normalize.
- [ ] **1.3** Также применить в `resolveModelEntry` для единообразия:
  ```ts
  export function resolveModelEntry(id: string): ModelEntry | undefined {
    const normalized = normalizeModelId(id);
    const entry = CATALOG[normalized];
    if (!entry) return;
    if (entry.aliasOf) return CATALOG[entry.aliasOf];
    return entry;
  }
  ```
- [ ] **1.4** Проверить `getDisplayName` и `getContextWindow` — если они тоже принимают raw modelId, применить normalize:
  ```ts
  export function getDisplayName(id: string): string {
    return CATALOG[normalizeModelId(id)]?.displayName ?? id;
  }
  ```
- [ ] **1.5** `npx tsc --noEmit` → 0 ошибок
- [ ] **1.6** `npm run build` → успех

**Валидация:**
- TS clean
- Build clean
- Никаких изменений в других файлах (только `model-catalog.ts`)

**Git:** commit `fix(tz-openrouter): normalize modelId по known registry prefixes в catalog lookup`

---

## Этап 2 — Unit test (TDD safety net)

**Цель:** гарантировать что `normalizeModelId` ведёт себя корректно во всех граничных случаях, чтобы будущая регрессия была пойма на CI.

### Задачи

- [ ] **2.1** Проверить есть ли в проекте test framework (grep `.test.ts` или `vitest.config`)
- [ ] **2.2** Если есть — добавить `lib/ai/__tests__/model-catalog.test.ts` (или аналогичный путь) с тестами:
  - `normalizeModelId("openrouter:qwen/qwen3.6-plus")` → `"qwen/qwen3.6-plus"`
  - `normalizeModelId("anthropic:claude-haiku-4-5-20251001")` → `"claude-haiku-4-5-20251001"`
  - `normalizeModelId("minimax:MiniMax-M2.7")` → `"MiniMax-M2.7"`
  - `normalizeModelId("minimaxLong:MiniMax-M2.7")` → `"MiniMax-M2.7"`
  - `normalizeModelId("xai:grok-4")` → `"grok-4"`
  - `normalizeModelId("qwen/qwen3.6-plus")` → `"qwen/qwen3.6-plus"` (no-op)
  - `normalizeModelId("claude-haiku-4-5-20251001")` → `"claude-haiku-4-5-20251001"` (no-op)
  - `normalizeModelId("unknown:foo")` → `"unknown:foo"` (no-op, unknown prefix)
  - `normalizeModelId("")` → `""`
- [ ] **2.3** Если тестов нет в проекте — пропустить (не создавать инфраструктуру ради одного теста), зафиксировать в CHANGELOG как «тесты не добавлены — проект без test framework»

**Валидация:** тест проходит или пропущено с обоснованием.

**Git:** commit `test(tz-openrouter): unit test normalizeModelId edge cases` (если добавлены)

---

## Этап 3 — Manual E2E validation

**Цель:** подтвердить что DevPanel показывает правильный cost для OpenRouter моделей после фикса.

### Задачи

- [ ] **3.1** Запустить dev server (если не запущен): `npm run dev`
- [ ] **3.2** Открыть `/dev/models`
- [ ] **3.3** Переключить `simply-chat` на `qwen/qwen3.6-plus` override
- [ ] **3.4** Открыть `/simply`, отправить тестовый запрос (любой текст)
- [ ] **3.5** Открыть DevPanel → проверить:
  - Model ID: `qwen/qwen3.6-plus`
  - **Cost: non-zero** (например `₽0.65` на типичных 15K токенов)
- [ ] **3.6** Повторить для `z-ai/glm-4.6` (text) и `z-ai/glm-4.6v` (vision) через `/dev/models`
- [ ] **3.7** **Контрольный тест:** убрать override, переключить на дефолтный Haiku / MiniMax → убедиться что для прямых провайдеров cost тоже показывается (регрессии нет)
- [ ] **3.8** SQL sanity check:
  ```sql
  SELECT "modelId", "inputTokens", "cacheReadTokens", "costUsd"
  FROM "ai_usage_log"
  WHERE "createdAt" > NOW() - INTERVAL '10 minutes'
  ORDER BY "createdAt" DESC LIMIT 10;
  ```
  Ожидание: все строки non-zero cost (где должно быть)
- [ ] **3.9** Сбросить все dev overrides через `/dev/models` → clean state

**Валидация этапа:**
- ✅ DevPanel показывает non-zero cost для всех 3 OpenRouter моделей
- ✅ Контрольные провайдеры (Anthropic, MiniMax) работают как раньше
- ✅ SQL подтверждает что `ai_usage_log` корректно пишется

**Git:** не нужен (только валидация).

---

## Этап 4 — Финализация

**Цель:** release v3.87.1.

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать `DOCUMENTATION_GUIDE.md` → пройти чек-лист.

### Задачи

- [ ] Прочитать `DOCUMENTATION_GUIDE.md`
- [ ] Решить: нужен ли ADR 052? **Нет** — это patch fix defensive normalization, не архитектурное решение. Зафиксировать в CHANGELOG как bugfix
- [ ] Обновить главный `CHANGELOG.md` — раздел `[3.87.1]` с описанием
- [ ] Обновить `SIMPLY_STATUS.md` — короткая запись (patch, не feature)
- [ ] Обновить `CLAUDE.md` — добавить ТЗ-OpenRouterCostTracking в «Завершены», bump версии
- [ ] Обновить `specs/_backlog/README.md` — переместить из open в closed
- [ ] `package.json` версия 3.87.0 → 3.87.1
- [ ] Финальный smoke test пользователем (быстрый — 2 минуты)
- [ ] Перенос `specs/TZ_OpenRouterCostTracking/` → `_archive/TZ_OpenRouterCostTracking/`
- [ ] Финальный release commit
- [ ] Git tag `v3.87.1`

**Валидация:**
- `npm run build` — успех
- Документация актуальна

---

## Принципы выполнения

### 1. Atomic fix

Все изменения кода в **одном commit** (Этап 1). Это маленький bug fix, не должен быть размазан.

### 2. SSOT через getModelEntry

Normalize внедряется в `getModelEntry`, не в call-sites. Все будущие call-sites автоматически защищены.

### 3. Cardinal solution

Не добавляем специальный случай для OpenRouter, не strip'аем префикс в call-site. Нормализация на уровне catalog — универсально и устойчиво.

### 4. Test before deploy

Этап 3 (мануальная валидация) — обязателен. Без подтверждения через живой запрос не закрываем ТЗ.

---

## Готово к следующему ТЗ?

После ТЗ_OpenRouterCostTracking:
- OpenRouter, z-ai/glm, qwen — все показывают корректный cost в DevPanel
- `ai_usage_log` полностью покрывает OpenRouter-usage (уже покрывал, теперь ещё и DevPanel)
- Backlog TZ_OpenRouterCostTracking закрыт
- Одна поверхность cost tracking меньше beholden к implicit AI SDK поведению
