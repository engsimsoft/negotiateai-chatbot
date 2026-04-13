# ROADMAP — TZ_StreamObservability

**Цель:** заменить молчаливый `onError: () => "Oops, an error occurred!"` в двух chat routes на полноценный observability handler (console.error + emitDebugError + локализованное сообщение пользователю).

**Статус:** ✅ ЗАВЕРШЕНО (v3.87.2, 2026-04-14)
**Оценка:** 0.5 сессии → фактически ~1 сессия (из-за расширения скоупа на Stage 2b — recovery UX)
**Создано:** 2026-04-13
**Закрыто:** 2026-04-14

> Все этапы 0–5 выполнены и проверены smoke-тестом (2 прохода: server observability + recovery UX). Подробности в [CHANGELOG.md](CHANGELOG.md) и [HANDOFF.md](HANDOFF.md).

---

## Этап 0 — Подготовка ✅

- [x] Прочитать SPEC.md
- [x] Изучить официальную документацию AI SDK v6 (Правило 1 WORKFLOW)
- [x] Прочитать оба chat route и зафиксировать точки вмешательства
- [x] Написать ANALYSIS.md с ключевыми находками + closure-capture паттерном
- [x] Согласовать с пользователем: user-facing строка на русском, DevPanel/console — английский

---

## Этап 1 — Fix `app/(chat)/api/chat/route.ts` ⬜

**Файл:** [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts)

- [ ] Прочитать секцию импортов AI SDK — проверить, экспортирован ли `UIMessageStreamWriter` публично. Если да — использовать его как тип closure-ref. Если нет — использовать `Parameters<...>` extraction
- [ ] Объявить `let dataStreamRef: <тип> | null = null;` прямо перед `createUIMessageStream` (строка ~536)
- [ ] В первой строке `execute` — `dataStreamRef = dataStream;`
- [ ] Заменить блок `onError: () => { return "Oops, an error occurred!"; }` (строки 1537-1539) на:
  ```ts
  onError: (error: unknown) => {
    console.error("[Chat Stream onError]", error);
    if (dataStreamRef) {
      emitDebugError(dataStreamRef, {
        source: "server:chat-stream-onError",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
        context: { chatId: id, userId: session.user.id },
      });
    }
    return "Произошла ошибка при генерации ответа. Попробуйте повторить.";
  },
  ```
- [ ] `emitDebugError` уже импортирован (строка 59), ничего в import не добавляем
- [ ] `npx tsc --noEmit` → 0 ошибок

---

## Этап 2 — Fix `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` ⬜

**Файл:** [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts)

- [ ] Добавить `emitDebugError,` в import block [строки 19-29](app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L19-L29) (после `emitDebugWarning,`)
- [ ] Найти `createUIMessageStream({` в этом файле — определить номер строки объявления
- [ ] Объявить `let dataStreamRef: <тот же тип> | null = null;` перед `createUIMessageStream`
- [ ] В первой строке `execute` — `dataStreamRef = dataStream;` (проверить как здесь называется writer — возможно иначе)
- [ ] Заменить `onError: () => { return "Oops, an error occurred!"; }` (строки 745-747) на аналог с `source: "server:task-expert-stream-onError"` и `context: { projectId, taskId, chatId, userId: session.user.id }` (имена переменных могут отличаться — проверить по месту)
- [ ] `npx tsc --noEmit` → 0 ошибок

---

## Этап 3 — Валидация ⬜

- [ ] `npx tsc --noEmit` — 0 ошибок (комплексно, после обоих этапов)
- [ ] `npm run build` — exit 0 (проверка что Next.js не ломается на type check в prod build)
- [ ] Визуальный code review diff по обоим файлам — убедиться что ничего лишнего не задели

---

## Этап 4 — Мануальный smoke test (с пользователем) ⬜

**⚠️ Требует участия владельца.** Делаем вместе.

- [ ] Временно добавить `throw new Error("TEST: stream observability smoke")` в самом начале `execute` одного из route (например, `app/(chat)/api/chat/route.ts`)
- [ ] Перезапустить dev-сервер (или дать ему hot-reload)
- [ ] Владимир отправляет сообщение в чат на главной (`localhost:3000`)
- [ ] Проверяем **3 точки**:
  1. **Server logs** (в tail dev output): видим строку `[Chat Stream onError] Error: TEST: stream observability smoke` + stack
  2. **DevPanel → секция Errors & Warnings**: карточка с `source: server:chat-stream-onError`, message, stack, context
  3. **UI чата**: вместо текста ответа видим строку «Произошла ошибка при генерации ответа. Попробуйте повторить.»
- [ ] Удалить временный `throw` из кода
- [ ] Повторить тот же smoke для project task expert route (опционально — если пользователь согласен потратить 2 минуты; иначе доверяем симметрии кода)
- [ ] Владимир подтверждает: «OK, вижу все три точки» → отмечаем [x]

---

## Этап 5 — Финализация ⬜

- [ ] Обновить [CHANGELOG.md](CHANGELOG.md) (root) — новая запись `[Unreleased]` или `[3.87.2]`:
  - `### Fixed` / `### Changed`
  - Описание: «Stream-level error handler в обоих chat routes теперь логирует в console.error + emitDebugError вместо молчаливого Oops-return. Пользователь видит локализованную строку, в DevPanel — полный stack и context»
- [ ] Обновить [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — добавить ТЗ в Completed с версией
- [ ] Обновить [CLAUDE.md](CLAUDE.md) — в раздел «Завершены» в начале документа: `ТЗ-StreamObservability (v3.87.2 — ObservabilityOnErrorHandler)`
- [ ] Решить версию (patch bump v3.87.2 — это не фича, а closing gap / bug fix)
- [ ] Обновить `package.json` version → 3.87.2
- [ ] Обновить локальный [CHANGELOG.md](specs/TZ_StreamObservability/CHANGELOG.md) — краткий лог изменений
- [ ] Написать `HANDOFF.md` — минимальный, только ссылки на файлы
- [ ] Обновить [specs/_backlog/README.md](specs/_backlog/README.md):
  - Удалить строку TZ_StreamObservability из «Открытые долги» → medium
  - Добавить строку в «Закрытые долги» с версией и как закрыто
- [ ] `git mv specs/TZ_StreamObservability _archive/TZ_StreamObservability`
- [ ] Коммиты по этапам (или один финальный release commit — решить при финализации)
- [ ] Тег `v3.87.2` — recovery point

---

## Выход

После этого ТЗ backlog сжимается до 3 открытых долгов (TZ_DeadModelSelectors, TZ_CreateSnapshotAudit, TZ_GrokContextWindowAudit). Любой из них — следующий кандидат.
