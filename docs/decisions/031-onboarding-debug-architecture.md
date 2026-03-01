# ADR 031: Onboarding Debug Architecture

**Дата:** 2026-03-01
**Статус:** Принято
**ТЗ:** DEV3 (v3.59.0)

## Контекст

Developer Panel (ADR 029, v3.57.0) покрывает основной чат через `DataStreamContext` и data-stream events. Онбординг брифинга (`/briefing/setup`) использует принципиально другую систему: `service-chat` с `useChat` хуком (Vercel AI SDK `useChat`, не `useDataStream`). Это означало, что весь отладочный слой DEV1 был недоступен в онбординге.

Проблема: при настройке брифинга через онбординг происходят многошаговые AI-запросы с tool calls (deepResearch, fetchUrl, readTelegramChannel, updateBriefingPreview), но разработчик не видит ни токенов, ни стоимости, ни деталей tool calls — только финальный ответ.

## Решение

Отдельный хук `useOnboardingDebug` + переиспользование существующих компонентов DevPanel с адаптированной логикой накопления данных.

### Архитектура

```
Server (api/service-chat/route.ts)
  → emitDebugStep() / emitDebugFinish() / emitDebugGuardian() / emitDebugPrompt()
  → standard data-stream events (без изменений)

Client (briefing-setup-client.tsx)
  → useChat({ onData: handleData })
      └── useOnboardingDebug(handleData)
            ├── накапливает DebugStepData / DebugFinishData / DebugGuardianData / DebugPromptData
            ├── сохраняет в localStorage на каждом finish
            ├── восстанавливает из localStorage при init
            └── возвращает { debugData, setDebugData }

DevPanelFooter / DevPanelDrawer
  → получают debugData как prop (те же компоненты, что в основном чате)
```

### Ключевые решения

1. **Отдельный хук вместо расширения DevPanelProvider** — DevPanelProvider завязан на `DataStreamContext` (`useDataStream`). Использование `useChat`'s `onData` callback в онбординге требует другой точки интеграции. Вынос в отдельный `useOnboardingDebug` сохраняет существующий Provider нетронутым и избегает coupling между двумя независимыми системами.

2. **Умная обрезка tool results (`truncateToolResultSmart()`)** — tool results из research/fetch могут весить десятки KB. Вместо полной передачи через SSE stream или полного отбрасывания создана функция умной обрезки: сохраняет структурные/метаданные поля (`rssUrl`, `source`, `isValid`, `title`, `tier`, `fetchMethod`, `postCount`) и обрезает контентные поля до 200 символов. Это позволяет секции Tools в Drawer отображать структурированную информацию без перегрузки потока.

3. **localStorage persistence** — онбординг — многошаговый flow, пользователь может перезагрузить страницу. Debug данные сохраняются в `localStorage` при каждом finish event и восстанавливаются при init хука. Ключ: `simply-dev-onboarding-debug`. Позволяет post-mortem анализ без повторной генерации.

4. **Исправление расчёта стоимости для многошаговых запросов** — обнаружена ошибка: AI SDK's `onFinish.usage` сообщает накопленные токены ПОСЛЕДНЕГО шага, а не сумму всех шагов. Для многошаговых запросов (с tool calls) каждый шаг — отдельный API-вызов. Реальная стоимость = сумма стоимостей всех шагов. Исправление применено в Footer, TokensSection и CostBreakdownSection: аккумулируем `stepCostRub` из каждого `debug-step` event вместо пересчёта из финальных токенов. Reasoning tokens (adaptive thinking) тарифицируются по ставке output tokens.

5. **AI SDK v5 именование полей** — в AI SDK v5 поля переименованы: `toolCalls[].args` → `toolCalls[].input`, `toolResults[].result` → `toolResults[].output`. Добавлен fallback: `tc.input ?? tc.args` для обратной совместимости при возможном откате версии.

6. **Структурированные рендереры по типу tool** — секция Tools в Drawer рендерит специализированное представление для каждого типа инструмента:
   - `deepResearch`: query, source, postCount, tier badges
   - `fetchUrl`: url, fetchMethod, isValid, title preview
   - `readTelegramChannel`: channel handle, postCount
   - `updateBriefingPreview`: topics/sources diff, preview данные

   Клиентская детекция предупреждений (подозрительные URL, низкое postCount) не требует серверных изменений.

### Схема данных

```
useOnboardingDebug returns:
{
  debugData: {
    steps: DebugStepData[],      // per-step: model, tokens, tool calls, cost
    finish: DebugFinishData,     // total: finishReason, duration, TTFT
    guardian: DebugGuardianData, // clean/blocked/warning/bypassed
    prompt: DebugPromptData,     // system prompt preview, agent, mode
  } | null
}

DebugStepData (расширен):
{
  ...стандартные поля ADR 029...
  stepCostRub: number,           // стоимость конкретного шага (не накопленная)
}
```

## Причины

1. **Переиспользование существующих компонентов** — DevPanelFooter и DevPanelDrawer не изменялись, только расширены для приёма `debugData` как prop. Нет дублирования UI-логики.
2. **Изоляция** — `useOnboardingDebug` — самодостаточный хук, не затрагивает DevPanelProvider и основной чат.
3. **Точность стоимости** — исправление расчёта per-step cost даёт реальную стоимость многошаговых запросов, что критично для онбординга с 4-6 tool calls.
4. **Выживаемость при перезагрузке** — localStorage persistence соответствует паттерну онбординга, где пользователь может итерировать настройки.

## Последствия

**Плюсы:**
- Разработчик видит полную картину онбординга: tool calls, токены, стоимость, Guardian
- Исправление расчёта стоимости распространено на все секции DevPanel (Footer, TokensSection, CostBreakdownSection)
- Структурированные рендереры tools упрощают отладку research pipeline
- localStorage persistence позволяет анализ без повторного запуска онбординга

**Минусы:**
- Два независимых механизма сбора debug данных (DevPanelProvider для чата, useOnboardingDebug для онбординга) — синхронизация логики при изменении DebugEvent типов должна выполняться в двух местах
- localStorage не очищается автоматически — старые данные могут вводить в заблуждение при длительном использовании

## Альтернативы

1. **Расширение DevPanelProvider с опциональной поддержкой useChat** — отклонено: добавляет сложность в работающую систему, требует рефакторинга Provider для поддержки двух источников данных одновременно
2. **Передача сырых tool results без обрезки** — отклонено: research results могут быть 50-200KB, перегружают SSE поток и localStorage
3. **Отдельный API endpoint для debug данных онбординга** — отклонено: излишняя сложность, данные уже есть в data-stream events
