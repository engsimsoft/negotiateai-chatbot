# ТЗ-1: BR-AUTHOR-KIMI — миграция briefing с MiniMax на Kimi K2.6 (финал)

**Серия:** Simply_Migration · Фаза А, шаг 1
**Дата:** 2026-04-27
**Связан с:** [../SIMPLY_MIGRATION_CONCEPT.md](../SIMPLY_MIGRATION_CONCEPT.md), [../SIMPLY_BRIEFING_CONCEPT.md](../SIMPLY_BRIEFING_CONCEPT.md)

---

## Цель

Заменить MiniMax на Kimi K2.6 в трёх taskId briefing pipeline. Закрыть production silent hang (с 23.04.2026). Полностью убрать MiniMax из проекта, включая dev-панель.

## Что мигрируем

| taskId | Было | Стало |
|---|---|---|
| `briefing:author` | `MiniMax-M2.7-long` | `kimi-k2.6` |
| `briefing:section` | `MiniMax-M2.7-long` | `kimi-k2.6` |
| `briefing:podcast-script` | `MiniMax-M2.7` | `kimi-k2.6` |

`briefing:filter` уже на Grok — не трогаем. Промпты в `lib/prompts/briefing/` не трогаем (уже в Skills формате).

## Параметры подключения

- **SDK:** `@ai-sdk/moonshotai` (официальный пакет Vercel из монорепо vercel/ai). НЕ `@ai-sdk/openai-compatible` — generic обёртка не понимает специфику Moonshot, есть подтверждённые баги стриминга
- **Model id:** `kimi-k2.6`
- **Mode:** Instant (`providerOptions: { moonshotai: { thinking: { type: 'disabled' } } }`). Reasoning для длинного связного текста не нужен
- **Temperature:** 0.6, **top_p:** 0.95 (рекомендация Moonshot для Instant)
- **Timeout:** 180 секунд для всех трёх taskId (наследуется от `minimaxLong`, briefing author работает 60-120 сек)
- **API endpoint:** `https://api.moonshot.ai/v1` (default Global API, не China)
- **ENV:** `MOONSHOT_API_KEY` (уже добавлен в Vercel)

## Что удаляем

- Пакет `vercel-minimax-ai-provider` из `package.json`
- Namespaces `minimax` и `minimaxLong` в `lib/ai/registry.ts:28-46`
- Все упоминания MiniMax-моделей в catalog
- `MINIMAX_API_KEY` из ENV (если используется только для briefing)
- **MiniMax-карточку из секции LLM Providers** в панели `/dev/models`
- **Override `MiniMax-M2.7` на `simply-chat`** в dev-панели — сбросить на default (`grok-4-1-fast-non-reasoning`). Тестовый, остался от прошлых экспериментов

## Что добавляем

- Пакет `@ai-sdk/moonshotai` в `package.json`
- Namespace `moonshotai` в `lib/ai/registry.ts` с timeout 180 сек
- Регистрация модели `kimi-k2.6` в catalog через taskId-привязку (Блок 9 концепта — никаких прямых ссылок на model name из бизнес-кода)
- **Карточка `moonshotai` в LLM Providers** в `/dev/models` рядом с anthropic / minimax / xai / openrouter, с проверкой `MOONSHOT_API_KEY` (✅ set / ❌ not set)
- **Регистрация `kimi-k2.6` в dropdown «Active Model»** для трёх briefing-task'ов — позволит Владимиру переключать модель без редеплоя для будущих A/B тестов и отката
- **DEFAULT-колонка в dev-панели** для трёх briefing taskId меняется на `kimi-k2.6`
- Скрипт `scripts/test-kimi-via-registry.ts` — прогоняет три taskId на тестовом контексте, печатает время / токены / первые 500 символов вывода

## Верификация — четыре шага в любом порядке

1. **TypeScript:** `pnpm tsc --noEmit` зелёный
2. **Скрипт:** `pnpm tsx scripts/test-kimi-via-registry.ts` отрабатывает за < 180 сек на каждом taskId, возвращает осмысленный markdown
3. **Production smoke:** ручной запуск `/api/briefing/run` для тестового пользователя — статья генерится, в логах нет таймаутов
4. **Dev-панель:**
   - Открыть `/dev/models`, убедиться что `moonshotai` появился как зелёный provider
   - Карточка `minimax` в LLM Providers исчезла
   - Найти три briefing-задачи в TASK ASSIGNMENTS — DEFAULT = `kimi-k2.6`
   - Кликнуть dropdown «Active Model» для каждой — `kimi-k2.6` есть в списке кандидатов
   - На `simply-chat` нет override (default `grok-4-1-fast-non-reasoning` восстановлен)
   - Счётчик `19 overrides active` уменьшился на 1 (если override на simply-chat был активен)

## Контекст по Moonshot OpenAI compatibility

`@ai-sdk/moonshotai` уже обрабатывает корректно, но Claude Code должен знать:
- Temperature максимум 1.0 (не 2.0 как у OpenAI) — у нас 0.6, не упрёмся
- `tool_choice="required"` не поддерживается в thinking режиме — у нас тулзы в briefing не используются
- Kimi K2.6 возвращает reasoning в поле `reasoning`, не `reasoning_content`

## Что НЕ делаем в этом ТЗ

- Не трогаем `briefing:filter` (уже на Grok)
- Не редактируем промпты в `lib/prompts/briefing/`
- Не подключаем thinking mode (решение для будущей итерации, если PE попросит)
- Не пишем integration-тесты с реальным API в CI (только локальный скрипт верификации)
- Не трогаем другие override в dev-панели (кроме `simply-chat` MiniMax)
