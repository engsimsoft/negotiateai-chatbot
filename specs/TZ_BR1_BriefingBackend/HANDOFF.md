# Передача сессии ТЗ-BR1: Утренний брифинг — Backend

**Дата:** 2026-02-19
**Сессия:** 1 (анализ + планирование)

---

## Статус этапов
- [ ] Этап 1: БД + Конфигурация ← **НАЧНИ ЗДЕСЬ**
- [ ] Этап 2: Фетчеры источников
- [ ] Этап 3: AI-пайплайн
- [ ] Этап 4: API Endpoint + Seed
- [ ] Этап 5: Финализация

## Что сделано в этой сессии
- ✅ Фаза 1 (Анализ) — завершена, все вопросы закрыты
- ✅ Фаза 2 (Планирование) — ROADMAP создан, 5 этапов
- ✅ Все рекомендации согласованы с архитектором

## Следующая сессия: начни с

### 1. Прочитай рабочие документы
```
@specs/WORKFLOW.md
@specs/TZ_BR1_BriefingBackend/ROADMAP.md
@specs/TZ_BR1_BriefingBackend/TZ_BR1_BRIEFING_BACKEND.md
```

### 2. Выполняй Этап 1 по ROADMAP.md
Порядок задач:
1. `pnpm add rss-parser cheerio @mozilla/readability jsdom` + `pnpm add -D @types/jsdom`
2. 3 таблицы в `lib/db/schema.ts` (briefingSettings, briefingSources, briefingHistory)
3. `npm run db:generate` → `npm run db:migrate`
4. CRUD queries в `lib/db/queries.ts`
5. `lib/briefing/briefing-config.ts`
6. `lib/briefing/topics-catalog.ts` (10 тем × 3-5 источников, реальные RSS)

### 3. После каждой задачи: `npx tsc --noEmit`
### 4. После этапа: `npm run build` → git commit → мануальный тест

## Ключевые решения (согласованы)

| Решение | Выбор |
|---------|-------|
| Route group для API | `app/(chat)/api/briefing/` (единообразие с auth) |
| Web-фетчер | `@mozilla/readability` + `jsdom` (не наивный cheerio) |
| Gemini 3 Pro model ID | `gemini-3-pro` (подтверждён, fallback: `gemini-2.5-pro`) |
| Gemini Flash model ID | `gemini-2.0-flash` |
| Seed | Скрипт `lib/db/seed-briefing.ts` + команда `db:seed-briefing` |
| Дефолтные источники | Все 10 тем × 2 источника (~20 шт) |
| maxDuration | 60 сек в route.ts |

## Контекст кодовой базы (не перечитывать, уже изучено)

- **Gemini уже используется:** `lib/ai/vision-ocr.ts` — паттерн `createGoogleGenerativeAI` + `generateText`
- **AI SDK:** `generateObject` используется в 11 файлах (clerks, professors, pipeline)
- **Schema паттерн:** uuid PK, FK → User, timestamps — см. существующие таблицы
- **Queries паттерн:** `db.select/insert/update/delete`, `ChatSDKError` для ошибок
- **Миграции:** Drizzle Kit, файлы в `lib/db/migrations/`, последняя — `0030_drop-helper.sql`
- **Google API key:** `GOOGLE_GENERATIVE_AI_API_KEY` (уже в .env.local)

## Блокеры
- Нет
