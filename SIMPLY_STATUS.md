# Simply — Текущее состояние проекта

**Версия:** 2.13.0
**Дата:** 2026-02-01
**Статус:** Active development
**Production URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> **Назначение:** Полная информация о состоянии проекта для разработки ТЗ и архитектурных решений.

---

## 📖 О проекте

### Что это?

**Simply** — платформа AI-агентов для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

### Философия

- **Apple-подход:** Лучше 10 идеально работающих агентов, чем 100 посредственных
- **Best-in-Class API:** Не изобретаем велосипеды — интегрируем лучшие решения (Perplexity, Plus AI, Ideogram)

### Ключевые особенности

| Особенность | Описание | Статус |
|-------------|----------|--------|
| **Каталог агентов** | 8 проработанных агентов с проверенными промптами | ✅ |
| **Три уровня персонализации** | Профиль + RAG + Chat Memory | Профиль ✅, RAG/Memory 📋 |
| **Best-in-Class инструменты** | Perplexity, Plus AI, Ideogram, AssemblyAI | 📋 Фаза 1 |
| **Мультипровайдер** | GPT, Claude, Gemini через единый интерфейс | 📋 |
| **Smart Routing** | Автовыбор модели для экономии без потери качества | 📋 |
| **Оплата в рублях** | ЮKassa, Тинькофф, СБП | 📋 |

**Подробнее:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## ✅ Унаследовано от Family AI Assistant

Проект Simply построен на базе Family AI Assistant (v2.5.0). Сохранены:

### Инфраструктура
- ✅ Next.js 15.3 (App Router, RSC)
- ✅ NextAuth 5.0-beta.25
- ✅ PostgreSQL (Neon) + Drizzle ORM
- ✅ Vercel AI SDK
- ✅ Vercel Blob Storage

### AI-возможности
- ✅ Streaming responses
- ✅ Автовыбор модели (Gemini 3 Pro / 2.5 Flash)
- ✅ Web Search (Brave API)
- ✅ Weather (Open-Meteo)
- ✅ Get Current Date

### Артефакты (документы в холсте)
- ✅ Text Artifact (plain text + emoji)
- ✅ Markdown Artifact (форматированные документы) — NEW в ТЗ-5
- ✅ Excel Artifact (таблицы, формулы, графики) — NEW в ТЗ-6
- ✅ Presentation-Reveal (веб-презентации)
- ✅ Presentation-PPTX (PowerPoint)
- ✅ Public Share (публичные ссылки)
- ✅ PDF Export (для Markdown и Excel) — NEW в ТЗ-5/ТЗ-6

---

## 🤖 AI-агенты (в БД)

> Агенты мигрированы в БД в ТЗ-1. Промпты и capabilities хранятся в таблице `agents`.

| Агент | Тип | Модель | Slug |
|-------|-----|--------|------|
| **Помощник** | system | Gemini 3 Pro | helper |
| **Prompt-агент** | catalog | Gemini 3 Pro | prompt-agent |
| **Универсальный** | catalog | Gemini 2.5 Flash | universal |
| **Маркетолог** | catalog | Gemini 3 Pro | marketer |
| **Копирайтер** | catalog | Gemini 3 Pro | copywriter |
| **Переводчик** | catalog | Gemini 3 Pro | translator |
| **Наставник** | catalog | Gemini 3 Pro | mentor |
| **Презентатор** | catalog | Gemini 3 Pro | presenter |

Удалены: Кулинар, Астролог, Одессит

---

## 👤 Профиль пользователя (ТЗ-3A)

> Добавлен в ТЗ-3A. Данные профиля используются агентами и при персонализации.

### Поля профиля

| Поле | Тип | Описание |
|------|-----|----------|
| `displayName` | varchar(100) | Как обращаться к пользователю |
| `pronouns` | varchar(10) | "ты" / "вы" — форма обращения |
| `occupation` | varchar(100) | Сфера деятельности |
| `bio` | text | Контекст для агентов |
| `theme` | varchar(20) | "light" / "dark" / "system" |

### Функционал

- **Страница настроек** `/settings` — 3 секции (Профиль, Аккаунт, Внешний вид)
- **Меню пользователя** — имя вместо email, аватар, план, настройки
- **Онбординг** — 3-шаговый диалог для новых пользователей
- **Интеграция с агентами** — user context в system prompts
- **Синхронизация темы** — БД ↔ next-themes

---

## 🎭 Персонализация агентов (ТЗ-3B) — UI убран в ТЗ-4

> Backend сохранён для будущего, UI убран в рамках упрощения UX.

### API (сохранён)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/user-agents` | GET | Список персональных агентов |
| `/api/user-agents` | POST | Создание персонального агента |
| `/api/user-agents/[id]` | PATCH | Обновление настроек |
| `/api/user-agents/[id]` | DELETE | Soft delete (isActive = false) |

