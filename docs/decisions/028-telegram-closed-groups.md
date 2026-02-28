# ADR 028: Telegram Closed Groups — group message ingestion

**Дата:** 2026-02-28
**Статус:** Принято

## Контекст

Публичные каналы Telegram читаются через скрейпинг (ТЗ-TG1). Но закрытые рабочие группы — основной источник оперативной информации для бизнеса. Скрейпинг туда не заходит — нужен бот.

@GetSimplyBot уже существует (ТЗ-TG3) для линковки аккаунтов и доставки брифингов. Нужно расширить его для чтения групп.

## Решение

### Архитектура: Webhook → DB → API → UI

```
Telegram Group
     │ webhook (message, my_chat_member)
     ▼
Bot Handlers (lib/telegram/bot.ts)
     │ upsertGroup, createMessage, upsertTopic
     ▼
PostgreSQL (3 таблицы)
     │
     ▼
REST API (3 endpoints, auth + ownership)
     │
     ▼
UI /groups (ListDetailPage)
```

### Таблицы

1. **TelegramGroup** — группы (telegramChatId unique, ownerUserId FK → User, isForum, isActive)
2. **TelegramGroupTopic** — топики форумов (unique по groupId+telegramTopicId)
3. **TelegramMessage** — сообщения (text, fromUserId, hasMedia, mediaType, sentAt)

### Паттерн auto-owner

При добавлении бота в группу (`my_chat_member` → status: member/administrator):
- `from.id` → найти в TelegramConnection → записать `ownerUserId`
- Если не найден → `ownerUserId = null` (бесхозная группа)

### API

- `GET /api/telegram/groups` — список с messageCount (LEFT JOIN + GROUP BY)
- `GET /api/telegram/groups/[groupId]/messages` — cursor-based pagination по sentAt + topic filter
- `DELETE /api/telegram/groups/[groupId]` — soft delete (isActive = false), сообщения сохраняются

## Причины

1. **Webhook, не polling** — бот уже на webhook, дополнительный handler на `message` для групп
2. **Отдельные таблицы** — сообщения из групп имеют другую структуру (topicId, fromUserId, hasMedia), не подходят к существующей Chat/Message_v2
3. **ownerUserId вместо shared access** — MVP: один владелец на группу (кто добавил бота). Shared доступ — отдельное ТЗ
4. **Soft delete** — `isActive = false` вместо удаления. Сообщения могут понадобиться для AI-анализа (Фаза 3)
5. **ListDetailPage** — переиспользуем существующий layout shell (как /chats, /expertise, /create)

## Последствия

**Плюсы:**
- Единый бот для всего (линковка + доставка + чтение групп)
- Готовность к AI-анализу (TG6) — данные уже в БД
- Утилитарный UI — не требует сложного дизайна

**Минусы:**
- Медиа не сохраняются (только hasMedia flag) — нужен отдельный этап
- Историю до добавления бота не получить (ограничение Bot API)
- Один владелец на группу — не покрывает multi-user сценарий

## Альтернативы

- **Userbot (MTProto)** — полный доступ к истории, но нарушает ToS Telegram, требует телефон
- **Telegram Database Library (TDLib)** — мощнее Bot API, но сложнее в деплое на serverless
- **Отдельный микросервис** — выделенный worker для ingestion, но оверинжениринг для MVP

## Связанные решения

- [ADR 020](020-telegram-integration-strategy.md) — стратегия интеграции Telegram (фазовый подход)
- [ADR 021](021-telegram-bot-infrastructure.md) — инфраструктура бота (grammY + webhook)
