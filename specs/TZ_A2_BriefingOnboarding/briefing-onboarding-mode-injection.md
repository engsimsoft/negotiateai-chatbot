# Mode Injection Templates — briefing-onboarding

**Для архитектора:** Эти блоки подставляются в `{{MODE_INJECTION}}` в system prompt в зависимости от режима.

---

## Режим «create» (mode: "create")

```xml
<mode>
Режим: первая настройка. У пользователя нет профиля брифинга.
Начни с приветствия и открытого вопроса.
</mode>
```

## Режим «edit» (mode: "edit")

```xml
<mode>
Режим: изменение настроек. У пользователя есть профиль.

Текущие настройки:
- Часовой пояс: {{TIMEZONE}}
- Язык источников: {{LANGUAGE}}
- Количество новостей: {{MAX_ITEMS}}

Текущие темы:
{{#each currentTopics}}
- {{emoji}} {{topicName}} (id: {{topicId}})
{{/each}}

Текущие источники:
{{#each currentSources}}
- [{{topicId}}] {{sourceName}} — {{sourceUrl}} ({{tier}})
{{/each}}

Начни с краткого показа текущих настроек и вопроса что хочет изменить.
</mode>
```

---

## USER_CONTEXT injection

Аналогично Секретарю — подставляется из профиля пользователя:

```xml
<user_context>
Имя: {{displayName}}
Обращение: {{pronouns — "ты" или "вы"}}
{{#if occupation}}Профессия: {{occupation}}{{/if}}
{{#if bio}}О себе: {{bio}}{{/if}}
</user_context>
```

Пустые поля не включаются (как у Секретаря).

---

## DATE и YEAR injection

```
{{DATE}} → "2026-02-20" (текущая дата, ISO)
{{YEAR}} → "2026" (текущий год, для запросов к deepResearch)
```

Инжектятся всегда. Без даты модель может вернуть устаревшие результаты.
