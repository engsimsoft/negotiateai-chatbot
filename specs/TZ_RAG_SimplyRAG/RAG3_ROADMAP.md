# Roadmap ТЗ-RAG3: Compaction — Бесконечный чат

**Создан:** 2026-04-07
**Версия проекта:** 3.72.0 → 3.73.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 2-3 |

**Ключевое ограничение:** Compaction API (`compact_20260112`) поддерживается только Sonnet 4.6 и Opus 4.6. Haiku 4.5 **не поддерживает**. Поэтому snapshot-система остаётся для Haiku-чатов (`chatMode: "chat"`), а Compaction включается только для expertise/create/project.

---

## Этап 1: Включить Compaction API + критические фиксы

**Статус:** ✅ Завершён

**Цель:** Добавить Anthropic Compaction в streaming routes для Sonnet/Opus. Исправить баг с несохранением сообщений (`originalMessages`).

**Задачи:**
- [x] 1.1 Добавить `providerOptions.anthropic.contextManagement` в `app/(chat)/api/chat/route.ts` (условно: только для expertise/create/project, НЕ для chatMode="chat" Haiku)
- [x] 1.2 Добавить `providerOptions.anthropic.contextManagement` в `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
- [x] 1.3 Добавить compaction debug event: тип `DebugCompactionData` + `emitDebugCompaction()` в `lib/ai/debug-events.ts`
- [x] 1.4 Эмитить compaction debug event из `onFinish` в обоих route handlers (через `providerMetadata?.anthropic?.iterations`)
- [x] 1.5 Добавить compaction info в DevPanel — badge в footer + секция в model-section + provider parsing
- [x] 1.6 **HOTFIX:** Добавить `originalMessages: uiMessages` в `createUIMessageStream` (chat + task routes) — без него SDK не активировал persistence mode, messages не сохранялись в БД
- [x] 1.7 **HOTFIX:** Фильтровать новые сообщения в `onFinish` — с `originalMessages` SDK возвращает ВСЕ сообщения, нужно сохранять только новые (`!originalIds.has(m.id)`)
- [x] 1.8 **HOTFIX:** Привести `dataStream.write` к `(dataStream as any).write` для professor pipeline events — `originalMessages` ужесточил типизацию `UIMessageStreamWriter`

**Файлы изменённые:**
- `app/(chat)/api/chat/route.ts` — compaction (условный), originalMessages, фильтрация новых messages, professor cast
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — compaction, originalMessages, фильтрация
- `lib/ai/debug-events.ts` — DebugCompactionData тип + emitDebugCompaction()
- `components/dev-panel/dev-panel-provider.tsx` — DebugCompactionData import, compaction field, event parsing
- `components/dev-panel/dev-panel-footer.tsx` — Compaction badge (amber)
- `components/dev-panel/sections/model-section.tsx` — Compaction triggered/not + iterations breakdown

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: обычный чат (Haiku) работает — compaction не включается, ошибок нет
- [x] Сообщения сохраняются в БД (лог: `Saving 1 assistant message(s)`)
- [x] 🧪 Мануальный тест пользователем — ОК

**Git:** `git commit -m "feat(tz-rag3): enable Compaction API for Sonnet/Opus + fix message persistence"`

**Критерий готовности:** ✅ Compaction включен для Sonnet/Opus, Haiku работает без compaction, сообщения сохраняются.

---

## Этап 2: Очистить snapshot из Sonnet/Opus routes

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Убрать snapshot-логику из routes, которые теперь используют Compaction (expertise, create, project tasks). Snapshot остаётся ТОЛЬКО для Haiku-чатов (`chatMode: "chat"`).

**Стратегия:** Двойная система — snapshot для Haiku, compaction для Sonnet/Opus. Snapshot-файлы (клерк, tool, UI) НЕ удаляются, так как используются Haiku-чатами.

**Задачи:**

**Очистить task chat route (полностью — всегда Sonnet/Opus):**
- [ ] 2.1 `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — убрать ВСЮ snapshot-логику: imports (createFallbackSnapshot, SNAPSHOT_THRESHOLD, FALLBACK_MESSAGE_PAIRS, calcUsagePercent, getChatWithSnapshotState, addChatSnapshot, resetChatContextState, updateChatContextState), snapshot state loading, snapshot-aware message trimming, `<previous_context>` injection, context-usage event emission, threshold checking, fallback creation, contextState updates
- [ ] 2.2 `components/projects/task-chat.tsx` — убрать ContextIndicator (project tasks = Sonnet/Opus, compaction управляет контекстом)

