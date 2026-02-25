# Roadmap ТЗ-TG1: Telegram Phase 1 — readTelegramChannel

**Создан:** 2026-02-25
**Версия проекта:** 3.46.0 → 3.47.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 1 |
| Сессий (оценка) | 1-2 |

---

## Этапы

### Этап 1: Shared Telegram Parser

**Статус:** ✅ Завершён

**Цель:** Создать универсальный парсер `lib/telegram/` — один парсер, два потребителя (tool + briefing)

**Задачи:**
- [x] Создать `lib/telegram/types.ts` — типы TelegramPost, TelegramParseResult, ParseTelegramOptions
- [x] Создать `lib/telegram/utils.ts` — normalizeChannelUrl, extractChannelHandle (из текущего telegram-fetcher.ts)
- [x] Создать `lib/telegram/parser.ts` — parseTelegramChannel (cheerio, hasMedia, isValid, опции)

**Файлы:**
- `lib/telegram/types.ts` — новый: TelegramPost (`text`, `date`, `url`, `hasMedia`), TelegramParseResult (`channel`, `channelUrl`, `isValid`, `posts[]`, `error?`), ParseTelegramOptions (`timeout?`, `freshnessDate?`, `maxContentLength?`, `includeMediaOnly?`, `followRedirects?`)
- `lib/telegram/utils.ts` — новый: normalizeChannelUrl (@channel / t.me/X / t.me/s/X → https://t.me/s/X), extractChannelHandle (→ X без @)
- `lib/telegram/parser.ts` — новый: parseTelegramChannel. Cheerio парсинг `.tgme_widget_message_wrap`. hasMedia через `.tgme_widget_message_photo`, `_video`, `_document`, `_sticker`, `_voice`. isValid: 302/301 = приватный, 0 постов = пустой. redirect опция через followRedirects

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: не требуется (нет UI, внутренний модуль)

**Git (после валидации):**
```bash
git add lib/telegram/
git commit -m "feat(tz-tg1): shared Telegram parser (types, utils, parser)"
```

**Критерий готовности:** Модуль `lib/telegram/` компилируется, экспортирует parseTelegramChannel

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

### Этап 2: Tool readTelegramChannel

**Статус:** ✅ Завершён

**Цель:** Создать AI-tool, обёртку над shared parser

**Задачи:**
- [x] Создать `lib/ai/tools/read-telegram-channel.ts` — tool definition (z.object schema, wrapToolExecution, timeout 15s)

**Файлы:**
- `lib/ai/tools/read-telegram-channel.ts` — новый: `readTelegramChannel = tool({...})`. Input: `channel` (string), `maxPosts` (1-50, default 50). Вызывает parseTelegramChannel, slice по maxPosts, вычисляет oldestDate/newestDate. При isValid=false возвращает error.

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: не требуется (tool ещё не зарегистрирован)

**Git (после валидации):**
```bash
git add lib/ai/tools/read-telegram-channel.ts
git commit -m "feat(tz-tg1): readTelegramChannel tool definition"
```

**Критерий готовности:** Файл tool компилируется, экспортирует readTelegramChannel

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

### Этап 3: Регистрация tool + Skill + UI config

**Статус:** ✅ Завершён

**Цель:** Tool доступен модели во всех режимах, skill загружается через loadSkill, UI показывает индикатор

**Задачи:**
- [x] Зарегистрировать tool в `lib/ai/tools/chat-tools.ts` — import, getStandardTools, ALL_TOOL_NAMES, getActiveToolNames (оба списка), НЕ в CHAT_MODE_EXCLUDED_TOOLS
- [x] Добавить UI конфиг в `lib/ai/tool-activity-config.ts` — Send icon, "Читаю Telegram-канал" / "Канал прочитан", argsFormatter (@channel), resultFormatter (N постов / Канал недоступен)
- [x] Создать `lib/prompts/skills/research/telegram-channel-reading/SKILL.md` — скопировать as-is из `specs/TZ_TG1_PeContract/telegram-channel-reading-SKILL.md`
- [x] Обновить `lib/ai/tools/load-skill.ts` — добавить `"research/telegram-channel-reading"` в AVAILABLE_SKILLS, обновить description

**Файлы:**
- `lib/ai/tools/chat-tools.ts` — MODIFY: +import, +tool в getStandardTools return, +"readTelegramChannel" в ALL_TOOL_NAMES, + в оба списка getActiveToolNames (project + base)
- `lib/ai/tool-activity-config.ts` — MODIFY: +import Send, +readTelegramChannel entry
- `lib/prompts/skills/research/telegram-channel-reading/SKILL.md` — CREATE: содержимое из specs, as-is
- `lib/ai/tools/load-skill.ts` — MODIFY: +enum entry, +строка в description

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: в чате написать "прочитай канал @durov" → спиннер "Читаю Telegram-канал", tool вызван, результат с постами
- [ ] Браузер: написать "прочитай @this_channel_does_not_exist_xyz123" → isValid=false, сообщение "канал не найден"
- [ ] Браузер: в Экспертизе написать "проанализируй канал @breakingmash" → loadSkill вызван, структурированный анализ
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/ai/tools/chat-tools.ts lib/ai/tool-activity-config.ts lib/ai/tools/load-skill.ts lib/prompts/skills/research/telegram-channel-reading/
git commit -m "feat(tz-tg1): register readTelegramChannel tool + skill + UI config"
```

**Критерий готовности:** Tool работает в чате, skill загружается, индикатор отображается

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

### Этап 4: Миграция briefing fetcher

**Статус:** ✅ Завершён

**Цель:** Briefing fetcher использует shared parser вместо inline cheerio-парсинга. Контракт FetchResult не меняется.

**Задачи:**
- [x] Переписать `lib/briefing/source-fetchers/telegram-fetcher.ts` — заменить inline парсинг на parseTelegramChannel(). Передать: timeout=FETCH_TIMEOUT_MS, freshnessDate=cutoff, maxContentLength=MAX_CONTENT_LENGTH, includeMediaOnly=false, followRedirects=true. Маппинг TelegramPost[] → RawContent[]. Удалить локальную normalizeChannelUrl (теперь в shared utils).

**Файлы:**
- `lib/briefing/source-fetchers/telegram-fetcher.ts` — REWRITE: вызов parseTelegramChannel вместо inline cheerio

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: сгенерировать брифинг с Telegram-источником → посты подтягиваются как раньше
- [ ] 🧪 Мануальный тест: регрессия briefing (пользователь генерирует выпуск)

**Git (после валидации):**
```bash
git add lib/briefing/source-fetchers/telegram-fetcher.ts
git commit -m "refactor(tz-tg1): migrate briefing fetcher to shared Telegram parser"
```

**Критерий готовности:** Briefing с TG-источниками работает идентично до миграции

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

### Этап 5: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация актуальна, проект версионирован, ТЗ в архиве

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (секция "Структура кода" + "Текущий этап")
- [x] Обновить package.json (версия 3.47.0)
- [x] Обновить docs/ai-tools.md (если существует — добавить readTelegramChannel)
- [ ] Верификация docs против кода (Правило 5)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна и верифицирована
