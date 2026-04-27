# ТЗ-A.2: FIX-SIMPLY-MEMORY

**Серия:** Simply_Memory (новая, вне Simply_Migration)
**Приоритет:** Critical (блокер для возврата в миграцию xAI)
**Создан:** 2026-04-27

---

## Цель

Починить потерю памяти KITT в Simply chat. Сейчас сообщения с `extractedAt != null` вырезаются из истории на загрузке — модель полагается только на MIND retrieve. При сбое Voyage происходит полная амнезия в текущем чате. После починки Voyage амнезия остаётся (метка `extractedAt` не сбрасывается).

Архитектурный фикс: история чата — primary source, MIND — augmentation. Compaction (provider-agnostic, ADR 054) сжимает старое автоматически на 50% от 200K.

---

## Три действия

### 1. Убрать excludeExtracted для Simply

`app/(chat)/api/chat/route.ts` (~строка 596):

- Удалить `excludeExtracted: isSimplyChat`
- Понизить `maxTokens` для Simply со 180000 до 140000 (как у других режимов — Compaction Soft 50% = 100K, Hard 85% = 170K, оставляем запас на system + response)
- Параметр `excludeExtracted` остаётся в сигнатуре `getMessagesByChatId` и продолжает использоваться cron / on-visit для своих целей
- Собрать `alreadyExtractedIds: Set<string>` из `messagesFromDb.filter(m => m.extractedAt !== null).map(m => m.id)` после загрузки и передать в `prepareMessagesWithCompaction` через `CompactionContext`

### 2. Дедупликация в pre-compact extract (через context, не SQL)

`lib/ai/compaction/types.ts` — добавить поле `alreadyExtractedIds?: Set<string>` в `CompactionContext`.

`lib/ai/compaction/prepare-messages.ts` (~строка 126) — перед вызовом `batchExtractFacts` отфильтровать `split.toCompact.filter(m => !context.alreadyExtractedIds?.has(m.id))`. Если результат пустой — skip extract step целиком (не вызывать `batchExtractFacts`), сразу на compact.

**Обоснование:** `getMessagesByChatId` уже возвращает `extractedAt` в `DBMessage[]` — бесплатный сайд-эффект существующего SELECT. Передача через context сохраняет middleware изолированным от БД. Минус один SQL на каждый compaction цикл.

**Дополнительный аргумент:** в существующих долгих чатах (192 сообщения, все extracted) при первом срабатывании compaction после фикса №1 — `split.toCompact` будет на 100% extracted. Без фильтра — $0.10 в пустоту + summary на сообщения которые модель и так видит в verbatim. С фильтром — extract скипается мгновенно, идём сразу на summary.

### 3. Замер cost до/после

На тестовом чате со 192 сообщениями (есть в проекте):

- До фикса: запустить 1 turn, замерить input-tokens
- После фикса: запустить ещё 1 turn, замерить input-tokens
- После compaction срабатывания: замерить input-tokens на следующих 3 turns подряд
- Положить в FINDINGS.md цифры

Цель замера: подтвердить что стационар после первого compaction ≈ 40-43K, не 140K.

---

## Что НЕ делаем

- Не удаляем `extractedAt` из схемы БД (нужен cron / on-visit)
- Не трогаем поведение `expertise` / `create` / `project` (там бага не было)
- Не меняем пороги Compaction в `context-limits.ts`
- Не добавляем fallback / страховку на случай падения Compaction (отдельный backlog item, не в этом ТЗ)
- Не трогаем MIND `processAndStoreFact` (атомарность фактов — отдельный backlog `TZ_MindAtomicityFix`, делается следующим)

---

## Верификация

1. `pnpm tsc --noEmit` зелёный
2. В Simply chat: задать вопрос «о чём мы говорили 10 сообщений назад» — модель отвечает по тексту истории
3. Отключить Voyage в dev (wrong API key) → Simply chat помнит недавнюю историю, MIND-блок пустой, амнезии нет
4. На тестовом чате 192 сообщения: убедиться что Compaction срабатывает корректно, summary генерится, последующие turns используют 40-43K input
5. Проверить логи `[Compaction] pre-compact-extract` — после первого compaction цикла повторных extract на тех же сообщениях нет

---

## После реализации

1. Владимир обновляет `SIMPLY_STATUS.md`
2. `TZ_MindAtomicityFix` (A.1) — следующий, в backlog зафиксирован High приоритет
3. Возврат к Simply_Migration ТЗ-3 (Vision/OCR cleanup) — после A.2 + A.1
