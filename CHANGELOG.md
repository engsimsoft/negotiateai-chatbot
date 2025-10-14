# Changelog

Все заметные изменения в проекте NegotiateAI Assistant документируются здесь.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Planned (Phase 3-4)
- Интеграция Brave Search API (web_search)
- UI полировка и error handling
- Деплой на Vercel

## [0.4.1] - 2025-10-14

### Fixed
- app/api/chat/route.ts: исправлена обработка messages с полем 'parts' (AI SDK v5 format)
  - AI SDK v5 отправляет messages с структурой {parts: [{type, text}]} вместо {content}
  - Добавлена конвертация parts → content для совместимости
- System prompt успешно загружается и применяется
- Базовый чат работает с system prompt и streaming

### Changed
- Временно отключены tools из-за бага AI SDK v5 с Anthropic провайдером
  - Ошибка: "tools.0.custom.input_schema.type: Field required"
  - AI SDK неправильно сериализует Zod/JSON schemas для Anthropic API
  - Требуется решение для включения read_document и get_current_date

### Working
- ✅ Базовый чат с Claude
- ✅ Streaming ответов через toUIMessageStreamResponse()
- ✅ System prompt (~1018 строк) загружается из system-prompt.md
- ✅ Claude понимает роль NegotiateAI Assistant
- ✅ Форматирование markdown в ответах

### Blocked
- ❌ Function calling (tools) - блокировано багом AI SDK
- ❌ Phase 2.8 тестирование - требует рабочие tools

## [0.4.0] - 2025-10-14

### Added
- Phase 2: База знаний полностью интегрирована
- knowledge/index.md: каталог ~25 ключевых документов из ~102 файлов
  - Описания по категориям: главные, коммерческие, технические, страновые
  - Для каждого: путь, формат, дата, размер, описание (150-250 символов), ключевые темы
  - Структура папок (17 стран)
- lib/tools.ts: полная реализация AI инструментов
  - read_document(filepath): чтение DOCX/PDF через Anthropic API
    - Base64 кодирование документов
    - Поддержка форматов: PDF, DOCX, DOC, TXT, CSV, HTML
    - Валидация путей (только knowledge/*)
    - Проверка размера файла (<30MB)
    - Обработка ошибок
  - get_current_date(): текущая дата в ISO 8601
  - toolDefinitions: схемы для function calling
- system-prompt.md: полный системный промпт (~1018 строк)
  - Роль NegotiateAI Assistant для MIR.TRADE
  - Философия "Show, don't tell"
  - Встроенный полный каталог knowledge/index.md
  - Детальные инструкции по 3 tools (read_document, web_search, get_current_date)
  - Формат ответов со ссылками на источники
  - Специальные сценарии (аргументация, анализ, сравнение)
  - Примеры создания "вау-эффекта"
- app/api/chat/route.ts: интеграция системного промпта и tools
  - getSystemPrompt(): загрузка system-prompt.md с кэшированием
  - system параметр в streamText
  - tools интеграция (read_document, get_current_date)
  - execute функции для каждого tool
  - Fallback промпт при ошибке загрузки

### Changed
- app/api/chat/route.ts: runtime изменён с 'edge' на 'nodejs'
  - Необходимо для file system доступа (fs/promises)
  - Добавлены импорты fs и path
- roadmap.md: обновлён прогресс Phase 2 (7/8 задач, 87.5%)
- roadmap.md: общий прогресс 27/28 задач (96%)

### Completed
- ✅ Phase 2.1-2.7: База знаний готова (87.5%)
  - Папка knowledge/ проверена (102 файла)
  - index.md создан с описанием документов
  - read_document tool реализован
  - Function calling интегрирован
  - Tool calls обработка через AI SDK
  - System prompt создан и встроен
  - System prompt подключён к API

### Next
- Phase 2.8: Тестирование чтения документов (осталось 10 мин)

## [0.3.0] - 2025-10-14

### Added
- Установлены зависимости для AI интеграции:
  - @anthropic-ai/sdk (^0.65.0) - официальный Anthropic SDK
  - ai (^5.0.70) - Vercel AI SDK для streaming
  - @ai-sdk/react (^1.x) - React hooks для useChat
  - @ai-sdk/anthropic - Anthropic provider для Vercel AI SDK
- .env.local: настроен с ANTHROPIC_API_KEY (не коммитится в git)
- lib/anthropic.ts: Anthropic API client
  - streamChatCompletion() - streaming ответы от Claude
  - simpleChatCompletion() - простые запросы для тестирования
  - Модель: claude-sonnet-4-20250514
- app/api/chat/route.ts: Chat API endpoint
  - POST handler с streaming через AI SDK v5 (streamText)
  - toUIMessageStreamResponse() для совместимости с useChat
  - convertToModelMessages() для преобразования UI messages
  - Edge runtime для низкой латентности
  - Обработка ошибок и валидация
- app/page.tsx: Chat UI с полным функционалом
  - useChat() hook из @ai-sdk/react для управления чатом
  - Messages list с user/assistant стилями
  - Поддержка message.parts (AI SDK v5 structure)
  - sendMessage() метод вместо handleSubmit
  - status состояние вместо isLoading
  - Input форма с валидацией и disabled состояниями
  - Loading индикатор с анимированными точками
  - Responsive Tailwind дизайн для всех экранов
- CLAUDE.md: добавлена секция "Стратегия коммитов: Часто и по задачам"
  - Правило: 1 задача из roadmap = 1 коммит
  - Примеры хороших/плохих коммитов
  - Когда делать коммит / когда НЕ коммитить
  - Структура сообщения коммита

### Changed
- package.json: добавлены AI зависимости (@ai-sdk/react, @ai-sdk/anthropic)
- package-lock.json: обновлены lockfile записи
- roadmap.md: Phase 1 отмечена как завершённая (8/8 задач)
- roadmap.md: обновлён общий прогресс (20/28 задач, 71%)
- roadmap.md: обновлены оценки времени (затрачено 130 мин)

### Fixed
- Исправлена совместимость с AI SDK v5:
  - Заменён toDataStreamResponse на toUIMessageStreamResponse
  - Убран await перед streamText (не требуется в v5)
  - Адаптирован useChat под новый API (@ai-sdk/react)
- Исправлены проблемы со streaming ответами от Claude
- Исправлено отображение сообщений (message.parts вместо message.content)

### Completed
- ✅ Phase 1: Базовый чат (100%)
  - Базовый чат работает
  - Claude отвечает через Anthropic API
  - Streaming функционирует корректно
  - UI responsive и функциональный

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
