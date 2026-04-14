# ТЗ-PromptsDeadCodeCleanup

**Источник:** `specs/TZ_DeadModelSelectors/FINDINGS.md` Finding #1 (внесено 2026-04-14)
**Impact:** medium
**Оценка:** 0.5 сессии

## Цель

Удалить мёртвые экспорты из `lib/ai/prompts.ts`. Файл на 90% состоит из legacy-кода от ванильного Vercel AI Chatbot, который был заменён системой промптов `lib/prompts/` ещё в ТЗ-NEW-01 (v3.0.0).

## Что мёртвое

- `artifactsPrompt` — legacy artifacts инструкция (заменена на `lib/prompts/skills/`)
- `regularPrompt` — legacy «You are a friendly assistant!» fallback
- `systemPrompt` — `@deprecated` ещё с ТЗ-NEW-01, использует удалённый `selectedChatModel` параметр
- `buildUserContext` — `@deprecated` с ТЗ-NEW-01, заменён на `buildFullUserContext` из `@/lib/prompts`

## Что живое

- `updateDocumentPrompt` — импортируется 3 artifact-серверами (`artifacts/text/server.ts`, `artifacts/markdown/server.ts`, `artifacts/presentation-reveal/server.ts`)
- `getRequestPromptFromHints` — проверить, используется ли живым кодом после удаления `systemPrompt`. Если нет — тоже удалить.
- `RequestHints` type — проверить импортёров

## Подход

1. Grep `from "@/lib/ai/prompts"` — зафиксировать всех живых импортёров
2. Удалить мёртвые экспорты
3. Если после удаления `systemPrompt` остался только `updateDocumentPrompt` — рассмотреть переименование файла в `lib/ai/artifact-prompts.ts` для семантической ясности
4. `tsc --noEmit` = 0
5. `next build` успешен
6. Smoke test artifacts (создать документ в чате)

## Риски

- Low. Переименование файла может сбить импорты — делать только если все импортёры в одной папке и grep-substitute тривиален. Иначе оставить имя `prompts.ts`.
