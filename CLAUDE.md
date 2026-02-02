# Инструкция для Claude Code

**Проект:** Simply | **Версия:** 3.2.0 | **Статус:** Active development

**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

---

## Начни здесь

1. **[README.md](README.md)** — О проекте Simply
2. **[SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)** — Видение продукта (roadmap, инструменты, концепции)
3. **[SIMPLY_STATUS.md](SIMPLY_STATUS.md)** — Текущее состояние проекта
4. **[DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)** — Правила документации

**Главный принцип:** SSOT (Single Source of Truth)

---

## О проекте

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

**Философия:**
- **Apple-подход** — качество важнее количества
- **Best-in-Class API** — не изобретаем велосипеды, интегрируем лучшие решения

**Ключевые особенности:**
- Универсальный AI-чат с инструментами (Gemini)
- Проекты: изолированные рабочие пространства (Claude)
- Модальные помощники: Prompt-агент (📝), Бен (❓)
- Три уровня персонализации: Профиль + RAG + Chat Memory
- Мультипровайдер: Gemini + Claude (GPT планируется)
- Оплата в рублях (ЮKassa, Тинькофф, СБП)

---

## Технологии

**Frontend:** Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS

**AI:**
- Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic)
- Текущий: Google Gemini (3 Pro + 2.5 Flash)
- Voice Input: Deepgram Nova-3 (русский язык)
- План: мультипровайдер

**Backend:** NextAuth 5.0-beta.25, PostgreSQL (Neon), Drizzle ORM

**Storage:** Vercel Blob Storage

**Deploy:** Vercel

---

## Структура кода

**Prompt System (v3.0):**
- `lib/prompts/` — Файловая система промптов
- `lib/prompts/chat/config.ts` — Конфиг основного чата
- `lib/prompts/ben/config.ts` — Конфиг Бена
- `lib/prompts/assistants/prompt-agent/config.ts` — Конфиг Prompt-агента
- `lib/prompts/builder.ts` — Логика сборки промптов
- `lib/prompts/contexts/` — Контексты (user-profile, chat-memory)

**Modal Assistants:**
- `components/modal-assistants/` — UI модальных помощников
- `components/modal-assistants/prompt-agent/` — Prompt-агент (📝)
- `components/modal-assistants/ben/` — Бен (❓), intro-bubble.tsx
- `app/(chat)/api/assistant/prompt-agent/route.ts` — API Prompt-агента
- `app/(chat)/api/assistant/ben/route.ts` — API Бена

**Dashboard:**
- `app/(dashboard)/` — Route group без sidebar
- `app/(dashboard)/dashboard/page.tsx` — Главная страница с карточками
- `components/dashboard/` — Dashboard компоненты (header, greeting, tool-card, tools-grid)

