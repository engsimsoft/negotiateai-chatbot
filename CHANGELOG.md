# Changelog

Все заметные изменения в проекте NegotiateAI Assistant документируются здесь.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Added
- Установлены зависимости для AI интеграции:
  - @anthropic-ai/sdk (^0.65.0) - официальный Anthropic SDK
  - ai (^5.0.70) - Vercel AI SDK для streaming
- .env.local: настроен с ANTHROPIC_API_KEY (не коммитится в git)
- lib/anthropic.ts: Anthropic API client
  - streamChatCompletion() - streaming ответы от Claude
  - simpleChatCompletion() - простые запросы для тестирования
  - Модель: claude-sonnet-4-20250514
- app/api/chat/route.ts: Chat API endpoint
  - POST handler с streaming через Vercel AI SDK
  - Edge runtime для низкой латентности
  - Обработка ошибок и валидация
- @ai-sdk/anthropic: Anthropic provider для Vercel AI SDK
- app/page.tsx: Chat UI с полным функционалом
  - useChat() hook для управления чатом
  - Messages list с пользовательскими и AI сообщениями
  - Input форма с валидацией и disabled состояниями
  - Loading индикатор с анимацией
  - Responsive дизайн для всех экранов

### Changed
- package.json: добавлены AI зависимости (@ai-sdk/anthropic)
- package-lock.json: обновлены lockfile записи
- roadmap.md: отмечены задачи 1.3, 1.4, 1.5, 1.6-1.7 как завершённые

### In Progress (Phase 1: Базовый чат)
- Интеграция Anthropic API (Claude Sonnet 4.5)
- Создание веб-интерфейса чата
- Настройка streaming ответов

### Planned (Phase 2-4)
- Реализация функции read_document для чтения DOCX/PDF
- Создание knowledge/index.md (каталог ~40 документов)
- Интеграция Brave Search API (web_search)
- Реализация функции get_current_date
- Создание system-prompt.md
- UI полировка и error handling
- Деплой на Vercel

## [0.2.0] - 2025-10-14

### Added
- Инициализация Next.js 14 проекта с TypeScript и Tailwind CSS
- Базовая структура приложения (app/, components/, lib/)
- Конфигурация: next.config.ts, tsconfig.json, eslint.config.mjs
- .gitignore с исключением для .env.example
- package.json с зависимостями Next.js

### Changed
- README.md обновлён со статусом Phase 1
- Файлы техзадания перемещены в папку Техзадание/

## [0.1.0] - 2025-10-14

### Added
- Полная документационная структура (SSOT принцип)
- README.md с описанием проекта и быстрым стартом (~190 строк)
- DOCUMENTATION_GUIDE.md - правила ведения документации
- CLAUDE.md - инструкции для AI-агентов и разработчиков
- roadmap.md - детальный план разработки (4 фазы, 28 задач)
- CHANGELOG.md для отслеживания изменений
- .env.example с шаблоном переменных окружения (Anthropic API)
- docs/setup.md - детальная инструкция по установке
- docs/architecture.md - архитектура системы с ASCII диаграммами
- docs/deployment.md - руководство по деплою на Vercel
- docs/troubleshooting.md - решение распространённых проблем
- docs/api/tools.md - документация 3 AI функций
- docs/decisions/ - Architecture Decision Records:
  - template.md - шаблон ADR
  - 001-why-anthropic-direct.md - почему прямой Anthropic API
  - 002-why-nextjs.md - почему Next.js
  - 003-no-vector-db.md - почему без векторной БД
- Папка knowledge/ с базой знаний проекта MIR.TRADE (~40 документов)
- Папка Техзадание/ с техническим заданием и спецификациями
