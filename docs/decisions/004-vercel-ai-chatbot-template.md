# ADR 004: Использование Vercel AI Chatbot Template

**Дата:** 2025-10-14
**Статус:** Принято

---

## Контекст

При разработке NegotiateAI Chatbot мы столкнулись с критическим выбором подхода к реализации:

**Ситуация:**
- Техническое задание (`Техзадание /negotiateai-tech-spec.md`) изначально указывало на использование Vercel AI Chatbot Template
- Несмотря на это, была предпринята попытка реализации с нуля
- Потрачен полный рабочий день (10+ часов) на кастомную реализацию
- Столкнулись с множественными проблемами:
  - AI SDK v5 bugs с tool calling
  - Проблемы со streaming
  - Необходимость реализовывать auth, database, history с нуля
  - Отсутствие готовых UI компонентов

**Требования:**
- Чат с Claude Sonnet 4.5 через Anthropic API
- Система аутентификации
- База данных для хранения истории чатов
- Streaming ответов
- Custom AI tools (read_document, web_search, get_current_date)
- Загрузка файлов (multimodal support)
- Production-ready решение

**Почему это решение было критически важным:**
- От выбора подхода зависела скорость разработки (дни vs недели)
- Надёжность и стабильность итогового решения
- Возможность следовать best practices индустрии
- Поддерживаемость кода в будущем

---

## Решение

