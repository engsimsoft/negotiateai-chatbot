# ADR 043: MiniMax M2.7 + маршрутизация модели для Simply Chat

**Дата:** 2026-04-08
**Статус:** Принято

## Контекст

Simply Chat использовал Claude Haiku (Anthropic) для всех сообщений. Haiku не имеет встроенного reasoning, стоит $1/1M input, и не поддерживает vision. Нужна более дешёвая reasoning-модель для текста и vision-модель для изображений.

## Решение

Мультимодельная маршрутизация для Simply Chat по типу контента:

1. **Текст** → MiniMax M2.7 ($0.30/1M input, reasoning встроенный)
2. **Изображения/PDF** → Gemini 3 Flash Preview (vision)
3. **Кнопка «Думать»** → Claude Sonnet (глубокий анализ)

Модели создаются напрямую (`minimax()` / `google()`) вместо добавления в `myProvider`, чтобы не смешивать три провайдера в одном `customProvider`.

## Причины

1. **Стоимость:** MiniMax M2.7 в 3× дешевле Haiku ($0.30 vs $1.00 за 1M input)
2. **Reasoning:** MiniMax M2.7 — reasoning-модель, Haiku — нет
3. **Vision:** Отдельная vision-модель (Gemini) вместо отправки всего в один API
4. **Провайдер-агностичность:** Нет зависимости от Anthropic для основного чата

## Последствия

**Плюсы:**
- Экономия ~70% на input токенах для текста
- Встроенный reasoning без дополнительной настройки
- Vision-обработка через специализированную модель

**Минусы:**
- Anthropic-specific фичи (cacheControl, compaction) не работают для MiniMax/Gemini
- Три провайдера = больше env-переменных (MINIMAX_API_KEY)
- Контекстное окно MiniMax (204K) меньше чем у Claude (1M)

## Альтернативы

1. **Оставить Haiku** — дороже, нет reasoning, нет vision
2. **Добавить в myProvider** — риск несовместимости при смешивании провайдеров в customProvider
3. **Gemini для всего** — нет Anthropic Compaction для expertise/create, смена провайдера для всех режимов
