# AI Learning Agent

> **🚀 В разработке: v2.0** - Полный UI рефакторинг в стиле Claude + новые фичи
> Текущая стабильная версия: [v1.0](roadmap-v1.0.md) | Roadmap v2.0: [roadmap.md](roadmap.md)

AI-наставник с доступом к 72 урокам веб-разработки. Отвечает на вопросы студентов с поддержкой 4 оптимальных LLM через OpenRouter (Gemini 2.5 Flash, Grok 4 Fast, GPT-4.1 Mini, Claude Sonnet 4.5).

## Быстрый старт

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Настрой OPENROUTER_API_KEY
uvicorn main:app --reload
```

Backend: http://localhost:8000

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # Настрой VITE_API_URL
npm run dev
```

Frontend: http://localhost:5173

## Образовательные курсы

Проект содержит **два курса** по веб-разработке (72 урока):

- **[AI Web Learning](docs/course-structure.md)** (41+ урок) - что создавать: Backend, Frontend, Database, RAG, ML
- **[Project Setup Guide](docs/project-setup-guide-structure.md)** (21 урок) - как организовать: структура, архитектура, работа с ИИ

**Как связаны:** Setup Guide учит организовать проект, AI Web Learning - что в нём создавать.

## Документация

- [Детальная установка](docs/setup.md) - пошаговая инструкция
- [Архитектура](docs/architecture.md) - как работает система
- [Структура курса "AI Web Learning"](docs/course-structure.md) - 10 модулей веб-разработки
- [Структура курса "Project Setup Guide"](docs/project-setup-guide-structure.md) - правильная организация проектов
- [Deployment](docs/deployment.md) - деплой на Railway
- [Troubleshooting](docs/troubleshooting.md) - решение проблем

## Технологии

**Backend:**
- FastAPI 0.115+
- OpenRouter API (доступ к топовым LLM)
- Поддержка 4 моделей: Gemini 2.5 Flash (default), Grok 4 Fast (FREE!), GPT-4.1 Mini, Claude Sonnet 4.5
- Python 3.13

**Frontend:**
- React 18
- Vite 5
- Fetch API

**Deployment:**
- Railway (backend + frontend)

## Структура проекта

```
backend/
├── main.py              # FastAPI приложение
├── config.py            # Конфигурация
├── models.py            # Pydantic модели
├── services/
│   ├── openrouter_service.py  # Работа с LLM через OpenRouter
│   └── context_service.py     # Управление уроками
└── data/lessons/        # 72 урока (10 модулей + Project Setup Guide)

frontend/
├── src/
│   ├── components/      # React компоненты
│   │   ├── ChatInterface.jsx
│   │   ├── MessageList.jsx
│   │   ├── InputForm.jsx
│   │   ├── LessonSelector.jsx
│   │   └── ModelSelector.jsx
│   └── services/        # API клиент
└── package.json
```

## Возможности

- **4 оптимальные AI модели** - Gemini 2.5 Flash, Grok 4 Fast (FREE!), GPT-4.1 Mini, Claude Sonnet 4.5
- **Контекстно-зависимые ответы** - AI знает 72 урока
- **Гибкий выбор уроков** - используй все или выбери конкретные модули
- **Автоматический fallback** - Gemini → Grok при ошибке
- **Real-time чат** - интерактивный диалог с историей
- **Open Source** - github.com/engsimsoft/ai-learning-assistant

## Roadmap

**v2.0 (в разработке):**
- 🎨 Трёхпанельный UI в стиле Claude (LEFT: курсы, CENTER: урок, RIGHT: AI чат)
- 💰 Отображение стоимости с кэшированием промптов
- 🔍 Умный поиск по официальной документации
- ⚡ Long Context Window подход (1M-2M токенов)

См. [roadmap.md](roadmap.md) для детального плана (58 задач, 4 фазы, ~6-8 недель).

**v1.0 (стабильная версия):**
- ✅ FastAPI backend + React frontend
- ✅ 4 оптимальные AI модели через OpenRouter
- ✅ 72 урока (2 курса)
- ✅ История чата

См. [roadmap-v1.0.md](roadmap-v1.0.md) для истории разработки v1.0.

## Для разработчиков

- [Руководство по документации](DOCUMENTATION_GUIDE.md) - как правильно вести документацию проекта

## Лицензия

MIT
