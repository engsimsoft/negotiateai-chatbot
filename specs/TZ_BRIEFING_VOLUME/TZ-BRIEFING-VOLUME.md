# ТЗ: Объём брифинга (briefingVolume) + лимит контента

**Дата:** 2026-02-21  
**От:** Prompt Engineering → Архитектор  
**Приоритет:** Высокий (главная причина скупых брифингов)  
**Связано с:** ТЗ-WS1, ТЗ-WS2 (web scraping upgrade)

---

## Проблема

Брифинг выдаёт "СМСки" вместо полноценных статей. Две причины:

1. **MAX_CONTENT_LENGTH = 1000 символов** — каждый источник обрезается до ~5 предложений. Автор (Gemini 3 Pro) получает огрызки и не может написать развёрнутый текст — ему не из чего.

2. **Нет настройки объёма.** Пользователь в briefingStyle пишет «живой, длинный, интересный», но автор не знает что значит "длинный" в цифрах. У разных пользователей разные ожидания: кто-то хочет 5 минут чтения, кто-то — 20.

---

## Задача 1: Поднять MAX_CONTENT_LENGTH

**Файл:** `lib/briefing/briefing-config.ts`

```typescript
// Было:
export const MAX_CONTENT_LENGTH = 1000;

// Стало:
export const MAX_CONTENT_LENGTH = 6000;
```

6000 символов ≈ 900-1000 слов ≈ полноценная статья. Это не потолок (buildUserMessage обрезает до 12000 per candidate), но даёт автору реальный материал для работы.

**Влияние:**
- Фетчеры (RSS, Web, Telegram) будут возвращать больше текста
- Фильтр (Gemini Flash) получит больше контекста для оценки — при контексте 1М токенов это не проблема
- Автор (Gemini 3 Pro) получит в ~6 раз больше материала
- Стоимость: незначительно вырастет (больше входных токенов для фильтра и автора)

**Примечание:** в `buildUserMessage` уже стоит `truncatedContent = content.length > 12000 ? content.slice(0, 12000)` — это верхний лимит на уровне автора, он остаётся.

---

## Задача 2: Добавить поле briefingVolume

**Новое поле в briefingSettings:**

```typescript
briefingVolume: "compact" | "standard" | "detailed"
// default: "standard"
```

| Значение | Время чтения | Стиль | Для кого |
|----------|-------------|-------|----------|
| `compact` | 3-5 мин | Ключевые факты, минимум деталей | «Быстро пробежать за кофе» |
| `standard` | 8-12 мин | Факты + контекст, сбалансированно | По умолчанию |
| `detailed` | 15-25 мин | Развёрнутые разборы, аналитика, юмор | «Как хороший подкаст / журнал» |

### Где хранить

В таблице `briefingSettings` — новое поле `volume VARCHAR DEFAULT 'standard'`.

Передаётся в saveBriefingProfile через settings:

```json
{
  "settings": {
    "timezone": "Europe/Moscow",
    "language": "both",
    "maxItems": 15,
    "volume": "detailed"
  }
}
```

### Где передать автору

**Файл:** `lib/briefing/briefing-author.ts`, функция `buildUserMessage()`

Добавить в начало user message:

```typescript
const volumeLine = `Объём выпуска: ${settings.volume ?? "standard"}`;
// Вставить в userMessage рядом с language и maxItems
```

Промпт автора уже обновлён с инструкциями по интерпретации volume (см. briefing-author v4 от PE).

---

## Порядок

1. MAX_CONTENT_LENGTH → одна строка, можно прямо сейчас
2. Поле volume в БД + schema + saveBriefingProfile
3. Передача volume в buildUserMessage

Задача 1 — минутная, но даёт максимальный эффект. Задачи 2-3 — в одной сессии.
