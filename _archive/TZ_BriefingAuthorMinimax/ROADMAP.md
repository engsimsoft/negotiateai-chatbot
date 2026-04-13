# Roadmap ТЗ-Briefing-1: Author Sonnet → MiniMax M2.7

**Создан:** 2026-04-08
**Версия проекта:** 3.79.0 → 3.80.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

---

## Этап 1: Замена модели и адаптация Author pipeline

**Статус:** ✅ Завершён

**Цель:** Перевести генерацию брифинга (полный + секция) с Claude Sonnet на MiniMax M2.7 с паттерном generateText + JSON.parse + Zod.

**Задачи:**

- [x] 1.0. Обновить `FILTER_MODEL` в `briefing-config.ts` → `"MiniMax-M2.7"` (дополнение: убрать геоблокировку Gemini)
- [x] 1.0a. Адаптировать `briefing-filter.ts`: убрать Google import, generateObject → generateText + JSON.parse + Zod, minimaxM27
- [x] 1.1. Обновить `AUTHOR_MODEL` в `briefing-config.ts` → `"MiniMax-M2.7"`
- [x] 1.2. Адаптировать `briefing-author.ts`:
  - Убрать `createAnthropic` import и `const anthropic`
  - Импортировать `minimaxM27` из `providers.ts`
  - Заменить `generateObject()` на `generateText()` + JSON cleanup + `briefingArticleSchema.parse()`
  - Добавить программную JSON-инструкцию + сериализованную Zod-схему в промпт
  - Установить `temperature: 0.7`
  - Убедиться что JSON.parse + Zod.parse внутри callback `retryWithLogging` (ошибки → авторетрай)
- [x] 1.3. Адаптировать `briefing-section-author.ts`:
  - Тот же паттерн: убрать Anthropic, импортировать `minimaxM27`
  - `generateObject()` → `generateText()` + JSON cleanup + `sectionSchema.parse()`
  - Программная JSON-инструкция + сериализованная Zod-схема
  - `temperature: 0.7`
- [x] 1.4. Валидация TypeScript: `npx tsc --noEmit` — 0 ошибок

**Файлы:**
- `lib/briefing/briefing-config.ts` — изменить AUTHOR_MODEL
- `lib/briefing/briefing-author.ts` — generateObject → generateText + JSON.parse + Zod
- `lib/briefing/briefing-section-author.ts` — то же самое

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест:
  1. Открыть /briefing, запустить генерацию брифинга
  2. Проверить: брифинг сгенерирован без ошибок
  3. Проверить: JSON распарсился (все секции на месте, текст на русском)
  4. Проверить: брифинг отображается корректно в UI
  5. Проверить: обновление одной секции (кнопка ↻) работает
  6. Проверить: подкаст генерируется (не сломан — он на Gemini, не затронут)
  7. Проверить в DevPanel: модель = MiniMax-M2.7, стоимость ≤ $0.04
  8. Проверить `ai_usage_log`: записи с modelId="MiniMax-M2.7", chatMode="briefing:author"

**Git (после валидации):**
```bash
git add lib/briefing/briefing-config.ts lib/briefing/briefing-author.ts lib/briefing/briefing-section-author.ts
git commit -m "feat(tz-briefing-1): Author Sonnet → MiniMax M2.7 — v3.80.0"
```

**Критерий готовности:** Брифинг генерируется MiniMax M2.7, JSON валиден, стоимость Author ≤ $0.04

---

## Этап 2: Проверка стоимости и логирования

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Убедиться что pricing, логирование и cron pipeline работают корректно с MiniMax.

**Задачи:**
- [x] 2.1. SQL-проверка `ai_usage_log` — записи с MiniMax для briefing:author и briefing:filter ✅
- [ ] 2.2. Проверить что cron pipeline (если доступен) отработает без ошибок — проверится на Vercel
- [ ] 2.3. Проверить Telegram-доставку (если настроена) — проверится на Vercel

**Валидация этапа:**
- [ ] SQL: `SELECT model_id, chat_mode, cost_rub FROM ai_usage_log WHERE chat_mode LIKE 'briefing:%' ORDER BY created_at DESC LIMIT 10`
- [ ] Стоимость Author ≤ 4 RUB (~$0.04)
- [ ] 🧪 Мануальный тест: Telegram-доставка (если настроена)

**Критерий готовности:** Логирование корректно, стоимость подтверждена

---

## Этап 3: Финализация

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2
⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) → пройти чеклист.

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (briefing-author.ts описание: MiniMax M2.7 вместо Sonnet)
- [ ] Обновить package.json → 3.80.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Нет (паттерн уже задокументирован, это повторное применение)
- [ ] docs/ai-chats-map.md → обновить (модель briefing:author)
- [ ] docs/ai-providers.md → обновить Реестр конфигураций (briefing-author.ts, briefing-section-author.ts)
- [ ] ⛔ Верификация docs против кода (Правило 5): grep models, providerOptions, temperature

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)

**Git:**
```bash
git commit -m "chore(tz-briefing-1): finalize docs + version bump — v3.80.0"
```
