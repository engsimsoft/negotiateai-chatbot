# Roadmap ТЗ-A.2: FIX-SIMPLY-MEMORY

**Создан:** 2026-04-27
**Версия проекта:** 3.99.3 → 3.100.0
**Статус:** ✅ Завершён 2026-04-27

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Сессий | 1 |

---

## Этапы

### Этап 1: Убрать excludeExtracted для Simply + 140K + alreadyExtractedIds

**Статус:** ✅ Завершён

**Цель:** Simply Chat грузит полную историю как expertise/create. Подготовить `alreadyExtractedIds` для передачи в Compaction middleware.

**Задачи:**
- [ ] В `app/(chat)/api/chat/route.ts:593` понизить `maxTokens` для Simply со `180000 - newMessageTokens` до `140000 - newMessageTokens` (унификация с другими chatMode)
- [ ] В `app/(chat)/api/chat/route.ts:596` удалить `excludeExtracted: isSimplyChat` (передаётся дефолт `false`)
- [ ] После `getMessagesByChatId` собрать `const alreadyExtractedIds = new Set(messagesFromDb.filter(m => m.extractedAt !== null).map(m => m.id))`
- [ ] В `lib/ai/compaction/types.ts` добавить поле `alreadyExtractedIds?: Set<string>` в `CompactionContext`
- [ ] В вызов `prepareMessagesWithCompaction` (route.ts:1113) добавить `alreadyExtractedIds` в context

**Файлы:**
- `app/(chat)/api/chat/route.ts` — убрать excludeExtracted, понизить maxTokens, собрать Set
- `lib/ai/compaction/types.ts` — расширить CompactionContext
- Комментарий «ТЗ-ExtractCompression: simply…» в `route.ts:588` обновить под новую семантику

**Валидация этапа:**
- [ ] `pnpm exec tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен (⚠ предупредить владельца перед запуском — auto-migration)
- [ ] 🧪 Мануальный тест: открыть существующий Simply чат → задать вопрос про прошлое → модель помнит

**Критерий готовности:** В Simply Chat ответы используют полную доступную историю (до 140K), фильтр extractedAt отключён.

---

### Этап 2: Дедупликация в pre-compact extract

**Статус:** ✅ Завершён

**Цель:** Compaction middleware пропускает extract step для уже-extracted сообщений. Skip целиком если результат фильтра пустой.

**Задачи:**
- [ ] В `lib/ai/compaction/prepare-messages.ts` (~строка 120-156) перед `batchExtractFacts` добавить фильтр: `const messagesToExtract = split.toCompact.filter(m => !context.alreadyExtractedIds?.has(m.id))`
- [ ] Если `messagesToExtract.length === 0` — skip extract step (не вызывать `batchExtractFacts`), сразу на summary
- [ ] Если `messagesToExtract.length > 0` — передать его (не `split.toCompact`) в `batchExtractFacts.messages`
- [ ] Сохранить existing graceful fallback (try/catch + dataStream warning)
- [ ] Обновить лог `[Compaction] pre-compact-extract` — добавить `skipped:N` (количество пропущенных как уже extracted) для observability

**Файлы:**
- `lib/ai/compaction/prepare-messages.ts` — фильтр + early-skip + лог

**Валидация этапа:**
- [ ] `pnpm exec tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест на тестовом чате 192 сообщения: довести до 100K (если возможно искусственно) → убедиться по логам что extract не вызывался / вызывался только на свежих

**Критерий готовности:** В существующем чате с extracted-историей первый compaction не делает дубликатных Grok-вызовов на extract.

---

### Этап 3: Замер cost до/после

**Статус:** ✅ Завершён

**Цель:** Подтвердить гипотезу архитектора: стационар после первого compaction ≈ 40-43K input, не 140K.

**Задачи:**
- [ ] На тестовом чате со 192 сообщениями (`3353a183-37f5-498e-b461-c2e87ff65ef1`):
  - [ ] До разворота фикса (или из логов до сегодняшнего dev) — зафиксировать input-tokens 1 turn
  - [ ] После Этапа 1+2 — запустить 1 turn, зафиксировать input-tokens
  - [ ] Если history < Soft 100K — compaction = noop (ожидаемо). Зафиксировать.
  - [ ] Опционально: довести history искусственно до >100K (вставить длинное user-сообщение) → зафиксировать compaction event + input-tokens на следующих 3 turns
- [ ] Положить таблицу замеров в `FINDINGS.md` (создать если нет находок — здесь это полезный артефакт замера, не «находка»)

**Файлы:**
- `specs/TZ_FixSimplyMemory/FINDINGS.md` — таблица замеров (или отдельный `MEASUREMENTS.md`)

**Валидация этапа:**
- [ ] Цифры замеров записаны
- [ ] 🧪 Владелец подтверждает корректность поведения по логам/UI

**Критерий готовности:** Замеры зафиксированы; стационар на чате с уже-extracted историей в пределах ожидания (compaction срабатывает корректно).

---

### Этап 4: Финализация

**Статус:** ✅ Завершён

**Цель:** Архивация ТЗ + миграция backlog + единый коммит (Правило 7).

**Задачи:**
- [ ] Проверить `wc -l CLAUDE.md` ≤ 220 — НЕ редактировать
- [ ] Обновить `SIMPLY_STATUS.md` (snapshot, известная проблема снята)
- [ ] Обновить `CHANGELOG.md` (запись о ТЗ)
- [ ] Bump версии в `package.json`: 3.99.3 → 3.100.0
- [ ] Обновить `specs/_backlog/TRIAGE.md` — пометить A.2 как ✅ с датой
- [ ] Удалить `specs/_backlog/TZ_SimplyChatMemoryRegression.md` (закрыт)
- [ ] Не трогать `specs/_backlog/TZ_MindAtomicityFix.md` (следующий)
- [ ] `git diff --stat master...HEAD` → пройти таблицу Правила 6 docs/ обновлений (ожидаемо: ничего не триггерится — нет новых tools, моделей, компонентов)
- [ ] Единый коммит ТЗ: `feat(tz-fix-simply-memory): убрать excludeExtracted фильтр для Simply + дедупликация pre-compact extract — v3.100.0`
- [ ] Переместить папку: `mv specs/TZ_FixSimplyMemory _archive/Simply_Memory/`

---

## Глобальная валидация

После всех этапов:
- [ ] Полная Верификация (5 пунктов из SPEC.md → Верификация)
- [ ] Замеры зафиксированы (Этап 3)
- [ ] Backlog обновлён, ТЗ переехала в архив
- [ ] Коммит создан
