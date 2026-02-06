# ADR 011: Временный переход проектов на Gemini

**Дата:** 2026-02-05
**Статус:** Принято (временное решение)
**Связано с:** ADR 007 (приостановлен)

---

## Контекст

При тестировании чатов в проектах с прикреплёнными файлами обнаружена проблема:

**Ошибка:**
```
[Error [AI_APICallError]: Invalid file type: text/plain]
responseBody: '{"error":{"message":"Invalid file type: text/plain","code":400}}'
```

**Причина:** OpenRouter не передаёт текстовые файлы (`.txt`, `.md`) в Claude API — поддерживаются только изображения как file attachments.

**Дополнительные факторы:**
1. OpenRouter — прокси, добавляет latency (+50-200ms)
2. Наценка ~10-20% к стоимости токенов
3. Не все фичи провайдеров доступны через прокси
4. На счёте OpenRouter временно заканчиваются средства

---

## Решение

**Временно** заменить Claude (через OpenRouter) на Google Gemini для проектов:

| Уровень | Было (Claude) | Стало (Gemini) |
|---------|---------------|----------------|
| **Исполнитель** (⚡) | Claude Haiku 4.5 | Gemini 2.5 Flash |
| **Эксперт** (🎯) | Claude Sonnet 4.5 | Gemini 3 Pro |
| **Профессор** (🎓) | Claude Opus 4.5 + Pipeline | Gemini 3 Pro (без pipeline) |

**Professor Pipeline временно отключён** — код сохранён для будущего использования.

---

## Причины

1. **Ограничения OpenRouter** — не поддерживает text/plain file attachments
2. **Тестирование** — нужен стабильный провайдер для тестов
3. **Упрощение** — один провайдер (Google) проще поддерживать
4. **Экономия** — нет наценки OpenRouter, нет дополнительного API ключа

---

## Последствия

### Плюсы

- ✅ Файлы text/plain работают (Gemini поддерживает)
- ✅ Меньше latency (прямое подключение)
- ✅ Один провайдер — проще отладка
- ✅ Нет наценки OpenRouter

### Минусы

- ⚠️ Gemini может быть слабее Claude в некоторых задачах (reasoning)
- ⚠️ Professor Pipeline временно недоступен
- ⚠️ Нужно будет вернуть при переходе на production

---

## План возврата к Claude

**Когда:** При переходе на production или при необходимости premium качества

**Шаги:**
1. Подключить `@ai-sdk/anthropic` напрямую (не через OpenRouter)
2. Восстановить `model-tiers.ts` с Claude моделями
3. Включить Professor Pipeline
4. Обработать text/plain файлы — конвертировать в текст перед отправкой (код готов в `convertTextFilePartsInMessage`)
5. Обновить документацию (ADR, ai-chats-map.md)
6. Изменить статус этого ADR на "Устарело"

---

## Затронутые файлы

### Изменены:
- `lib/ai/model-tiers.ts` — модели проектов → Gemini
- `lib/ai/providers.ts` — OpenRouter закомментирован
- `app/(chat)/api/chat/route.ts` — pipeline отключён
- `docs/ai-chats-map.md` — обновлена карта моделей

### Удалены:
- `app/(chat)/api/test-anthropic/route.ts` — тестовый endpoint

### Сохранены для будущего:
- `lib/ai/professor-pipeline.ts` — pipeline логика (не удалена)
- Функции `convertTextFilePartsInMessage`, `convertTextFilesInAllMessages` — для будущего Claude

---

## Связанные документы

- [ADR 007](007-projects-claude-integration.md) — оригинальное решение (приостановлено)
- [docs/ai-chats-map.md](../ai-chats-map.md) — карта моделей
- [CHANGELOG.md](../../CHANGELOG.md) — v3.7.1

---

## История изменений

- **2026-02-05** — Документ создан (Claude Code)
