# ТЗ-FIX1: Tool Call Guardian

**Приоритет:** КРИТИЧЕСКИЙ — блокер всех фич  
**Зависимости:** нет  
**Оценка:** средний scope  

---

## Проблема

Модель при сложных задачах описывает вызовы инструментов текстом вместо реальных tool_calls. Пользователь видит "Проверяю @channel через readTelegramChannel..." — но проверки не было. Это уничтожает доверие к продукту. Промптовые правила снижают частоту, но не устраняют — это фундаментальное свойство LLM.

## Решение

Shared middleware `lib/ai/tool-call-guardian.ts` — перехватывает streaming между моделью и клиентом. Буферизирует каждый **step** модели, валидирует, и решает: показать пользователю или retry.

## Как работает

### Детекция

После завершения каждого step проверяем текст на упоминания инструментов **без реальных tool_calls** в этом step.

Паттерны детекции (русский + английский):
- Названия tools: `deepResearch`, `fetchUrl`, `readTelegramChannel`, `webSearch`, `updateBriefingPreview`
- Глаголы-маркеры: «вызываю», «проверяю через», «использую инструмент», «запускаю поиск», «ищу через»
- Фейковый прогресс: «результат:», «найдено N источников» (без реального tool result)
- Описание tool output без tool_call: «канал живой», «RSS найден», «источник доступен» (в контексте где это невозможно знать без вызова)

Важно: НЕ срабатывать когда модель легитимно обсуждает инструменты ("я могу использовать deepResearch для поиска" — это нормально, модель описывает план). Критерий: **утверждение о результате** vs **описание возможности**.

### Реакция

```
Step завершён →
  hasToolMentions(text) AND toolCallsInStep === 0?
    НЕТ → flush step клиенту (всё ок)
    ДА → isResultClaim(text)? (утверждает о результатах, а не о планах)
      НЕТ → flush (модель описывает план — допустимо)
      ДА → ГАЛЛЮЦИНАЦИЯ ДЕТЕКТИРОВАНА:
        1. НЕ показывать текст этого step пользователю
        2. Логировать: [Guardian] Hallucination detected, step N, retry M
        3. Inject системное сообщение в контекст:
           "[SYSTEM] Ты описал результаты инструментов но не вызвал их. 
            Это недопустимо. Вызови нужный инструмент прямо сейчас. 
            Не описывай — вызови."
        4. Retry (модель получает системное сообщение → следующий step)
        5. После 2 retry → показать пользователю честное сообщение:
           "Не удалось выполнить эту операцию. Попробуйте переформулировать запрос."
```

### Архитектура

```
lib/ai/tool-call-guardian.ts
  ├── createGuardedStream(baseStream, options) → ReadableStream
  ├── detectToolHallucination(text, toolCallCount) → { detected, confidence, details }
  └── TOOL_PATTERNS — паттерны детекции (regex + keyword lists)
```

`createGuardedStream` — обёртка над `toUIMessageStream`. Принимает базовый stream от `streamText`, возвращает stream с буферизацией и валидацией по step boundaries (events `step-start` / `step-finish`).

### Интеграция

Минимальное изменение в каждом route — одна обёртка:

**service-chat/route.ts** (briefing-onboarding, project-creation, etc.):
```
// БЫЛО:
return result.toUIMessageStreamResponse();

// СТАЛО:
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    const baseStream = result.toUIMessageStream({ sendReasoning: true });
    const guarded = createGuardedStream(baseStream, {
      writer,
      maxRetries: 2,
      context: 'briefing-onboarding',
      onHallucination: (details) => console.warn('[Guardian]', details),
    });
    writer.merge(guarded);
  }
});
return new Response(stream);
```

**chat/route.ts** и **task-expert/route.ts**: аналогично — обернуть `instrumentedStream` в `createGuardedStream`. У них уже есть `createUIMessageStream`, нужно только добавить guardian в pipeline.

### Конфиг

```typescript
interface GuardianOptions {
  /** dataStream writer для inject retry messages */
  writer: UIMessageStreamWriter;
  /** Максимум retry до показа ошибки пользователю (default: 2) */
  maxRetries?: number;
  /** Контекст для логирования */
  context?: string;
  /** Callback на обнаружение (мониторинг, аналитика) */
  onHallucination?: (details: HallucinationDetails) => void;
  /** Отключить guardian (dev mode, тестирование) */
  disabled?: boolean;
}
```

## Что НЕ делать

- Не буферизировать ВСЕ сообщения целиком — только по step boundaries
- Не менять промпты — это ответственность PE
- Не ловить легитимные описания планов ("я сейчас поищу через deepResearch")
- Не делать это middleware на уровне Next.js — это AI-layer logic

## Ожидаемый результат

- Пользователь **никогда** не видит фейковый прогресс
- Галлюцинация ловится и исправляется (retry) до показа пользователю
- Если retry не помогает — честное сообщение вместо бесконечного вранья
- Логирование всех срабатываний для мониторинга и анализа
- Работает для ВСЕХ routes — chat, expertise, create, service-chats, task-expert

## Тестирование

Для проверки: в briefing-onboarding попросить настроить 3-4 темы. Если модель скатывается в нарратив → Guardian ловит → retry → модель вызывает tool. В логах видно `[Guardian] Hallucination detected` и `[Guardian] Retry successful`.
