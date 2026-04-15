# ТЗ-SimplyChatModeInjection

**Источник:** Диалог с Владимиром 2026-04-15 (расследование «почему Simply Chat не направляет в Экспертизу»)
**Impact:** low-medium (чистота system prompt, не блокирующее поведение)
**Оценка:** 0.2 сессии
**Зависимости:** желательно катать вместе с **ТЗ-XAI-3 (KITT)** — там всё равно трогают маршрутизацию Simply Chat

---

## Находка

В `simply-chat.md` есть плейсхолдеры, которые должны подменяться composer.ts на актуальные значения:

```
<current_mode>chat</current_mode>
<current_model>Haiku</current_model>
```

Комментарий в файле ([simply-chat.md:14](../../lib/prompts/chat/simply-chat.md#L14)) обещает: «Инъектируется composer.ts: current_mode по chatMode, current_model по modelMap».

**Фактически подмена сломана по трём причинам** (все три в одной цепочке):

### 1. buildChatPrompt не пробрасывает chatMode

[lib/prompts/builder/index.ts:76-77](../../lib/prompts/builder/index.ts#L76-L77):
```typescript
export function buildChatPrompt(context: BuildContext = {}): BuiltPrompt {
  const composed = composeChatPrompt(context);  // ← второй аргумент не передаётся
```

`composeChatPrompt` ожидает вторым аргументом `chatMode`, использует default `'chat'`.

### 2. Дефолт composer.ts использует удалённый режим

[lib/prompts/builder/composer.ts:162](../../lib/prompts/builder/composer.ts#L162):
```typescript
export function composeChatPrompt(context: BuildContext = {}, chatMode: string = 'chat'): ComposedPrompt {
```

Режим `chat` удалён в v3.86.0 (ТЗ-LegacyChatCleanup). Валидные режимы — `simply | expertise | create`.

### 3. modelMap знает только Claude-модели из эпохи до xAI/MiniMax

[lib/prompts/builder/composer.ts:179-183](../../lib/prompts/builder/composer.ts#L179-L183):
```typescript
const modelMapForDisplay: Record<string, string> = {
  chat: 'claude-haiku',
  expertise: 'claude-sonnet',
  create: 'claude-sonnet',
};
```

- Нет ключа `simply`
- Нет MiniMax / Grok — весь modelMap концептуально устарел
- Реальный резолв моделей происходит через `task-assignments.ts` + `getModel(taskId)`, этот локальный modelMap — мёртвая параллельная структура

И аналогичный второй modelMap на [composer.ts:208-212](../../lib/prompts/builder/composer.ts#L208-L212) — возвращается из `composeChatPrompt.model`, тоже устаревший.

---

## Последствия

**Что реально получает модель в system prompt Simply Chat:**
```
<current_mode>chat</current_mode>     ← должно быть `simply`
<current_model>Haiku</current_model>  ← реально MiniMax M2.7 (а после XAI-3 будет Grok 4.1 Fast)
```

Модель не читает эти теги как инструкцию поведения — это информационные маркеры для самопрезентации. Но:
- Врём модели про её собственное имя (она думает, что она Haiku, хотя она MiniMax/Grok)
- `current_mode=chat` ссылается на несуществующий режим — если где-то в инструкции будет условная логика по mode, она не сработает
- При отладке и разборе дампов system prompt можно потратить время на ложный след

Прямого влияния на «почему чат не направляет в Экспертизу» находка НЕ даёт — это отдельная история про формулировки в [simply-chat.md](../../lib/prompts/chat/simply-chat.md) и особенности instruction following у MiniMax (см. заметку ниже).

---

## Что сделать

1. **`buildChatPrompt`** — принимать `chatMode` аргументом, пробрасывать в `composeChatPrompt`:
   ```typescript
   export function buildChatPrompt(context: BuildContext = {}, chatMode: ChatMode = 'simply'): BuiltPrompt
   ```
   Обновить вызов в [chat/route.ts:591](../../app/(chat)/api/chat/route.ts#L591) — передавать реальный `chatMode`.

2. **`composeChatPrompt` дефолт** — поменять `'chat'` → `'simply'`, типизировать параметр через `ChatMode` из `chat-mode-config.ts` (не `string`).

3. **Убрать локальные modelMap из composer.ts** — `modelMapForDisplay` и нижний `modelMap`. Резолв модели — только через `getModelIdForTask(activeTaskId)` + `getModelEntry().displayName` из каталога. Это SSOT после ТЗ-1 CoreRegistry, локальные маппинги ему противоречат.

4. **Для display-имени модели** — использовать `displayName` из `model-catalog.ts`. Это автоматически даст правильные имена после ТЗ-XAI-3/4/5 (KITT → Grok 4.1 Fast, Think → Grok 4.20, и т.д.) без правок composer.

5. **Учесть вложения и «Думать»** — composer должен знать не только `chatMode`, но и финальный `taskId` (`simply-chat` / `simply-chat-think` / `simply-chat-vision`), чтобы подставлять правильное имя модели. Роут уже вычисляет `activeTaskId` на [chat/route.ts:598-608](../../app/(chat)/api/chat/route.ts#L598-L608) — передать его в `buildChatPrompt` третьим аргументом или через `BuildContext`.

---

## Почему это ложится на ТЗ-XAI-3

ТЗ-XAI-3 переключает KITT на Grok 4.1 Fast. Значит после него имя `<current_model>Haiku</current_model>` станет ещё более неправильным. Пока тихо меняем: исправление тегов ровно в тот момент, когда меняем модель.

Также ТЗ-XAI-3 всё равно будет трогать [chat/route.ts](../../app/(chat)/api/chat/route.ts) (R-6: убрать `isSimplyNonAnthropicModel`). Composer правится параллельно — одна PR, одна валидация.

---

## Отдельная заметка (НЕ часть этого ТЗ)

В том же расследовании 2026-04-15 всплыл **продуктовый вопрос**, не баг: текущая формулировка `<behavior>` и `<navigation>` в [simply-chat.md](../../lib/prompts/chat/simply-chat.md) написана как «сначала помоги, потом думай про редирект». Владимир ожидал более жёсткого роутинга на Экспертизу при запросе «качественной консультации».

Это вопрос философии продукта:
- **Сейчас:** Simply Chat = толковый ассистент, делает максимум сам + мягкая рекомендация
- **Ожидалось:** Simply Chat = диспетчер, серьёзные вопросы сразу в специализированные режимы

Решать ПОСЛЕ завершения серии Simply_xAI, когда основной чат будет на Grok (возможно, переформулировка инструкции + переоценка поведения на новой модели). Зафиксировано здесь как якорь для памяти, **отдельное ТЗ заводить не надо** до момента, когда Владимир примет решение о философии.

---

## Риски

- Low. Изменения локальные, затрагивают только генерацию system prompt. Поведение модели на уровне инструкций не меняется — меняются только информационные теги. Smoke test: проверить через /dev/models дамп system prompt Simply Chat — убедиться, что `<current_mode>simply</current_mode>` и `<current_model>` соответствует реально используемой модели.
