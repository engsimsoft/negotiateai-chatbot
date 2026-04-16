# ✅ CLOSED 2026-04-16 — 1 дыра из 3 починена, 2 оказались ложными

> **Этот хвост закрыт.** Диагностика хвоста утверждала 3 дыры, но при реализации выяснилось:
>
> - **Дыра 1** «UI `/dev/models` не показывает service-chat:*» → **ложная.** `service-chat:*` taskIds присутствуют в `DEFAULT_TASK_MODELS` (task-assignments.ts:174-177), автоматически попадают в `ALL_TASK_IDS`, UI рендерит все из них через `data.tasks` без фильтрации. Автор хвоста grep'ал по директории `/dev/models/` и не нашёл упоминаний, но UI получает taskIds через import из `lib/ai/task-assignments.ts` — прямых упоминаний в `/dev/models/` и не должно быть
> - **Дыра 2** «service-chat/route.ts не импортирует model-overrides-node» → **реальная, починена.** +1 side-effect import line. Теперь все 4 service chats (ben, project-creation, project-manager, briefing-onboarding) переключаемые через `/dev/models` override
> - **Дыра 3** «docs/ai-chats-map.md не разделяет briefing-onboarding (service chat) и briefing pipeline (backend кухня)» → **починена.** Overview-таблица обновлена с явными маркерами «Service chat» vs «Backend pipeline (кухня)». Briefing Onboarding section в детальном блоке получила важное предисловие что она архитектурно независима от pipeline
>
> **Commit:** `<briefing-cleanup-commit>` 2026-04-16 (один коммит закрыл все три пункта)
>
> **Связанные изменения:**
> - Side-effect import в [app/(chat)/api/service-chat/route.ts](../../../app/(chat)/api/service-chat/route.ts) с подробным комментарием
> - Overview-таблица в [docs/ai-chats-map.md](../../../docs/ai-chats-map.md) с маркерами Service chat / Backend pipeline (кухня)
> - Briefing Onboarding section header + новая строка «Dev override» в таблице параметров
>
> **Неподтверждённые Мета-правила из этого хвоста:**
> 1. **Проверять claim «UI не показывает X»** — автор хвоста мог ошибиться с grep. Если UI динамически импортирует из SSOT-списка, отсутствие match в конкретной директории не значит отсутствия функциональности
> 2. **Хвосты с «3 дыры» чаще бывают «1 дыра + 2 предположения»** — при closing'е готовиться к тому что scope может быть меньше чем в ТЗ
>
> Содержимое ниже сохранено как исторический артефакт.

---

# ТЗ-ServiceChatNotOverridable — service chats нельзя переопределить через dev panel (UI + backend gap)

**Статус:** ✅ **CLOSED** 2026-04-16 — 1 реальная дыра (side-effect import) + 2 ложных (UI уже работал, docs cleanup). См. блок сверху.
**Создано:** 2026-04-16 (сессия ТЗ-XAI-4 Этап 2, мануальное тестирование briefing onboarding)
**Источник:** Владимир, замечено в режиме «Настройки брифинга» → /dev/models
**Связано с:** [app/(chat)/api/service-chat/route.ts](../../../app/(chat)/api/service-chat/route.ts), [app/(dashboard)/dev/models/](../../../app/(dashboard)/dev/models/), [docs/decisions/048-dev-switchboard-ui.md](../../../docs/decisions/048-dev-switchboard-ui.md) (ADR), TZ_DeadModelSelectors/FINDINGS (архив)

---

## Симптом

В режиме `/briefing` → «Настройки брифинга» (briefing onboarding chat) работает Sonnet 4.6 — это видно в DevPanel footer под сообщением. **Но** попытка переключить модель через `/dev/models` панель разработчика невозможна:

1. В UI `/dev/models` **нет селектора для `service-chat:briefing-onboarding`** (и других 3 service chats: ben, project-creation, project-manager)
2. Даже если бы вручную прописать override в `.simply-dev-overrides.json` — он бы не применился

Это ломает Dev Switchboard ADR 048 принцип: **«любой taskId должен быть переключаемым без правки кода»**. Service chats (4 точки) являются исключением без документированного обоснования.

---

## Корневые причины — две связанные дыры

### Дыра 1: `/dev/models` UI не перечисляет `service-chat:*`

Grep на `briefing-onboarding|service-chat:briefing|briefingOnboarding` в `app/(dashboard)/dev/models/` → **0 matches**.

