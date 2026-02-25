# Changelog ТЗ-TG3: Telegram Bot — инфраструктура

## Сессия 1 — 2026-02-25

### Added
- ANALYSIS.md — анализ ТЗ + код-ревью (5 рекомендаций, все приняты)
- ROADMAP.md — план из 6 этапов
- HANDOFF.md — документ передачи
- grammy и qrcode.react в зависимости
- TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET в .env.local
- Бот @GetSimplyBot создан через @BotFather

### Decisions
- PascalCase для таблиц (TelegramConnection, TelegramLinkToken)
- Link API в route group (chat), webhook в корне app/api/
- bigint mode "number" для telegramUserId
- API route для setup webhook (не скрипт)
- Тексты бота из telegram-bot-messages.md
- Inline URL-кнопки добавляем сразу в TG3

### Files
- package.json (+grammy, +qrcode.react)
- package-lock.json
- specs/TZ_TG3_BotInfrastructure/* (ANALYSIS, ROADMAP, CHANGELOG, HANDOFF)
