# TZ_MindAtomicityFix

**Impact:** 🟥 high
**Найдено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills (2026-04-27)
**Источник:** FINDINGS #4 ТЗ-MigrateArtifactPromptsToSkills

## Проблема

`markMessagesExtracted` в MIND extract job вызывается **безусловно** даже когда все `processAndStoreFact` упали (например, Voyage 403). Сообщения помечаются как «обработаны», но факты в БД/Voyage не записаны → память теряется безвозвратно.

## Где код

[lib/ai/memory/extract.ts:235-246](lib/ai/memory/extract.ts#L235-L246):

```ts
for (const fact of facts) {
  try {
    await processAndStoreFact(...);   // Voyage embedding upload + DB save
  } catch (error) {
    console.error("[MIND] Batch extract: failed to store fact ...");  // ловим, продолжаем
  }
}
// Mark ALL batch messages as extracted (even if no facts found)
await markMessagesExtracted(batch.map((m) => m.id));
```

Комментарий «even if no facts found» написан под кейс «LLM не нашёл фактов в батче», но логически покрывает и кейс «факты были, но запись провалилась» — это ошибка.

## Воспроизведение

При работе на финском VPN владельца (известный долг `voyage_vpn_finland`):
1. MIND batch-extract запускается на новом окне сообщений
2. LLM (Grok 4.1 Fast) извлекает 5-10 фактов — успешно
3. Каждый факт пытается записаться через `processAndStoreFact` → Voyage 403 → throw
4. catch проглатывает, цикл продолжается, **0 фактов сохранено**
5. `markMessagesExtracted(batch.map(m => m.id))` помечает 50+ сообщений как extracted
6. На следующем запросе чата эти сообщения исключаются из inline-контекста (фильтр `extractedAt IS NULL`)
7. Retrieve через Voyage не находит факты (их нет в БД)
8. **Память сообщения потеряна навсегда**

## Гипотезы решения

1. **Условный mark (минимальный fix):**
   ```ts
   const failedFacts = facts.length - storedCount;
   if (failedFacts === 0 || facts.length === 0) {
     await markMessagesExtracted(batch.map(m => m.id));
   } else {
     console.warn(`[MIND] Batch extract: ${failedFacts}/${facts.length} facts failed, NOT marking messages — will retry on next on-visit`);
   }
   ```
   Не помечаем extracted если был partial failure. Retry на следующем on-visit.

2. **2-фазное сохранение:** сначала пишем факты в БД без вектора, помечаем extracted; отдельный job поднимает не-векторизованные и пытается embedding. При провале — повтор с экспоненциальным backoff.

3. **Retry с backoff внутри `processAndStoreFact`:** делать 3 попытки с 1s/5s/30s паузами перед throw. Большинство Voyage 403 кратковременны (VPN flap).

## Влияние

При каждом сетевом сбое Voyage = безвозвратная потеря памяти пользователя. Усугубляет TZ_SimplyChatMemoryRegression — даже когда retrieve работает, фактов в Voyage может не быть.

## Оценка

0.3-0.5 сессии (минимальный fix через условный mark)
