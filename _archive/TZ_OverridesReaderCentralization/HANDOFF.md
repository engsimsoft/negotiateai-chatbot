# TZ_OverridesReaderCentralization — закрыто как «ошибочно заведено»

**Дата закрытия:** 2026-04-14 (сессия 3)
**Итоговый статус:** ❌ Won't fix — задача не существует
**Коммитов:** 0 в код, 1 housekeeping (удаление backlog-заготовки и архивирование)

---

## Что это было

Заготовка ТЗ в `specs/_backlog/` с пометкой 🟥 high-impact. Источник — FINDINGS.md из `TZ_DeadModelSelectors` (Finding #2, написан в сессии 2026-04-14 session 2).

Формулировка проблемы:
> «Reader `.simply-dev-overrides.json` регистрируется только при импорте `@/lib/ai/model-overrides-node`. Side-effect import стоит только в 4 файлах. Остальные ~20 call-sites `getModel()` молча игнорируют override в production.»

Предложенное решение: перенести side-effect import в `instrumentation.ts` (Вариант A в SPEC).

## Почему это было ошибочно

**Панель `/dev/models` — dev-only инструмент по дизайну.** ADR 048 (Dev Switchboard UI, 2026-04-12) прямо фиксирует:

> «File-based = только local dev (не работает на Vercel)»

Триггер уровня модуля `lookupOverride()` возвращает null без `isSimplyDevMode`. В production (`SIMPLY_DEV_MODE` не установлен) `isOverridesAllowed()` возвращает false и файл даже не читается — **это не пробел, это дизайн**.

Finding #2 был сформулирован как production-concern, хотя никакой production-работы у этой фичи нет и не планировалось. Моя ошибка прошлой сессии — я не сверил находку с действующим ADR 048, который явно документирует dev-only scope.

## Что попробовал в этой сессии (и откатил)

**Сессия 3, попытка внедрить Вариант A:**

1. `instrumentation.ts` — добавил `async register()` + `await import("@/lib/ai/model-overrides-node")` под `NEXT_RUNTIME === "nodejs"`
2. Удалил side-effect import из `app/(chat)/api/chat/route.ts`
3. Удалил side-effect import из `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

Валидация: `tsc --noEmit` ✓, `npx next build` ✓. Но **мануальный тест показал что override для `simply-chat` не применяется** — лог `[Chat API] Model selection` продолжал показывать default MiniMax-M2.7 несмотря на присутствие ключа в `.simply-dev-overrides.json`.

**Диагноз (неверный):** я предположил что module-local singleton `activeOverridesReader` не переживает границу module graph между instrumentation и route bundle. Теория правдоподобная для Vercel serverless, но **в dev single-process не воспроизводится** — там один Node процесс, один module registry, одна копия `model-overrides.ts`.

**Настоящий диагноз (пришёл позже):** в `.simply-dev-overrides.json` **не было ключа `simply-chat`** (владелец либо сбросил его через UI, либо UI никогда его туда не писал). Resolver корректно возвращал default. Override для Simply просто не был выставлен.

## Финальное действие

Все 3 правки откачены — три файла (`instrumentation.ts`, `chat/route.ts`, `projects/[id]/tasks/[taskId]/chat/route.ts`) возвращены в состояние коммита `741031b`.

`.simply-dev-overrides.json` — ключ `simply-chat` был добавлен владельцем через `/dev/models` UI в финальной части сессии. Владелец подтвердил: «все проверил все модели работают».

## Главный вывод (lesson learned)

**Никогда не заводить в backlog production-concerns для dev-only инструментов.** Если фича имеет `isSimplyDevMode` (или аналогичный dev-gate) — production-поведение «не работает» **by design**, а не «архитектурный долг».

Перед заведением любой находки в FINDINGS.md надо сверить с действующими ADR и спросить себя: «это отклонение от документированного намерения, или реализация декларированного ограничения?» Если второе — это НЕ finding.

## Связанные документы

- `docs/decisions/048-dev-switchboard-ui.md` — действующий ADR, определяющий dev-only scope
- `_archive/TZ_DeadModelSelectors/FINDINGS.md` — источник ошибочной находки #2
- `_archive/TZ_DeadModelSelectors/HANDOFF.md` — контекст предыдущей сессии
