# NegotiateAI Chatbot

> **🔄 Переход на Vercel AI Chatbot Template** - AI чат-бот для переговоров по проекту MIR.TRADE
> **Важное изменение:** Переходим с самописного решения на готовый template (согласно техзаданию)
> Статус: Phase 0 - Подготовка к клонированию template

AI-ассистент для переговоров, использующий Claude Sonnet 4 для работы с документацией проекта MIR.TRADE.

**Основан на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot) (auth + database + история чатов)

## 🎯 Ключевые возможности

- **Чтение документов**: Нативное чтение ~40 DOCX/PDF файлов через Anthropic API
- **Function Calling**: 3 AI-инструмента (read_document, web_search, get_current_date)
- **Контекстные ответы**: Ответы со ссылками на конкретные документы
- **Streaming**: Потоковая передача ответов для быстрого UX
- **Без Vector DB**: Использование index.md + long context вместо embeddings

## 🚀 Quick Start

```bash
# 1. Установить зависимости
npm install

# 2. Настроить environment variables
cp .env.example .env.local
# Добавить ANTHROPIC_API_KEY в .env.local

# 3. Запустить dev сервер
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

## 📚 База знаний

База знаний содержит ~40 документов в папке `knowledge/`:

### Документация по странам (9 стран)
- Алжир (тендерная платформа, процессы)
- Египет (тендерная система, требования)
- Иран (особенности работы, регуляции)
- Китай (бизнес-практики, контракты)
- ОАЭ (правовая база, процедуры)
- Оман (тендеры, регламенты)
- И другие страны региона

### Коммерческие документы
- Коммерческие предложения (КП)
- Шаблоны договоров
- Финансовые модели
- Условия оплаты и финансирования

### Технические спецификации
- User journeys для разных ролей
- Функциональные требования
- Технические детали MIR.TRADE
- API и интеграции

### Тендерная информация
- Процессы участия в тендерах
- Требования к документации
- Регламенты площадок
- Сроки и дедлайны

## 📖 Документация

- **[CLAUDE.md](CLAUDE.md)** - Правила работы с проектом для AI-агентов
- **[DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)** - Стандарты ведения документации (SSOT)
- **[roadmap.md](roadmap.md)** - План разработки по фазам
- **[docs/setup.md](docs/setup.md)** - Детальная инструкция по установке
- **[docs/architecture.md](docs/architecture.md)** - Архитектура системы
- **[docs/api/tools.md](docs/api/tools.md)** - Документация AI функций
- **[docs/deployment.md](docs/deployment.md)** - Деплой на Vercel
- **[docs/troubleshooting.md](docs/troubleshooting.md)** - Решение проблем

## 🔧 Технологии

- **Next.js 14** (App Router) - Full-stack React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Anthropic SDK** - Claude Sonnet 4.5 API
- **Vercel AI SDK** - AI streaming и function calling
- **Brave Search API** - Веб-поиск

## 📋 Фазы разработки

- [X] **Phase 0: Документация** (60 мин) - README, CHANGELOG, docs/, ADR
- [ ] **Phase 1: Базовый чат** (30-60 мин) - Next.js, Anthropic API, streaming UI
- [ ] **Phase 2: База знаний** (60-90 мин) - index.md, read_document, DOCX/PDF
- [ ] **Phase 3: Дополнительный функционал** (30-45 мин) - web_search, get_current_date
- [ ] **Phase 4: Полировка** (15-30 мин) - UI, error handling, Vercel deploy

Подробный roadmap с конкретными задачами: [roadmap.md](roadmap.md)

## 🤖 AI Инструменты

Бот использует 3 функции через Claude Function Calling:

### 1. read_document(filepath)
Читает документ из базы знаний (knowledge/*).
Поддержка: DOCX, PDF (нативное чтение через Anthropic API).

### 2. web_search(query)
Поиск актуальной информации через Brave Search API.
Используется для: курсы валют, новости, текущие события.

### 3. get_current_date()
Возвращает текущую дату и время.
Используется для: контекст времени, расчёт дедлайнов.

Подробнее: [docs/api/tools.md](docs/api/tools.md)

## 🏗️ Архитектура

```
Presentation Layer (UI)
  ├── app/page.tsx                    # Главная страница
  ├── components/Chat.tsx             # Контейнер чата
  ├── components/Message.tsx          # Компонент сообщения
  └── components/InputForm.tsx        # Форма ввода

API Layer
  └── app/api/chat/route.ts           # Chat endpoint (streaming)

Business Logic Layer
  ├── lib/anthropic.ts                # Anthropic client
  ├── lib/tools.ts                    # AI tools (read_document, etc)
  └── lib/brave-search.ts             # Brave Search integration

Data Layer
  ├── knowledge/                      # ~40 DOCX/PDF документов
  ├── knowledge/index.md              # Индекс всех документов
  └── system-prompt.md                # System prompt для Claude
```

Подробнее: [docs/architecture.md](docs/architecture.md)

## 🔑 Environment Variables

```bash
# Anthropic API (обязательно)
ANTHROPIC_API_KEY=sk-ant-api03-xxx
# Получить: https://console.anthropic.com/settings/keys

# Brave Search API (обязательно для web_search)
BRAVE_SEARCH_API_KEY=xxx
# Получить: https://brave.com/search/api/
```

## 🚢 Deployment

Деплой на Vercel в 3 шага:

```bash
# 1. Push в GitHub
git push origin master

# 2. Импортировать в Vercel
# vercel.com/new

# 3. Добавить Environment Variables
# ANTHROPIC_API_KEY
# BRAVE_SEARCH_API_KEY
```

Подробнее: [docs/deployment.md](docs/deployment.md)

## 📝 Принципы разработки

1. **SSOT (Single Source of Truth)** - Каждый факт живёт в одном месте
2. **Документация сначала** - Обновляй документацию ДО коммита
3. **Минимализм** - Только необходимый функционал
4. **Прозрачность** - Всегда ссылки на источники в ответах

См. [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)

## 🎯 Критерии успеха MVP

- [X] Документация готова (SSOT, все согласовано)
- [ ] Базовый чат работает (можно общаться с Claude)
- [ ] Чтение документов (~40 DOCX/PDF нативно)
- [ ] 3 AI tools (read_document, web_search, get_current_date)
- [ ] Контекстные ответы (ссылки на источники)
- [ ] Production deploy (работает на Vercel)

## 📄 License

Проект для внутреннего использования MIR.TRADE.

## 🔗 Ссылки

- [Техзадание](Техзадание/negotiateai-tech-spec.md)
- [CHANGELOG](CHANGELOG.md)
- [Architecture Decision Records](docs/decisions/)
