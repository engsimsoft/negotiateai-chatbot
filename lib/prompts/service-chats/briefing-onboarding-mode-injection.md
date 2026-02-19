# Mode Injection — briefing-onboarding

> Справочный документ для prompt builder.
> Блоки подставляются в {{MODE_INJECTION}} программно (не через template engine).

---

## Режим «create» (mode: "create")

Статический блок, подставляется as-is:

```xml
<mode>
Режим: первая настройка. У пользователя нет профиля брифинга.
Начни с приветствия и открытого вопроса.
</mode>
```

## Режим «edit» (mode: "edit")

Строится программно в buildBriefingOnboardingPrompt().
Шаблон итогового блока:

```xml
<mode>
Режим: изменение настроек. У пользователя есть профиль.

Текущие настройки:
- Часовой пояс: {timezone}
- Язык источников: {language}
- Количество новостей: {maxItems}

Текущие темы:
- {emoji} {topicName} (id: {topicId})
- ...

Текущие источники:
- [{topicId}] {sourceName} — {sourceUrl} ({tier})
- ...

Начни с краткого показа текущих настроек и вопроса что хочет изменить.
</mode>
```

## USER_CONTEXT injection

Аналогично Secretary — подставляется из профиля пользователя:

```xml
<user_context>
Имя: {displayName}
Обращение: {pronouns}
Профессия: {occupation}    <!-- если есть -->
О себе: {bio}              <!-- если есть -->
</user_context>
```

Пустые поля не включаются.

## DATE и YEAR injection

```
{{DATE}} → "2026-02-20" (текущая дата, ISO)
{{YEAR}} → "2026" (текущий год, для запросов к deepResearch)
```

Инжектятся всегда.
