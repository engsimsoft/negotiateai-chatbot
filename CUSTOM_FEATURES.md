# Custom Features для NegotiateAI Chatbot

> **Цель:** Описать ЧТО нужно добавить к чистому Vercel AI Chatbot Template для нашего проекта

Этот файл содержит список кастомных фич, которые нужно интегрировать в базовый template.

---

## 🎯 Что уже есть в Vercel AI Chatbot Template

✅ **Authentication** (Auth.js)
✅ **Database** (PostgreSQL через Vercel)
✅ **История чатов** (сохранение в БД)
✅ **Streaming ответов** (работает из коробки)
✅ **UI компоненты** (готовый дизайн)
✅ **Поддержка разных провайдеров** (OpenAI, Anthropic и др.)

**НЕ ТРОГАЕМ!** Используем как есть.

---

## ➕ Что нужно ДОБАВИТЬ

### 1. Anthropic Provider Configuration

**Файл:** Конфигурация провайдера (возможно `lib/ai/providers.ts` или подобный)

**Что сделать:**
- Настроить Anthropic как основной провайдер
- Модель: `claude-sonnet-4-20250514`
- API Key: из `ANTHROPIC_API_KEY` environment variable

**Пример (ориентировочно):**
```typescript
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const model = anthropic('claude-sonnet-4-20250514');
```

---

### 2. System Prompt Integration

**Файл:** Где template загружает system prompt

**Что сделать:**
1. Загружать содержимое из `system-prompt.md` файла
2. При инициализации встраивать содержимое `index.md` в маркер `[ИНДЕКСНЫЙ ФАЙЛ index.md ВСТАВЛЯЕТСЯ СЮДА]`
3. Использовать получившийся полный промпт

**Логика:**
```typescript
async function getSystemPrompt(): Promise<string> {
  const promptTemplate = await fs.readFile('system-prompt.md', 'utf-8');
  const indexContent = await fs.readFile('index.md', 'utf-8');

  return promptTemplate.replace(
    '[ИНДЕКСНЫЙ ФАЙЛ index.md ВСТАВЛЯЕТСЯ СЮДА]',
    indexContent
  );
}
```

**Файлы:**
- `system-prompt.md` - основной промпт (уже готов)
- `index.md` - индекс документов (~25 из 102 описано, остальные TODO)

---

### 3. Custom AI Tools (Functions)

**Файл:** Создать `lib/tools/` или добавить в существующую систему tools template

#### Tool 1: read_document

**Назначение:** Чтение документов из папки `knowledge/`

**Параметры:**
- `filepath` (string) - путь относительно `knowledge/`, например: `"knowledge/Алжир/тендерные площадки Алжира.docx"`

**Реализация:**
- Использовать **прямой Anthropic SDK** (@anthropic-ai/sdk)
- Читать DOCX/PDF через Anthropic Document API (нативная поддержка)
- Не конвертировать в TXT!

**Референс:** См. `Техзадание /negotiateai-tech-spec.md` раздел "Функции/Tools"

**Пример кода (ориентировочно):**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function readDocument(filepath: string) {
  // 1. Validate path starts with 'knowledge/'
  // 2. Read file as base64
  // 3. Determine MIME type (.pdf, .docx, etc.)
  // 4. Send to Anthropic Messages API with document block
  // 5. Return extracted text
}
```

**Важно:**
- Проверка безопасности (только из `knowledge/`)
- Лимит размера файла (30MB)
- Поддерживаемые форматы: .pdf, .docx, .doc, .txt, .csv, .html

#### Tool 2: get_current_date

**Назначение:** Возвращает текущую дату и время

**Параметры:** нет

**Реализация:**
```typescript
function getCurrentDate() {
  return new Date().toISOString();
  // или: return new Date().toLocaleString('ru-RU', {...});
}
```

**Зачем:** Для контекста по срокам тендеров, дедлайнам и т.д.

#### Tool 3: web_search (ОПЦИОНАЛЬНО - Phase 3)

**Назначение:** Поиск актуальной информации через Brave Search API

**Параметры:**
- `query` (string) - поисковый запрос

**Реализация:**
- Brave Search API: `https://api.search.brave.com/res/v1/web/search`
- API Key: из `BRAVE_SEARCH_API_KEY` environment variable
- Возвращать топ 5-10 результатов

**Пример ответа:**
```typescript
{
  results: [
    { title: '...', snippet: '...', url: '...' },
    // ...
  ]
}
```

---

### 4. UI Customization

**Что изменить:**

#### Брендинг
- **Название:** "NegotiateAI Assistant"
- **Описание:** "Ассистент для переговоров по проекту MIR.TRADE"
- **Placeholder:** "Задайте вопрос о проекте MIR.TRADE..."

#### Tool Usage Indicators (опционально)
При вызове функции показывать статус:
- "Читаю документ..." (read_document)
- "Ищу в интернете..." (web_search)
- "Получаю текущую дату..." (get_current_date)

**Где:** Скорее всего в компоненте чата, где отображаются "thinking" индикаторы

---

## 📦 Что НЕ трогаем (оставляем из template)

❌ **НЕ трогай:**
- Authentication систему
- Database схему (Postgres)
- UI компоненты (используем как есть)
- Routing структуру
- API endpoints структуру

✅ **Только добавляем:**
- Настройки Anthropic провайдера
- System prompt загрузку
- 3 custom tools
- Минимальный брендинг (название, описание)

---

## 🗂️ Файловая структура (что добавится)

```
/
├── knowledge/              # ГОТОВО - база знаний (~102 документа)
├── system-prompt.md        # ГОТОВО - системный промпт
├── index.md                # В ПРОЦЕССЕ - индекс документов (25/102)
├── lib/
│   └── tools/              # СОЗДАТЬ
│       ├── read-document.ts   # Tool 1
│       ├── get-current-date.ts # Tool 2
│       └── web-search.ts      # Tool 3 (опционально)
├── [остальное из template]
```

---

## 📋 Чек-лист интеграции

### Phase 1: Базовая интеграция
- [ ] Настроить Anthropic провайдер
- [ ] Загрузка system-prompt.md + встраивание index.md
- [ ] Протестировать базовый чат (без tools)

### Phase 2: Custom Tools
- [ ] Добавить read_document tool
- [ ] Добавить get_current_date tool
- [ ] Протестировать вызов tools

### Phase 3: Доп. функционал (опционально)
- [ ] Добавить web_search tool
- [ ] Tool usage indicators в UI

### Phase 4: Брендинг
- [ ] Изменить название на "NegotiateAI Assistant"
- [ ] Изменить placeholder
- [ ] Финальное тестирование

---

## 🔗 Референсы

**Техническая спецификация:**
- `Техзадание /negotiateai-tech-spec.md` - полное техзадание проекта
- `Техзадание /index-file-specification.md` - спецификация index.md

**Системный промпт:**
- `system-prompt.md` - готовый промпт (используй как есть!)
- `index.md` - индекс документов (частично готов)

**База знаний:**
- `knowledge/` - ~102 документа в форматах DOCX/PDF
- Структура: 17 папок по странам + корневые файлы

---

## 💡 Важные принципы

1. **Минимум изменений в template** - только добавляем, не переписываем
2. **Используй существующую архитектуру** - если есть система tools, используй её
3. **Не дублируй функционал** - если в template есть auth, используй его
4. **Следуй стилю кода template** - TypeScript, file structure, naming

---

**Обновлено:** 2025-10-14
**Статус:** Готов к интеграции с Vercel AI Chatbot Template