UI `/dev/models` строится на каком-то списке taskIds — либо он хардкоден, либо извлекается из `DEFAULT_TASK_MODELS`, но фильтруется. Четыре `service-chat:*` taskIds **существуют** в [lib/ai/task-assignments.ts:143-146](../../lib/ai/task-assignments.ts#L143):

```ts
"service-chat:ben":                 "claude-haiku-4-5-20251001",
"service-chat:project-creation":    "claude-sonnet-4-6",
"service-chat:project-manager":     "claude-haiku-4-5-20251001",
"service-chat:briefing-onboarding": "claude-sonnet-4-6",
```

Но UI их не видит. Вероятно — хардкод-список или pattern-фильтрация в `/dev/models/page.tsx` или соответствующем компоненте.

### Дыра 2: `service-chat/route.ts` не импортирует reader

Grep на `model-overrides-node|import.*model-overrides` в [app/(chat)/api/service-chat/route.ts](../../app/(chat)/api/service-chat/route.ts) → **0 matches**.

Это **точно та же архитектурная дыра**, которая была в [app/(chat)/api/projects/[id]/plan/route.ts](../../app/(chat)/api/projects/[id]/plan/route.ts) до hot-fix в ТЗ-XAI-4 Этапе 2 (коммит `d9d3488`): reader `.simply-dev-overrides.json` регистрируется через `registerOverridesReader()` **только** при импорте `@/lib/ai/model-overrides-node` в конкретных файлах. Если route этот импорт не делает — `getActiveOverrides()` возвращает `{}` и **любой override молча игнорируется**.

Известная проблема per [_archive/TZ_DeadModelSelectors/FINDINGS.md](../../_archive/TZ_DeadModelSelectors/FINDINGS.md) строка 36: «Reader регистрируется только при импорте @/lib/ai/model-overrides-node. В настоящее время side-effect import стоит только в 4 местах». Четыре места — очевидно недостаточно.

### Дыра 3: Documentation gap — связь briefing-onboarding и briefing pipeline не явная

Найдено во время ТЗ-XAI-4 Этапа 2 (2026-04-16). **Это проблема документации**, не читателя: формулировки в `docs/ai-chats-map.md` не дают явно понять, что существуют **две разные сущности**, которые оба пользователь воспринимает как «Брифинг»:

**Сущность 1 — Briefing Onboarding (интерактивный AI-интервью)**
- taskId: `service-chat:briefing-onboarding`
- Модель: Claude Sonnet 4.6 ([task-assignments.ts:146](../../lib/ai/task-assignments.ts#L146))
- Route: [app/(chat)/api/service-chat/route.ts](../../app/(chat)/api/service-chat/route.ts) контекст `"briefing-onboarding"`
- Где используется в UI: `/briefing` → «Настройки брифинга» (режим настройки профиля)
- Задача: собрать с пользователя темы/источники/расписание через диалог
- В [docs/ai-chats-map.md:34](../../docs/ai-chats-map.md#L34) — отдельная строка «Briefing: Онбординг»

**Сущность 2 — Briefing Pipeline (автоматический backend генератор)**
- 4 taskIds: `briefing:filter` (после ТЗ-XAI-4 → Grok 4.1 Fast) + `briefing:author` + `briefing:section` + `briefing:podcast-script` (MiniMax M2.7)
- Route: [lib/briefing/*](../../lib/briefing/) — серверные функции без UI
- Где запускается: cron или кнопка «Обновить» в `/briefing` (после настройки)
- Задача: раз в день фетчит новости, фильтрует, пишет статью, генерит подкаст-скрипт
- В [docs/ai-chats-map.md:35-38](../../docs/ai-chats-map.md#L35) — 4 отдельных строки

**Проблема:** документация в `docs/ai-chats-map.md` перечисляет эти 5 строк последовательно (34, 35, 36, 37, 38), но **не говорит явно** что:
1. Первая (onboarding) — это UI-диалог, пользователь видит
2. Следующие 4 — backend pipeline, пользователь не видит
3. **Модель для них выбирается независимо** — onboarding на Sonnet, pipeline на MiniMax/Grok
4. Они **связаны по UX** (обе через `/briefing`), но **архитектурно независимы**

Любой читающий отчёты по ТЗ-XAI-4 (включая Claude Code в этой сессии) легко говорит «briefing остаётся на MiniMax», имея в виду только pipeline (4 taskIds), и забывая что **onboarding — отдельный 5-й AI-вызов на Sonnet**. Это **ошибка в оформлении документации**: текущая структура `docs/ai-chats-map.md` перечисляет 5 строк подряд без маркера «эти 4 — backend pipeline, эта 1 — UI service chat», что вводит в заблуждение всех последующих читателей.

**Исправление в docs/ai-chats-map.md:**
- Разнести Briefing Onboarding (service chat) и Briefing Pipeline (backend) в **разные секции** или чётко маркировать их отношение
- В блоке «Где используются» у Sonnet (строка 592) явно добавить упоминание «briefing-onboarding (диалог настройки)» чтобы не было путаницы
- В детальном блоке [docs/ai-chats-map.md:300+](../../docs/ai-chats-map.md#L300) — Briefing AI-пайплайн не упоминает onboarding вообще, стоит добавить предисловие «настройка профиля — отдельно, см. service chats»

Аналогичная инвентаризация может требоваться для других product-areas где одно слово объединяет несколько taskIds (Meeting = Deepgram + `meeting:summary`, Professor = 5 `professor:*` + `project:expert:*`, и т.д.).

---

## Impact

- **Medium** потому что service chats работают корректно на production-моделях (Haiku/Sonnet), это не блокирует пользователя
- **Но** ломает A/B тестирование и продуктовые эксперименты:
  - Нельзя быстро протестировать «что будет если briefing-onboarding на Grok?»
  - Нельзя переключить ben на более дешёвую модель через UI
  - Приходится править код + пересобирать dev server для любого эксперимента
- **Критично для миграции:** service chats выведены из scope ТЗ-XAI-4 (Q4: «отдельное ТЗ для PE-команды»). Когда это ТЗ начнётся — тестирование без переключения модели через UI будет очень болезненным

---

## Воспроизведение

### Дыра 1 (UI):

1. Открыть http://localhost:3000/dev/models
2. Найти секцию с taskIds
3. **Ожидается:** 4 строки для `service-chat:ben / project-creation / project-manager / briefing-onboarding` с селектором модели
4. **Фактически:** этих строк нет

### Дыра 2 (backend):

1. Вручную отредактировать `.simply-dev-overrides.json`:
   ```json
   { "service-chat:briefing-onboarding": "grok-4-1-fast-non-reasoning" }
   ```
2. Открыть `/briefing` → «Настройки брифинга»
3. Отправить сообщение
4. Проверить `ai_usage_log` через SQL — запись будет с **Sonnet** (override игнорирован), не с Grok

---

## Acceptance criteria

### Дыра 1:
- [ ] `/dev/models` UI показывает все 4 `service-chat:*` taskIds с селектором модели
- [ ] Selected model из UI сохраняется в `.simply-dev-overrides.json` через стандартный API
- [ ] Группировка/секция service chats логичная (например, «Сервисные чаты» в отдельной группе)

### Дыра 2:
- [ ] [app/(chat)/api/service-chat/route.ts](../../app/(chat)/api/service-chat/route.ts) импортирует `@/lib/ai/model-overrides-node` как side-effect
- [ ] Override применяется: при установке override для `service-chat:briefing-onboarding` → SQL показывает запись с новой моделью, не с default из task-assignments

### Plus — aggregation audit (можно объединить в тот же ТЗ):
- [ ] Audit всех backend routes в `app/(chat)/api/` на наличие `import "@/lib/ai/model-overrides-node"`. Список routes без импорта → исправить все
- [ ] Document в ADR 048 (dev switchboard UI) требование «все route handlers в `app/(chat)/api/` ДОЛЖНЫ импортировать model-overrides-node»
- [ ] Можно сделать через автоматический side-effect в `instrumentation.ts` или middleware, чтобы не полагаться на ручной импорт в каждом route

### Дыра 3 — documentation fix:
- [ ] `docs/ai-chats-map.md` — явно разделить Briefing Onboarding (service chat) и Briefing Pipeline (backend). Либо группировкой, либо маркером «UI-chat / backend-pipeline», либо перекрёстными ссылками
- [ ] Во всех местах где упоминается «Брифинг» — явно указывать какая из 5 AI-точек имеется в виду
- [ ] Аналогичная инвентаризация для Meeting, Professor, Project expert — любые product-areas где одно слово объединяет несколько taskIds

---

## Связанные хвосты и архивные ТЗ

- **Плохая новость:** это pre-existing baseline problem, уже всплывало в [_archive/TZ_DeadModelSelectors/FINDINGS.md](../../_archive/TZ_DeadModelSelectors/FINDINGS.md), но не было финально закрыто
- **Hot-fix в ТЗ-XAI-4 Этапе 2 (коммит `d9d3488`)** — исправил одно из «4 мест без импорта» (plan/route.ts). Сейчас осталось минимум одно (service-chat/route.ts) + audit остальных
- **TZ-CachePipelineMetrics (архив)** — затрагивал observability и pipelines, мог содержать audit но не фиксировал этот симптом
- **ADR 048 DevPanel Switchboard UI** — должен быть обновлён как часть этого ТЗ

---

## НЕ в scope ТЗ-XAI-4

Важно: этот баг **НЕ связан с миграцией моделей**, он pre-existing. Просто стал заметнее во время тестирования Этапа 2 ТЗ-XAI-4, когда владелец активно использовал `/dev/models` UI для переключения моделей в разных режимах.

Решать — отдельным ТЗ. Оценка — 0.5–1 сессия (оба фикса простые: Дыра 1 — дописать UI коллекции, Дыра 2 — одна строка импорта + audit остальных routes).

---

## Связанный код (первые места для исследования)

- [app/(dashboard)/dev/models/page.tsx](../../app/(dashboard)/dev/models/page.tsx) — страница UI
- [components/dev-panel/](../../components/dev-panel/) — компоненты DevPanel
- [app/(chat)/api/service-chat/route.ts](../../app/(chat)/api/service-chat/route.ts) — route handler без импорта reader
- [lib/ai/model-overrides-node.ts](../../lib/ai/model-overrides-node.ts) — reader, `registerOverridesReader()`
- [lib/ai/model-overrides.ts](../../lib/ai/model-overrides.ts) — client-safe, `getActiveOverrides()`
- [lib/ai/getModel.ts](../../lib/ai/getModel.ts) — call site для `getActiveOverrides()` в `lookupOverride()`
