# Находки ТЗ-DeadModelSelectors

> Список нерешённых проблем, обнаруженных во время работы над ТЗ.
> После закрытия ТЗ — оформить как follow-up задачу (Правило 9 WORKFLOW.md).

---

## 🚩 Finding #1: `lib/ai/prompts.ts` на 90% мёртв

**Где:** `lib/ai/prompts.ts`
**Что:** Файл содержит: `artifactsPrompt`, `regularPrompt`, `systemPrompt` (deprecated), `buildUserContext` (deprecated), `updateDocumentPrompt`, `getRequestPromptFromHints`.

**Grep показал:** только `updateDocumentPrompt` импортируется живыми файлами (3 artifact-сервера: `artifacts/text/server.ts`, `artifacts/markdown/server.ts`, `artifacts/presentation-reveal/server.ts`). Остальное — dead.

**Почему проблема:**
- `systemPrompt` помечен `@deprecated` ещё с ТЗ-NEW-01 (v3.0.0)
- `buildUserContext` — `@deprecated` с ТЗ-NEW-01
- `regularPrompt`, `artifactsPrompt` — legacy от ванильного Vercel AI Chatbot, замещены системой промптов в `lib/prompts/`
- ~130 строк dead-кода, путает новых агентов при импорте

**Предлагаемое решение:**
1. Оставить только `updateDocumentPrompt` и вспомогательный `getRequestPromptFromHints` (проверить)
2. Удалить остальное
3. Рассмотреть переименование файла в `lib/ai/artifact-prompts.ts`

**Влияние:** medium (tech debt, путаница при импорте, но не ломает прод)

**Оценка:** 0.5 сессии

---

## 🚩 Finding #2: Scattered side-effect imports для model-overrides reader (архитектурный)

**Где:** Весь проект — любой роут/модуль, который вызывает `getModel(taskId)`

**Что:** Reader `.simply-dev-overrides.json` регистрируется только при импорте `@/lib/ai/model-overrides-node`. В настоящее время side-effect import стоит только в 4 местах:
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (добавлен в 9ddf814)
- `app/(dashboard)/dev/models/page.tsx`
- `app/(dashboard)/dev/models/actions.ts`

**Роуты/модули, которые вызывают `getModel(taskId)` но НЕ импортируют model-overrides-node:**
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/assistant/ben/route.ts`
- `app/(chat)/api/chat/[id]/generate-title/route.ts`
- `app/(chat)/api/projects/[id]/plan/route.ts`
- `app/(chat)/api/projects/[id]/generate-summary/route.ts`
- `app/(chat)/api/projects/[id]/analyze-file/route.ts`
- `app/(chat)/actions.ts` (server actions, в т.ч. `generateTitleFromUserMessage`)
- `lib/briefing/*`, `lib/podcast/*`, `lib/meeting/*`, `lib/ai/clerks/*`, `lib/ai/memory/*`, `lib/ai/professors/*`
- `artifacts/*` серверы

**Почему проблема:**
- В Next.js каждый route handler — отдельный module graph. Side-effect import работает только для того графа, куда его явно положили.
- В dev single-process работает «как будто всё общее», но это артефакт HMR cache.
- В Vercel serverless production каждая lambda — изолированный процесс. Override из `/dev/models` применяется только к тем роутам, где был явно прописан импорт.
- Результат: в проектных task-чатах override молча игнорировался до фикса в `9ddf814`. Аналогично сейчас в briefing, podcast, meeting, memory, clerks, professors — все эти модули **не применяют dev override в production**.

**Предлагаемое решение (два варианта):**
1. **Канонический путь Next.js** — перенести установку reader'а в `instrumentation.ts` через conditional dynamic import:
   ```ts
   export async function register() {
     if (process.env.NEXT_RUNTIME === "nodejs") {
       await import("@/lib/ai/model-overrides-node");
     }
   }
   ```
   Плюс: один раз при старте сервера, гарантированно до любого роута, закрывает все call-sites сразу. Минус: требует внимания при edit (HMR перекомпилирует instrumentation при правке).
2. **Явный side-effect import в каждом call-site** — механическое размножение импорта по ~20 файлам. Плюс: локально видно в каждом файле. Минус: антипаттерн, легко забыть в новом роуте.

**ИСТОРИЧЕСКИЙ НЮАНС:** В сессии 2026-04-14 первая попытка применить вариант 1 (instrumentation.ts) была отвергнута владельцем после того как применение сломало активный stream в task-чате из-за HMR recompile посреди работы. Рекомендация: применять вариант 1 **только на холодном сервере** (убить dev server → edit instrumentation.ts → restart), не при активном streaming.

**Влияние:** high (корректность override в production для ~20 call-sites)

**Оценка:** 1 сессия (preferably вариант 1 + careful testing)

**Примечание:** Bug B в проектных task-чатах закрыт локально в коммите `9ddf814`, но остальные ~20 call-sites остаются в том же состоянии.
