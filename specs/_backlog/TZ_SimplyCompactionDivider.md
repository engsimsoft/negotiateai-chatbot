# TZ_SimplyCompactionDivider

**Impact:** 🟧 medium — UX-долг текущего состояния, не масштабирования.
**Origin:** выделено из [TZ_SimplyChatUiScaling.md](TZ_SimplyChatUiScaling.md), пункт E. По решению владельца 2026-04-28 — это UX-проблема прямо сейчас (compaction уже работает, compactionIndex=155 в Simply chat'е), а не часть будущего scaling.

## Проблема

Когда модель compaction уплотняет старые сообщения в `chat.compactionSummary`, пользователь продолжает видеть эти сообщения в истории как обычно. Mental model расходится: «вижу сообщение → значит модель помнит». Реально модель видит только summary.

**Пример сейчас:** Simply chat `3353a183-37f5-498e-b461-c2e87ff65ef1`, compactionIndex=155, compactionCount=14. Сообщения 0-154 уже сжаты в summary, но в UI выглядят как обычная история. Пользователь спрашивает «как мы делали X?» (имея в виду сообщение #80) — модель не помнит.

## Предложение

В месте границы compaction (`chat.compactionIndex`) показать визуальный разделитель в UI:

```
─── Эти 154 сообщения сжаты в краткое содержание ───
     Модель помнит общий смысл, но не дословно
```

## Файлы

- `components/messages.tsx` — место рендера разделителя (между сообщением `compactionIndex-1` и `compactionIndex`)
- Возможно новый компонент `components/compaction-divider.tsx`

## Зависимости / связь

- `chat.compactionIndex` уже хранится в БД (видно в schema)
- `getMessagesByChatId` уже возвращает все сообщения в порядке создания → достаточно сравнить index с `compactionIndex` в pageprop
- Не блокирует и не блокируется TZ_SimplyChatLoadPerf или TZ_SimplyChatUiScaling

## Оценка

1 короткая сессия. UI-компонент + пропс `compactionIndex` через цепочку Page → Chat → Messages.
