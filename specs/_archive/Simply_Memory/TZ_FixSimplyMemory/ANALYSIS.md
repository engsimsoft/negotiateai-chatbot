# Анализ ТЗ-A.2: FIX-SIMPLY-MEMORY

**Создан:** 2026-04-27

---

## Изученная документация

**Внешние технологии затронуты:** нет. ТЗ — внутренний фикс на готовом стеке. AI SDK / Vercel / xAI / Anthropic SDK не вызываются по-новому, новых параметров провайдеров не добавляется. Compaction уже provider-agnostic (ADR 054), затронут только его context-входной контракт. Voyage / Grok extract pipeline без изменений.

**Прочитан внутренний код:**
- [app/(chat)/api/chat/route.ts:580-610](app/(chat)/api/chat/route.ts#L580-L610) — `isSimplyChat` ветка `getMessagesByChatId`
- [app/(chat)/api/chat/route.ts:1100-1140](app/(chat)/api/chat/route.ts#L1100-L1140) — вызов `prepareMessagesWithCompaction` с `CompactionContext`
- [lib/db/queries.ts:507-549](lib/db/queries.ts#L507-L549) — `getMessagesByChatId({ excludeExtracted })`
- [lib/ai/compaction/prepare-messages.ts:53-227](lib/ai/compaction/prepare-messages.ts#L53-L227) — middleware: split → extract → summary
- [lib/ai/memory/extract.ts:144-316](lib/ai/memory/extract.ts#L144-L316) — `batchExtractFacts`: внутри **нет** фильтра по `extractedAt`
- [lib/ai/context-limits.ts](lib/ai/context-limits.ts) — Soft 100K, Hard 170K, Verbatim 40K, Summary target 3K

---

## Резюме

Simply Chat сейчас грузит из БД только сообщения с `extractedAt IS NULL`. После того как фоновый extract пометил всё прошлое — модель не видит истории, опирается только на MIND retrieve (5-10 фактов). Причины «не помнит»:

1. **Сбой Voyage** (VPN, network, ключ) → retrieve пустой → пустой контекст → амнезия
2. **Сбой post-fix:** даже после починки Voyage сообщения остаются `extractedAt != null` навсегда → амнезия не лечится автоматически

Архитектурный фикс: убрать фильтр, сделать историю primary source. Compaction уже умеет provider-agnostic сжатие (ADR 054), сработает когда история перейдёт Soft 100K. Существующие чаты (192 сообщения = 49K) после фикса работают мгновенно без compaction.

---

## Рекомендации разработчика (Код-ревью)

### ✅ Согласен с ТЗ

- Действие 1 (off + 140K) — корректно. Существующие чаты влезут под Soft.
- Действие 2 (дедупликация) — нужна. `batchExtractFacts` внутри **не фильтрует** `extractedAt`. Без дедупа смешанная toCompact = $0.10 впустую на каждый compaction.
- Действие 3 (замер) — обязателен для подтверждения гипотезы стационара 40-43K.

### ⚠️ Уточнено и согласовано с архитектором

| # | Было (исходный ТЗ) | Согласованная финальная реализация | Обоснование |
|---|--------------------|-----------------------------------|-------------|
| 1 | Дедупликация через новый SQL запрос внутри `prepare-messages.ts` | Передача `alreadyExtractedIds: Set<string>` через `CompactionContext` из caller | `getMessagesByChatId` уже возвращает `extractedAt` (бесплатно). Минус 1 SQL на compaction. Middleware остаётся изолированным от БД. |

### Дополнительный аргумент ЗА дедупликацию (был не упомянут в исходном ТЗ)

В существующих долгих чатах (192 сообщения, все extracted) при первом срабатывании compaction после фикса №1 — `split.toCompact` будет на 100% extracted. Без фильтра = $0.10 в пустоту + summary поверх extracted, которые модель уже видит в verbatim. С фильтром = extract скипается мгновенно, сразу на summary.

---

## Потенциальные риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Cost grow (input tokens × turn) на длинных чатах | High до Soft, Low после первого compaction | Действие 3 — замер. Если стационар > 50K — пересмотр порогов в отдельном ТЗ. |
| Дублирующее знание: история + MIND retrieve одновременно | Low | OK для качества (модель видит и сырое, и обобщённое). Compaction сожмёт. |
| Большое вложение в `newMessageTokens` | Existing | `maxTokens=140K - newMessageTokens` уже вычитает (route.ts:593). Граничный кейс корректен. |
| Первый compaction в существующем чате с 100% extracted toCompact | Mitigated by Действие 2 | Фильтр пропускает extract step → нет лишнего Grok-вызова. |

---

## Зависимости

- **TZ_MindAtomicityFix (A.1)** — НЕ блокирует A.2. A.2 чинит «не помнит в текущем чате». A.1 чинит «факты не доходят до MIND при сбое Voyage». Оба нужны, но независимы.
- **`extractedAt` колонка** остаётся в схеме — продолжает использоваться cron / on-visit. Не удаляется.

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

3 этапа, изолированные правки в 3 файлах + 1 файл типов. Ожидаемое время: 1 сессия.
