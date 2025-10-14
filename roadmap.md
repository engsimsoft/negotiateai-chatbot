# 🗺️ Roadmap: NegotiateAI Chatbot

## 📊 Текущий статус

- **Этап:** Phase 1 ЗАВЕРШЁН ✅, Phase 2 в процессе (частично)
- **Прогресс:** 6/20 задач (30%)
- **Текущая задача:** Исправление system prompt + добавление read_document
- **Проблема:** System prompt урезан (без index.md) из-за проблемы с 200K токенами
- **Достижение:** Базовый чат работает стабильно, getCurrentDate tool добавлен

---

## ⚠️ ВАЖНОЕ ИЗМЕНЕНИЕ СТРАТЕГИИ

**Согласно техзаданию (`Техзадание /negotiateai-tech-spec.md`):**
- ✅ **Использовать Vercel AI Chatbot Template** - готовое решение с auth, database, историей
- ✅ **НЕ писать с нуля** - адаптировать существующий код
- ✅ **Anthropic API напрямую** - не через OpenRouter
- ✅ **История, auth, database** - всё это уже есть в template и нужно

**Почему это правильно:**
1. Экономия времени (часы вместо дней)
2. Проверенная архитектура
3. Готовые UI компоненты
4. Работающий streaming
5. Auth и database из коробки

---

## Phase 0: Клонирование и настройка template ✅ ЗАВЕРШЁН

### 0.1 Клонировать Vercel AI Chatbot Template ✅
- [x] Клонировать репозиторий: `git clone https://github.com/vercel/ai-chatbot.git temp-chatbot`
- [x] Скопировать нужные файлы в текущий проект (174 файла)
- [x] Изучить структуру template

### 0.2 Сохранить важные файлы из текущего проекта ✅
- [x] Сохранить `knowledge/` (база знаний - ~102 файла)
- [x] Сохранить `system-prompt.md`
- [x] Сохранить `index.md` (восстановлен из git после случайного удаления)
- [x] Сохранить всю документацию (README, CLAUDE.md, docs/)

### 0.3 Настроить базовую структуру ✅
- [x] Установить зависимости из template (npm install --legacy-peer-deps)
- [x] Настроить .env.local с ANTHROPIC_API_KEY и AUTH_SECRET
- [x] Настроить Neon Postgres database (Vercel Integration)
- [x] Запустить миграции (npm run db:migrate - успешно за 3.3s)
- [x] Запустить dev server и проверить что работает (готов за 939ms)
- [x] UI загружается без ошибок - чат интерфейс работает!

---

## Phase 1: Интеграция Anthropic Provider ✅ ЗАВЕРШЁН

### 1.1 Настроить Anthropic как провайдер ✅
- [x] Изучить как template использует провайдеры
- [x] Установить @ai-sdk/anthropic (v2.0.27)
- [x] Настроить Anthropic provider в lib/ai/providers.ts
- [x] Установить модель claude-sonnet-4-20250514
- [x] Обновить lib/ai/models.ts (DEFAULT_CHAT_MODEL = "claude-sonnet-4")
- [x] Исправить schema validation в app/(chat)/api/chat/schema.ts
- [x] Протестировать базовый чат - работает!

### 1.2 Интегрировать system-prompt.md ✅
- [x] Найти где template загружает system prompt (lib/ai/prompts.ts)
- [x] Добавить функцию loadSystemPrompt() с кэшированием
- [x] Сделать systemPrompt() async функцией
- [x] Добавить await в app/(chat)/api/chat/route.ts
- [x] Протестировать что промпт применяется - Claude представляется как NegotiateAI!

---

## Phase 2: Добавить custom tools

### 2.1 Изучить систему tools в template ✅
- [x] Найти где template определяет tools
- [x] Изучить формат tool definitions
- [x] Понять как tools интегрируются с UI

### 2.2 Добавить read_document tool ⚠️ ПРОБЛЕМА
- [x] Создать файл `lib/ai/tools/read-document.ts`
- [x] Использовать fs/promises для чтения DOCX/PDF
- [ ] Интегрировать с системой tools template - **ОТКЛЮЧЕН из-за 200K токен проблемы**
- [ ] Протестировать чтение документов
- **ПРОБЛЕМА:** При добавлении в activeTools возникает ошибка `prompt is too long: 200281 tokens > 200000 maximum`
- **ПРИЧИНА:** Неизвестна - возможно загружается вся папка knowledge/ автоматически
- **СТАТУС:** Tool создан, но временно отключен до выяснения причины

### 2.3 Добавить get_current_date tool ✅
- [x] Создать файл `lib/ai/tools/get-current-date.ts`
- [x] Простая функция возврата даты
- [x] Интегрировать с системой tools
- [x] Протестировать - работает отлично!

