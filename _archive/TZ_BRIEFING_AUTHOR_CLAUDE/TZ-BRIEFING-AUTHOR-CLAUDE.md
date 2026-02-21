# ТЗ: Замена провайдера briefing-author → Claude Sonnet 4.6

**Дата:** 2026-02-21  
**От:** PE (prompt engineering)  
**Кому:** Архитектор  
**Приоритет:** Высокий  
**Причина:** Gemini 3 Pro не соблюдает volume-инструкции при generateObject. outputTokens 5104 из 32768 (15.6%) при detailed, finishReason=stop. Две итерации промпта (v4→v5) дали +26%, но это потолок. Проблема поведенческая — structured output schema зажимает генерацию.

---

## Часть 1: briefing-author — замена провайдера

Заменить провайдер генерации брифинга с Gemini 3 Pro на Claude Sonnet 4.6.

### Изменения в `briefing-author.ts`

**1. Провайдер**
```
// Было:
google('gemini-3-pro-preview')

// Стало:
anthropic('claude-sonnet-4-6')
```

**2. Параметры генерации**
```
// Было:
maxOutputTokens: dynamicMaxTokens

// Стало:
maxTokens: dynamicMaxTokens  // терминология Anthropic
```

Значения maxTokens по volume оставить как есть:
- compact: 8192
- standard: 16384
- detailed: 32768

**3. Effort (adaptive thinking)**
```
thinking: { type: "adaptive" },
effort: "medium"
```

Обоснование: briefing-author — задача контент-генерации, не сложного рассуждения. Модель читает 30 источников и пишет текст по стилевым инструкциям. `medium` даёт оптимальный баланс качества и стоимости. Thinking-токены тарифицируются как output ($15/1M) — на `high` будут лишние расходы без выигрыша в качестве.

> Важно: если Vercel AI SDK `generateObject` не поддерживает `thinking` / `effort` параметры напрямую — проверить документацию `@ai-sdk/anthropic`. Возможно потребуется передать через `providerOptions` или `headers`. Если adaptive thinking несовместим с generateObject (structured output) — убрать thinking, оставить только модель. Качество генерации и без thinking будет значительно лучше Gemini.

**4. Промпт**

Оставить `briefing-author-v5.md` без изменений. Промпт написан в формате, совместимом с Claude (XML-теги, структурированные секции).

**5. Schema / generateObject**

Проверить совместимость текущей Zod-schema с `generateObject` на провайдере `@ai-sdk/anthropic`. Vercel AI SDK поддерживает generateObject для Anthropic, но возможны нюансы:
- Вложенные массивы объектов (items внутри topics)
- Enum-значения
- Optional поля

Если schema не проходит — упростить проблемные поля, не менять структуру данных.

---

## Часть 2: briefing-onboarding — настройка effort

Онбординг уже работает на Claude Sonnet 4.6, но effort не настроен (= используется `high` по умолчанию).

Рекомендация: **оставить `high`** (или зафиксировать явно).

Обоснование: онбординг принимает решения — оценивает источники, определяет tier и fetchMethod, решает когда искать альтернативу, ведёт многошаговый диалог. Это рассуждение, effort=high оправдан.

```
// В конфиге онбординга (если есть возможность задать явно):
thinking: { type: "adaptive" },
effort: "high"
```

Если effort задаётся глобально для всех Sonnet-режимов — не менять (high по умолчанию подходит для онбординга, чата, экспертизы). Только briefing-author получает свой `medium`.

---

## Что НЕ менять

- Промпт `briefing-author-v5.md` — оставить как есть
- Структуру output (BriefingJSON schema) — оставить как есть
- Pipeline до автора (фильтрация, полные тексты, candidates) — не трогать
- Pipeline после автора (сохранение, рендер) — не трогать
- `getVolumeInstruction()` в buildUserMessage — оставить как есть (патч из `patch-buildUserMessage-volume.md`)

---

## Проверка

После внедрения — один прогон генерации с volume=detailed.

Критерии успеха:
```
[Briefing Author] model: claude-sonnet-4-6  ← подтвердить модель
[Briefing Author] outputTokens: 8000+       ← было 5104 на Gemini
[Briefing Author] finishReason: end_turn     ← терминология Anthropic (аналог stop)
[Briefing Author] Full text hit: 30/30       ← все тексты дошли
```

Если outputTokens 10000-15000 при detailed — задача закрыта.

---

## Контекст стоимости

| | Input $/1M | Output $/1M | ~Стоимость брифинга |
|---|---|---|---|
| Gemini 3 Pro | $2.00 | $12.00 | ~$0.20 (но 5K токенов — недописанный) |
| Claude Sonnet 4.6 | $3.00 | $15.00 | ~$0.45 (ожидаем 12-15K — полноценный) |

Разница ~$0.25/брифинг. С effort=medium thinking-токены минимальны, реальная стоимость ближе к $0.40.

---

## Версионирование

После внедрения: **v3.38.0** (замена провайдера — minor change).

Обновить в ИТОГ:
```
| briefing-author | v5 | v5 | Claude Sonnet 4.6 | ✅ Внедрён |
```

Строку `Gemini 3 Pro — briefing-author` убрать из списка внешних сервисов.
