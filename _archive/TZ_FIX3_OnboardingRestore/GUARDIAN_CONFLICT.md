# Конфликт Guardian vs Briefing Onboarding

**Дата:** 2026-02-27
**Контекст:** ТЗ-FIX3 Этап 1 выполнен (unified tools), тест create mode
**Для:** Архитектор + PE (Prompt Engineer)

---

## Суть проблемы

После восстановления единого набора инструментов (deepResearch, fetchUrl, readTelegramChannel) для create mode, **Guardian блокирует финальный текстовый шаг**, где AI презентует найденные источники пользователю. Пользователь видит "Запускаю поиск... Готово." — и тишина. Диалог обрывается.

---

## Что произошло (хронология теста)

**Сценарий:** create mode, пользователь попросил одну тему (AI для разработчиков), стандартный объём.

### Steps 1-7: AI корректно использует инструменты

```
Step 1: text — приветствие, уточняющие вопросы
Step 2: text — "Запускаю поиск источников"
Step 3: deepResearch ×2 (параллельно, RU + EN запросы) ✅
Step 4: deepResearch ×2 + readTelegramChannel ×2 ✅
Step 5: fetchUrl (anthropic.com/news) + readTelegramChannel ✅
Step 6: fetchUrl (simonwillison.net) + deepResearch ✅
Step 7: fetchUrl ×3 (RSS фиды) ✅
```

Всё работает. deepResearch, fetchUrl, readTelegramChannel вызываются реально.

### Step 8: Guardian блокирует текст

```
Step 8: toolCallCount=0, AI пишет текст с результатами:
  "Вот что нашёл по теме 🤖 AI для разработчиков:
   **Официальные источники:** Anthr..."

Guardian verdict:
  tool: readTelegramChannel
  pattern: result_claim (verb "нашёл" + tool mention)
  confidence: 0.7
  → Blocked hallucinated step (233 chunks suppressed)
```

**Результат:** Пользователь ничего не видит. Поток завершается. Ни текста, ни updateBriefingPreview.

---

## Почему Guardian срабатывает

Логика Guardian (ТЗ-FIX1/FIX1.2):
1. Step 8 имеет `toolCallCount === 0` (AI не вызвал ни одного инструмента)
2. Текст содержит упоминание `readTelegramChannel` (через паттерн "telegram-канал")
3. Текст содержит глагол прошедшего времени "нашёл" (`result_claim`)
4. Это НЕ план (нет паттернов "могу/сейчас/давай проверю")
5. **Вердикт: галлюцинация** → текст заблокирован

### Но это НЕ галлюцинация

AI действительно вызывал deepResearch/fetchUrl/readTelegramChannel в steps 3-7. В step 8 он **пересказывает реальные результаты** предыдущих шагов. Guardian не знает контекста предыдущих шагов — он анализирует каждый step изолированно.

---

## Корневая причина: два конфликта

### Конфликт 1: Guardian не учитывает multi-step контекст

Guardian проверяет каждый step отдельно: `toolCallCount === 0` + `text mentions tool` = hallucination. Но в multi-step flow (briefing-onboarding, 30 steps) AI **законно** пересказывает результаты из предыдущих шагов.

**Ранее** был workaround для startResearch:
```typescript
// tool-call-guardian.ts, строки 410-426
if (hadStartResearch && stepToolCallCount === 0) {
  // Suppress false positive after startResearch
  result.details = result.details.filter(
    (d) => !START_RESEARCH_INTERNAL_TOOLS.has(d.toolMentioned)
  );
}
```

Этот workaround работал потому что startResearch был "зонтичным" tool call — Guardian знал, что после него AI будет упоминать внутренние инструменты. Теперь startResearch удалён, и workaround не работает.

### Конфликт 2: Промпт v10 не направляет AI к updateBriefingPreview

Текущий промпт (v10) не говорит AI чётко: "после research — сразу вызови updateBriefingPreview, не описывай результаты текстом". AI выбирает естественный путь — написать текст с результатами. Но Guardian этот текст блокирует.

---

## Варианты решения

### Вариант A: Промпт (PE задача)

В промпте v11 добавить жёсткое правило:
```
После завершения research по теме — СРАЗУ вызови updateBriefingPreview
с найденными источниками. НЕ описывай результаты текстом.
Краткий комментарий ("Нашёл 5 источников, обновляю превью") + tool call.
```