### 2.4 Добавить web_search tool (Brave Search)
- [ ] Создать файл `lib/tools/web-search.ts`
- [ ] Интегрировать Brave Search API
- [ ] Добавить в систему tools
- [ ] Протестировать поиск

---

## Phase 3: Кастомизация UI

### 3.1 Брендинг
- [ ] Изменить название на "NegotiateAI Assistant"
- [ ] Добавить описание "Ассистент для переговоров по проекту MIR.TRADE"
- [ ] Настроить placeholder: "Задайте вопрос о проекте MIR.TRADE..."

### 3.2 Индикаторы использования tools
- [ ] Показывать "Читаю документ..." при вызове read_document
- [ ] Показывать "Ищу в интернете..." при web_search
- [ ] Показывать "Получаю текущую дату..." при get_current_date

---

## Phase 4: Тестирование

### 4.1 Тестирование функций
- [ ] Тест: "Расскажи про тендеры в Алжире" (read_document)
- [ ] Тест: "Какая сегодня дата?" (get_current_date)
- [ ] Тест: "Найди последние новости про MIR.TRADE" (web_search)
- [ ] Тест: Комбинация всех функций

### 4.2 Тестирование UI/UX
- [ ] Проверить адаптивность (desktop/mobile)
- [ ] Проверить streaming ответов
- [ ] Проверить markdown рендеринг
- [ ] Проверить историю чатов

---

## Phase 5: Деплой на Vercel

### 5.1 Подготовка к деплою
- [ ] Проверить что `/knowledge` включена в деплой
- [ ] Проверить что `system-prompt.md` и `index.md` доступны
- [ ] Создать `.env.example` с нужными переменными
- [ ] Обновить документацию для деплоя

### 5.2 Деплой
- [ ] Подключить GitHub репозиторий к Vercel
- [ ] Добавить environment variables в Vercel
- [ ] Задеплоить
- [ ] Протестировать в продакшене

---

## 📈 Общая статистика

- **Всего задач:** 20
- **Выполнено:** 6 (Phase 0: 3 задачи, Phase 1: 2 задачи, Phase 2: 1 задача)
- **В процессе:** 1 (Phase 2.2: read_document tool - проблема с токенами)
- **Осталось:** 13
- **Прогресс:** 30%

**Затраченное время:**
- Phase 0: ~2 часа (включая решение проблем с базой данных)
- Phase 1: ~1 час (интеграция Anthropic + system prompt)
- Phase 2: ~2 часа (Vercel Blob Storage, getCurrentDate tool, проблема с readDocument)

---

## 🎯 Приоритеты

**Сейчас:** Phase 2 (Добавление custom tools)
**Далее:** Phase 3 (UI кастомизация)
**Цель:** Завершить Phase 2 за 1-2 часа

---

## 📝 Примечания

### Почему НЕ писать с нуля:
1. ❌ Потратили весь день на борьбу с AI SDK API
2. ❌ Streaming не заработал правильно
3. ❌ Tools не работали из-за багов
4. ❌ Нет auth, database, истории - нужно было писать

### Почему template ЛУЧШЕ:
1. ✅ Всё уже работает из коробки
2. ✅ Проверенная архитектура от Vercel
3. ✅ Auth + Database готовы
4. ✅ Можно сфокусироваться на custom tools
5. ✅ Быстрее в 5-10 раз

---

**Обновлено:** 2025-10-14 (после Phase 2.3 completion, Phase 2.2 имеет проблему)
**Следующее обновление:** После решения проблемы с readDocument tool

## 🎉 Достижения Phase 1 + Phase 2 (частично)

**Что работает сейчас:**
- ✅ Claude Sonnet 4.5 успешно интегрирован через @ai-sdk/anthropic
- ✅ System prompt загружается из system-prompt.md (~1018 строк)
- ✅ Claude представляется как "NegotiateAI Assistant"
- ✅ Claude понимает свою роль и проект MIR.TRADE
- ✅ Streaming ответов работает плавно
- ✅ Markdown форматирование отображается корректно
- ✅ Базовый чат полностью функционален
- ✅ Schema validation исправлена для нового model ID
- ✅ Vercel Blob Storage подключен (загрузка изображений работает)
- ✅ getCurrentDate tool добавлен и работает отлично
- ✅ ADR 004 создан (документирует выбор Vercel Template)

**Известные проблемы:**
- ⚠️ readDocument tool создан, но отключен из-за проблемы с 200K токенами
- ⚠️ index.md не встроен в system-prompt.md (временно удалён)
- ⚠️ Нужно выяснить почему readDocument вызывает загрузку всей папки knowledge/

**Следующие шаги:**
- Исправить readDocument tool (убедиться что он загружает только запрошенный файл)
- Вернуть index.md в system-prompt.md (как требует техзадание)
- Добавить custom tool: web_search (Brave Search API)
- Протестировать работу всех tools
