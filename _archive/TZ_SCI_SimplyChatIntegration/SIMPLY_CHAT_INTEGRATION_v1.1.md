# Simply Chat — Интеграционные инструкции v1.1

**Для:** Claude Code  
**Задача:** Интегрировать промпт Simply Chat + обновлённый dev-mode  
**Зависимость:** Dashboard V2 (chatMode) — уже реализован в v3.24.0

---

## Что сделать

### 1. Создать файл промпта Simply Chat

**Путь:** `lib/prompts/chat/simply-chat.md`

Содержимое — XML-блок из `SIMPLY_CHAT_PROMPT_v1.1.md` (между тройными кавычками ```xml и ```). Только XML-контент, без markdown-обёртки, без обоснований.

### 2. Заменить dev-mode.md

**Путь:** `lib/prompts/core/dev-mode.md`

Содержимое — XML-блок из `DEV_MODE_UPDATE.md`. Заменяет текущий файл целиком.

### 3. Обновить `composeChatPrompt()` в `lib/prompts/builder/composer.ts`

Три изменения:

**A) Загрузка simply-chat.md после core blocks:**

```typescript
export function composeChatPrompt(context: BuildContext = {}, chatMode: string = 'chat'): ComposedPrompt {
  const parts: string[] = [];
  
  // Core blocks
  parts.push(getAllCoreBlocks());
  
  // Simply Chat role & behavior
  const chatPromptPath = path.join(process.cwd(), 'lib', 'prompts', 'chat', 'simply-chat.md');
  try {
    const chatPrompt = fs.readFileSync(chatPromptPath, 'utf-8').trim();
    if (chatPrompt) {
      // Inject current_mode based on chatMode parameter
      const promptWithMode = chatPrompt.replace(
        '<current_mode>chat</current_mode>',
        `<current_mode>${chatMode}</current_mode>`
      );
      parts.push('---\n\n' + promptWithMode);
    }
  } catch (e) {
    console.warn('Simply Chat prompt not found, using core blocks only');
  }
  
  // User context (без изменений)
  const userContext = combineContextBlocks(context);
  if (userContext) {
    parts.push('---\n\n' + userContext);
  }

  // Skills metadata (без изменений)
  const skills = getSkillsRegistry();
  if (skills.length > 0) {
    parts.push('---\n\n' + buildSkillsMetadataBlock(skills));
  }

  // Dev mode block (без изменений — загружает обновлённый dev-mode.md)
  if (process.env.SIMPLY_DEV_MODE === 'true') {
    const devBlock = loadCoreBlock('dev-mode.md');
    if (devBlock) {
      parts.push('---\n\n' + devBlock);
    }
    // Dev reminder — в самом конце, ближе к ответу модели
    parts.push(`<dev_reminder>DEV-РЕЖИМ: каждый ответ НАЧИНАЕТСЯ с блока [DEV]. Режим: ${chatMode}</dev_reminder>`);
  }

  // Модель определяется chatMode
  const modelMap: Record<string, ModelId> = {
    chat: 'claude-haiku',
    expertise: 'claude-sonnet',
    create: 'claude-sonnet',
  };

  return {
    systemPrompt: parts.join('\n\n'),
    model: modelMap[chatMode] || 'claude-haiku',
    greeting: 'Привет! Чем могу помочь?',
    toolAccess: null, // TODO: ограничить по chatMode когда tools будут разделены
  };
}
```

**B) Аналогично для `composeExpertisePrompt()` и `composeCreatePrompt()` (заглушки):**

```typescript
export function composeExpertisePrompt(context: BuildContext = {}): ComposedPrompt {
  return composeChatPrompt(context, 'expertise');
}

export function composeCreatePrompt(context: BuildContext = {}): ComposedPrompt {
  return composeChatPrompt(context, 'create');
}
```

**C) Экспорт новых функций** в `lib/prompts/builder/index.ts`:

```typescript
import {
  composeChatPrompt,
  composeAgentPrompt,
  composeSkillPrompt,
  composeExpertisePrompt,  // NEW
  composeCreatePrompt,      // NEW
  type ComposedPrompt,
} from './composer';

// ... в re-exports:
export {
  composeChatPrompt,
  composeAgentPrompt,
  composeSkillPrompt,
  composeExpertisePrompt,   // NEW
  composeCreatePrompt,       // NEW
};
```

### 4. Подключить composer к route

В `app/(chat)/api/chat/route.ts` — использовать правильный composer на основе `chatMode`:

```typescript
// Из request body:
const { chatMode } = body; // 'chat' | 'expertise' | 'create'

// Выбор composer:
let composed;
switch (chatMode) {
  case 'expertise':
    composed = composeExpertisePrompt(context);
    break;
  case 'create':
    composed = composeCreatePrompt(context);
    break;
  default:
    composed = composeChatPrompt(context, 'chat');
}
```

### 5. НЕ менять

- Core blocks (base, safety, formatting, russian-market) — не трогать
- Greeting — оставить как есть
- Skills metadata — оставить как есть
- Проектные промпты (Менеджер, Эксперт, Профессор) — не затрагиваются

---

## Тестирование

### С SIMPLY_DEV_MODE=true (приоритет)

| # | Ввод | Ожидание | ✅/❌ |
|---|---|---|---|
| 1 | В Simply Chat: «Привет» | [DEV] блок с Режим: chat, Модель: Haiku | |
| 2 | В Экспертизе: «Привет» | [DEV] блок с Режим: expertise, Модель: Sonnet | |
| 3 | В Создать: «Привет» | [DEV] блок с Режим: create, Модель: Sonnet | |
| 4 | В любом режиме: «С кем я говорю?» | Ответ с указанием режима | |
| 5 | Длинный диалог (10+ сообщений) | [DEV] блок не пропадает | |

### Функциональные тесты

| # | Ввод | Ожидание | ✅/❌ |
|---|---|---|---|
| 6 | «Какой курс доллара?» | web_search → короткий ответ | |
| 7 | «Напиши письмо поставщику о переносе на март» | createDocument | |
| 8 | «Подготовь бизнес-план для нового направления» | Помощь + навигация на Проекты | |
| 9 | «Проверь мой договор на соответствие 44-ФЗ» | Навигация на Экспертизу | |
| 10 | «Сделай презентацию для инвесторов» | Структура + навигация на Создать | |
| 11 | «Переведи: Уважаемые партнёры...» | Перевод сразу | |
| 12 | После навигации: «Нет, ответь здесь» | Отвечает, не настаивает | |

---

## Файловая структура после интеграции

```
lib/prompts/
├── core/
│   ├── base.md              # ✅ Без изменений
│   ├── safety.md            # ✅ Без изменений
│   ├── formatting.md        # ✅ Без изменений
│   ├── russian-market.md    # ✅ Без изменений
│   └── dev-mode.md          # 📝 ОБНОВИТЬ (новая версия)
├── chat/
│   └── simply-chat.md       # 🆕 НОВЫЙ ФАЙЛ
├── agents/
│   └── ben/                 # ✅ Без изменений
├── skills/                  # ✅ Без изменений
└── builder/
    ├── composer.ts          # 📝 ОБНОВИТЬ (current_mode, dev_reminder, chatMode→model)
    └── index.ts             # 📝 ОБНОВИТЬ (экспорт новых composers)
```
