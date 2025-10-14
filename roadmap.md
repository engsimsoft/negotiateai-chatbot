# 🗺️ Roadmap: NegotiateAI Chatbot

## 📊 Текущий статус

- **Этап:** Phase 1 ЗАВЕРШЁН ✅ → Переход к Phase 2
- **Прогресс:** 5/20 задач (25%)
- **Текущая задача:** Phase 2 - Добавление custom tools
- **Достижение:** Claude Sonnet 4.5 работает! System prompt загружен! Базовый чат функционален!

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

### 2.1 Изучить систему tools в template
- [ ] Найти где template определяет tools
- [ ] Изучить формат tool definitions
- [ ] Понять как tools интегрируются с UI

### 2.2 Добавить read_document tool
- [ ] Создать файл `lib/tools/read-document.ts`
- [ ] Использовать Anthropic SDK для чтения DOCX/PDF
- [ ] Интегрировать с системой tools template
- [ ] Протестировать чтение документов

### 2.3 Добавить get_current_date tool
- [ ] Создать файл `lib/tools/get-current-date.ts`
- [ ] Простая функция возврата даты
- [ ] Интегрировать с системой tools
- [ ] Протестировать

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
- **Выполнено:** 5 (Phase 0: 3 задачи, Phase 1: 2 задачи)
- **В процессе:** 0
- **Осталось:** 15
- **Прогресс:** 25%

**Затраченное время:**
- Phase 0: ~2 часа (включая решение проблем с базой данных)
- Phase 1: ~1 час (интеграция Anthropic + system prompt)

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

**Обновлено:** 2025-10-14 (после Phase 1 completion)
**Следующее обновление:** После Phase 2.1

## 🎉 Достижения Phase 1

**Что работает сейчас:**
- ✅ Claude Sonnet 4.5 успешно интегрирован через @ai-sdk/anthropic
- ✅ System prompt загружается из system-prompt.md (~1018 строк)
- ✅ Claude представляется как "NegotiateAI Assistant"
- ✅ Claude понимает свою роль и проект MIR.TRADE
- ✅ Streaming ответов работает плавно
- ✅ Markdown форматирование отображается корректно
- ✅ Базовый чат полностью функционален
- ✅ Schema validation исправлена для нового model ID

**Следующие шаги:**
- Добавить custom tool: read_document (чтение DOCX/PDF из knowledge/)
- Добавить custom tool: get_current_date
- Добавить custom tool: web_search (Brave Search API)
- Протестировать работу всех tools
