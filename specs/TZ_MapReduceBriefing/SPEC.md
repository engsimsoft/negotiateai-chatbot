# ТЗ-MapReduce: Briefing Author → Map-Reduce

**Версия:** 3.82.0
**Приоритет:** Критический (блокирует подкаст на аккаунтах с >2 тем)
**Цель:** Устранить disconnect MiniMax M2.7 при генерации брифинга с множеством тем
**Scope:** briefing-author.ts, briefing-pipeline.ts, briefing-config.ts

---

## Проблема

MiniMax M2.7 закрывает соединение при input prompt >15K tokens. Текущий Author отправляет ВСЕ кандидаты (25-30) в один вызов → ~16-20K tokens → `AI_APICallError: other side closed`.

С 1-2 темами работает стабильно. С 3+ темами — disconnect.

---

## Решение: Always Map-Reduce

Заменить монолитный `generateArticle()` на Map-Reduce pipeline. **Всегда**, без условий — один путь для всех аккаунтов (1 тема или 10 тем).

### Map (параллельно, pLimit(1)):
Для каждой темы → `generateSection()` (уже существует в `briefing-section-author.ts`).
Каждый вызов: ~3-5K tokens input. M2.7 справляется стабильно.

### Reduce (один вызов):
Готовые секции → `generateIntroOutro()` (НОВАЯ функция).
Получает краткие сводки секций (~2-3K tokens) → генерирует title, intro, outro.

### Assemble (чистая функция):
Склеить sections + title + intro + outro + вычислить meta.

---

## Архитектура

```
candidates[25] → groupByTopic() → { f1: [8], crypto: [7], ai: [6], macro: [4] }
                                     │         │         │         │
                              pLimit(1) последовательно
                                     │         │         │         │
                                section1   section2   section3   section4
                                     │         │         │         │
                                     └─────────┴─────────┴────────┘
                                                │
                              generateIntroOutro(section summaries)
                                                │
                              assembleBriefingArticle()
                                                │
                                          BriefingArticle
```

---

## Что сделать

### 1. Новая функция `generateArticleMapReduce()` в briefing-author.ts

Оркестратор:
1. `groupCandidatesByTopic(candidates, userTopics)` — разбить кандидатов по topicId
2. Для каждой темы с кандидатами → `generateSection()` (существующая функция)
3. `generateIntroOutro(sections, volume, date)` → title, intro, outro
4. `assembleBriefingArticle(title, intro, sections, outro)` → BriefingArticle + meta

### 2. Новая функция `generateIntroOutro()`

Лёгкий вызов M2.7 (~2K tokens input):
- Получает: краткие сводки секций (topicName, emoji, newsCount, первые 150 символов content)
- Генерирует: title, intro, outro
- JSON output, Zod validation, retry

### 3. Заменить вызов в briefing-pipeline.ts

Строка ~269: `generateArticle()` → `generateArticleMapReduce()`

### 4. Partial failure handling

`Promise.allSettled` — если одна тема упала, остальные выживают.
Частичный брифинг лучше чем "Попробуйте позже".

---

## Что НЕ менять

- `generateSection()` в briefing-section-author.ts — уже работает, не трогать
- briefing-filter.ts — без изменений
- Podcast pipeline — без изменений
- UI — без изменений (формат BriefingArticle тот же)

---

## Стоимость

| Компонент | Монолит (было) | Map-Reduce (стало) |
|-----------|---------------|-------------------|
| Author (1 вызов, 16-20K) | ~$0.006 | — |
| Sections (4 × 3-5K) | — | ~$0.006-0.008 |
| Intro/Outro (1 × 2K) | — | ~$0.001 |
| **Итого** | **~$0.006** | **~$0.007-0.009** |

Разница минимальна. Надёжность — 100%.

---

## Тестовый план

1. Аккаунт с 1 темой → Map-Reduce работает, брифинг генерируется
2. Аккаунт с 5+ темами → Map-Reduce работает, нет disconnect
3. Проверить intro/outro — связывают все темы
4. Partial failure — одна тема падает, остальные в брифинге
5. DevPanel — trace показывает per-section данные
