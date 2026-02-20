# ТЗ-А5: ROADMAP — Прогресс генерации брифинга

**Версия:** 3.32.0 → 3.33.0
**Дата:** 2026-02-20

---

## Этап 1: Типы и Backend ✅

### 1.1 Тип BriefingProgressEvent ✅
- [x] Добавить `BriefingProgressStep` и `BriefingProgressEvent` в `lib/briefing/briefing-types.ts`
- [x] `npx tsc --noEmit` → 0 ошибок

### 1.2 Streaming route ✅
- [x] Конвертировать `app/(chat)/api/briefing/generate/route.ts` из `Response.json()` в `ReadableStream` (JSON Lines)
- [x] Добавить emit-вызовы между шагами pipeline (connecting → fetching → filtering → writing → complete)
- [x] Обработка ошибок: emit `step: "error"` + close stream
- [x] `npx tsc --noEmit` → 0 ошибок

---

## Этап 2: Хук и компонент ✅

### 2.1 Хук useBriefingGeneration ✅
- [x] Создать `hooks/use-briefing-generation.ts`
- [x] Логика: fetch → ReadableStream reader → parse JSON Lines → setState
- [x] Возвращает `{ steps, isGenerating, error, startGeneration, redirectUrl }`
- [x] `npx tsc --noEmit` → 0 ошибок

### 2.2 Компонент BriefingGenerationProgress ✅
- [x] Создать `components/briefing/briefing-generation-progress.tsx`
- [x] Заголовок "Готовим ваш брифинг"
- [x] Список шагов: иконка + текст + (spinner | галочка + detail)
- [x] Анимация fade-in шагов (framer-motion)
- [x] Состояние error: сообщение + кнопка "Попробовать снова"
- [x] `npx tsc --noEmit` → 0 ошибок

---

## Этап 3: Интеграция ✅

### 3.1 BriefingPageClient — обёртка /briefing ✅
- [x] Создать `components/briefing/briefing-page-client.tsx`
- [x] Получает серверные данные как props
- [x] Управляет isGenerating state через useBriefingGeneration
- [x] isGenerating → BriefingGenerationProgress, иначе → контент (Header + IssueContent | NoBriefingsYet)
- [x] `npx tsc --noEmit` → 0 ошибок

### 3.2 Рефактор page.tsx ✅
- [x] `app/(dashboard)/briefing/page.tsx` — передать данные в BriefingPageClient
- [x] Убрать прямой рендер BriefingIssueContent/NoBriefingsYet — теперь через обёртку
- [x] `npx tsc --noEmit` → 0 ошибок

### 3.3 Sidebar — убрать локальную генерацию ✅
- [x] `briefing-sidebar.tsx` — добавить prop `onGenerate` callback
- [x] Убрать локальный handleGenerate (fetch + router.refresh)
- [x] BriefingPageClient передаёт startGeneration через prop
- [x] `npx tsc --noEmit` → 0 ошибок

### 3.4 NoBriefingsYet — убрать локальную генерацию ✅
- [x] `briefing-article-view.tsx` — добавить prop `onGenerate` callback
- [x] Убрать локальный handleGenerate
- [x] BriefingPageClient передаёт startGeneration
- [x] `npx tsc --noEmit` → 0 ошибок

### 3.5 Setup success card — прогресс вместо Loader2 ✅
- [x] `briefing-setup-client.tsx` — интегрировать useBriefingGeneration
- [x] При isGenerating → показать BriefingGenerationProgress вместо success card содержимого
- [x] При complete → router.push(redirectUrl)
- [x] `npx tsc --noEmit` → 0 ошибок

---

## Этап 4: Валидация ✅

### 4.1 Build ✅
- [x] `npm run build` → успешно
- [x] Мануальный тест: Sidebar trigger — прогресс работает, авто-перезагрузка после завершения

### 4.2 Bugfix: авто-перезагрузка после генерации ✅
- [x] `briefing-page-client.tsx` — `router.refresh()` → `window.location.href` (сброс клиентского стейта)
- [x] `use-briefing-generation.ts` — добавлен `reset()` в API хука
- [x] `npx tsc --noEmit` → 0 ошибок

---

## Файлы

| Файл | Действие |
|------|----------|
| `lib/briefing/briefing-types.ts` | ИЗМЕНИТЬ — +типы |
| `app/(chat)/api/briefing/generate/route.ts` | ИЗМЕНИТЬ — streaming |
| `hooks/use-briefing-generation.ts` | НОВЫЙ |
| `components/briefing/briefing-generation-progress.tsx` | НОВЫЙ |
| `components/briefing/briefing-page-client.tsx` | НОВЫЙ |
| `app/(dashboard)/briefing/page.tsx` | ИЗМЕНИТЬ — обёртка |
| `components/briefing/briefing-sidebar.tsx` | ИЗМЕНИТЬ — onGenerate prop |
| `components/briefing/briefing-article-view.tsx` | ИЗМЕНИТЬ — onGenerate prop |
| `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` | ИЗМЕНИТЬ — прогресс |
