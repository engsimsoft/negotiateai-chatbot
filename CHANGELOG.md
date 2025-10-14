# Changelog

Все заметные изменения в проекте NegotiateAI Assistant документируются здесь.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Planned (Next Steps)
- Добавление custom tools (read_document, web_search, get_current_date)
- UI кастомизация (брендинг NegotiateAI)
- Деплой на Vercel

## [0.8.0] - 2025-10-14 - Vercel Blob Storage Integration

### Added
- ✅ **Vercel Blob Storage** полностью интегрирован
  - Создан Blob Store `chatbot-files` в Frankfurt region (FRA1)
  - Подключен к проекту `negotiateai-chatbot` через Vercel Dashboard
  - File upload endpoint ([app/(chat)/api/files/upload/route.ts](app/(chat)/api/files/upload/route.ts)) работает
  - Environment variable: `BLOB_READ_WRITE_TOKEN` добавлен в `.env.local`
- ✅ **File Upload Functionality** полностью работает
  - Поддержка изображений: JPEG, PNG (до 5MB)
  - Upload через UI (кнопка 📎 скрепка)
  - Файлы сохраняются в Vercel Blob с публичным доступом
  - Автоматическая генерация URLs для загруженных файлов
- ✅ **Multimodal Support** (Claude Vision)
  - Claude Sonnet 4.5 видит и анализирует загруженные изображения
  - Работает через Anthropic Vision API
  - Claude корректно интерпретирует визуальный контекст
- ✅ **Architecture Decision Record**
  - Создан [ADR 004: Vercel AI Chatbot Template](docs/decisions/004-vercel-ai-chatbot-template.md)
  - Задокументировано решение использовать template
  - Описаны причины, альтернативы и последствия
  - Зафиксирован ключевой урок: "Следуй техзаданию, используй проверенные решения"

### Changed
- `next.config.ts`: Добавлен hostname `*.public.blob.vercel-storage.com` в `remotePatterns`
  - Исправлена ошибка Next.js Image: "hostname is not configured"
  - Теперь изображения из Vercel Blob корректно отображаются
- `.env.local`: Добавлена переменная `BLOB_READ_WRITE_TOKEN`
  - Token для доступа к Vercel Blob Storage
  - Используется upload endpoint для сохранения файлов

### Fixed
- ❌ Решена проблема с upload endpoint
  - Проблема: HTTP 500 - "Upload failed" (отсутствие BLOB_READ_WRITE_TOKEN)
  - Решение: Создан Vercel Blob Store и получен токен
  - Результат: Upload работает полностью
- ✅ Исправлена ошибка отображения изображений
  - Ошибка: "hostname is not configured under images in next.config.js"
  - Решение: Добавлен wildcard hostname для Blob Storage
  - Результат: Изображения корректно отображаются через Next.js Image

### Working Now
- ✅ File uploads (JPEG, PNG) через UI
- ✅ Vercel Blob Storage сохраняет файлы
- ✅ Next.js Image отображает загруженные изображения
- ✅ Claude Sonnet 4.5 видит и анализирует изображения
- ✅ Multimodal functionality полностью работает
- ✅ System prompt применяется (Claude понимает контекст проекта при анализе изображений)

### Infrastructure
**Vercel Services настроены:**
- ✅ Neon Postgres (database) - Frankfurt region
- ✅ Vercel Blob Storage (file uploads) - Frankfurt region
- ✅ Environment variables автоматически добавлены в Vercel project

**Managed Services:**
- Database: Neon Serverless Postgres
- File Storage: Vercel Blob Storage
- Platform: Vercel Edge Network

### Next Steps
- Phase 2: Добавить custom AI tools для работы с базой знаний
  - read_document tool для чтения DOCX/PDF из knowledge/
  - get_current_date tool
  - web_search tool (Brave Search API)

## [0.7.0] - 2025-10-14 - Anthropic Integration Complete

### Added
- ✅ **Anthropic AI Provider** полностью интегрирован
  - Установлен `@ai-sdk/anthropic` (v2.0.27)
  - Модель: Claude Sonnet 4.5 (`claude-sonnet-4-20250514`)
  - Прямое подключение через Anthropic API (не через Gateway)
- ✅ **System Prompt Integration** из `system-prompt.md`
  - Создана функция `loadSystemPrompt()` с кэшированием
  - System prompt (~1018 строк) загружается автоматически
  - Fallback на базовый промпт при ошибке
- ✅ **Model Configuration** обновлена
  - [lib/ai/models.ts](lib/ai/models.ts): заменён DEFAULT_CHAT_MODEL на `"claude-sonnet-4"`
  - [lib/ai/providers.ts](lib/ai/providers.ts): настроен Anthropic provider
  - [lib/ai/prompts.ts](lib/ai/prompts.ts): async загрузка system-prompt.md
- ✅ **API Schema Validation** исправлена
  - [app/(chat)/api/chat/schema.ts](app/(chat)/api/chat/schema.ts): обновлен enum для `claude-sonnet-4`
  - Исправлена ошибка HTTP 400 при валидации

### Changed
- `lib/ai/models.ts`: убраны Grok модели, добавлен Claude Sonnet 4.5
- `lib/ai/providers.ts`: заменён `@ai-sdk/gateway` на `@ai-sdk/anthropic`
- `lib/ai/prompts.ts`: `systemPrompt()` теперь async функция
- `app/(chat)/api/chat/route.ts`: добавлен await для загрузки system prompt
- `package.json`: добавлена зависимость `@ai-sdk/anthropic`