**Сделать snapshot условным в chat route (только для chatMode="chat"):**
- [ ] 2.3 `app/(chat)/api/chat/route.ts` — обернуть snapshot-логику в `if (chatMode === "chat")` guard: snapshot state loading, trimming, `<previous_context>` injection, threshold checking, fallback creation, contextState updates, context-usage event
- [ ] 2.4 `components/chat.tsx` — показывать ContextIndicator только для chatMode="chat" (передать chatMode prop или условие)

**Файлы:**
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — полная очистка snapshot
- `app/(chat)/api/chat/route.ts` — условный snapshot (chatMode="chat" only)
- `components/projects/task-chat.tsx` — убрать ContextIndicator
- `components/chat.tsx` — условный ContextIndicator

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: обычный чат (Haiku) — ContextIndicator виден, snapshot работает
- [ ] Браузер: expertise/create — ContextIndicator НЕ виден (compaction управляет)
- [ ] Браузер: project task chat — ContextIndicator НЕ виден, чат работает
- [ ] 🧪 Мануальный тест пользователем

**Git:** `git commit -m "refactor(tz-rag3): snapshot only for Haiku chats, compaction for Sonnet/Opus"`

**Критерий готовности:** Snapshot-логика выполняется только для chatMode="chat". Sonnet/Opus routes чистые — только Compaction.

---

## Этап 3: Cost tracking + DevPanel polish

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** Корректный учёт compaction tokens в cost breakdown и polish DevPanel.

**Задачи:**
- [ ] 3.1 Проверить что `logUsage()` корректно учитывает суммарные токены при compaction (SDK суммирует iterations автоматически — верифицировать в логах)
- [ ] 3.2 В DevPanel cost-breakdown-section — показать compaction iteration отдельной строкой (если есть)

**Файлы:**
- `components/dev-panel/sections/cost-breakdown-section.tsx` — compaction iteration display

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест пользователем

**Git:** `git commit -m "feat(tz-rag3): compaction cost tracking in DevPanel"`

**Критерий готовности:** Compaction tokens отражены в DevPanel при срабатывании.

---

## Этап 4: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] 4.1 ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] 4.2 Обновить главный CHANGELOG.md
- [ ] 4.3 Обновить SIMPLY_STATUS.md
- [ ] 4.4 Обновить CLAUDE.md (добавить Compaction, отметить что snapshot остаётся для Haiku)
- [ ] 4.5 Обновить package.json: 3.72.0 → 3.73.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] 4.6 ADR нужен? → Да: `docs/decisions/NNN-compaction-dual-strategy.md` (Compaction для Sonnet/Opus + snapshot для Haiku)
- [ ] 4.7 `docs/architecture.md` нужно обновить? (dual context management)
- [ ] 4.8 `docs/ai-chats-map.md` нужно обновить? (compaction в routes)
- [ ] 4.9 `docs/ai-providers.md` нужно обновить? (compaction providerOptions для Sonnet/Opus)

**Завершение:**
- [ ] 4.10 Финальное мануальное тестирование (пользователь)
- [ ] 4.11 Переместить spec файлы в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)
- [ ] ⛔ Верификация docs против кода (Правило 5)

**Git:** `git commit -m "docs(tz-rag3): Compaction v3.73.0 — dual strategy documentation and ADR"`