**Sidebar:**
- `components/sidebar-layout.tsx` — Layout с табами вне Sidebar
- `components/sidebar-tabs.tsx` — Вертикальные иконки (Search, Chats, Projects)
- `components/app-sidebar.tsx` — Sidebar с историей чатов
- `components/ui/sidebar.tsx` — CSS variable `--sidebar-left-offset`

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` — Chat endpoint (streaming)
- `lib/ai/providers.ts` — Конфигурация AI-моделей
- `lib/ai/model-tiers.ts` — Уровни моделей для проектов (Haiku/Sonnet/Opus)
- `lib/ai/professor-pipeline.ts` — Pipeline для режима Профессор
- `lib/ai/tools/` — Инструменты (search, excel, web scraping)
- `lib/ai/tools/excel/` — Excel tools (create, parse, edit)

**Projects (v3.2.0):**
- `app/(chat)/projects/` — Страницы проектов
- `app/(chat)/projects/page.tsx` — Список проектов
- `app/(chat)/projects/new/page.tsx` — Создание проекта
- `app/(chat)/projects/[id]/page.tsx` — Страница проекта
- `app/(chat)/projects/[id]/chat/` — Чаты проекта
- `app/(chat)/api/projects/` — API проектов (CRUD)
- `components/projects/professor-progress.tsx` — UI прогресса pipeline

**Voice Input (Deepgram):**
- `app/(chat)/api/deepgram/token/route.ts` — Token API
- `lib/audio/` — Аудио утилиты (types, constants, utils)
- `hooks/use-voice-recorder.ts` — Хук записи (Deepgram Nova-3)
- `components/voice-button.tsx` — Кнопка микрофона

**Auth/DB:**
- `app/(auth)/` — NextAuth 5.0 setup
- `lib/db/schema.ts` — Database schema (Drizzle)
- `lib/db/queries.ts` — Database queries

**User Profile:**
- `app/(chat)/api/user/profile/route.ts` — API профиля (GET/PATCH)
- `app/(chat)/api/user/ben-intro/route.ts` — API флага Бена (GET/PATCH)
- `app/(dashboard)/settings/page.tsx` — Страница настроек (без sidebar)
- `components/onboarding-dialog.tsx` — Онбординг

**Config:**
- `.env.local` — API keys (НЕ коммитить!)
- `next.config.ts` — Next.js config
- `drizzle.config.ts` — Database config

---

## Текущий этап

**Завершены:** ТЗ-03 (v3.2.0 — Проекты + Claude), ТЗ-02 (v3.1.0 — Dashboard + Sidebar), ТЗ-NEW-01 (v3.0.0 — новая архитектура промптов)
**Прогресс:** См. [SIMPLY_STATUS.md](SIMPLY_STATUS.md)

**Следующие этапы (по приоритету):**
| Этап | Описание | Приоритет |
|------|----------|-----------|
| 7 | Tool Activity UX | Высокий |
| 8 | Инструменты Фаза 1 (Perplexity, Plus AI, Ideogram) | Высокий |
| 9 | RAG (База знаний) | Средний |
| 10 | Chat Memory | Средний |
| 11 | Мультипровайдер GPT | Средний |
| 12 | Биллинг (Pay-as-you-go) | Средний |

**Документы в холсте (5 типов):**
- `text` — plain text для соцсетей
- `markdown` — форматированные документы
- `excel` — таблицы с формулами и графиками
- `presentation-reveal` — веб-презентации
- `presentation-pptx` — PowerPoint

**Детали:** [docs/ai-artifacts.md](docs/ai-artifacts.md) | [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## Команды

```bash
# Разработка
npm install              # Установка зависимостей
npm run dev              # Dev сервер (localhost:3000)
npm run build            # Сборка production
npm run start            # Запуск production

# Database
npm run db:migrate       # Применить миграции
npm run db:studio        # Drizzle Studio

# Deploy
vercel --prod            # Deploy на Vercel
```

---

## Навигация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — Текущее состояние проекта
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая (AI):**
- [docs/ai-providers.md](docs/ai-providers.md) — Провайдеры, модели, цены (SSOT)
- [docs/ai-agents.md](docs/ai-agents.md) — Система промптов и помощники
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Документы в холсте
- [docs/ai-tools.md](docs/ai-tools.md) — Инструменты (search, vision)

**Техническая (инфраструктура):**
- [docs/setup.md](docs/setup.md) — Установка
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/deployment.md](docs/deployment.md) — Deployment
- [docs/decisions/](docs/decisions/) — ADR

**Архив (не читать для новых задач):**
- [_archive/](_archive/) — завершённые ТЗ (история планирования)

> **Правило:** Папка `_archive/` содержит завершённые ТЗ. Вся актуальная информация уже в docs/. Не трать токены на изучение архива.

---

## Workflow

**Моя роль:** Получаю ТЗ → Пишу код → Документирую изменения в STATUS/CHANGELOG

**При работе с новыми задачами:**
1. Читай [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние
2. Читай [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — куда идём
3. Читай docs/ — техническая документация
4. Выполняй задачу
5. Обновляй SIMPLY_STATUS.md и CHANGELOG.md

**Правило:** Не читай `_archive/` — там только история.

---

**Обновлено:** 2026-02-02