---

## 🎯 Упрощение UX (ТЗ-4)

> Философия: "iPhone, не Android". Убрана избыточная сложность.

### @-mentions — гостевой вызов

- @-mention НЕ меняет `Chat.agentId` — агент отвечает один раз как "гость"
- Следующее сообщение без @ идёт основному агенту чата
- Гостевые сообщения визуально выделены (отступ + фон + метка "↩️ гость")

### Greeting

- Greeting НЕ добавляется как сообщение в БД
- Пустой чат показывает UI заголовок + suggested actions

### Suggested Actions

- Берутся из `agent.capabilities.exampleTasks`
- Разные для каждого агента
- Дефолтные suggestions когда агент не выбран

### Подсказка

- Новый текст про гостевые вызовы
- Иконка 💡 в панели инструментов для повторного показа

---

## 🛠️ AI-инструменты

**Текущие (все агенты):**
- Web Search (Brave API)
- Get Current Date
- Get Weather (Open-Meteo)
- Read Document
- Create Document (text, markdown, excel, presentations)
- Update Document (редактирование артефактов)
- Request Suggestions
- Parse Excel (анализ загруженных файлов) — NEW в ТЗ-6

**Эксклюзивные (Презентатор):**
- Presentation-Reveal (через createDocument)
- Presentation-PPTX (через createDocument)

**Планируемые:**
- Website Analyzer (fetch, screenshot, SEO)
- Transcription (Whisper)
- Image Generation

---

## 🏗️ Технический стек

| Слой | Технология |
|------|------------|
| Frontend | Next.js 15.3, React 18, TypeScript, Tailwind CSS |
| AI | Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic) |
| Auth | NextAuth 5.0-beta.25 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob Storage |
| External | Brave Search, CloudConvert, Open-Meteo |
| Deploy | Vercel |

---

## 📈 План развития

### Этап 0: Документация и ребрендинг — ✅ ЗАВЕРШЁН
### Этап 1: Архитектура агентов (ТЗ-1) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Таблицы `agents`, `user_agents` в БД
- 7 агентов с промптами и capabilities
- UI каталога `/agents` и `/agents/[slug]`
- Смена агента в чате
- Greeting при старте чата

**Детали:** [TZ_01_AGENTS_ARCHITECTURE.md](TZ_01_AGENTS_ARCHITECTURE.md)

### Этап 2: Мультиагентный чат (ТЗ-2) — ✅ ЗАВЕРШЁН

**Выполнено:**
- @-mentions: парсинг, UI автокомплит, резолвинг агента
- Мультиагентный чат: иконка агента на сообщениях, `Message.agentId`
- Помощник: полный промпт-консьерж с динамическим `{AGENTS_LIST}`
- Prompt-агент: улучшение запросов, кнопки действий `[button:Label|payload]`
- Подсказки для новых пользователей (`ChatHint`)
- 8 агентов в БД (1 системный + 7 каталожных)

**Детали:** [TZ_02_MULTIAGENT_CHAT.md](TZ_02_MULTIAGENT_CHAT.md) | [TZ_02_ROADMAP.md](TZ_02_ROADMAP.md)

### Этап 3A: Профиль пользователя (ТЗ-3A) — ✅ ЗАВЕРШЁН

**Выполнено:**
- 5 новых полей в таблице User (displayName, pronouns, occupation, bio, theme)
- API: GET/PATCH `/api/user/profile`
- Страница настроек `/settings` с 3 секциями
- Редизайн меню пользователя (sidebar): имя, аватар, "Бесплатный", Настройки, Тема, Помощь, Выйти
- Динамическое приветствие вместо хардкода
- Онбординг для новых пользователей (3 шага)
- User context injection в system prompts всех агентов
- Синхронизация темы БД ↔ next-themes
- Очистка артефактов ("Family AI Assistant" → "Simply")

**Детали:** [TZ_03A_USER_PROFILE.md](TZ_03A_USER_PROFILE.md)

### Этап 3B: Персонализация агентов (ТЗ-3B) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Диалог персонализации (4 шага): имя, стиль, специализация, подтверждение
- CRUD API для персональных агентов (POST, PATCH, DELETE)
- Кнопка "В мои агенты" на странице каждого агента
- Секция "Мои агенты" в sidebar с меню действий
- Редактирование и удаление персональных агентов
- buildAgentCustomizations — применение настроек в system prompt
- Fallback в chat route: userAgent если не найден в каталоге

**Детали:** [TZ_03B_AGENT_PERSONALIZATION.md](TZ_03B_AGENT_PERSONALIZATION.md) | [TZ_03B_ROADMAP.md](TZ_03B_ROADMAP.md)

