# Правила работы с проектом NegotiateAI Chatbot

## 🚨 ОБЯЗАТЕЛЬНО перед началом работы

### Порядок действий (СТРОГО):

1. **📖 Изучи README.md** - [README.md](README.md) - точка входа в проект
2. **📝 Прочитай правила документации** - [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)
3. **🎯 Следуй принципу SSOT** - Single Source of Truth (никаких дублей!)
4. **📋 Проверь CHANGELOG.md** - [CHANGELOG.md](CHANGELOG.md) - что уже сделано

### 🎯 Текущий статус проекта

**Версия:** 1.0.5  
**Статус:** ✅ Production Ready - deployed на Vercel  
**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

**Что работает:**
- ✅ Vercel AI Chatbot Template интегрирован
- ✅ Anthropic API (Claude Sonnet 4) подключен
- ✅ Authentication через NextAuth работает
- ✅ PostgreSQL база данных (Neon) настроена
- ✅ Blob Storage для файлов работает
- ✅ Middleware работает корректно (проблема решена в v1.0.5)
- ✅ Проект задеплоен на Vercel

**В разработке:**
- [ ] AI Tools (read_document, web_search, get_current_date)
- [ ] System prompt интеграция
- [ ] Knowledge base индексация
- [ ] UI кастомизация

---

## 📋 Процесс работы

### Перед началом задачи:
- [ ] Прочитай [README.md](README.md) - точка входа в проект
- [ ] Если нужны детали → смотри ссылки в README на `docs/`
- [ ] Изучи [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) - как вести документацию
- [ ] Проверь [CHANGELOG.md](CHANGELOG.md) - что уже сделано

### Во время работы:
- [ ] Используй **TodoWrite** для отслеживания текущих задач
- [ ] Если задача сложная (3+ шага) → обязательно используй TodoWrite
- [ ] Отмечай задачи как выполненные сразу после завершения
- [ ] Тестируй изменения локально перед commit

### После ЛЮБЫХ значительных изменений:
1. ✅ Обнови документацию согласно [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)
2. ✅ Пройди чек-лист из раздела "Чек-лист при изменениях"
3. ✅ Обнови [CHANGELOG.md](CHANGELOG.md)
4. ✅ Проверь, что нигде нет дублирования информации

---

## 🚨 КРИТИЧЕСКИ ВАЖНО: Перед commit/push

**ЗАПРЕЩЕНО делать commit или push на GitHub без обновления документации!**

### Обязательный чек-лист перед commit:
- [ ] Документация обновлена согласно [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)
- [ ] [CHANGELOG.md](CHANGELOG.md) содержит запись о изменениях
- [ ] Нет дублирования информации (проверен принцип SSOT)
- [ ] README.md не длиннее 120 строк
- [ ] Все ссылки в документации рабочие
- [ ] .env.local НЕ коммитится (только .env.example)

**Только после прохождения всех пунктов → можно делать commit и push!**

---

## 📦 Стратегия коммитов: Часто и по задачам

### Правило: 1 задача = 1 коммит

**Почему часто лучше:**
- ✅ **Быстрое восстановление:** откат на 5-10 минут, а не на час
- ✅ **Чистая история:** легко найти где что добавлено
- ✅ **Безопасность:** никогда не потеряешь больше 10 минут работы
- ✅ **Смелые эксперименты:** можно пробовать новое без страха

### Когда делать коммит:

**Делай коммит после КАЖДОЙ завершённой задачи:**
- ✅ Установил зависимости (npm install) → коммит
- ✅ Создал один файл (например, `lib/tools/read-document.ts`) → коммит
- ✅ Создал API endpoint или компонент → коммит
- ✅ Добавил новую AI функцию (tool) → коммит
- ✅ Обновил документацию → коммит
- ✅ Завершил тестирование фичи → коммит

### ⚠️ Когда НЕ коммитить:

