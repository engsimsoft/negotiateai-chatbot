# ТЗ: Включение инструментов для chatMode=simply (MiniMax M2.7)

**Версия:** 3.79.0  
**Приоритет:** Высокий  
**Scope:** route.ts — условие блокировки tools

---

## Проблема

chatMode=simply на MiniMax M2.7 — самая умная модель в Simply (Intelligence Index 50), но единственная без инструментов. Все 14 tools отключены условием `isSimplyNonAnthropicModel` в route.ts (~строка 870). KITT не может показать погоду, прочитать ссылку, создать документ.

MiniMax M2.7 полностью поддерживает tool calling через OpenAI-совместимый endpoint (подтверждено документацией MiniMax и фреймворком Mini-Agent). Tools в AI SDK — провайдер-независимые, конвертация формата автоматическая.

---

## Что сделать

### 1. Убрать полную блокировку tools для non-Anthropic моделей

В `app/(chat)/api/chat/route.ts` (~строка 870):

```typescript
// БЫЛО:
...(isSimplyNonAnthropicModel ? {} : {
    experimental_activeTools: getActiveToolNames(isProjectChat, chatMode),
    tools: getStandardTools({ ... }),
}),

// СТАЛО:
// Tools передаются для ВСЕХ моделей. Фильтрация — через CHAT_MODE_EXCLUDED_TOOLS.
...{
    experimental_activeTools: getActiveToolNames(isProjectChat, chatMode),
    tools: getStandardTools({ ... }),
},
```

### 2. Добавить `deepResearch` в исключения для simply

В `CHAT_MODE_EXCLUDED_TOOLS` (или аналогичная структура) для chatMode=simply добавить `deepResearch`. Причина: стоимость $0.02–$0.80 за вызов (Perplexity API), риск необоснованных вызовов.

Остальные tools — доступны все.

### 3. Убедиться что при «Думать» (Sonnet) deepResearch доступен

При нажатии кнопки «Думать» модель переключается на Sonnet и условие `isSimplyNonAnthropicModel` = false. В этом режиме `deepResearch` должен быть доступен (не фильтроваться). Если фильтрация привязана к chatMode, а не к модели — нужно сделать исключение: simply + think = deepResearch доступен.

---

## Что НЕ менять

- expertise, create, projects — без изменений
- briefing, service-chat — без изменений  
- Генерация артефактов — Sonnet (`artifact-model`), не зависит от модели чата
- requestSuggestions — Sonnet (`artifact-model`), не зависит от модели чата
- readDocument OCR — Gemini Vision внутри tool, MiniMax получает текст

---

## Финальная схема tools для simply

| Режим | Модель | Доступные tools | deepResearch |
|-------|--------|----------------|:---:|
| Обычный | MiniMax M2.7 | 13 из 14 | ❌ |
| Думать | Anthropic Sonnet | 14 из 14 | ✅ |

### 13 tools для MiniMax (обычный режим):

1. `getCurrentDate` — дата/время
2. `getWeather` — погода (бесплатный API)
3. `webSearch` — поиск в интернете (Brave, бесплатно)
4. `fetchUrl` — чтение веб-страницы (бесплатно)
5. `readDocument` — чтение файлов из knowledge/
6. `readTelegramChannel` — чтение Telegram-каналов
7. `createDocument` — создание артефактов (контент → Sonnet)
8. `updateDocument` — обновление артефактов (контент → Sonnet)
9. `requestSuggestions` — предложения (Sonnet внутри)
10. `parseExcel` — анализ Excel (ExcelJS серверный)
11. `loadSkill` — загрузка скиллов
12. `createSnapshot` — фиксация прогресса
13. `readProjectFile` — только в проектных чатах (если applicable)

### 1 tool исключён для MiniMax:

- `deepResearch` — Perplexity API, $0.02–$0.80/вызов. Доступен только при «Думать» (Sonnet).

---

## Тестовый план

После деплоя отправить в chatMode=simply (MiniMax M2.7) по одному сообщению. Зафиксировать результат.

| # | Сообщение | Ожидаемый tool | Проверяем |
|---|-----------|----------------|-----------|
| 1 | «Какое сегодня число и время?» | `getCurrentDate` | Дата, русский формат |
| 2 | «Какая погода в Хельсинки?» | `getWeather` | Температура, описание |
| 3 | «Найди в интернете последние новости про MiniMax AI» | `webSearch` | Результаты поиска Brave |
| 4 | «Прочитай эту страницу: https://minimax.io» | `fetchUrl` | Контент страницы |
| 5 | «Что нового в канале @durov» | `readTelegramChannel` | Посты канала |
| 6 | «Прочитай файл из моих документов» | `readDocument` | Текст файла (нужен файл в knowledge/) |
| 7 | «Создай документ "Тест MiniMax" с описанием погоды» | `createDocument` | Артефакт появляется в UI |
| 8 | «Обнови документ — добавь раздел про ветер» | `updateDocument` | Артефакт обновлён |
| 9 | «Предложи улучшения для этого документа» | `requestSuggestions` | Предложения появляются |
| 10 | «Проанализируй загруженный Excel-файл» | `parseExcel` | Структура листов (нужен xlsx) |
| 11 | «Загрузи скилл document/create-presentation» | `loadSkill` | Инструкция загружена |
| 12 | «Зафиксируй прогресс: мы протестировали все инструменты» | `createSnapshot` | Snapshot сохранён |
| 13 | [Нажать «Думать»] «Проведи глубокое исследование: тренды AI в 2026» | `deepResearch` | Результат Perplexity (Sonnet режим) |

**Критерий приёмки:** 11 из 13 tools вызваны и вернули корректный результат. Допускается что `loadSkill` и `createSnapshot` могут потребовать более явной формулировки.

**Формат отчёта — таблица:**

| # | Tool | Вызван ✅/❌ | Результат ✅/❌ | Ошибки |
|---|------|:-----------:|:-------------:|--------|
| 1 | getCurrentDate | | | |
| ... | ... | | | |

---

## Контекст для Claude Code

- MiniMax M2.7 поддерживает tool calling через OpenAI-совместимый endpoint
- Tools в AI SDK провайдер-независимые — формат конвертируется автоматически
- Артефакты генерирует Sonnet (`artifact-model`), не модель чата
- readDocument OCR → Gemini Vision внутри, модель получает текст
- Это изменение не затрагивает другие chatMode (expertise, create, projects)
