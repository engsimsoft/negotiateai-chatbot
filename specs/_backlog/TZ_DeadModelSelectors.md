# ТЗ-DeadModelSelectors (Follow-up из TZ_LegacyChatCleanup, Findings #4 #6 #7)

**Импакт:** medium · **Оценка:** 1–2 сессии · **Создано:** 2026-04-13

## Цель

Полностью выпилить `lib/ai/models.ts` и все его dead импортёры. В рамках TZ_LegacyChatCleanup файл оставлен как `@deprecated` тонкая заглушка, потому что физическое удаление требует параллельного удаления 5 компонентов и переписывания `entitlements.ts` — это отдельный refactor с собственным risk profile.

## Что удалить

### Файл-источник
- `lib/ai/models.ts` (целиком)

### Импортёры (5 файлов)
1. **`lib/ai/entitlements.ts`** — импортирует тип `ChatModel`, использует `ChatModel["id"]` для `availableChatModelIds`. Переписать без зависимости от `ChatModel`: либо `string[]`, либо инлайн-литерал
2. **`components/compact-model-selector.tsx`** — целиком legacy-селектор моделей, не рендерится в активном UI (grep подтвердил — только в архивах)
3. **`components/input/input-model-selector.tsx`** — экспортируется из `components/input/index.tsx`, но не используется в активных компонентах. Удалить файл + убрать экспорт
4. **`components/model-selector.tsx`** — старый legacy-селектор. Удалить
5. **`components/multimodal-input.tsx` строки 700-742** — целый dropdown-блок с массивом `chatModels`, рендерится по условию которое всегда false (`isProjectChat` ветка использует другой компонент `ModelSelectorCompact`). Удалить весь блок dead-кода

### Связанные dead-артефакты
- **Finding #6**: `currentModelIdRef` мёртвый useRef в `components/chat.tsx:91, 122-123` — объявлен, синхронизируется, нигде не читается. Удалить 3 строки
- **Finding #7**: `isReasoningModel === "chat-model-reasoning"` в `components/multimodal-input.tsx:602` — проверка на удалённую модель. Найти все usages и удалить вместе с зависимыми ветками

## Подход (рекомендуемые этапы)

1. **Этап 1**: Удалить `currentModelIdRef` и `isReasoningModel` (тривиальные правки, разогрев)
2. **Этап 2**: Удалить блок dropdown в `multimodal-input.tsx:700-742`. Проверить что компонент `MultimodalInput` всё ещё корректно рендерится (он рендерит `ModelSelectorCompact` только для проектов — должен остаться нетронутым)
3. **Этап 3**: Удалить три legacy селектор-файла (`compact-model-selector`, `input-model-selector`, `model-selector`). Убрать экспорт из `components/input/index.tsx`
4. **Этап 4**: Переписать `entitlements.ts` без `ChatModel` типа (`availableChatModelIds: string[]`)
5. **Этап 5**: Удалить `lib/ai/models.ts` физически
6. **Этап 6**: Финал — `tsc --noEmit`, `npm run build`, smoke test всех 4 режимов

## Риски

- **`ModelSelectorCompact` для проектов** — отдельный компонент, не путать с удаляемыми. Перед каждым удалением grep по имени, чтобы не задеть проектный селектор tier
- **Cookie `chat-model`** — после Этапа 5 окончательно мёртвая. Можно (опционально) добавить миграцию: при первом заходе пользователя удалить cookie через server action

## Definition of Done

- `lib/ai/models.ts` физически удалён
- `grep -r "from.*lib/ai/models" .` возвращает только архивы
- `grep -r "DEFAULT_CHAT_MODEL" .` возвращает только архивы
- `tsc --noEmit` = 0
- `npm run build` успешен
- Smoke test: Simply / expertise / create / projects — все 4 работают, в проектах всё ещё работает выбор tier через `ModelSelectorCompact`