**Использовать Vercel AI Chatbot Template** (https://github.com/vercel/ai-chatbot) в качестве базы для NegotiateAI Chatbot.

Адаптировать template под наши нужды:
1. Заменить модели на Claude Sonnet 4.5 (Anthropic)
2. Интегрировать custom system prompt из `system-prompt.md`
3. Добавить custom AI tools для работы с базой знаний
4. Настроить инфраструктуру (Neon Postgres, Vercel Blob Storage)

---

## Причины

### 1. **Следование техническому заданию**
Техзадание чётко указывало на использование готового template:
> "Использовать Vercel AI Chatbot Template как основу проекта"

Игнорирование этого пункта привело к потере времени.

### 2. **Проверенная архитектура от Vercel**
- Template создан и поддерживается командой Vercel
- Используется в production множеством компаний
- Регулярные обновления и bug fixes
- Следует Next.js и React best practices

### 3. **Готовая инфраструктура из коробки**
Template включает всё необходимое:
- ✅ Authentication (NextAuth.js/Auth.js)
- ✅ Database integration (Drizzle ORM)
- ✅ Chat history persistence
- ✅ File uploads (Vercel Blob Storage)
- ✅ Streaming responses
- ✅ Responsive UI components
- ✅ Rate limiting
- ✅ User management

Реализация этого с нуля потребовала бы недели работы.

### 4. **Экономия времени разработки**
**Кастомная реализация:**
- День 1: Настройка Next.js, базовый чат - 4 часа
- День 2: Реализация auth - 6 часов
- День 3: Database setup, история - 8 часов
- День 4: UI компоненты - 8 часов
- День 5: File uploads - 6 часов
- **Итого: 5+ дней только на базовый функционал**

**С template:**
- Интеграция template: 2 часа
- Настройка Anthropic provider: 1 час
- Настройка инфраструктуры (DB, Blob): 2 часа
- **Итого: 5 часов до полностью рабочего чата**

**Выигрыш: 10x ускорение разработки**

### 5. **Избежание типичных ошибок**
Template решает проблемы, с которыми мы столкнулись:
- AI SDK API compatibility issues
- Streaming edge cases
- Database schema для chat apps
- Security (auth, rate limiting)
- Error handling
- Production optimizations

### 6. **Интеграция с Vercel экосистемой**
- Neon Postgres - managed database с автоматической интеграцией
- Vercel Blob Storage - файловое хранилище из коробки
- Vercel Analytics - встроенная аналитика
- One-click deployment
- Environment variables management

---

## Последствия

### Плюсы

**Скорость разработки:**
- ✅ Базовый функционал работает за часы, не дни
- ✅ Можно сфокусироваться на custom features (AI tools)
- ✅ Не тратим время на "изобретение велосипеда"

**Качество кода:**
- ✅ Production-tested code
- ✅ TypeScript с полным type safety
- ✅ Следование best practices
- ✅ Готовые patterns для типичных задач

**Поддерживаемость:**
- ✅ Понятная структура проекта
- ✅ Документированные компоненты
- ✅ Активная поддержка от Vercel
- ✅ Регулярные обновления безопасности

**Инфраструктура:**
- ✅ Managed services (Neon, Vercel Blob)
- ✅ Автоматическое масштабирование
- ✅ Не нужно управлять серверами
- ✅ Deployment в один клик

**Функциональность:**
- ✅ Auth и user management готовы
- ✅ История чатов из коробки
- ✅ File uploads работают
- ✅ Responsive UI

### Минусы

**Кривая обучения:**
- ⚠️ Нужно изучить структуру template (174 файла)
- ⚠️ Понять как работает интеграция providers
- ⚠️ Разобраться с existing components

Однако: время на изучение (2-3 часа) << время на реализацию с нуля (недели)

**Зависимость от Vercel:**
- ⚠️ Template оптимизирован для Vercel platform
- ⚠️ Некоторые features требуют Vercel services (Blob Storage)

Однако: Vercel - надёжная платформа с free tier, подходит для production

**Ограничения кастомизации:**
- ⚠️ Нужно адаптироваться к существующей архитектуре
- ⚠️ Некоторые изменения требуют понимания всего template

Однако: архитектура продумана и расширяема, кастомизация возможна

---

## Альтернативы

### Альтернатива 1: Кастомная реализация с нуля

**Что это:**
Написать весь код самостоятельно используя Next.js + AI SDK + Anthropic API

**Почему отклонили:**
- ❌ Слишком долго (недели разработки)
- ❌ Высокий риск ошибок и bugs
- ❌ Нужно решать уже решённые проблемы (auth, database, streaming)
- ❌ Не следует техзаданию
- ❌ Практический опыт показал множество проблем (AI SDK bugs, streaming issues)

**Когда может быть лучше:**
- Специфические требования, которые template не может удовлетворить
- Обучающий проект (где цель - научиться, а не сделать продукт)
- Очень нестандартная архитектура

**Вывод:** Для NegotiateAI это был неправильный выбор

### Альтернатива 2: Другие AI chatbot templates

**Примеры:**
- ChatGPT Clone repositories
- LangChain templates
- Custom AI SDKs templates

**Почему отклонили:**
- ⚠️ Меньшая поддержка сообщества
- ⚠️ Не от официального источника (Vercel)
- ⚠️ Хуже документация
- ⚠️ Меньше готовых интеграций
- ⚠️ Техзадание специально указывало на Vercel template

**Когда может быть лучше:**
- Если нужна специфическая интеграция (например, LangChain agents)
- Если не используется Vercel platform

**Вывод:** Vercel template - лучший выбор для нашего случая

### Альтернатива 3: AI frameworks (LangChain, LlamaIndex)

**Что это:**
Использовать специализированные AI frameworks вместо прямого AI SDK

**Почему отклонили:**
- ⚠️ Больший overhead и сложность
- ⚠️ Дополнительный слой абстракции
- ⚠️ Техзадание указывало на прямое использование Anthropic API
- ⚠️ Vercel template использует более простой и прямой подход

**Когда может быть лучше:**
- Сложные AI workflows с chains
- Нужна интеграция множества AI моделей
- RAG (Retrieval-Augmented Generation) с векторными БД

**Вывод:** Для нашего случая (прямой чат с tools) - избыточно

---

## Ссылки и ресурсы

- [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Техзадание проекта](../Техзадание/negotiateai-tech-spec.md)
- [CUSTOM_FEATURES.md](../../CUSTOM_FEATURES.md) - что нужно добавить к template
- [Architecture Decision: Why Anthropic Direct](001-why-anthropic-direct.md)
- [Architecture Decision: Why Next.js](002-why-nextjs.md)

---

## Результаты реализации

**После перехода на template (данные на 2025-10-14):**

✅ **Phase 0 (Template Integration): 2 часа**
- Клонирован template
- Установлены зависимости
- Настроен Neon Postgres
- Database migrations выполнены

✅ **Phase 1 (Anthropic Integration): 1 час**
- Настроен Anthropic provider
- Claude Sonnet 4.5 работает
- System prompt загружается из system-prompt.md
- Базовый чат функционален

✅ **Blob Storage Setup: 1 час**
- Создан Vercel Blob Store
- Настроен upload endpoint
- File uploads работают (изображения)
- Multimodal support (Claude видит изображения)

**Итого: 4 часа до полностью рабочего production-ready чата**

Для сравнения: кастомная реализация после 10+ часов работы:
- ❌ Streaming работал нестабильно
- ❌ Tools не вызывались
- ❌ Не было auth
- ❌ Не было database
- ❌ Не было file uploads

---

## Примечания

**Ключевой урок сегодняшнего дня:**
> "Следуй техзаданию. Используй проверенные решения. Не изобретай велосипед."

**Что сработало:**
- ✅ Чтение документации внимательно
- ✅ Следование best practices
- ✅ Использование managed services (Neon, Vercel Blob)
- ✅ Не обходить проблемы костылями, а решать правильно
- ✅ Настройка инфраструктуры как задумано в template

**Что НЕ сработало:**
- ❌ Попытка писать всё с нуля
- ❌ Игнорирование рекомендаций техзадания
- ❌ Временные решения и костыли
- ❌ "Мы сделаем лучше чем готовое решение"

**Вывод:**
В 2025 году при наличии качественных готовых решений от крупных компаний (Vercel, Anthropic) - правильный подход это адаптация, а не реализация с нуля.

---

## История изменений

- **2025-10-14** - Документ создан (после успешной интеграции template)