### Fixed
- Исправлена валидация schema для нового model ID
- Убраны старые модели из experimental_activeTools check

### Working Now
- ✅ Claude Sonnet 4.5 отвечает через Anthropic API
- ✅ System prompt загружается из system-prompt.md
- ✅ Claude представляется как "NegotiateAI Assistant"
- ✅ Claude понимает роль и проект MIR.TRADE
- ✅ Streaming работает плавно
- ✅ Markdown форматирование работает
- ✅ Базовый чат полностью функционален

### Next Steps
- Phase 2: Добавить custom AI tools
  - read_document tool для чтения DOCX/PDF
  - get_current_date tool
  - web_search tool (Brave Search API)

## [0.6.0] - 2025-10-14 - Database Integration Complete

### Added
- ✅ **Neon Postgres Database** успешно интегрирована
  - Provider: Neon Serverless Postgres
  - Region: Frankfurt, Germany (West) - оптимально для EU/Russia
  - Plan: Free tier (достаточно для development и testing)
  - Database: `neondb`
  - Connection: Pooled connection с SSL encryption
- ✅ **Environment Variables** настроены
  - `POSTGRES_URL`: полная connection string для Neon
  - Обновлён `.env.local` для локальной разработки
  - Vercel автоматически получил переменные из Neon integration
- ✅ **Database Migrations** выполнены успешно
  - Запущен `npm run db:migrate` через Drizzle ORM
  - Создана полная схема: Users, Chats, Messages, Documents, Suggestions, Votes
  - Время выполнения: 3.3 секунды
  - Миграции применены к облачной Neon базе
- ✅ **Vercel AI Chatbot Template** полностью функционален
  - Dev server запускается без ошибок (939ms ready time)
  - База данных подключена и работает
  - Auth.js готов к использованию
  - UI загружается корректно
  - Sidebar, chat interface, user menu - всё работает

### Changed
- `.env.local`: заменён Docker Postgres на Neon Postgres
  - Старый: `postgres://negotiateai:...@localhost:5432/negotiateai`
  - Новый: `postgresql://neondb_owner:...@ep-dry-voice-ageycpaz-pooler.c-2.eu-central-1.aws.neon.tech/neondb`
  - SSL mode: require (безопасное соединение)

### Fixed
- ❌ Решена проблема с локальным Docker Postgres
  - Проблема: Конфликт портов между локальным Postgres (PID 763) и Docker (PID 89269)
  - Решение: Переход на Neon Serverless Postgres (managed решение)
  - Преимущество: Не нужно управлять Docker контейнерами, автоматический деплой
- ✅ Устранены ошибки Auth.js
  - Исправлено: `MissingSecret: Please define a 'secret'` (добавлен AUTH_SECRET)
  - Исправлено: `InvalidProvider: Callback for provider type (credentials) is not supported` (подключена БД)

### Working Now
- ✅ Next.js 15.3.0 с Turbopack (350ms compilation)
- ✅ React 19 RC UI components
- ✅ Neon Postgres database подключена и работает
- ✅ Auth.js готов (credentials provider требует БД - теперь есть)
- ✅ Chat interface отображается
- ✅ История чатов будет сохраняться
- ✅ Готово к добавлению Anthropic provider

### Next Steps
- Phase 1 (roadmap.md): Интеграция Anthropic Provider
  - Заменить placeholder модели на Claude Sonnet 4.5
  - Настроить streaming через @anthropic-ai/sdk
  - Протестировать базовый чат

## [0.5.0] - 2025-10-14 - КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ СТРАТЕГИИ

### Changed - СМЕНА ПОДХОДА
**⚠️ ПЕРЕХОД С САМОПИСНОГО РЕШЕНИЯ НА VERCEL AI CHATBOT TEMPLATE**

**Причина смены стратегии:**
- Техзадание (`Техзадание /negotiateai-tech-spec.md`) **с самого начала указывало** использовать Vercel AI Chatbot Template
- Потратили весь день (10+ часов) на самописное решение из-за невнимательного чтения документации
- Столкнулись с множеством проблем: AI SDK API bugs, streaming issues, tools не работают
- Реализация с нуля НЕ имеет смысла когда есть готовое решение от Vercel

**Что было сделано (самописное - DEPRECATED):**
- ❌ app/api/chat/route.ts - custom implementation (НЕ РАБОТАЕТ полностью)
- ❌ lib/tools.ts - tools implementation (tools НЕ ВЫЗЫВАЮТСЯ)
- ❌ app/page.tsx - basic UI (будет заменен на template UI)
- ❌ Боролись с AI SDK v5 bugs целый день (НАПРАСНО)

**Что делаем дальше (правильный подход):**
- ✅ Клонируем Vercel AI Chatbot Template
- ✅ Адаптируем под наши нужды (custom tools + system prompt)
- ✅ Получаем auth + database + history из коробки
- ✅ Все работает БЕЗ борьбы с багами

**Обновлено:**
- ✅ CLAUDE.md - добавлено **ЖИРНЫМИ БУКВАМИ: ЧИТАЙ ТЕХЗАДАНИЕ ПЕРВЫМ ДЕЛОМ**
- ✅ roadmap.md - полностью переписан под Vercel AI Chatbot Template (20 новых задач)
- ✅ README.md - указано что проект основан на Vercel AI Chatbot Template
- ✅ CHANGELOG.md - добавлена запись о критическом изменении стратегии

**Урок:** Всегда читай техзадание ДО начала кодинга, а не ПОСЛЕ дня мучений.

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
