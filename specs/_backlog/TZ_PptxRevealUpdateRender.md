# TZ_PptxRevealUpdateRender

**Impact:** 🟥 high
**Найдено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills (2026-04-27)
**Источник:** FINDINGS #1 ТЗ-MigrateArtifactPromptsToSkills

## Проблема

После успешного `onUpdateDocument` для презентации (pptx или reveal):
- ✅ БД обновлена (новый JSON в `Document.content`)
- ✅ Blob URL обновлён (новый `.pptx` файл загружен)
- ✅ Превью-картинки регенерированы и залиты в Blob
- ❌ **Клиент в холсте показывает СТАРУЮ версию** слайдов и превью

Пользователь думает что update не сработал, **но скачанный файл — свежий**. То есть update реально применился, проблема **только в client-side rendering**.

## Воспроизведение (doc `3588b19e-759b-4aa9-91c3-99a611b84b66`, 2026-04-27, 13:33)

- kind = `presentation-pptx`
- update запрос: «замени первый слайд на "Деловые переговоры 2026"»
- БД (createdAt 13:33:25): первый слайд = «Деловые переговоры 2026 / Основы и стратегии» ✅
- Холст в браузере: первый слайд = старый «Искусственный интеллект» ❌
- Скачанный pptx: новый «Деловые переговоры 2026» ✅

## Где код

- Server side: [artifacts/presentation-pptx/server.ts](artifacts/presentation-pptx/server.ts) `onUpdateDocument` — пишет в БД, делает blob.put, отправляет `data-pptxComplete` event
- Client side: [components/artifact-presentation-pptx.tsx](components/artifact-presentation-pptx.tsx) (или соседний `artifact-presentation-*`) — обработчик `data-pptxComplete`
- Сравнить с text/markdown: они работают корректно через `data-textDelta` / `data-markdownDelta`

## Гипотезы решения

1. **Проверить event handler `data-pptxComplete`** в client-компоненте — обновляет ли он state артефакта (slides, pptxUrl, previewUrls) принудительно?
2. **React Query / SWR keys** — возможно надо invalidate `['document', documentId]` после update, чтобы client заново подтянул свежий JSON из БД
3. **Сравнить с `data-textDelta`** — в text артефакте update работает. Что в нём отличается от презентационных?
4. **`mutate()` или router.refresh()** в onSuccess после updateDocument tool result

## Влияние

high — UX полностью сломан для update презентаций. Работает только через "скачать файл и посмотреть". Большинство пользователей не догадаются.

## Оценка

0.5-1 сессия (debug client state + правка event handler)
