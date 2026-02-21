# ТЗ-BF1: Привязка контента по itemId в briefing pipeline

**Приоритет:** Высокий (автор пишет вслепую — 0 из 27 полных текстов)  
**Оценка:** 1 сессия  
**Затрагивает:** `route.ts`, `briefing-filter.ts`, `briefing-author.ts`, `source-fetchers/types.ts`

---

## Проблема

`fullTextsMap` строится по `item.url` (URL страницы-источника). Фильтр (Gemini Flash) возвращает кандидатов с URL отдельных статей, которых в Map нет. Lookup всегда `undefined`. Автор (Gemini Pro) пишет статью только из `oneLinerSummary` без полного текста — качество страдает.

Причина: web/jina фетчер возвращает одну страницу-листинг как один item. Фильтр "находит" в ней отдельные новости и придумывает URL которых нет в Map.

Для RSS проблемы нет — каждая статья приходит с уникальным URL, lookup работает.

---

## Решение: привязка через itemId

Каждый RawContent получает уникальный `itemId` при сборке. Фильтр обязан вернуть `sourceItemId` кандидата. Автор делает lookup по `sourceItemId`.

---

## Что сделать

### 1. Добавить itemId в RawContent

**Файл:** `lib/briefing/source-fetchers/types.ts`

Добавить опциональное поле в интерфейс RawContent:

```ts
itemId?: string;  // Уникальный ID для lookup (присваивается в route.ts)
```

### 2. Присвоить itemId при сборке

**Файл:** `app/(chat)/api/briefing/generate/route.ts`

После сбора allItems — присвоить каждому уникальный ID:

```ts
allItems.forEach((item, i) => {
  item.itemId = `src-${i}`;
});
```

Построить fullTextsMap по itemId вместо url:

```ts
const fullTextsMap = new Map<string, RawContent>();
for (const item of allItems) {
  fullTextsMap.set(item.itemId!, item);
}
```

### 3. Передать itemId в фильтр

**Файл:** `lib/briefing/briefing-filter.ts`

В промпте фильтра — передавать кандидатов с itemId:

```
[src-0] The Race | https://the-race.com/formula-1/ | "Первые 300 символов текста..."
[src-1] Autosport | https://autosport.com/f1/news/123 | "Первые 300 символов..."
```

В Zod-схему FilteredItem добавить обязательное поле:

```ts
sourceItemId: z.string()  // itemId из входных данных, напр. "src-0"
```

В промпте явно указать: **"Поле sourceItemId — обязательно. Верни ТОЧНЫЙ itemId из квадратных скобок [src-N] того источника, из которого извлечена новость."**

### 4. Lookup по sourceItemId в авторе

**Файл:** `lib/briefing/briefing-author.ts`

Заменить lookup:

**Было:**
```ts
const full = fullTexts.get(c.url);
```

**Стало:**
```ts
const full = fullTexts.get(c.sourceItemId);
```

---

## Ключевые ограничения

- **Не менять структуру pipeline** — только добавить поле и изменить ключ Map
- **Не дофетчивать отдельные статьи** — это отдельный этап, не сейчас
- **RSS items** — тоже получат itemId, lookup будет работать одинаково для всех типов
- **Обратная совместимость** — `itemId` опционален в типе, обязателен только в runtime после присвоения в route.ts

---

## Как проверить

1. Сгенерировать брифинг с источниками разных типов (RSS + web/jina)
2. В логах или дебаге посмотреть: сколько кандидатов получили полный текст
3. **До:** 0 из ~27 (для web/jina источников)
4. **После:** ~27 из ~27 (все получают контент — либо статью, либо текст листинга)
5. Сравнить качество итоговой статьи — должна быть заметно глубже и конкретнее
