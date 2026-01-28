# Family AI Assistant — Полный обзор проекта

**Версия:** 2.5.0
**Дата:** 2026-01-28
**Статус:** ✅ Production Ready
**Production URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> **Назначение документа:** Предоставить полную актуальную информацию о состоянии проекта для разработки новых технических заданий и архитектурных решений.

---

## 📖 О проекте

### Что это?

**Family AI Assistant** — персональный семейный AI-ассистент с ролями и специализированными агентами на базе Google Gemini.

### Для кого?

Приватный проект для **двух пользователей** с разными потребностями:

| Пользователь | Роль | Потребности | Email |
|--------------|------|-------------|-------|
| **Владимир** | Инженер (engineer) | Технический помощник, личностный рост, развлечение, презентации | vladimir@family.local |
| **Юлия** | Маркетолог (marketer) | Маркетинг, копирайтинг, переводы, кулинария, астрология, презентации | julia@family.local |

### Ключевая особенность

**Система из 9 специализированных AI-агентов** с персонализацией по ролям и автоматическим выбором AI модели для оптимизации затрат и качества ответов.

---

## ✅ Что реализовано (Этапы 1-4)

### Этап 1: Очистка и подготовка (ЗАВЕРШЁН - 2026-01-26)

**Цель:** Переиспользование кодовой базы NegotiateAI для нового назначения

