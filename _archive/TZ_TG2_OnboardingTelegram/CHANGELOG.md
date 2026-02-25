# Changelog ТЗ-TG2: Onboarding Telegram

> История изменений в рамках этого ТЗ.
> После завершения — переносится в главный CHANGELOG.md

---

## Сессия 1 — 2026-02-25

### Added
- Секция `<telegram_channels>` в промпте онбординга (v9): поиск, валидация, формат профиля, обработка @username
- Целевой deepResearch запрос для поиска Telegram-каналов в `<tools_usage>`
- Секция `## readTelegramChannel` в `<tools_usage>` промпта
- Пример TG-источника в `<output_format>` (fetchMethod: telegram_parse)
- `readTelegramChannel` как tool в briefing-onboarding (route.ts)

### Changed
- Промпт онбординга: v8 → v9
- PE-контракт: `fetchUrl` → `readTelegramChannel` для валидации TG-каналов
- sourceName формат: `"@username"` (с собачкой, без префикса "Канал")
- edge_cases: строка про Telegram-канал → ссылка на секцию `<telegram_channels>`
- Финальная верификация: добавлено упоминание readTelegramChannel

### Files
```
lib/prompts/service-chats/briefing-onboarding.md  — промпт v8 → v9
app/(chat)/api/service-chat/route.ts               — +import +tool readTelegramChannel
```
