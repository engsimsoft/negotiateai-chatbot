# ТЗ-SimplyChatRaceCondition (follow-up, вне серии Simply_xAI)

**Импакт:** low (в steady state не виден) · **Оценка:** 0.5 сессии · **Создано:** 2026-04-14

## Контекст

Обнаружено во время ТЗ-XAI-2 (серия Simply_xAI миграции) при смоук-тесте MIND pipeline. После очистки dev-БД первые параллельные запросы из дашборда создали **3 разных чата** с `chatMode='simply'` для одного `userId` вместо одного persistent чата.

**Детали воспроизведения:** `getOrCreateSimplyChat` в [lib/db/queries.ts:228](../../lib/db/queries.ts#L228) использует паттерн SELECT + INSERT без транзакционной защиты и без unique constraint на `(userId, chatMode='simply')`:

```ts
export async function getOrCreateSimplyChat(userId: string) {
  // 1. SELECT WHERE userId AND chatMode='simply' LIMIT 1
  const [existing] = await db.select().from(chat).where(...).limit(1);
  if (existing) return existing;
  // 2. INSERT new chat
  await db.insert(chat).values({ id: generateUUID(), chatMode: "simply", ... });
  // 3. SELECT the created row
}
```

При параллельных запросах (особенно когда persistent чат ещё не создан) все запросы видят пустую БД в SELECT → все делают INSERT → получаем N дубликатов.

**Почему в production обычно не видно:** в steady state у каждого активного пользователя уже есть один simply chat, все SELECT его находят, race не триггерится. Проявляется только в двух сценариях:
1. Первый заход нового пользователя (параллельные запросы до создания persistent чата)
2. После очистки БД (как в нашем случае с ТЗ-XAI-2)

## Решение

**Вариант A — Unique constraint (предпочтительный):**

Добавить миграцию:
```sql
-- 0055_simply_chat_unique.sql
CREATE UNIQUE INDEX IF NOT EXISTS "Chat_user_simply_uniq"
ON "Chat" ("userId")
WHERE "chatMode" = 'simply';
```

И обновить `getOrCreateSimplyChat` чтобы обрабатывать race на уровне INSERT:
```ts
try {
  await db.insert(chat).values({...}).onConflictDoNothing();
} catch (e) { /* unique violation → read existing */ }
const [row] = await db.select().from(chat).where(...).limit(1);
return row;
```

Partial unique index (`WHERE chatMode='simply'`) позволяет у пользователя иметь другие чаты (expertise, create), но ровно один simply.

**Вариант B — Advisory lock (альтернатива):**

`pg_advisory_xact_lock(hashtext(userId))` перед SELECT + INSERT. Проще, но плохо работает с Neon HTTP driver (stateless соединения).

**Рекомендация:** Вариант A, partial unique index.

## Definition of Done

- [ ] Миграция `0055_simply_chat_unique.sql` создана и применена
- [ ] `getOrCreateSimplyChat` переписан с `onConflictDoNothing` + повторный SELECT
- [ ] Тест: запустить 10 параллельных вызовов `getOrCreateSimplyChat(userId)` на пустой БД — должен получиться ровно 1 чат
- [ ] `npm run build` успешен
- [ ] Мануальный смоук: очистить БД → открыть дашборд → быстро отправить 3 сообщения → проверить что все попали в один persistent чат

## Риски

- Partial unique index в Postgres — стандартная фича, поддерживается давно
- При применении миграции на prod БД: если там уже есть дубликаты (невидимые) — миграция упадёт. Нужно сначала cleanup-скрипт который удалит дубликаты (keep oldest по createdAt, остальных merge сообщений в oldest или просто delete если пустые)

## Не чинится сейчас

Владимир явно зафиксировал фокус: «строго идём по серии Simply_xAI, не отвлекаемся на другие проекты и болячки». Этот баг не в коде миграции, он существовал раньше, просто проявился из-за нашей очистки БД. Чинить будем после ТЗ-XAI-6 (полное завершение серии).
