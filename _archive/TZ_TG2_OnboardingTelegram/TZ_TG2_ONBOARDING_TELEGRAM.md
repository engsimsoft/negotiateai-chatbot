# ТЗ-TG2: Telegram-каналы в онбординге брифинга

**Цель:** Онбординг брифинга находит и предлагает Telegram-каналы как источники. Пользователь может добавить TG-канал вручную в edit-режиме. Закрывает Фазу 1 Telegram-интеграции.

**Зависимости:** ТЗ-TG1 ✅ (shared parser), PE-контракт briefing-onboarding v9 ✅ (готов)

---

## Что сделать

### 1. Обновить промпт онбординга (v8 → v9)

Заменить файл `lib/prompts/service-chats/briefing-onboarding.md` на новую версию v9 от PE.

Промпт v9 добавляет:
- Секцию `<telegram_channels>` — как искать, валидировать и добавлять TG-каналы
- Обновление deepResearch стратегии — отдельный целевой запрос для TG-каналов
- Обновление edge_cases

**Файл промпта v9:** Владимир предоставит готовый .md файл.

### 2. Добавить readTelegramChannel в tools онбординга

В `app/(chat)/api/service-chat/route.ts`, в блоке `briefing-onboarding` tools — добавить:

```
tools.readTelegramChannel = readTelegramChannel;
```

**Зачем:** Агент находит @username через deepResearch, затем валидирует канал через readTelegramChannel (maxPosts: 5). Если isValid: true — канал добавляется в профиль с fetchMethod: `telegram_parse`. Если false — агент сообщает что канал недоступен.

Это тот же tool что уже работает во всех режимах чата (v3.47.0). Дублировать не нужно.

### 3. Формат источника в профиле

Когда агент добавляет TG-канал через updateBriefingPreview / saveBriefingProfile:

```
{
  topicId: "...",
  sourceName: "Канал @omggpt",        // "Канал @" + handle
  sourceUrl: "https://t.me/s/omggpt", // URL веб-превью (для парсера)
  rssUrl: null,                        // TG-каналы не используют RSS в Фазе 1
  fetchMethod: "telegram_parse",       // Существующий тип
  sourceLanguage: "ru",
  tier: "community"                    // Или другой, на усмотрение агента
}
```

Инфраструктура для `telegram_parse` полностью работает: fetcher dispatch, briefing pipeline, UI-иконка (MessageCircle) в preview.

### 4. maxSteps — без изменений

Текущий `maxSteps: 30` для онбординга достаточен. readTelegramChannel быстрый (2-5 сек), добавляет 1-3 шага на валидацию каналов.

---

## Что НЕ делать

- **Не менять UI preview** — иконка MessageCircle для `telegram_parse` уже есть
- **Не менять fetcher pipeline** — `telegram_parse` уже работает в briefing generate
- **Не создавать отдельный tool валидации** — readTelegramChannel с maxPosts: 5 работает как валидатор
- **Не добавлять ручной ввод @username в UI** — в Фазе 1 каналы добавляются через диалог с агентом (и в create, и в edit режиме). Отдельная форма ввода — это Фаза 3 (каталог, TG8)

---

## Проверка

1. **Create-режим:** Сказать агенту "мне интересны AI-новости". Агент должен:
   - Вызвать deepResearch с целевым запросом для TG-каналов
   - Найти @username из результатов
   - Вызвать readTelegramChannel для валидации
   - Добавить валидные каналы в preview с иконкой TG
   - Сообщить если канал недоступен

2. **Edit-режим:** Сказать "добавь канал @omggpt". Агент должен:
   - Вызвать readTelegramChannel(@omggpt, maxPosts: 5)
   - Подтвердить что канал живой, показать о чём он
   - Добавить в профиль с fetchMethod: telegram_parse

3. **Генерация:** После сохранения профиля с TG-источником — брифинг генерируется, контент из TG-канала включается в выпуск.

---

## Объём работы

Минимальный: 1 файл промпта заменить + 1 строка в route.ts (добавить tool). Всё остальное — уже работает с v3.47.0.
