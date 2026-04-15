# ТЗ-BriefingAuthorUrlHallucination — briefing author выдумывает 82-91% URL (все модели одинаково)

**Статус:** Хвост, **High impact** (качество продуктивного output)
**Создано:** 2026-04-16 (сессия ТЗ-XAI-4 Этап 2, мануальное тестирование briefing)
**Обновлено:** 2026-04-16 — после empirical test Grok 4.20 vs MiniMax подтверждено что проблема в промпте/архитектуре, не в модели. Владимир уточнил: ранее эту роль выполняли Sonnet и Gemini — **тоже галлюцинировали URL**, именно поэтому была добавлена метрика `fabricated` как детектор hallucination в принципе (не конкретной модели).
**Источник:** Владимир + DevPanel Pipeline Trace, обнаружено в живой сессии после миграции `briefing:filter` → Grok 4.1 Fast
**Связано с:** [lib/briefing/briefing-author.ts](../../lib/briefing/briefing-author.ts), [lib/ai/pipeline-trace.ts:368-381](../../lib/ai/pipeline-trace.ts#L368-L381), [docs/decisions/030-pipeline-observability.md](../../docs/decisions/030-pipeline-observability.md)

---

## Симптом

В DevPanel Pipeline Trace для briefing generation (ТЗ-XAI-4 Этап 2 test run, 2026-04-16):

```
Pipeline Trace (briefing) — success, 3 stages, 31.0K tokens, ₽1.37, 157.6s
URLs total:     11
Verified:        1   ✅ (fetcher stage)
Fabricated:     10   🔴 (модель выдумала 10 из 11)
Modified:        0
```

**Из 11 URL в финальной статье 10 были «fabricated»** — т.е. URL, которых **не было ни в fetched данных (RSS/Telegram/Web), ни в filter output**. Модель в `author` stage сгенерировала их из ничего (URL-hallucination).

---

## Где именно происходит галлюцинация — author stage (MiniMax M2.7)

**Cost breakdown из Pipeline Trace:**

| Stage | Model | Duration | Tokens | Cost |
|---|---|---|---|---|
| fetch | — | 1.5s | — | — |
| **filter** | **grok-4-1-fast-non-reasoning** | 16.6s | 13.7K in / 1942 out | ₽0.37 (27%) |
| **author** | **MiniMax-M2.7** | 137.3s | 9220 in / 6065 out | ₽1.00 (73%) |

**Grok filter** сделал свою работу корректно: 46 items → 14 items (отфильтровал 32, pipeline trace: `Data flow 46 → 14 (-32)`). Filter **не генерирует URL**, он только пропускает/отбрасывает. SQL подтверждает штатную работу filter taskId после миграции ТЗ-XAI-4 (`grok-4-1-fast-non-reasoning / xai`, $0.0037, 16.6s).

**MiniMax author** получил 14 реальных items с реальными URL, но в финальной статье **вставил 10 фейковых URL поверх**. Это URL-hallucination в author stage, не регрессия filter.

---

## Классификация URL — из кода

[lib/ai/pipeline-trace.ts:368-381](../../lib/ai/pipeline-trace.ts#L368):

```ts
function classifyUrl(
  url: string,
  sectionTopicId: string,
  fetchedUrls: Set<string>,
  filterOutputUrls?: Set<string>,
): UrlCheck {
  if (fetchedUrls.has(url)) {
    return { url, foundInSources: true, sourceStage: "fetcher" };   // verified
  }
  if (filterOutputUrls?.has(url)) {
    return { url, foundInSources: false, sourceStage: "filter" };    // modified
  }
  return { url, foundInSources: false, sourceStage: "fabricated" };  // fabricated
}
```

Метрика проверяет URL в `section.sources` + inline markdown links через `MARKDOWN_LINK_REGEX` в `section.content`. Если URL не найден ни в fetched, ни в filter output — он классифицируется как fabricated.

---

## Почему это критично

1. **Сломанный пользовательский output.** Пользователь briefing получает статью с фейковыми ссылками. Клик → 404 или ещё хуже — ведёт на выдуманный/непохожий ресурс.
2. **91% fabrication rate (10/11)** — это не случайный сбой, это **systematic behavior модели** в данной задаче.
3. **Подрывает доверие к продукту.** Briefing — одна из premium фич Simply. Если ссылки в нём выдуманы — это катастрофично для репутации.
4. **Скрыто от пользователя.** Без DevPanel Pipeline Trace метрики пользователь не видит что именно фейково — URL выглядят правдоподобно (`example.com/article-about-xai`). Только клик раскрывает обман.

---

## Empirical Evidence — модели не помогают, проблема в промпте/архитектуре

**Исторический контекст (Владимир 2026-04-16):** Pipeline Trace метрика `fabricated` была добавлена в проект **специально** потому что **Sonnet и Gemini** (предыдущие модели в этой роли) **тоже галлюцинировали URL**. Метрика — не детектор «проблем MiniMax», а детектор **фундаментальной проблемы URL attribution в structured generation** независимо от модели.

**Empirical test в сессии ТЗ-XAI-4 Этапа 2 (2026-04-16):**

После hot-fix briefing routes (import `model-overrides-node` в generate/refresh-section/cron) и установки override `briefing:author` → `grok-4.20-0309-non-reasoning` через `/dev/models`, запущены 2 briefing runs на одинаковом профиле:

| Run | Модель author | Duration | Cost | Input/Output | **Fabricated** |
|---|---|---|---|---|---|
| 19:06:10 | MiniMax-M2.7 | 137.3s | $0.010 | 9220/6065 | **10/11 (91%)** |
| 19:16:43 | **Grok 4.20 non-reasoning** | **15.6s** | **$0.044** | 14117/2679 | **9/11 (82%)** |

**Выводы из empirical теста:**

1. **Fabrication rate практически идентичен** (91% MiniMax vs 82% Grok 4.20). Marginal difference = модели не решают проблему.
2. **Grok 4.20 в 8× быстрее** MiniMax (15.6s vs 137.3s) — но это не влияет на качество URL attribution.
3. **Grok 4.20 в 4.4× дороже** MiniMax ($0.044 vs $0.010) — плохой trade-off если fabrication тот же.
4. **Суммируя 4 поколения моделей** (Sonnet → Gemini → MiniMax M2.7 → Grok 4.20):
   - Все 4 одинаково плохо справляются
   - Это **архитектурная проблема промпта и контекста**, не модели
   - Смена модели — **не решение**

---

## Корневая причина (переформулированная)

Проблема **не в выборе модели**. Проблема в:

1. **System prompt** [lib/briefing/briefing-author.ts](../../lib/briefing/briefing-author.ts) — недостаточно явно запрещает генерацию URL, не существующих в source material
2. **Presentation формата sources** — если модель видит URL только как часть длинного текста, она учится использовать их как «паттерн» и может генерировать похожие
3. **Markdown freedom** — через обычный text generation модель может вставить любую markdown-ссылку, schema не enforced
4. **Отсутствие verification loop** — fabricated URLs не блокируются на этапе генерации, только детектируются post-hoc через Pipeline Trace

---

## Исключённые гипотезы (dispelled by empirical data)

- ❌ **«Baseline MiniMax weakness»** — неверно. Grok 4.20 показывает тот же rate. Это не MiniMax-specific.
- ❌ **«Регрессия от миграции filter на Grok 4.1 Fast»** — неверно. MiniMax run 19:06:10 показал 10/11 fabricated на том же filter → проблема не в filter output.
- ❌ **«Смена модели = решение»** — неверно. Empirical показал что смена даёт marginal 9% improvement при 4× цене. Не оправдано.

---

## Acceptance criteria (что нужно сделать для закрытия ТЗ)

### Фаза 1 — Диагностика пройдена в сессии 2026-04-16 ✅

- [x] Empirical test: MiniMax vs Grok 4.20 на briefing:author → rates 91% vs 82% (marginal difference)
- [x] Исключены model-specific гипотезы
- [x] Подтверждена архитектурная природа проблемы (prompt/context)

**Дополнительная диагностика, которую стоит сделать перед Фазой 2:**

- [ ] Прочитать текущий system prompt в [lib/briefing/briefing-author.ts](../../lib/briefing/briefing-author.ts) — найти блок instruction про URLs
- [ ] Посмотреть как sources подаются в prompt (как список URL отдельно, или inline в тексте, или через tool-call context)
- [ ] Проанализировать несколько fabricated URLs — они похожи на реальные (domain+path модели догадываются) или совсем случайные?

### Фаза 2 — Выбор решения (после Фазы 1, 0.5-2 сессии в зависимости от подхода)

**Исключено (по empirical data):** миграция модели — не решение.

**Остающиеся варианты:**

**A. Prompt engineering (цель: сделать честность первым требованием)**
- Добавить в system prompt **явное правило с примером**:
  > **Правило URL attribution:** Используй ТОЛЬКО URL из блока `<sources>`. Никогда не генерируй новые URL. Если нужна ссылка на источник, которого нет в sources — **опусти её** (напиши «(источник)» без ссылки, или не упоминай этот факт вообще). Придуманные URL → статья блокируется как галлюцинация.
- Переранжировать sections — чтобы верное attribution было в top-3 приоритетов
- Добавить few-shot examples с правильным и неправильным использованием URL
- Тест на 3 runs → сравнить fabrication rate
- **Стоимость: 0.5-1 сессия**
- **Риск:** может не помочь — модели часто игнорируют negative constraints в длинных промптах

**B. Structured output через `generateObject` + Zod schema (самый надёжный)**
- Refactor [briefing-author.ts](../../lib/briefing/briefing-author.ts) с `streamText` на `generateObject`
- Schema:
  ```ts
  z.object({
    sections: z.array(z.object({
      topicId: z.string(),
      title: z.string(),
      content: z.string(),   // без markdown ссылок
      sources: z.array(z.object({
        url: z.enum([...allowedUrlsFromFilter]),  // enum ограничен!
        snippet: z.string(),
      })),
    })),
  })
  ```
- **Ключевой приём:** URL как `z.enum([...allowedUrls])` — модель физически не может сгенерировать URL вне списка (Zod валидация на стороне AI SDK)
- Плюс — контент и ссылки разделены, нельзя контрабандой вставить fake URL в текст
- **Стоимость: 1-2 сессии**
- **Риск:** дешёвые модели могут не справиться с сложной schema, потребуется модель с сильным structured output (Sonnet или Grok 4.20)
- **Это правильный long-term fix.**

**C. Post-generation URL validation + replacement (быстрый tactical fix)**
- После генерации статьи пройтись по всем URL через `classifyUrl()` (уже существует в [pipeline-trace.ts](../../lib/ai/pipeline-trace.ts))
- Fabricated URLs → удалить из статьи или заменить на `<source removed for hallucination>`
- Или — простая стратегия: если больше N% fabricated → отклонить весь run и retry
- **Стоимость: 0.5 сессии**
- **Риск:** не решает, только прячет. Статья становится менее информативной.
- **Хорошо как временное решение пока B не готов.**

**D. Hybrid: prompt (A) + post-validation (C) одновременно**
- Быстрый фикс с сразу двумя слоями защиты
- **Стоимость: 1 сессия**
- **Рекомендуется** как промежуточный шаг до полного structured output (B)

### Фаза 3 — Мониторинг

- [ ] Добавить alert в DevPanel или admin dashboard: если fabrication rate > N% в production briefing run → notification
- [ ] Регрессионный тест: fabrication rate должен держаться < 5% стабильно

---

## Временное решение

**Пока ТЗ не решён** — предупредить пользователей что briefing может содержать fabricated URLs. Или временно **дисейблить showing URLs** в финальной статье (показывать только текст без кликабельных ссылок).

**Не блокер production** — briefing работает, статьи генерируются. Но качество compromised.

---

## НЕ в scope ТЗ-XAI-4

Важно: этот баг **НЕ связан с миграцией моделей через ТЗ-XAI-4** (гипотеза 1 — baseline MiniMax). Даже если окажется что миграция filter сделала его хуже (гипотеза 2), корневая причина — model choice для author stage, не filter.

Решать отдельным ТЗ. Рекомендуется **до следующей production релиз брифинга**, т.к. 91% fabricated URLs — это серьёзный product quality risk.

---

## Связанный код

- [lib/briefing/briefing-author.ts](../../lib/briefing/briefing-author.ts) — author stage, где происходит galлюцинация
- [lib/briefing/briefing-filter.ts](../../lib/briefing/briefing-filter.ts) — filter stage, невиновен но может поставлять контекст
- [lib/ai/pipeline-trace.ts:290-400](../../lib/ai/pipeline-trace.ts#L290) — URL verification logic (detector)
- [components/dev-panel/pipeline-trace-drawer.tsx](../../components/dev-panel/pipeline-trace-drawer.tsx) — UI отображение метрики (где Владимир увидел 10/11)
- [lib/prompts/](../../lib/prompts/) — system prompt для briefing author (для фазы 2A)
