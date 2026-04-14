# ТЗ-DeadModelSelectors

**Статус:** 🟢 Закрыто частично (2026-04-14)
**Источник:** `specs/_backlog/TZ_DeadModelSelectors.md` (поднято в активное ТЗ, файл удалён из backlog)
**Причина создания:** follow-up из TZ_LegacyChatCleanup (Findings #4 #6 #7)

---

## Цель

Удалить dead-код вокруг старой системы UI-селектора моделей, оставленной как заглушка после ТЗ-1 CoreRegistry.

## Что было запланировано в оригинальном SPEC (backlog-файл)

**Файл-источник:**
- `lib/ai/models.ts`

**Импортёры (5 файлов):**
1. `lib/ai/entitlements.ts` — тип `ChatModel`
2. `components/compact-model-selector.tsx` — legacy селектор
3. `components/input/input-model-selector.tsx` — legacy inline селектор
4. `components/model-selector.tsx` — старый dropdown
5. `components/multimodal-input.tsx:700-742` — dropdown блок внутри

**Связанные dead-артефакты:**
- Finding #6: `currentModelIdRef` в `components/chat.tsx` — мёртвый ref
- Finding #7: `isReasoningModel === "chat-model-reasoning"` — проверка на удалённую модель

## Что реально было сделано (см. ROADMAP.md)

См. `ROADMAP.md` — эпизод сессии 2026-04-14, результат и причины почему часть скоупа намеренно оставлена.

## Definition of Done (обновлённый)

- [x] `components/compact-model-selector.tsx` удалён
- [x] `components/model-selector.tsx` удалён
- [x] `components/input/input-model-selector.tsx` удалён + экспорт убран
- [x] `lib/ai/entitlements.ts` — `availableChatModelIds` + зависимость от `ChatModel` убраны
- [x] Фикс Bug #A (emitDebugPrompt поля) в проектном task-expert роуте — вышел за scope исходного SPEC, но закрыл блокер Владимира по override в проектах
- [x] Фикс Bug #B (side-effect import `model-overrides-node`) в том же роуте
- [ ] ~~`lib/ai/models.ts` физически удалён~~ — **намеренно оставлено**
- [ ] ~~`components/multimodal-input.tsx` — dead dropdown блок~~ — **намеренно оставлено**
- [ ] ~~`currentModelIdRef` в `components/chat.tsx`~~ — **намеренно оставлено**
- [ ] ~~`isReasoningModel` проверка~~ — **намеренно оставлено**
- [ ] ~~Упрощение `InputContext` (drop `provider` duality)~~ — **намеренно оставлено**
- [ ] ~~`saveChatModelAsCookie` удалить~~ — **намеренно оставлено**
- [ ] ~~`initialChatModel` prop из Chat + 5 pages~~ — **намеренно оставлено**
- [ ] ~~`components/projects/model-selector.tsx`~~ — **намеренно оставлено** (Владимир хочет сохранить селектор модели в проектах)

**Причина намеренного оставления:** Владелец Владимир явно сказал «в режиме проекта ничего не делай». Рабочий `ModelSelectorCompact` внутри `multimodal-input.tsx` (tier selector 🎯 Эксперт / Haiku / Opus) должен остаться нетронутым, и вся prop-цепочка вокруг него не трогается чтобы не ломать проектный flow. После сегодняшнего хаоса с откатом scope'а — обоснованное решение «не совать нос».
