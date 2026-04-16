# ТЗ-DevOverridesSideEffectImportAudit — global audit + архитектурное решение для dev overrides reader

**Статус:** Хвост, **High impact** (блокирует любые будущие A/B тесты через dev panel для routes без импорта)
**Создано:** 2026-04-16 (сессия ТЗ-XAI-4 Этап 4, финализация — запланирован ещё в Этапе 2 после двух hot-fix)
**Источник:** эмпирически подтверждённые дыры (plan route + 3 briefing routes + service-chat)
**Связано с:** [docs/decisions/048-dev-switchboard-ui.md](../../docs/decisions/048-dev-switchboard-ui.md) (ADR), [lib/ai/model-overrides-node.ts](../../lib/ai/model-overrides-node.ts), [lib/ai/model-overrides.ts](../../lib/ai/model-overrides.ts), [lib/ai/getModel.ts](../../lib/ai/getModel.ts), [_archive/TZ_DeadModelSelectors/FINDINGS.md](../../_archive/TZ_DeadModelSelectors/FINDINGS.md)

---

## Симптом

Reader `.simply-dev-overrides.json` регистрируется в shared модуле `model-overrides.ts` **только** при первом импорте `@/lib/ai/model-overrides-node` (side-effect через `registerOverridesReader()` на модульном уровне). Если backend route этот импорт не делает — `getActiveOverrides()` возвращает `{}` и **любой override из `/dev/models` молча игнорируется**. `getModel()` отдаёт default, пользователь не замечает.

ADR 048 утверждает (L94): «Один side-effect import в `chat/route.ts` достаточен — модуль `model-overrides.ts` загружается один раз, видна всем 26 call-sites». Это **верно только в dev-режиме при условии**, что `/api/chat` был вызван первым. В реальности Next.js компилирует routes по требованию (App Router) — если пользователь заходит на `/briefing` напрямую, `briefing/generate/route.ts` компилируется и выполняется **до** того, как `chat/route.ts` был когда-либо импортирован → override не применяется.

**Эмпирически подтверждено в ТЗ-XAI-4:**
- `plan/route.ts` — hot-fix d9d3488 добавил import, без него `professor:planning` override шёл на Opus игнорируя Haiku из UI
- `briefing/generate/route.ts` + `briefing/refresh-section/route.ts` + `cron/briefing/route.ts` — hot-fix 676d50d добавил import в каждый, без него `briefing:author` override не работал → empirical test был бы фейковым
- `service-chat/route.ts` — **до сих пор без импорта** ([TZ_ServiceChatNotOverridable.md](TZ_ServiceChatNotOverridable.md) Дыра 2)

---

## Scope audit

**Routes, вызывающие `getModel()` / `getModelIdForTask()`:**

| File | Import `model-overrides-node`? | Статус |
|---|---|---|
| `app/(chat)/api/chat/route.ts` | ✅ side-effect | ok (ADR 048) |
| `app/(chat)/api/projects/[id]/plan/route.ts` | ✅ side-effect (d9d3488) | **починено в ТЗ-XAI-4** |
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | ✅ side-effect | ok |
| `app/(chat)/api/briefing/generate/route.ts` | ✅ side-effect (676d50d) | **починено в ТЗ-XAI-4** |
| `app/(chat)/api/briefing/refresh-section/route.ts` | ✅ side-effect (676d50d) | **починено в ТЗ-XAI-4** |
| `app/api/cron/briefing/route.ts` | ✅ side-effect (676d50d) | **починено в ТЗ-XAI-4** |
| `app/(chat)/api/service-chat/route.ts` | ❌ отсутствует | **сломан** (4 service chats) |
| `app/(chat)/api/assistant/ben/route.ts` | ❌ отсутствует | **под подозрением** (ben deprecation plan, но пока живой) |
| `app/(chat)/api/projects/[id]/generate-summary/route.ts` | ❌ отсутствует | **сломан** (`util:project-summary`) |
| `app/(chat)/api/projects/[id]/analyze-file/route.ts` | ❌ отсутствует | **сломан** (`clerk:file-analyzer`) |
| `app/(chat)/api/chat/[id]/generate-title/route.ts` | ❌ отсутствует | **сломан** (`util:title`) |
| `app/(expertise)/expertise/[id]/page.tsx` | ❌ отсутствует | SSR page, нужна проверка call-site |
| `app/(chat)/actions.ts` | ❌ отсутствует | Server Actions, нужна проверка |

**Итого: минимум 6 routes без импорта, из них ≥3 подтверждены как сломанные** (service-chat, generate-summary, analyze-file, generate-title).