**Плюсы:** Не трогаем Guardian, AI всегда делает tool call → toolCallCount > 0 → Guardian пропускает.
**Минусы:** AI может всё равно иногда писать текст без tool call. Зависит от качества промпта.

### Вариант B: Guardian — учёт multi-step контекста

Добавить в StepTracker память о предыдущих tool calls:
```typescript
// Если в предыдущих шагах были реальные вызовы этих инструментов,
// то упоминание их результатов в текстовом шаге — НЕ галлюцинация
if (previousStepsHadToolCalls.has(toolMentioned)) {
  return { detected: false }; // Suppress false positive
}
```

**Плюсы:** Точное решение, покрывает все multi-step flows.
**Минусы:** Усложняет Guardian, может пропустить реальные галлюцинации если AI "помнит" инструменты из давних шагов.

### Вариант C: Комбинация A + B

1. Промпт v11 направляет к updateBriefingPreview (основной путь)
2. Guardian получает `previousToolCalls` Set для suppression (страховка)

---

## Данные для воспроизведения

- **Аккаунт:** vladimir@family.local (bed95407), БД очищена
- **URL:** localhost:3000/briefing/setup (create mode)
- **Сообщение:** "я AI разработчик, интересует Anthropic Claude и конкуренты"
- **Лог:** 233 chunks suppressed в step 8
- **Guardian log:**
  ```
  [Guardian:briefing-onboarding] Hallucination detected in step 8: {
    confidence: 0.7,
    toolCallCount: 0,
    details: [{
      tool: 'readTelegramChannel',
      pattern: 'result_claim',
      snippet: '| ничего`\n\nВот что нашёл по теме **🤖 AI для разработчиков**:\n\n**Официальные источники:**\n- **Anthr'
    }]
  }
  ```

---

## Файлы для контекста

| Файл | Что смотреть |
|------|-------------|
| `lib/ai/tool-call-guardian.ts` | Вся логика Guardian, особенно `createStepTracker()` и `hadStartResearch` workaround (строки 385-426) |
| `app/(chat)/api/service-chat/route.ts` | instrumentedStream с Guardian интеграцией (строки 882-1017) |
| `lib/prompts/service-chats/briefing-onboarding.md` | Текущий промпт v10, секции `<tools_usage>` и `<source_discovery>` |

---

---

## Результаты тестирования (2026-02-27)

### Тест 1: create mode, одна тема

Аккаунт vladimir@family.local, БД очищена. Пользователь сказал: одна тема — AI для разработчиков (Anthropic Claude + конкуренты), стандартный объём.

AI провёл полноценный research:
- deepResearch ×6 (Perplexity Sonar Pro, RU + EN запросы)
- fetchUrl ×8 (anthropic.com/news, simonwillison.net, platform.claude.com/docs, openai.com/news, deepmind.google/blog, RSS фиды)
- readTelegramChannel ×4 (ai_newz ✅, aioftheday ✅, habr_ai ✅, sioloshennaya — приватный)

**Проблема:** После research AI написал текстовый step с результатами ("Вот что нашёл..."), toolCallCount=0. Guardian заблокировал (233 chunks suppressed). Пользователь увидел "Запускаю поиск... Готово." — и тишина.

Guardian лог:
```
step 8: tool=readTelegramChannel, pattern=result_claim, confidence=0.7
snippet: '| ничего`\n\nВот что нашёл по теме **🤖 AI для разработчиков**:\n\n**Официальные источники:**\n- **Anthr'
→ Blocked hallucinated step (233 chunks suppressed)
```

### Тест 2: тот же диалог, пользователь пристыдил AI

Пользователь написал что AI его обманул. AI извинился и заново запустил research — на этот раз тоже реальные вызовы (deepResearch, fetchUrl, readTelegramChannel). Stream завершился нормально (145с), Guardian не сработал. Но AI всё равно **не вызвал updateBriefingPreview** — показал результаты текстом. Превью слева не обновилось.

### Вывод

1. **Этап 1 работает:** tools unified, deepResearch/fetchUrl/readTelegramChannel вызываются реально, startResearch нет
2. **Guardian false positive:** в multi-step flow AI законно пересказывает результаты предыдущих шагов, Guardian блокирует
3. **Промпт не направляет:** AI не знает что после research нужно вызвать updateBriefingPreview, а не писать текст

---

## Вопрос к архитектору

Какой вариант выбираем: A (только промпт), B (только Guardian), C (оба)?
