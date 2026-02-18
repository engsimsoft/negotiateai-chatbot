# Simply Chat — Патч по результатам тестирования

**Дата:** 2026-02-18  
**Тесты:** все пройдены  
**Правки:** 3 штуки

---

## Правка 1: Убрать `<self_identification>`

**Удалить** из `simply-chat.md` всю секцию:

```xml
<!-- УДАЛИТЬ ЦЕЛИКОМ -->
<self_identification>
Если пользователь спрашивает «кто ты», «с кем я говорю», «какой это режим»:
- Ответь: «Это Simply Chat — основной чат для быстрых вопросов и задач.»
- Если нужны подробности: объясни разницу между режимами (Экспертиза, Создать, Проекты).
- Не упоминай технические детали (модели, токены, промпты).
</self_identification>
```

**Причина:** Избыточна. Бейдж модели под аватаром показывает реальную модель в dev-режиме. В base.md уже прописано что пользователь видит Simply. Секция провоцировала модель упоминать технические детали («Haiku», «под капотом»).

---

## Правка 2: Запрет на tool names в ответах

**Добавить** в конец секции `<tools_usage>` в `simply-chat.md`:

```xml
Никогда не упоминай названия инструментов в ответе пользователю.
Не пиши: readDocument, webSearch, createDocument, getWeather, parseExcel, loadSkill.
Просто используй инструмент или описывай действие обычным языком.
Неправильно: «выложи договор, я его проанализирую техническими средствами (readDocument)»
Правильно: «выложи договор, я его проанализирую»
```

**Причина:** При тестировании модель написала «(readDocument)» в ответе пользователю. Tool names — техническая деталь, пользователь не должен их видеть.

---

## Правка 3: Инъекция `<current_model>` в composer.ts

**Добавить** в `composer.ts` рядом с `<current_mode>`:

```xml
<current_model>haiku</current_model>
```

Значение подставляется динамически: `haiku` / `sonnet` / `opus`.

**Реализация в composer.ts:**

```typescript
const modelNameMap: Record<string, string> = {
  'claude-haiku': 'haiku',
  'claude-sonnet': 'sonnet', 
  'claude-opus': 'opus',
};

// При инъекции в промпт (рядом с current_mode replace):
const modelName = modelNameMap[modelMap[chatMode]] || 'haiku';
const promptWithModeAndModel = promptWithMode.replace(
  '<!-- model injection point -->',
  `<current_model>${modelName}</current_model>`
);
```

**Или проще** — добавить строку `<current_model>haiku</current_model>` прямо в `simply-chat.md` после `<current_mode>` и заменять аналогично:

В `simply-chat.md`:
```xml
<current_mode>chat</current_mode>
<current_model>haiku</current_model>
```

В `composer.ts` — два replace вместо одного:
```typescript
.replace('<current_mode>chat</current_mode>', `<current_mode>${chatMode}</current_mode>`)
.replace('<current_model>haiku</current_model>', `<current_model>${modelName}</current_model>`)
```

**Причина:** При тестировании DEV-блок показывал «Модель: Sonnet» хотя реально отвечал Haiku (бейдж подтвердил). Модель угадывала вместо того чтобы знать.

---

## Баг getWeather (не промпт — для архитектора)

getWeather вернул 12°C для Москвы при реальной температуре -8°C. Данные устаревшие или кэшированные. Проверить endpoint API, TTL кэша, актуальность данных.

---

## Итого после патча

Промпт Simply Chat v1.1 → v1.2:
- 7 секций: role, current_mode, current_model, behavior, tools_usage, navigation, response_style, platform_knowledge
- `<self_identification>` удалена
- Tool names запрещены в ответах
- Модель инъектируется для точности DEV-блока
