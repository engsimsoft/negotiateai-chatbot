# Анализ ТЗ-Briefing-2: Подкаст MiniMax

## Резюме

Замена двух Gemini-компонентов подкаст-пайплайна на MiniMax:
1. Script: Gemini 2.5 Flash → M2-Her (разнообразие диалогов)
2. TTS: Gemini Flash TTS → Speech 2.8 HD (качество русского)

Побочный эффект: полное удаление Google-зависимостей из production-кода.

## Рекомендации разработчика (Код-ревью)

### Согласовано с архитектором

1. **JSON формат скрипта** вместо plain text — нужен для per-replica TTS routing
2. **Паузы `<#0.3#>`** между репликами — MiniMax поддерживает inline-паузы
3. **pLimit(4)** для параллельных TTS-вызовов внутри секции
4. **Fail без fallback** — pipeline уже обрабатывает partial failures
5. **Удаление Gemini зависимостей** — `@google/genai`, `@ai-sdk/google`, `lamejs`

### Коррекции к ТЗ (от архитектора)

- Модель TTS: `speech-2.8-hd` (не 2.6 как в исходном ТЗ)
- Pricing: $0.10/1K символов (HD)
- Voice ID: `Russian_Professional_Broadcaster_v2` (Host), `Russian_Overwhelmed_Vlogger_v1` (Expert)
- Интонационные теги: `(laughs)`, `(sighs)`, `(chuckle)`, `(humming)` — M2-Her может вставлять в реплики

## Оценка сложности

- [x] Простое (1-2 сессии)
