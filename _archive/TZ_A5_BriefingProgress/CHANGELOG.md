# Changelog ТЗ-А5: Прогресс генерации брифинга

## Сессия 1 — 2026-02-20

### Added
- `BriefingProgressStep` и `BriefingProgressEvent` типы в `lib/briefing/briefing-types.ts`
- **Streaming route** — `app/(chat)/api/briefing/generate/route.ts` конвертирован из `Response.json()` в `ReadableStream` (JSON Lines, `application/x-ndjson`)
- **useBriefingGeneration** хук — `hooks/use-briefing-generation.ts` (fetch → ReadableStream → parse → setState, AbortController, reset)
- **BriefingGenerationProgress** компонент — `components/briefing/briefing-generation-progress.tsx` (4 шага с framer-motion анимацией, error state с retry)
- **BriefingPageClient** обёртка — `components/briefing/briefing-page-client.tsx` (управление isGenerating state на /briefing)

### Changed
- `app/(dashboard)/briefing/page.tsx` — делегирует рендер в BriefingPageClient
- `components/briefing/briefing-sidebar.tsx` — добавлен `onGenerate` prop, убрана локальная генерация (fetch + router.refresh)
- `components/briefing/briefing-article-view.tsx` — NoBriefingsYet получил `onGenerate` prop, убрана локальная генерация
- `components/briefing/briefing-issue-content.tsx` — прокидывает `onGenerate` в sidebar
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — интеграция прогресса в success card

### Fixed
- Авто-перезагрузка после генерации: `router.refresh()` → `window.location.href` (сброс клиентского стейта)

### Files
- `lib/briefing/briefing-types.ts`
- `app/(chat)/api/briefing/generate/route.ts`
- `hooks/use-briefing-generation.ts` (NEW)
- `components/briefing/briefing-generation-progress.tsx` (NEW)
- `components/briefing/briefing-page-client.tsx` (NEW)
- `app/(dashboard)/briefing/page.tsx`
- `components/briefing/briefing-sidebar.tsx`
- `components/briefing/briefing-article-view.tsx`
- `components/briefing/briefing-issue-content.tsx`
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx`
