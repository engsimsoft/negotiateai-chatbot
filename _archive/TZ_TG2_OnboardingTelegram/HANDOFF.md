# Передача сессии ТЗ-TG2: Onboarding Telegram

**Последнее обновление:** 2026-02-25
**Сессия:** 1 (финальная)

---

## Статус этапов

- [x] Фаза 1: Анализ + Код-ревью ТЗ
- [x] Фаза 2: Планирование (ROADMAP)
- [x] Фаза 3: Разработка
- [x] Фаза 4: Финализация

---

## Результат

ТЗ-TG2 завершён. Версия 3.47.0 → 3.48.0.

---

## Что сделано

### Этап 1: Промпт v9 + tool
- Обновлён промпт `briefing-onboarding.md` v8 → v9:
  - Секция `<telegram_channels>` (поиск, валидация, формат, обработка @username)
  - Целевой deepResearch запрос для TG-каналов
  - `readTelegramChannel` в `<tools_usage>`
  - sourceName: `"@username"` (с собачкой)
  - tier: `community` сохранён
  - edge_cases: ссылка на новую секцию
- Добавлен `readTelegramChannel` в tools briefing-onboarding (`route.ts`)
- Валидация: tsc ✅, build ✅, мануальный тест ✅

### Этап 2: Финализация
- CHANGELOG.md (главный) — v3.48.0 entry
- SIMPLY_STATUS.md — версия 3.48.0
- package.json — версия 3.48.0
- CLAUDE.md — версия 3.48.0, TZ-TG2 в завершены
- Папка перемещена в `_archive/`

---

## Ключевые решения

1. **readTelegramChannel вместо fetchUrl** для валидации TG-каналов — fetchUrl (Readability→Jina) возвращает мусор для t.me/s/ виджетов, readTelegramChannel использует целевой cheerio-парсер
2. **sourceName: "@username"** — компактно, иконка MessageCircle уже указывает на TG
3. **tier: community** — сохранён для TG-каналов, логичный tier

---

## Git коммиты

```
3d5bb1c feat(tz-tg2): add Telegram channels to briefing onboarding (v9 prompt + tool)
[pending] docs(tz-tg2): finalize v3.48.0 — OnboardingTelegram
```