- ❌ Код сломан и ничего не работает
- ❌ Задача выполнена наполовину
- ❌ Есть syntax errors или TypeScript errors
- ❌ Промежуточное состояние (WIP)

### Структура сообщения коммита:

```
<Краткое описание на английском (50-70 символов)>

<Детальное описание (опционально):>
- Что именно сделано
- Какие файлы затронуты
- Связь с задачей

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Итог:** Коммить часто = безопасно. Лучше 10 маленьких коммитов, чем 1 большой.

---

## 🎯 Специфика проекта NegotiateAI

### Архитектура проекта:

**Основано на:** [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)

**Ключевые компоненты:**

1. **Next.js 15.3** (App Router)
   - TypeScript
   - React Server Components
   - Streaming UI

2. **Authentication**
   - NextAuth 5.0.0-beta.25
   - PostgreSQL для хранения пользователей
   - Guest mode поддерживается

3. **AI Integration**
   - Anthropic SDK (@anthropic-ai/sdk)
   - Claude Sonnet 4.5
   - Function calling (tools)
   - Streaming responses

4. **Database & Storage**
   - PostgreSQL (Neon) - основная БД
   - Vercel Blob Storage - для файлов
   - Drizzle ORM

5. **Knowledge Base** (планируется)
   - ~40 DOCX/PDF документов в `knowledge/`
   - Claude читает их напрямую (нативная поддержка)
   - index.md для навигации

### Ключевые файлы:

```
negotiateai-chatbot/
├── app/(chat)/           # Chat UI и routes
├── app/(auth)/           # Authentication
├── lib/                  # Business logic
│   ├── ai/              # AI интеграция
│   ├── db/              # Database queries
│   └── utils.ts         # Утилиты
├── components/           # React компоненты
├── artifacts/            # Artifact rendering
├── knowledge/            # База знаний (DOCX/PDF)
├── docs/                 # Документация
│   ├── architecture.md
│   ├── deployment.md
│   ├── setup.md
│   ├── troubleshooting.md
│   └── vercel-deploy-debug.md  # История решения проблем
├── .env.example         # Template переменных
└── .env.local          # Реальные ключи (НЕ коммитить!)
```

---

## 💡 Главное правило

**Информация живёт в ОДНОМ месте. Остальные файлы ссылаются на неё.**

- Факты о проекте → [README.md](README.md) и `docs/`
- Правила документации → [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)
- История изменений → [CHANGELOG.md](CHANGELOG.md)
- Текущие задачи → TodoWrite (в рамках сессии)

---

## 🔍 Где найти информацию

**Общее:**
- **Что это за проект?** → [README.md](README.md)
- **Как установить?** → [docs/setup.md](docs/setup.md)
- **Как работает?** → [docs/architecture.md](docs/architecture.md)
- **Как вести документацию?** → [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)
- **Что изменилось?** → [CHANGELOG.md](CHANGELOG.md)

**Deployment:**
- **Деплой на Vercel** → [docs/deployment.md](docs/deployment.md)
- **История решения проблем** → [docs/vercel-deploy-debug.md](docs/vercel-deploy-debug.md)
- **Проблемы и решения** → [docs/troubleshooting.md](docs/troubleshooting.md)

**Архитектурные решения:**
- **ADR (Architecture Decision Records)** → [docs/decisions/](docs/decisions/)

---

## 📊 Чек-лист для разных типов задач

### Добавил новую AI функцию (tool):
1. [ ] Реализовал в `lib/ai/tools/`
2. [ ] Добавил в конфигурацию tools
3. [ ] Обновил README.md (краткий список функций)
4. [ ] Детально описал в `docs/api/tools.md` (если существует)
5. [ ] Обновил `docs/architecture.md` (если меняет flow)
6. [ ] Обновил `CHANGELOG.md`
7. [ ] Протестировал функцию

### Изменил переменные окружения:
1. [ ] Обновил `.env.example` (без реальных ключей!)
2. [ ] Обновил `docs/setup.md` (как получить ключи)
3. [ ] Проверил `docs/deployment.md` (Vercel settings)
4. [ ] Обновил `CHANGELOG.md`
5. [ ] Обновил environment variables на Vercel (если нужно)

### Изменил UI/компоненты:
1. [ ] Протестировал локально
2. [ ] Проверил адаптивность (mobile/desktop)
3. [ ] Обновил `CHANGELOG.md`
4. [ ] Если архитектура изменилась → обновил `docs/architecture.md`

### Решил проблему deployment:
1. [ ] Задокументировал проблему и решение в `docs/troubleshooting.md`
2. [ ] Обновил `CHANGELOG.md`
3. [ ] Проверил что решение работает на production

---

## ⚠️ ЗАПРЕЩЕНО

### Общие правила:
- ❌ Дублировать информацию (копировать факты/числа в разные файлы)
- ❌ Создавать дублирующие документы (QUICKSTART.md, PROJECT_SUMMARY.md и т.д.)
- ❌ Делать README длиннее 120 строк
- ❌ Забывать обновлять документацию после изменений

### Специфика проекта:
- ❌ Коммитить .env.local (только .env.example!)
- ❌ Коммитить API ключи в код
- ❌ Удалять/пересоздавать Vercel проект без крайней необходимости
- ❌ Изменять critical configuration без backup
- ❌ Push в production без тестирования

---

## 🎓 Best Practices

### Работа с Vercel:
- ✅ Используй Vercel CLI для automation
- ✅ Environment variables через CLI: `vercel env add`
- ✅ Проверяй deployment перед push: `vercel --prod`
- ✅ Храни credentials в .env.local (server-side)

### Работа с кодом:
- ✅ TypeScript для всего кода
- ✅ Используй type safety
- ✅ Комментируй сложную логику
- ✅ Следуй Next.js best practices
- ✅ Тестируй локально перед commit

### Работа с документацией:
- ✅ Обновляй при КАЖДОМ значительном изменении
- ✅ Следуй принципу SSOT
- ✅ Используй ссылки вместо дублирования
- ✅ Проверяй чек-листы перед commit

---

## 🚀 Быстрая навигация

**Начинаешь работу:**
1. Прочитай [README.md](README.md)
2. Посмотри [CHANGELOG.md](CHANGELOG.md) - что уже сделано
3. Изучи [docs/architecture.md](docs/architecture.md)
4. Проверь [docs/setup.md](docs/setup.md) для локальной разработки

**Нужна помощь:**
- Проблема с установкой → [docs/setup.md](docs/setup.md)
- Ошибка в коде → [docs/troubleshooting.md](docs/troubleshooting.md)
- Вопрос по архитектуре → [docs/architecture.md](docs/architecture.md)
- Проблема с Vercel → [docs/vercel-deploy-debug.md](docs/vercel-deploy-debug.md)
- Не знаешь как вести документацию → [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)

**Финишируешь задачу:**
1. Пройди чек-лист выше
2. Обнови документацию
3. Обнови CHANGELOG.md
4. Проверь SSOT
5. Commit + Push

---

## 🔥 Важные уроки из v1.0.5

**Решена критическая проблема:** MIDDLEWARE_INVOCATION_FAILED на Vercel

**Что было сделано:**
- 14+ попыток исправить через код (все неудачны)
- Определено что проблема в конфигурации Vercel проекта
- **Решение:** Полное пересоздание проекта через Vercel CLI
- Результат: Middleware работает, проект deployed

**Ключевые уроки:**
1. Иногда проблема не в коде, а в конфигурации платформы
2. Vercel CLI позволяет полностью автоматизировать пересоздание
3. Документирование процесса отладки критически важно
4. См. полную историю: [docs/vercel-deploy-debug.md](docs/vercel-deploy-debug.md)

---

**Этот файл - твой гид по проекту. Следуй ему и всё будет организовано правильно!**

**Версия:** 1.0.5  
**Последнее обновление:** 2025-10-15
