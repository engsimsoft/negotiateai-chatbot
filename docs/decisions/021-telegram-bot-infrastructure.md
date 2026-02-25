# ADR 021: Telegram Bot Infrastructure

**Дата:** 2026-02-25
**Статус:** Принято

## Контекст

Для доставки брифингов в Telegram (TG4) и чтения закрытых групп (TG5) нужна инфраструктура: бот, привязка аккаунтов, webhook. Это ТЗ-TG3 — фундамент для обеих задач.

## Решение

### grammY как Telegram Bot Framework

Выбрана библиотека `grammy` вместо `telegraf` или `node-telegram-bot-api`:
- Нативный TypeScript (типы из коробки)
- Встроенный `webhookCallback("std/http")` — идеально для Next.js Route Handlers на Vercel
- Легковесный, без тяжёлой инициализации (важно для serverless cold start)
- Активная поддержка и документация

### Webhook вместо Polling

Webhook-режим вместо long polling:
- Vercel serverless — polling невозможен (нет persistent process)
- Telegram отправляет updates на наш URL — подходит под request/response модель
- Secret token в заголовке для безопасности

### Две таблицы: Connection + LinkToken

- `TelegramConnection` — постоянная связка (userId↔telegramUserId, оба unique)
- `TelegramLinkToken` — эфемерные токены (TTL 10 мин, удаляются после использования)

Разделение позволяет: cleanly отделить связку от процесса линковки, безопасно управлять TTL.

### Deep Link для привязки

Стандартный Telegram-паттерн `t.me/BotName?start={token}`:
- Безопасно (token одноразовый, с TTL)
- Не требует ввода данных от пользователя
- Работает и через кнопку, и через QR-код

### API Route вместо скрипта для setup

`/api/telegram/setup` вместо `scripts/setup-telegram-webhook.ts`:
- Можно вызвать curl-ом из любого окружения
- Удобнее при смене домена / передеплое
- Защита: `Authorization: Bearer {TELEGRAM_WEBHOOK_SECRET}`

## Причины

1. grammY — лучший DX для TypeScript + Vercel webhook
2. Deep link — стандартный, надёжный паттерн
3. Polling UI (3s / 2min) — простое MVP-решение для отслеживания линковки
4. QR-код — улучшает UX на десктопе

## Последствия

**Плюсы:**
- Простая, понятная архитектура
- Готовый фундамент для TG4 (доставка) и TG5 (чтение групп)
- Один пользователь = один Telegram (unique constraints)

**Минусы:**
- Polling для статуса линковки (можно заменить на SSE при масштабировании)
- Bot token в env — стандартный подход, но требует настройки при деплое

## Альтернативы

- **Telegraf** — отклонён: менее TypeScript-friendly, тяжелее для webhook
- **SSE вместо polling** — отклонён для MVP: сложнее, polling достаточен для ~десятков пользователей
- **Inline bot** — не нужен: бот доставляет, не ведёт диалог
