# ТЗ-HF1: Briefing PE Update

**Приоритет:** Hotfix (блокирует тестирование брифинга)  
**Версия:** → 3.33.1  
**Суть:** Обновление промптов от Prompt Engineering + новое поле `briefingStyle` в схеме данных + увеличение maxSteps.

---

## Контекст

При тестировании брифинга выявлены проблемы:
- Онбординг называл источники из памяти без вызова deepResearch
- Онбординг не вызывал updateBriefingPreview после deepResearch
- Автор не получал инструкцию КАК подавать материал по каждой теме

PE подготовил обновлённые промпты (v4 онбординга, v2 автора) и новое поле `briefingStyle` — персональная инструкция автору по каждой теме (1-3 предложения). Онбординг формирует, автор читает.

---

## Что сделать

### 1. Миграция БД — добавить `briefingStyle` в briefingTopics

Файл: `lib/db/schema.ts` → таблица `briefingTopics`

```
briefingStyle: text("briefing_style")   // nullable, 1-3 предложения
```

Сгенерировать миграцию Drizzle.

### 2. Обновить queries — прокинуть briefingStyle

Файл: `lib/db/queries.ts`

- `addBriefingTopic()` — принимает и сохраняет `briefingStyle`
- `getBriefingTopics()` — уже возвращает все поля, проверить что briefingStyle приходит

### 3. Обновить Zod-схемы в service-chat tools

Файл: `app/(chat)/api/service-chat/route.ts`

В `briefingProfileSchema` → массив `topics` → добавить поле:

```typescript
briefingStyle: z.string().optional().describe("Инструкция автору: глубина, фокус, стиль подачи по этой теме (1-3 предложения)")
```

В `saveBriefingProfile` execute → при вызове `addBriefingTopic()` передавать `briefingStyle`:

```typescript
await addBriefingTopic({
  userId,
  topicId: t.topicId,
  topicName: t.topicName,
  emoji: t.emoji,
  orderIndex: i,
  briefingStyle: t.briefingStyle ?? null,
});
```

### 4. Прокинуть briefingStyle в автора

Файл: `app/(chat)/api/briefing/generate/route.ts`

`userTopics` уже загружаются из `getBriefingTopics()` и передаются в `generateArticle()`. Убедиться что `briefingStyle` доходит до промпта автора.

Файл: `lib/briefing/briefing-author.ts`

В блок `userSettings` промпта добавить `briefingStyle` для каждой темы. Формат в промпте:

```
Темы пользователя:
- formula-1 (🏎️ Формула-1): "Техническая аналитика. Аэродинамика, шасси..."
- ai (🤖 AI): "Практическое применение в бизнесе..."
```

### 5. Заменить файлы промптов

- `lib/prompts/service-chats/briefing-onboarding.md` ← содержимое `briefing-onboarding-v4.md`
- `lib/prompts/briefing/briefing-author.md` ← содержимое `briefing-author-v2.md`

Файлы промптов приложены к задаче (в uploads).

### 6. maxSteps: 8 → 12

Файл: `app/(chat)/api/service-chat/route.ts`

Найти где задаётся `stepCountIs` для briefing-onboarding (сейчас 8), поменять на 12.

Причина: каждая тема = deepResearch + updateBriefingPreview = 2 шага. На 4+ тем 8 шагов не хватает.

### 7. Edit mode — briefingStyle в initialProfile

Файл: `app/(dashboard)/briefing/setup/page.tsx`

В edit mode при загрузке topics добавить `briefingStyle`:

```typescript
topics: topics.map((t) => ({
  topicId: t.topicId,
  topicName: t.topicName,
  emoji: t.emoji,
  briefingStyle: t.briefingStyle,  // ← добавить
})),
```

Файл: `app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx`

Добавить `briefingStyle` в интерфейс `BriefingTopic`. Опционально — показывать в превью под названием темы мелким шрифтом (если не пусто).

---

## Файлы промптов

Скопировать содержимое из uploads:
- `/mnt/user-data/uploads/briefing-onboarding-v4.md` → `lib/prompts/service-chats/briefing-onboarding.md`
- `/mnt/user-data/uploads/briefing-author-v2.md` → `lib/prompts/briefing/briefing-author.md`

---

## Не трогать

- UI страницы выпуска (article-view, sidebar) — не затронуты
- briefing-filter.ts — без изменений
- Модель онбординга — уже Claude Sonnet 4.6, менять не нужно

---

## Проверка

1. Онбординг: создать профиль с 3-4 темами → briefingStyle сохраняется в БД для каждой темы
2. Онбординг: модель не называет источники до вызова deepResearch
3. Генерация: автор получает briefingStyle и адаптирует стиль секций
4. Edit mode: при возврате на /briefing/setup briefingStyle загружается и отображается
