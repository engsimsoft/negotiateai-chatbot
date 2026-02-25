# Roadmap ТЗ-TG2: Telegram-каналы в онбординге брифинга

**Создан:** 2026-02-25
**Версия проекта:** 3.47.0 → 3.48.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 2 |
| Текущий этап | 2 (завершён) |
| Сессий (оценка) | 1 |

---

## Этап 1: Промпт v9 + tool

**Статус:** ✅ Завершён

**Цель:** Обновить промпт онбординга (v8 → v9) и подключить readTelegramChannel как tool.

**Задачи:**

- [x] **1.1** Обновить промпт `lib/prompts/service-chats/briefing-onboarding.md`:
  - Добавить секцию `<telegram_channels>` после `</source_accessibility>`, перед `<presenting_results>`
  - Адаптировать PE-контракт: заменить `fetchUrl` → `readTelegramChannel` для TG-каналов
  - sourceName формат: `"@username"` (с собачкой, без префикса)
  - Оставить `community` в tier-ах
  - Обновить edge_cases: заменить строку про Telegram-канал на ссылку к новой секции
  - Добавить целевой deepResearch запрос для TG-каналов в `<tools_usage>`
  - Обновить версию: v8 → v9

- [x] **1.2** Добавить readTelegramChannel в tools briefing-onboarding в `app/(chat)/api/service-chat/route.ts`:
  - Import readTelegramChannel
  - Добавить `tools.readTelegramChannel = readTelegramChannel;` в блок briefing-onboarding

**Файлы:**
- `lib/prompts/service-chats/briefing-onboarding.md` — обновление промпта v8 → v9
- `app/(chat)/api/service-chat/route.ts` — добавление tool (+import если нужен)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест пользователем:
  1. Create-режим `/briefing/setup`: сказать «мне интересны AI-новости» → агент вызывает deepResearch с целевым TG-запросом → находит @username → вызывает readTelegramChannel → добавляет валидные каналы в preview с иконкой 💬
  2. Edit-режим `/briefing/setup`: сказать «добавь канал @omggpt» → агент вызывает readTelegramChannel → подтверждает что канал живой → добавляет в профиль с fetchMethod: telegram_parse
  3. Генерация: после сохранения профиля с TG-источником — брифинг генерируется, контент из TG-канала включён

**Git (после валидации):**
```bash
git add lib/prompts/service-chats/briefing-onboarding.md app/(chat)/api/service-chat/route.ts
git commit -m "feat(tz-tg2): add Telegram channels to briefing onboarding (v9 prompt + tool)"
```

**Критерий готовности:** Агент онбординга находит, валидирует и добавляет TG-каналы как источники в create и edit режимах.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, версия, архив.

**Задачи:**
- [x] Обновить локальный CHANGELOG.md
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (версия 3.48.0, TZ-TG2 в завершены)
- [x] Обновить package.json: 3.47.0 → 3.48.0
- [x] ⛔ Верификация docs против кода (Правило 5):
  - [x] CLAUDE.md → пути файлов актуальны
  - [x] docs/ai-chats-map.md → модели не затронуты, изменения не нужны
- [x] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна

**Git (после валидации):**
```bash
git add -A
git commit -m "docs(tz-tg2): finalize v3.48.0 — OnboardingTelegram"
```

**Критерий готовности:** Документация обновлена, папка в архиве.