**Lib-слой (25 файлов с `getModel()` цепочкой):** работают через транзитивный импорт из roots, но если root-route без импорта — вся цепочка игнорирует overrides.

---

## Почему это High impact

1. **A/B тесты через `/dev/models` фейковые для 6+ routes.** Любой будущий empirical test модели на этих taskIds молча шёл бы на default. Это уже случилось дважды в ТЗ-XAI-4: planning 3×187s timeout на Opus (вместо Haiku из UI) и briefing empirical test блокировался до hot-fix.
2. **Архитектурный контракт ADR 048 нарушен.** «Любой taskId переключаемый без правки кода» — не выполняется. 6 taskId (`util:*`, `clerk:*`, `service-chat:*`) переключить нельзя.
3. **Регрессия при миграциях не ловится.** Если будущая сессия переключит `util:title` через override чтобы проверить quality — получит тест default модели, не зная об этом.
4. **Контракт «новый route должен импортировать» — хрупкий.** Любой новый route (текущая сессия добавила 4 из 6 дыр за одну миграцию) легко забывает этот импорт.

---

## Варианты решения (выбрать один)

### Вариант A — добавить импорт во все 6 routes (tactical)

Быстрое закрытие дыр, но не решает корень: каждый новый route продолжает быть риском.

**За:** 20 минут работы, диффы минимальные, риск регрессии нулевой.
**Против:** хвост снова появится через 3-5 новых routes.

### Вариант B — импорт в `lib/ai/getModel.ts` (centralized)

Перенести `import "@/lib/ai/model-overrides-node"` в сам `getModel.ts`. Любой call site автоматически регистрирует reader.

**За:** одно место, невозможно забыть, гарантирует работу во всех routes и Server Actions.
**Против:** `getModel.ts` сейчас client-safe через shim-условие; `model-overrides-node` зависит от `fs` — потребует server-only wrapper или dynamic import под `typeof window === "undefined"`. Не факт что через webpack граф это вообще разрешимо без edge runtime breaks.

### Вариант C — Next.js `instrumentation.ts` register-on-boot (cleanest)

Зарегистрировать reader в корневом `instrumentation.ts` — Next.js вызывает один раз при boot сервера, до любого route. 

**За:** гарантированно один раз, не привязано к call-site, архитектурно чистое решение для server-side инициализации (Next.js 15 рекомендованный паттерн).
**Против:** `instrumentation.ts` ещё не существует в проекте, нужно создать; требует validate в edge runtime (большинство routes nodejs runtime, но `cron/` может быть edge).

### Вариант D — заменить side-effect на explicit reader в `getActiveOverrides()` (architectural)

Убрать `registerOverridesReader` паттерн полностью; `getActiveOverrides` сам читает `.simply-dev-overrides.json` через dynamic import `fs`.

**За:** никакого side-effect contract, ничего регистрировать.
**Против:** самый большой дифф, пересматривает ADR 048, может сломать client-safe разделение.

**Рекомендация автора ТЗ:** **Вариант C** (instrumentation.ts) + оставить side-effect импорты в уже исправленных routes как defense-in-depth. Обновить ADR 048 чтобы зафиксировать новый контракт.

---

## Acceptance criteria

- [ ] Все 11 routes с `getModel()` покрыты reader-регистрацией (без необходимости помнить `import` в каждом route)
- [ ] `/dev/models` UI переключает модель для **любого** taskId из `DEFAULT_TASK_MODELS` и это реально применяется (SQL-проверка `ai_usage_log.modelId` за последние 5 минут)
- [ ] Empirical smoke test: override для 3 ранее сломанных taskId (`util:title`, `util:project-summary`, `clerk:file-analyzer`) даёт записи в БД с override-моделью
- [ ] ADR 048 обновлён с новым контрактом (или явным запретом «добавлять import в каждый route»)
- [ ] Отсутствие regression для уже работающих routes (chat, plan, briefing, task-chat)

---

## НЕ в scope

- UI coverage `/dev/models` для `service-chat:*` taskIds — это [TZ_ServiceChatNotOverridable.md](TZ_ServiceChatNotOverridable.md) Дыра 1 (отдельная задача)
- Добавление новых taskIds — этот ТЗ про mechanism, не про inventory
- Production behavior dev overrides — они dev-only per ADR 048 (`.simply-dev-overrides.json` в `.gitignore`, Server Actions throw в prod)

---

## Оценка

**0.5-1 сессия** в зависимости от варианта:
- Вариант A: 30-60 минут (6 import lines + smoke test)
- Вариант C: 1-2 часа (instrumentation.ts + ADR update + smoke test всех routes)
- Вариант D: 2-4 часа (архитектурный рефакторинг + риск regression)
