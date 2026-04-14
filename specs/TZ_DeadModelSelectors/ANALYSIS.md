# ТЗ-DeadModelSelectors — Анализ

**Дата:** 2026-04-14
**Статус:** Закрыто частично, воссоздано после отката

---

## История работы (важно для следующего агента)

Эта папка ТЗ была создана в коммите `772e886` (Этап 1 — коллапс цепочки props), который затем был откачен командой `git reset --hard 71de7f9` после того как Этап 1.5 сломал активный streaming в проектном task-чате. Hard reset физически удалил эту папку. Коммиты `9ddf814`, `a1923b1`, `5b2571c` были сделаны **после отката, без ROADMAP'а** — по памяти и ad-hoc. Папка ТЗ воссоздана ретроспективно в конце сессии, чтобы сохранить контекст.

## Изученная документация

Правило 1 WORKFLOW.md формально не применяется — ТЗ не трогает внешние SDK. Только удаление dead импортов. Для Этапа 1.5 (hotfix проектного override) была прочитана официальная документация Next.js по `instrumentation.ts` (register() lifecycle, NEXT_RUNTIME guard), но этот этап был откачен.

## Grep-audit (выполнен в начале сессии)

SPEC описывал 5 файлов-импортёров `lib/ai/models.ts`. Реальный grep показал более широкую картину (13+ файлов), включая глубокую цепочку мёртвых props через `Chat → Messages → MultimodalInput → Artifact → task-chat` и мёртвую дуальность `provider: "google" | "anthropic"` в `InputContextProvider`.

### Что было определено как живое (НЕ трогать)

1. **`ModelSelectorCompact` внутри `components/multimodal-input.tsx`** — рабочий tier selector 🎯 Эксперт / Haiku / Opus в проектных чатах. Владелец подтвердил что хочет этот компонент сохранить.
2. **`lib/ai/model-tiers.ts`** — SSOT проектных tier'ов. Полностью живой.
3. **Cookie `project-model-tier`** — живая, читается обоими projects server pages, пишется из `ModelSelectorCompact` внутри чата.
4. **`userEntitlements.maxMessagesPerDay`** — читается в `api/chat/route.ts:391` для rate limit.

### Что было определено как мёртвое

1. `components/compact-model-selector.tsx` — 0 импортёров ✅ удалён
2. `components/model-selector.tsx` — 0 импортёров в активном коде ✅ удалён
3. `components/input/input-model-selector.tsx` — экспортировался из `components/input/index.tsx`, но никто экспорт не потреблял ✅ удалён
4. `availableChatModelIds` в `lib/ai/entitlements.ts` — читалось только удалённым `model-selector.tsx` ✅ убрано
5. `lib/ai/models.ts` — `DEFAULT_CHAT_MODEL = "auto"` константа + пустой `chatModels[]` + `ChatModel` type. После удаления 4 выше только `multimodal-input.tsx` ещё импортирует `chatModels`. **НЕ удалён** — потому что `multimodal-input.tsx` в проектном flow.
6. **Цепочка `initialChatModel → currentModelId → selectedModelId`** через 10+ файлов — **НЕ удалена** (Этап 1 ROADMAP'а был откачен).

## Открытые вопросы/решения сессии

### Решение владельца — сохранить проектный селектор

После сегодняшнего инцидента с откатом Владимир явно указал: «в режиме проекта больше ничего не делай». Это закрывает часть скоупа TZ_DeadModelSelectors, которая касалась мёртвых props внутри chat/messages/artifact/multimodal-input. Владелец прямо сказал что хочет сохранить функциональность селектора модели в проектах.

### Bug discovery (вне оригинального SPEC)

Во время мануального теста Этапа 1 обнаружены два pre-existing бага в проектном task-expert роуте:
- **Bug A:** `emitDebugPrompt` не передавал `taskId`/`overrideActive`/`defaultModelId`/`effectiveModelId` — DevPanel Switchboard скрыт
- **Bug B:** отсутствовал side-effect import `@/lib/ai/model-overrides-node` — dev overrides молча игнорировались

Оба бага закрыты коммитом `9ddf814`. Решение — локальный fix в самом роуте (не instrumentation.ts, после того как этот подход был отвергнут владельцем).

## Выводы

- Оригинальный scope TZ_DeadModelSelectors закрыт **на ~30%** от того что было в SPEC
- Остальные ~70% **намеренно оставлены** как рабочий функционал проектного flow
- Попутно закрыт **критический баг проектного override**, не входивший в SPEC
- Финальный workspace воссоздан ретроспективно, потому что первая попытка была откачена
