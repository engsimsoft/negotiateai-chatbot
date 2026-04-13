# HANDOFF — TZ_StreamObservability

**Статус:** ✅ ЗАВЕРШЁНО в одну сессию (v3.87.2, 2026-04-14)
**Архив:** `_archive/TZ_StreamObservability/`

## Резюме

Finding #5 из TZ_LegacyChatCleanup закрыт в два stage:

1. **Stage 1 (исходный скоуп):** server-side `onError` в обоих chat routes теперь логирует через `console.error` + `emitDebugError` (через closure-captured `UIMessageStreamWriter`) и возвращает локализованную строку вместо английского "Oops"
2. **Stage 2b (расширенный скоуп при smoke test):** `useChat.clearError` прокинут в `MultimodalInput`, submit guard сужен до `streaming|submitted` — пользователь больше не застревает после ошибки без reload страницы

## Ключевые файлы (для ориентации будущего контекста)

- [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts) — main chat route `onError`
- [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts) — task expert route `onError`
- [components/chat.tsx](components/chat.tsx) — useChat destructuring + clearError prop
- [components/projects/task-chat.tsx](components/projects/task-chat.tsx) — то же
- [components/multimodal-input.tsx](components/multimodal-input.tsx) — submit guard + disabled attrs
- [CHANGELOG.md](CHANGELOG.md) раздел `[3.87.2]` — полное описание с Изученной документацией
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) секция `ТЗ-StreamObservability` — high-level контекст

## Не осталось незакрытых концов

- tsc ✅ 0 ошибок
- build ✅ exit 0
- smoke test (server obs) ✅ user-confirmed
- smoke test (recovery UX) ✅ user-confirmed
- backlog README обновлён
- APICallError narrowing — осознанно НЕ реализовано (YAGNI, зафиксировано в CHANGELOG)