### Этап 4: Упрощение UX (ТЗ-4) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Убрана персонализация агентов из UI (backend сохранён)
- @-mentions теперь "гостевой вызов" — не меняет Chat.agentId
- Гостевые сообщения визуально выделены (отступ + фон + метка)
- Подсказка обновлена + иконка 💡 для повторного показа
- Suggested actions берутся из agent.capabilities.exampleTasks
- Убрано создание greeting как сообщения

**Детали:** [_archive/TZ_04_UX_SIMPLIFICATION.md](_archive/TZ_04_UX_SIMPLIFICATION.md)

### Этап 5: Markdown документы (ТЗ-5) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Новый тип документа: Markdown с рендерингом (react-markdown + remark-gfm)
- Режимы View/Edit с переключением кнопкой
- Скачивание: PDF (html2pdf.js) и .md файлы
- Публичные ссылки для Markdown документов
- Компактное превью документов в чате (Anthropic-стиль)
- Информация о формате документа (MD, TXT, PPTX, HTML)
- Панель подсказок с accordion-секциями
- Терминология: "артефакт" → "документ в холсте"

**Детали:** [_archive/TZ_05_MARKDOWN_ARTIFACTS.md](_archive/TZ_05_MARKDOWN_ARTIFACTS.md)

### Этап 6: Excel Tool (ТЗ-6) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Новый тип документа: Excel (таблицы, формулы, графики)
- Excel через артефакты: createDocument(kind: "excel") + updateDocument
- parseExcel для анализа загруженных файлов
- 10 профессиональных шаблонов (бюджеты, медиапланы, инвойсы и др.)
- 5 цветовых тем (corporate-blue, forest-green, warm-orange, professional-gray, modern-teal)
- Поддержка формул: SUM, AVERAGE, IF, VLOOKUP и др.
- Графики: столбчатые, линейные, круговые, area, doughnut
- Русская локализация (₽, даты DD.MM.YYYY, числа с пробелами)
- Загрузка и анализ .xlsx/.xls файлов
- Экспорт: .xlsx, .pdf, Copy CSV
- Интеграция с агентами (Маркетолог, Копирайтер, Универсальный)

**Детали:** [_archive/TZ_EXCEL_TOOL.md](_archive/TZ_EXCEL_TOOL.md) | [_archive/TZ_06_ROADMAP.md](_archive/TZ_06_ROADMAP.md)

### Performance Audit — ✅ ЗАВЕРШЁН

**Выполнено:**
- Исправлен сломанный memo() в PreviewMessage и Artifact
- Генерация заголовка чата перенесена в фоновый режим (-2-3 сек TTFT)
- DB запросы параллелизированы (Promise.all)
- Добавлено кэширование каталога агентов (5 мин)
- Добавлен LIMIT в getMessagesByChatId (макс. 200)
- Исключён lastContext из sidebar history
- Оптимизирована Excel генерация (array.join)
- sessionStorage только для slow renders

**Отложено:** Виртуализация сообщений (требует @tanstack/react-virtual)

### Artifact Loading UX — ✅ ЗАВЕРШЁН

**Выполнено:**
- Code Rain анимация — падающие символы контекстные для каждого типа артефакта
- Статусные сообщения с плавной ротацией ("Думаю...", "Генерирую таблицу...")
- Streaming индикатор — плавающая плашка "Генерация документа..." внизу
- Исправлен баг с дублированием карточек документов (дедупликация по result.id)
- Исправлены стили code blocks в Markdown (контрастный текст)
- Артефакт открывается сразу при начале стриминга (было: после 400 символов)
- Исправлен баг Excel: `excelData.sheets undefined` — добавлена проверка перед рендерингом

**Файлы изменены:**
- `components/document-skeleton.tsx` — Code Rain анимация
- `app/globals.css` — CSS keyframes
- `components/message.tsx` — дедупликация tool results
- `artifacts/markdown/client.tsx` — streaming индикатор, стили code blocks
- `artifacts/text/client.tsx` — streaming индикатор
- `artifacts/excel/client.tsx` — проверка sheets
- `artifacts/presentation-reveal/client.tsx` — artifactKind
- `artifacts/presentation-pptx/client.tsx` — artifactKind

### ТЗ-VOICE-02: Voice Input (Deepgram) — ✅ ЗАВЕРШЁН

**Причина миграции:** AssemblyAI Streaming не поддерживает русский язык.
**Решение:** Deepgram Nova-3 (поддерживает русский в real-time streaming).

