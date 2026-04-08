# Анализ ТЗ-SimplyToolsMinimax

## Резюме

Включить 12 из 14 стандартных инструментов для chatMode=simply (MiniMax M2.7). Убрать блокировку `isSimplyNonAnthropicModel` для tools в `route.ts`. Исключить `deepResearch` для MiniMax (дорогой), оставить его доступным при «Думать» (Sonnet).

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Все рекомендации согласованы с архитектором.

### Согласен с ТЗ
- Убрать блокировку tools для `isSimplyNonAnthropicModel` — ОК
- Исключить `deepResearch` для simply без think — ОК
- Сохранить `deepResearch` при «Думать» (Sonnet) — ОК
- webSearch включаем (бесплатный Brave, 2000/мес)

### Принятые нюансы (согласованы с архитектором)

| # | Нюанс | Решение |
|---|-------|---------|
| 1 | `stopWhen: stepCountIs(5)` отключён для MiniMax | Включить — без лимита возможен бесконечный цикл |
| 2 | Tool Call Guardian работает для all chatMode | Плюс — ловит галлюцинации MiniMax. Smoke-тест в плане |
| 3 | `getActiveToolNames` не знает про `think` | Пробросить `think` флаг в функцию |
| 4 | temperature 0.7 для MiniMax | Оставить — для tool calling даже лучше |
| 5 | `readProjectFile` не попадёт в simply (не проектный чат) | Реально 12 tools, не 13 |

## Потенциальные риски

1. **MiniMax tool calling quality** — модель может формировать некорректные параметры. Mitigation: Guardian + smoke-тест всех 12 tools
2. **Стоимость webSearch** — 2000 запросов/мес бесплатно. Если MiniMax злоупотребляет — увидим в логах
3. **Guardian false positives** — Guardian может ложно блокировать нормальный текст MiniMax. Mitigation: smoke-тест

## Зависимости

- Нет новых зависимостей
- Нет миграций БД
- Нет новых файлов (только правка существующих)

## Оценка сложности

- [x] Простое (1 сессия, ~30 минут кода)
