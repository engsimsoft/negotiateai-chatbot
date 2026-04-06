# Roadmap ТЗ-AUDIT1: Валидация токенов и стоимости

**Версия:** 1.0 | **Дата:** 2026-04-05

---

## Результат

Таблица: каждый тип AI-вызова → статус (✅ OK / ⚠️ Расхождение / ❌ Не логируется).
Список исправлений (если нужны).

---

## Этапы

---

### Этап 0: Подготовка инструментов
**Статус:** ⬜ Не начат
**Цель:** Убедиться, что у нас есть всё необходимое для точного сравнения

**Задачи:**
- [ ] Проверить что `SIMPLY_DEV_MODE=true` в `.env.local`
- [ ] Открыть `/admin/cost-audit` — убедиться что работает
- [ ] Проверить структуру таблицы `ai_usage_log` в БД (через mcp__postgres__query)
- [ ] Убедиться что Dev Panel виден под AI-ответами
- [ ] Найти в Anthropic Console раздел Usage Logs

**Валидация этапа:**
- Dev Panel отображается
- Cost Audit Dashboard открывается
- БД доступна

---

### Этап 1: Обычный чат
**Статус:** ⬜ Не начат
**Цель:** Проверить базовый чат — самый важный тип

**Задачи:**
- [ ] Отправить тестовое сообщение в обычный чат (chatMode=chat)
- [ ] Записать из Dev Panel: input, output, cache_read, cache_write токены, стоимость ₽
- [ ] Проверить в БД последнюю запись `ai_usage_log` (userId + chatMode='chat')
- [ ] Сравнить с Anthropic Console
- [ ] Зафиксировать результат в таблице расхождений (ниже)

**Что особо смотреть:**
- cache_write tokens при первом запросе (prompt caching)
- Стоимость: Dev Panel ₽ vs (costUsd × 100) из БД

**Валидация этапа:** Результат зафиксирован

---

### Этап 2: Режимы Экспертиза и Создание
**Статус:** ⬜ Не начат
**Цель:** Проверить чаты expertise и create

**Задачи:**
- [ ] Отправить сообщение в `/expertise/[id]` (chatMode=expertise)
- [ ] Отправить сообщение в `/create/[id]` (chatMode=create)
- [ ] Проверить оба в БД
- [ ] Зафиксировать результаты

**Валидация этапа:** Результаты зафиксированы

---

### Этап 3: Сервисные чаты
**Статус:** ⬜ Не начат
**Цель:** Проверить Ben, Project Creation, Project Manager

**Задачи:**
- [ ] Отправить сообщение Бену
- [ ] Проверить в БД (chatMode='service:ben')
- [ ] Отправить сообщение в сервис-чат создания проекта
- [ ] Проверить в БД (chatMode='service:project-creation')
- [ ] Отправить сообщение менеджеру проекта
- [ ] Проверить в БД (chatMode='service:project-manager')

**Валидация этапа:** Все 3 зафиксированы

---

### Этап 4: Брифинг
**Статус:** ⬜ Не начат
**Цель:** Проверить briefing pipeline (Gemini + Claude)

**Задачи:**
- [ ] Запустить генерацию брифинга
- [ ] Проверить в БД записи с chatMode='briefing:*'
- [ ] Сравнить с консолью Google AI Studio (Gemini)
- [ ] Сравнить с Anthropic Console (Claude если используется)
- [ ] Зафиксировать

**Валидация этапа:** Зафиксировано

---

### Этап 5: Meeting Recorder
**Статус:** ⬜ Не начат
**Цель:** Проверить meeting pipeline (Deepgram + Claude)

**Задачи:**
- [ ] Записать короткую встречу и обработать
- [ ] Проверить в БД (chatMode='meeting:*')
- [ ] Проверить Deepgram billing (отдельный провайдер — costUsdOverride)
- [ ] Сравнить Claude суммаризацию с Anthropic Console
- [ ] Зафиксировать

**Валидация этапа:** Зафиксировано

---

### Этап 6: Анализ расхождений + Исправления
**Статус:** ⬜ Не начат
**Цель:** Устранить найденные проблемы

**Задачи:**
- [ ] Сформировать итоговую таблицу расхождений
- [ ] Определить root cause каждого расхождения
- [ ] Исправить (если нужно): MODEL_PRICING_RUB, cache_write billing, UsageLog пробелы
- [ ] npx tsc --noEmit → 0 ошибок
- [ ] npm run build → успешен
- [ ] Повторный тест для подтверждения

**Валидация этапа:** Все расхождения устранены или задокументированы

---

## Таблица расхождений (заполняется в процессе)

| Тип вызова | chatMode | Модель | Dev Panel ₽ | БД costUsd×100 | Антропик Console | Статус | Причина расхождения |
|---|---|---|---|---|---|---|---|
| Обычный чат | chat | claude-sonnet-4-6 | — | — | — | ⬜ | — |
| Экспертиза | expertise | claude-sonnet-4-6 | — | — | — | ⬜ | — |
| Создание | create | claude-sonnet-4-6 | — | — | — | ⬜ | — |
| Бен | service:ben | — | — | — | — | ⬜ | — |
| Создание проекта | service:project-creation | — | — | — | — | ⬜ | — |
| Менеджер | service:project-manager | — | — | — | — | ⬜ | — |
| Брифинг | briefing:* | gemini/claude | — | — | — | ⬜ | — |
| Meeting | meeting:* | claude-sonnet-4-6 | — | — | — | ⬜ | — |

**Легенда:** ✅ OK (<1% расхождение) | ⚠️ Расхождение (>1%) | ❌ Не логируется | ⬜ Не проверено

---

## Файлы затронутые потенциальными исправлениями

- `lib/ai/providers.ts` — MODEL_PRICING_RUB, calculateCostRub
- `lib/ai/usage-utils.ts` — logUsage, extractUsageFields
- `lib/ai/tokenlens-catalog.ts` — calcCostUsd, calcStepCostRub
- `lib/constants/pricing.ts` — RUB_PER_USD
- `lib/briefing/briefing-pipeline.ts` — logUsage вызовы
- `lib/meeting/meeting-pipeline.ts` — logUsage вызовы
- `lib/podcast/podcast-pipeline.ts` — logUsage вызовы