**Выполнено:**
- ✅ Token endpoint `/api/deepgram/token` (POST + GET)
- ✅ WebSocket подключение к Deepgram Nova-3
- ✅ Параметры: `language=ru`, `smart_format`, `punctuate`, `interim_results`
- ✅ Захват аудио через Web Audio API (PCM 16-bit, 16kHz)
- ✅ Кнопка микрофона с визуальными состояниями
- ✅ Interim транскрипты (текст появляется во время речи)
- ✅ Финальные транскрипты в поле ввода
- ✅ Ручной стоп (без автостопа по паузе — можно думать, мычать)
- ✅ Лимит 3 минуты (защита от забытой записи)

**Философия:** Apple-подход — качество важнее экономии. Пользователь контролирует запись.

**Файлы:**
- `app/(chat)/api/deepgram/token/route.ts` — Token API
- `lib/audio/constants.ts` — DEEPGRAM_PARAMS, MAX_RECORDING_DURATION
- `lib/audio/types.ts` — DeepgramMessage
- `hooks/use-voice-recorder.ts` — React хук (Deepgram WebSocket)
- `components/voice-button.tsx` — UI компонент

**Переменные окружения:**
- `DEEPGRAM_API_KEY` — добавить в `.env.local` и Vercel

**Детали:** [TZ_VOICE_01_MIGRATION_TO_DEEPGRAM.md](TZ_VOICE_01_MIGRATION_TO_DEEPGRAM.md)

### Следующие этапы ← ROADMAP

| Этап | Описание | Приоритет |
|------|----------|-----------|
| **7** | Tool Activity UX (индикация работы инструментов) | 🔴 Высокий |
| **8** | Инструменты Фаза 1 (Perplexity, Plus AI, Ideogram) | 🔴 Высокий |
| **9** | RAG (База знаний пользователя) | 🟡 Средний |
| **10** | Chat Memory (автоизвлечение фактов) | 🟡 Средний |
| **11** | Мультипровайдер (GPT, Claude) | 🟡 Средний |
| **12** | Биллинг (Pay-as-you-go, рубли) | 🟡 Средний |
| **13** | Инструменты Фаза 2 (видео, TTS quality) | 🟢 Низкий |
| **14** | Инструменты Фаза 3 + Morning Briefing | 🟢 Низкий |

**Философия инструментов:** Best-in-Class API — интегрируем лучшие готовые решения, не изобретаем велосипеды.

**Подробности:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## 📊 Статистика

| Метрика | Значение |
|---------|----------|
| Версия | 2.13.0 |
| Статус | Active development |
| Voice Input | Deepgram Nova-3 (русский) |
| AI-агентов | 8 (в БД) |
| AI моделей | 2 (Gemini 3 Pro, 2.5 Flash) |
| AI-инструментов | 8 |
| Типов документов | 5 (text, markdown, excel, presentation-reveal, presentation-pptx) |
| Тем презентаций | 5 |
| Тем Excel | 5 |
| Шаблонов Excel | 10 |
| Production build | ✅ Успешен |

---

## 🔗 Документация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая:**
- [docs/ai-agents.md](docs/ai-agents.md) — AI-агенты
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Артефакты
- [docs/ai-tools.md](docs/ai-tools.md) — Инструменты
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/setup.md](docs/setup.md) — Установка
- [docs/decisions/](docs/decisions/) — ADR

**ТЗ (архив):**
- [_archive/TZ_01_AGENTS_ARCHITECTURE.md](_archive/TZ_01_AGENTS_ARCHITECTURE.md) — Этап 1
- [_archive/TZ_02_MULTIAGENT_CHAT.md](_archive/TZ_02_MULTIAGENT_CHAT.md) — Этап 2
- [_archive/TZ_03A_USER_PROFILE.md](_archive/TZ_03A_USER_PROFILE.md) — Этап 3A
- [_archive/TZ_03B_AGENT_PERSONALIZATION.md](_archive/TZ_03B_AGENT_PERSONALIZATION.md) — Этап 3B
- [_archive/TZ_04_UX_SIMPLIFICATION.md](_archive/TZ_04_UX_SIMPLIFICATION.md) — Этап 4
- [_archive/TZ_05_MARKDOWN_ARTIFACTS.md](_archive/TZ_05_MARKDOWN_ARTIFACTS.md) — Этап 5
- [_archive/TZ_EXCEL_TOOL.md](_archive/TZ_EXCEL_TOOL.md) — Этап 6
- [_archive/TZ_06_ROADMAP.md](_archive/TZ_06_ROADMAP.md) — Этап 6 Roadmap
- [_archive/TZ_VOICE_01_VOICE_INPUT_MVP.md](_archive/TZ_VOICE_01_VOICE_INPUT_MVP.md) — Voice Input AssemblyAI (отменён)
- [TZ_VOICE_01_MIGRATION_TO_DEEPGRAM.md](TZ_VOICE_01_MIGRATION_TO_DEEPGRAM.md) — Voice Input Deepgram (завершён)

---

**Обновлено:** 2026-02-01
