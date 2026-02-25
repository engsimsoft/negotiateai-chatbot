# Передача сессии ТЗ-TG1

**Дата:** 2026-02-25
**Сессия:** 1

## Статус этапов
- [x] Этап 1: Shared Telegram Parser ✅
- [ ] Этап 2: Tool readTelegramChannel ← СЛЕДУЮЩИЙ
- [ ] Этап 3: Регистрация tool + Skill + UI config
- [ ] Этап 4: Миграция briefing fetcher
- [ ] Этап 5: Финализация

## Следующая сессия: начни с
1. Прочитать `specs/TZ_TG1_PeContract/ROADMAP.md` — Этап 2
2. Создать `lib/ai/tools/read-telegram-channel.ts` — tool definition (z.object, wrapToolExecution, timeout 15s)
3. Input: `channel` (string), `maxPosts` (1-50, default 50)
4. Вызывает `parseTelegramChannel()` из `lib/telegram/parser.ts`, slice по maxPosts, вычисляет oldestDate/newestDate
5. После Этапа 2 → Этап 3 (регистрация в chat-tools.ts, tool-activity-config.ts, load-skill.ts, размещение SKILL.md)

## Контекст
- ТЗ: PE Contract для Telegram Phase 1 — добавить tool `readTelegramChannel` для чтения публичных TG-каналов
- **Все решения согласованы:** shared parser, tool во всех режимах (включая Haiku), SKILL.md от PE as-is, briefing onboarding отложен
- Shared parser создан: `lib/telegram/` (types.ts, utils.ts, parser.ts) — компилируется, build проходит
- SKILL.md лежит готовый в `specs/TZ_TG1_PeContract/telegram-channel-reading-SKILL.md` — скопировать as-is в `lib/prompts/skills/research/telegram-channel-reading/SKILL.md`
- Существует plan-файл с детальным дизайном: `/Users/mactm/.claude/plans/jiggly-churning-melody.md`

## В процессе
- `lib/telegram/types.ts` — создан, TelegramPost + TelegramParseResult + ParseTelegramOptions
- `lib/telegram/utils.ts` — создан, normalizeChannelUrl + extractChannelHandle
- `lib/telegram/parser.ts` — создан, parseTelegramChannel (cheerio, hasMedia, isValid, конфигурируемые опции)

## Блокеры / Вопросы
- Нет
