# Roadmap ТЗ-TG4b: Доставка брифинга в Telegram

**Создан:** 2026-02-27
**Версия проекта:** 3.54.0 → 3.55.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 2 |
| Сессий (оценка) | 1 |

---

## Этап 1: Модуль доставки

**Статус:** ✅ Завершён

**Цель:** Создать функцию `deliverBriefingToTelegram()` — форматирование текста + отправка через grammY + обработка ошибок.

**Задачи:**
- [x] Создать `lib/telegram/briefing-delivery.ts`:
  - [x] `formatBriefingMessage(article, timezone)` — HTML-форматирование выжимки:
    - Заголовок: `Брифинг · {день недели}, {дата}` (в таймзоне пользователя)
    - По каждой секции: `{emoji} {firstSentence(content)}` (max 7 секций)
    - Inline-кнопки: `[Читать полностью]` + `[⚙️ Настроить]`
    - Лимит: 4096 символов (обрезка по секциям)
  - [x] `deliverBriefingToTelegram({ userId, briefingId, deliveryFormat })` — основная функция:
    - Загрузить `TelegramConnection` → проверить `isActive`
    - Загрузить `BriefingHistory` → распарсить `briefingJson`
    - Отправить текст: `bot.api.sendMessage(chatId, html, { parse_mode: "HTML", reply_markup })`
    - Если формат включает аудио И `audioStatus === "ready"` → `bot.api.sendAudio(chatId, url, { caption })`
    - Return `{ success, error? }`
  - [x] Error handling:
    - 403 (Forbidden) → `{ success: false, error: "blocked" }`, логировать
    - 5xx / timeout → `{ success: false, error: "telegram_unavailable" }`
    - Нет connection / isActive=false → `{ success: false, error: "no_connection" }`

**Файлы:**
- `lib/telegram/briefing-delivery.ts` — **новый**

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен

**Git (после валидации):**
```bash
git add lib/telegram/briefing-delivery.ts
git commit -m "feat(tz-tg4b): telegram briefing delivery module"
```

**Критерий готовности:** Модуль компилируется, экспортирует `deliverBriefingToTelegram`.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

## Этап 2: Интеграция в cron

**Статус:** ✅ Завершён

**Цель:** Подключить доставку к cron pipeline: исправить `getUsersForDelivery` для daily cron + вызвать `deliverBriefingToTelegram` после генерации.

**Задачи:**
- [x] Модифицировать `getUsersForDelivery()` в `lib/db/queries.ts`:
  - Для daily cron (Hobby): возвращать ВСЕХ с `deliveryEnabled = true` без фильтрации по времени
  - Добавить комментарий: при переходе на Pro (*/15 cron) — раскомментировать фильтрацию по окну
- [x] Модифицировать `generateForUser()` в `app/api/cron/briefing/route.ts`:
  - Переименовал в `generateAndDeliver()` для ясности
  - После `updateBriefingDeliveryStatus("pending")` — вызвать `deliverBriefingToTelegram()`
  - Обернуть в try/catch — ошибка доставки не должна ломать cron
  - По результату: обновить `deliveryStatus` → `"sent"` или `"failed"`
  - Добавить комментарий-limitation: аудио из cron MVP не доставляется (podcast в waitUntil)
- [x] Timezone передаётся через `deliverBriefingToTelegram` → `getBriefingSettings` внутри модуля (не через параметр cron)

**Файлы:**
- `lib/db/queries.ts` — модификация `getUsersForDelivery`
- `app/api/cron/briefing/route.ts` — интеграция доставки

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: вызвать cron endpoint вручную (`curl`), проверить что сообщение пришло в Telegram

**Git (после валидации):**
```bash
git add lib/db/queries.ts app/api/cron/briefing/route.ts
git commit -m "feat(tz-tg4b): integrate telegram delivery into cron"
```

**Критерий готовности:** При вызове cron endpoint брифинг генерируется и отправляется в Telegram.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

## Этап 3: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (новый модуль в структуре)
- [ ] Обновить package.json → 3.55.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Нет (простая интеграция, не архитектурное решение)
- [ ] docs/architecture.md нужно обновить? → Оценить (новый модуль доставки)
- [ ] docs/ai-tools.md нужно обновить? → Нет
- [ ] docs/ai-chats-map.md нужно обновить? → Нет (модели не менялись)
- [ ] docs/ai-agents.md нужно обновить? → Нет
- [ ] docs/design-system.md нужно обновить? → Нет (нет UI)

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)
