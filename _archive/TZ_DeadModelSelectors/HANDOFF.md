# HANDOFF — TZ_DeadModelSelectors

**Статус:** 🟢 Закрыто **частично** (~30% scope) в одну сессию (2026-04-14 session 2)
**Архив:** `_archive/TZ_DeadModelSelectors/`
**Предшественник handoff:** `specs/SESSION_HANDOFF.md` (session 2 от 2026-04-14)

## Резюме

Finding #4/#6/#7 из TZ_LegacyChatCleanup — `lib/ai/models.ts` и dead model-selector компоненты. Сессия закрыла ~30% скоупа после двух решающих событий:

1. **HMR incident:** во время Этапа 1 (atomic prop collapse через 11 файлов) при попытке hotfix'а pre-existing бага с DevPanel Switchboard в проектах редактировал `api/projects/.../tasks/.../chat/route.ts` во время активного `updateDocument` streaming. HMR пересобрал модуль посреди потока, tool таймаутнулся по 120s лимиту, UI «завис». Владелец откатил коммит `772e886` через `git reset --hard 71de7f9`.

2. **Архитектурное решение владельца:** после отката Владимир явно сказал «в режиме проекта больше ничего не делай», «я хочу чтобы остался выбор модели в режиме проекта». Это означало что вся цепочка `initialChatModel` → `currentModelId` → `selectedModelId` → `ModelSelectorCompact` должна сохраниться, а dead код вокруг неё — **не долг**, а часть рабочего проектного flow.

## Что закрыто (3 коммита)

1. **`9ddf814`** fix(projects): DevPanel Switchboard + dev overrides в проектных task-чатах
   - **Закрывает 2 pre-existing бага**, которых не было в оригинальном SPEC
   - Bug A: `emitDebugPrompt` в task-expert route не передавал taskId/overrideActive/defaultModelId/effectiveModelId → `SwitchboardSection.tsx` делал ранний return → dropdown скрыт
   - Bug B: отсутствовал side-effect import `@/lib/ai/model-overrides-node` → reader не регистрировался → `isTaskOverridden` возвращал stub → `getModel()` молча отдавал default модель, игнорируя override из `/dev/models`
   - Один файл, +14/-1 строк, тот же паттерн что в основном chat route
   - Мануальный тест user-confirmed

2. **`a1923b1`** chore(cleanup): удалить 3 мёртвых legacy selector-компонента
   - `components/compact-model-selector.tsx`
   - `components/model-selector.tsx`
   - `components/input/input-model-selector.tsx`
   - Убран экспорт `InputModelSelector` из `components/input/index.tsx`
   - −402 строки, все 3 файла имели 0 импортёров в активном коде
   - **`components/projects/model-selector.tsx` НЕ удалён** — `/projects/` папка, владелец сказал не трогать

3. **`5b2571c`** chore(cleanup): убрать unused availableChatModelIds из entitlements
   - `lib/ai/entitlements.ts`: убрана зависимость от `ChatModel` (единственный не-archive импортёр), поле `availableChatModelIds` убрано
   - Тип `Entitlements` упрощён до `{ maxMessagesPerDay: number }`

## Что НЕ сделано (намеренно, по решению владельца)

См. ROADMAP.md секцию «Что намеренно оставлено». Кратко:
- `lib/ai/models.ts` (deprecated stub, всё ещё импортируется `multimodal-input.tsx`)
- `components/multimodal-input.tsx` (dead Claude-ветка, dead props, dead imports)
- `components/chat.tsx` (currentModelId state, ref, initialChatModel prop)
- `components/messages.tsx`, `components/artifact.tsx` (dead `selectedModelId` props)
- `components/projects/task-chat.tsx` (3 × `selectedModelId="claude-sonnet"`)
- 5 page-файлов (dead `initialChatModel` prop)
- `components/input/input-context.tsx` (мёртвая `provider: "google" | "anthropic"` дуальность)
- `components/projects/model-selector.tsx` (0 импортёров, но в `/projects/`)
- `app/(chat)/actions.ts → saveChatModelAsCookie` (вызывается только из dead ветки)

Все эти вещи — часть работающего проектного flow с `ModelSelectorCompact` (выбор tier 🎯 Эксперт / Haiku / Opus). Удаление безопасно только с архитектурным обсуждением и отдельным ТЗ, который Владимир пока не санкционировал.

## Новые findings (внесены в backlog)

См. FINDINGS.md (полная версия). Кратко 2 новых долга:

1. 🟥 **TZ_OverridesReaderCentralization** (high impact, 1 сессия)
   - Side-effect import `@/lib/ai/model-overrides-node` сейчас стоит только в 4 из ~20 call-sites `getModel()`. Остальные молча игнорируют override из `/dev/models` в production.
   - Канонический Next.js путь — централизовать в `instrumentation.ts`.
   - Файл: `specs/_backlog/TZ_OverridesReaderCentralization.md`

2. 🟧 **TZ_PromptsDeadCodeCleanup** (medium, 0.5 сессии)
   - `lib/ai/prompts.ts` на 90% dead — `artifactsPrompt`, `regularPrompt`, `systemPrompt` deprecated, `buildUserContext` deprecated. Только `updateDocumentPrompt` живой.
   - Рассмотреть переименование в `lib/ai/artifact-prompts.ts`.
   - Файл: `specs/_backlog/TZ_PromptsDeadCodeCleanup.md`

## Lessons learned

1. **НЕ редактировать route-файлы во время активного streaming.** Dev-HMR пересобирает модуль → активные promises (tools, streams) могут зависнуть до timeout. Правило: дождаться завершения стрима, потом править. Если нужно срочно — `kill` процесса dev-сервера и перезапуск, а не in-place edit.

2. **Atomic multi-file refactors после first commit + до user manual test = рискованная зона.** Если первый этап такого refactor'а потребует hotfix, возможно лучше откатить коммит и переделать вместе с фиксом, чем дополнять его patch'ами поверх.

3. **«Mert код» внутри работающего flow ≠ долг.** `ModelSelectorCompact` для проектов работает идеально, и dead-импорты вокруг него — это техническая косметика, а не блокер. Решение «оставить намеренно» — валидное архитектурное решение, не недоработка.

4. **Pre-existing баги, обнаруженные параллельно с работой по ТЗ — fair game для расширения скоупа** (как Stage 2b в TZ_StreamObservability предыдущей сессии). Bug A/B про DevPanel override в проектных задачах не входил в исходный SPEC TZ_DeadModelSelectors, но был закрыт в той же сессии в одном коммите потому что (а) находка естественная, (б) фикс маленький, (в) одна область кода.

5. **Workspace воссоздание ретроспективно работает но плохо для трассировки.** Когда коммит `772e886` был откачен через `git reset --hard`, рабочая папка `specs/TZ_DeadModelSelectors/` исчезла вместе с ним. Восстанавливать пришлось вручную в конце сессии. На будущее: **держать рабочую папку ТЗ в отдельном коммите от code changes**, чтобы reset code commit'а не уничтожал workspace.

## Не осталось незакрытых концов

- tsc ✅ 0 ошибок (после каждого из 3 коммитов)
- HMR ✅ recompile clean (после короткой транзитной ошибки между `rm` и `edit`)
- Smoke test ✅ user-confirmed («всё работает как в других режимах») для bug fix
- Backlog ✅ 2 новых ТЗ внесены, TZ_DeadModelSelectors перенесён в «Закрытые»
- Workspace ✅ воссоздан ретроспективно, документирован

Не запушено в remote — стандарт сессии (push требует явного OK владельца).
