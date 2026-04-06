# Передача сессии ТЗ-AUDIT1

**Дата:** 2026-04-05
**Сессия:** 1 (финальная)
**Статус:** ✅ Завершено — заменено на **TZ_TOKENS1_SdkNativeUsage**

---

## Итог

Фаза обнаружения багов завершена. Выявлено 3 бага в системе расчёта стоимости:

1. **Отсутствие cacheWrite в формуле** — 25% надбавка за cache creation не биллилась (добавлено в середине сессии)
2. **Ручная субтракция `inputTokens - cacheRead - cacheWrite`** — хрупкая формула, зависящая от семантики `usage.inputTokens`, которая у разных провайдеров отличается
3. **TokenLens additive formula** — библиотека прибавляет стоимость cache_read *поверх* full input price, а не заменяет его со скидкой 0.1× (bypassed, но решение неустойчивое)

## Root cause

Используется самопальный расчёт вместо стандартного AI SDK v6 API. SDK уже предоставляет готовые раздельные поля `inputTokenDetails.noCacheTokens/cacheReadTokens/cacheWriteTokens`, которые соответствуют Anthropic billing model.

## Решение

Создан **TZ_TOKENS1_SdkNativeUsage** — полный рефакторинг на SDK native usage API. Breaking change в `TokenUsageForPricing`, компилятор найдёт всех callers.

## Что перенесено в TZ_TOKENS1

- **Валидационный фреймворк** (7 типов чатов × 3 запроса → сверка с Anthropic Console) — стал Этапом "Валидация" в TZ_TOKENS1
- **Таблица расхождений** — стала финальным артефактом TZ_TOKENS1

## Следующий шаг

Работать по `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md`.