**Выполнено:**
- ✅ Создана архивная ветка `archive/mir-trade-v1.0.14` (старый проект MIR.TRADE)
- ✅ Обновлена документация (README.md, CLAUDE.md, docs/*)
- ✅ Созданы ADR (Architecture Decision Records)
- ✅ Удалены устаревшие файлы (126 файлов, ~75MB)
- ✅ Production build протестирован

---

### Этап 2: Авторизация и роли (ЗАВЕРШЁН - 2026-01-27)

**Цель:** Убрать guest mode, добавить роли пользователей

**Выполнено:**
- ✅ Удален guest режим полностью
- ✅ Добавлена колонка `role` в таблицу User (миграция 0009)
- ✅ Создан seed скрипт для тестовых пользователей
- ✅ NextAuth 5.0 настроен корректно

---

### Этап 3: AI-агенты и персонализация (ЗАВЕРШЁН - 2026-01-27)

**Цель:** Система специализированных AI-агентов с автоматическим выбором модели

**Выполнено:**
- ✅ 8 специализированных AI-агентов с уникальными промптами
- ✅ Автоматический выбор AI модели (Gemini 3 Pro / 2.5 Flash)
- ✅ Персонализация по ролям (engineer/marketer)
- ✅ UI индикатор модели и режим "auto" по умолчанию

---

### Этап 4: Артефакты v2.0 (ЗАВЕРШЁН - 2026-01-28)

**Цель:** Упрощение артефактов, добавление презентаций, Public Share

**Выполнено:**
- ✅ Удалены code и sheet артефакты (не использовались)
- ✅ Упрощён text артефакт (plain text + emoji для соцсетей)
- ✅ Public Share инфраструктура (публичные ссылки без авторизации)
- ✅ Presentation-Reveal (веб-презентации на Reveal.js)
- ✅ Presentation-PPTX (PowerPoint через PptxGenJS + CloudConvert)
- ✅ Агент "Презентатор" с эксклюзивным доступом к presentation tools
- ✅ 5 профессиональных тем для презентаций

---

## 🤖 9 специализированных AI-агентов

| Агент | Иконка | Роль | Модель | Назначение |
|-------|--------|------|--------|------------|
| **Маркетолог** | 📊 | Marketer | Gemini 3 Pro | Стратегия, аналитика, целевая аудитория, продвижение |
| **Копирайтер** | ✍️ | Marketer | Gemini 3 Pro | Посты, рекламные тексты, заголовки с эмодзи |
| **Переводчик** | 🌐 | Marketer | Gemini 3 Pro | Точный перевод с учетом контекста |
| **Кулинар** | 🍳 | Marketer | Gemini 2.5 Flash | Рецепты, советы по готовке |
| **Астролог** | ⭐ | Marketer | Gemini 2.5 Flash | Нумерология и гороскопы |
| **Наставник** | 📚 | Both | Gemini 3 Pro | Личностный рост по методике Стивена Кови |
| **Универсальный** | 💬 | Both | Gemini 2.5 Flash | Общий ассистент для любых задач |
| **Одессит** | 😄 | Both | Gemini 2.5 Flash | Одесский юмор, байки |
| **Презентатор** | 🎯 | Both | Gemini 3 Pro | Создание PPTX и веб-презентаций |

**Персонализация по ролям:**
- **Юлия (marketer)**: видит все 9 агентов
- **Владимир (engineer)**: видит 4 агента (Наставник, Универсальный, Одессит, Презентатор)

---

## ✨ Артефакты (v2.5.0)

### 1. Text Artifact
- Plain text с emoji для соцсетей (VK, Telegram, Instagram)
- Копирование, скачивание .txt, Public Share

### 2. Presentation-Reveal (веб-презентации)
- **Доступ:** Эксклюзивно для агента Презентатор
- **Технология:** Reveal.js (iframe изоляция)
- 5 тем: corporate, modern, minimal, dark, creative
- Fullscreen, Public Share, Copy HTML

### 3. Presentation-PPTX (PowerPoint)
- **Доступ:** Эксклюзивно для агента Презентатор
- **Технология:** PptxGenJS + CloudConvert (preview)
- Настоящие PPTX файлы для PowerPoint/Keynote/Google Slides
- 5 тем, галерея превью слайдов, скачивание, Public Share

### Public Share (v2.3.0+)
- Все артефакты поддерживают публичные ссылки
- Ссылка: `/share/{token}` (без авторизации)
- Только артефакт виден (без истории чата)

---

## 🛠️ AI-инструменты

**Все агенты имеют доступ к:**
- **Web Search** (Brave Search API) - поиск в интернете
- **Get Current Date** - текущая дата/время
- **Get Weather** - погода (Open-Meteo API)
- **Read Document** - чтение из knowledge/
- **Create/Update Document** - артефакты (text)

**Только для Презентатора:**
- **Presentation-Reveal** - веб-презентации
- **Presentation-PPTX** - PowerPoint файлы

---

## 🏗️ Технический стек

### Frontend
- Next.js 15.3 (App Router, RSC)
- React 18, TypeScript, Tailwind CSS

### AI
- Google Gemini 3 Pro (профессиональные задачи)
- Google Gemini 2.5 Flash (быстрые задачи)
- Vercel AI SDK (@ai-sdk/google)

### Backend
- NextAuth 5.0-beta.25
- PostgreSQL (Neon) + Drizzle ORM
- Vercel Blob Storage

### External Services
- Brave Search API (web search)
- CloudConvert API (PPTX preview)
- Open-Meteo API (weather)

---

## 📈 Планы развития

### Этап 5: Система проектов (ПЛАНИРУЕТСЯ)

**Цель:** База знаний per-project, привязка чатов к проектам

**Ключевые задачи:**
- [ ] Таблица `projects` в БД (название, описание, userId)
- [ ] Привязка чатов к проектам (поле `projectId` в таблице `chat`)
- [ ] База знаний per-project (`knowledge/{projectId}/`)
- [ ] UI для управления проектами
- [ ] Загрузка файлов в проекты
- [ ] Фильтрация чатов по проектам

### Будущие улучшения (после Этапа 5)

**Экспорт артефактов:**
- Экспорт в DOCX (библиотека `docx`)
- Экспорт в PDF

**Расширение AI возможностей:**
- Image generation (DALL-E 3 / Stable Diffusion)
- Code execution (sandboxed environment)
- Audio transcription (Whisper)

---

## 📊 Статистика проекта

| Метрика | Значение |
|---------|----------|
| **Версия** | 2.5.0 |
| **AI-агентов** | 9 |
| **AI моделей** | 3 (Gemini 3 Pro, 2.5 Flash, 2.5 Pro) |
| **Артефактов** | 3 (text, presentation-reveal, presentation-pptx) |
| **Тем презентаций** | 5 |
| **Пользователей** | 2 (Владимир, Юлия) |
| **Production build** | ✅ Успешен |
| **TypeScript ошибок** | 0 |

---

## 🔗 Документация

**Основная:**
- [README.md](README.md) - Описание проекта
- [ROADMAP.md](ROADMAP.md) - План разработки
- [CHANGELOG.md](CHANGELOG.md) - История изменений
- [CLAUDE.md](CLAUDE.md) - Контекст для Claude Code

**Техническая:**
- [docs/ai-capabilities.md](docs/ai-capabilities.md) - AI возможности (SSOT)
- [docs/architecture.md](docs/architecture.md) - Архитектура
- [docs/setup.md](docs/setup.md) - Установка
- [docs/deployment.md](docs/deployment.md) - Deployment

**ADR:**
- [docs/decisions/001-why-gemini.md](docs/decisions/001-why-gemini.md)
- [docs/decisions/002-family-bot-concept.md](docs/decisions/002-family-bot-concept.md)
- [docs/decisions/003-no-guest-mode.md](docs/decisions/003-no-guest-mode.md)
- [docs/decisions/004-agent-system.md](docs/decisions/004-agent-system.md)

**Архив:**
- [_archive/TZ_STAGE_3_ROADMAP.md](_archive/TZ_STAGE_3_ROADMAP.md)
- [_archive/TZ_STAGE_ARTIFACTS_V2_ROADMAP.md](_archive/TZ_STAGE_ARTIFACTS_V2_ROADMAP.md)

---

**Документ обновлён:** 2026-01-28 (v2.5.0 - Stage 4 Artifacts v2 завершён)
**Автор:** Владимир (с помощью Claude Code)
