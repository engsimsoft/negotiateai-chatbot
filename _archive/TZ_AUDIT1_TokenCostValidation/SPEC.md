# ТЗ-AUDIT1: Валидация токенов и стоимости

**Версия:** 1.0
**Дата:** 2026-04-05
**Приоритет:** Высокий
**Автор:** Vladimir Sharandin

---

## Контекст

В проекте есть несколько уровней отображения расхода токенов и стоимости:
- **Dev Panel** (под каждым AI-ответом) — показывает токены и стоимость в ₽
- **Cost Audit Dashboard** (`/admin/cost-audit`) — агрегированная статистика по периодам
- **База данных** (таблица `UsageLog`) — сырые данные

Цель: убедиться, что цифры в приложении **совпадают** с тем, что показывает **консоль провайдера** (Anthropic Console, Google AI Studio).

---

## Цель ТЗ

Провести сквозную валидацию: **приложение → провайдер** для каждого типа AI-звонка.

Найти расхождения и устранить их.

---

## Порядок проверки (пошагово)

### Шаг 1: Обычный чат (`/chat`)
- Тип: стандартный чат (chatMode=chat)
- Модель: Claude Sonnet
- Что проверяем: input tokens, output tokens, cache read, cache write, стоимость

### Шаг 2: Чат-режим Экспертиза (`/expertise/[id]`)
- Модель: Claude Sonnet
- Что проверяем: аналогично Шагу 1

### Шаг 3: Чат-режим Создание (`/create/[id]`)
- Модель: Claude Sonnet
- Что проверяем: аналогично Шагу 1

### Шаг 4: Сервисный чат — Бен
- Тип: service-chat (assistantId=ben)
- Что проверяем: модель, токены, стоимость

### Шаг 5: Сервисный чат — Создание проекта
- Тип: service-chat (assistantId=project-creation)
- Что проверяем: аналогично

### Шаг 6: Сервисный чат — Менеджер проекта
- Тип: service-chat (assistantId=project-manager)
- Что проверяем: аналогично

### Шаг 7: Брифинг
- Тип: briefing/generate
- Что проверяем: модели фильтра (Gemini) + автора, токены, стоимость

### Шаг 8: Встречи (Meeting Recorder)
- Тип: meeting/process
- Что проверяем: Deepgram + Claude суммаризация

### Шаг 9: Cost Audit Dashboard
- Что проверяем: агрегаты совпадают с суммой по UsageLog

---

## Метод валидации

1. Открыть Dev-режим в приложении (`SIMPLY_DEV_MODE=true`)
2. Совершить AI-запрос
3. Записать цифры из Dev Panel: input/output tokens, стоимость в ₽
4. Проверить в консоли провайдера (Anthropic Console → Usage) то же самое
5. Сравнить: расхождение ≤ 1%? → OK. Больше → исследовать причину

**Расхождения могут быть вызваны:**
- Неверный курс USD→RUB
- Неверные цены за 1M токенов в `MODEL_PRICING_RUB`
- Cache tokens не учитываются / учитываются неверно
- UsageLog пишет не все звонки

---

## Ожидаемый результат

- Таблица: каждый тип чата → статус (✅ OK / ⚠️ Расхождение / ❌ Не пишется)
- Список найденных проблем
- Исправления в коде (если нужны)

---

## Затронутые файлы

- `lib/ai/providers.ts` — MODEL_PRICING_RUB, calculateCostRub, RUB_PER_USD
- `lib/ai/usage-utils.ts` — logUsage, extractUsageFields
- `lib/ai/tokenlens-catalog.ts` — calcStepCostRub
- `components/dev-panel/dev-panel-footer.tsx` — отображение стоимости
- `components/dev-panel/sections/cost-breakdown-section.tsx` — детальная разбивка
- `app/api/admin/cost-audit/route.ts` — агрегаты для dashboard
- `app/(dashboard)/admin/cost-audit/page.tsx` — UI dashboard
