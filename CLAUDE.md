# Инструкция для Claude Code

**Проект:** Simply | **Версия:** 2.9.0 | **Статус:** ТЗ-6 завершён

**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

---

## 📖 Начни здесь

1. **[README.md](README.md)** — О проекте Simply
2. **[SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)** — Видение продукта
3. **[SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md)** — План разработки и прогресс
4. **[DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)** — Правила документации

**Главный принцип:** SSOT (Single Source of Truth)

---

## 🎯 О проекте

**Simply** — платформа AI-агентов для российского рынка.

**Философия:** Apple-подход. Качество важнее количества.

**Ключевые особенности:**
- Каталог проработанных AI-агентов
- Персонализация готовых агентов (не создание с нуля)
- Мультипровайдер: GPT, Claude, Gemini
- Smart Routing — автовыбор модели
- Оплата в рублях

---

## 🔧 Технологии

**Frontend:** Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS

**AI:**
- Vercel AI SDK (@ai-sdk/google, @ai-sdk/openai, @ai-sdk/anthropic)
- Текущий: Google Gemini (3 Pro + 2.5 Flash)
- План: мультипровайдер

**Backend:** NextAuth 5.0-beta.25, PostgreSQL (Neon), Drizzle ORM

**Storage:** Vercel Blob Storage

**Deploy:** Vercel

---

## 📁 Структура кода

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` — Chat endpoint (streaming)
- `lib/ai/providers.ts` — Конфигурация AI-моделей
- `lib/ai/tools/` — Инструменты (search, excel, web scraping)
- `lib/ai/tools/excel/` — Excel tools (create, parse, edit)
- `lib/db/seed-agents.ts` — Агенты и промпты (БД)

**Auth/DB:**
- `app/(auth)/` — NextAuth 5.0 setup
- `lib/db/schema.ts` — Database schema (Drizzle)
- `lib/db/queries.ts` — Database queries

**Agents UI:**
- `app/(chat)/agents/page.tsx` — Каталог агентов
- `app/(chat)/agents/[slug]/page.tsx` — Страница агента
- `components/sidebar-agents.tsx` — Секция агентов в sidebar

**Agents API:**
- `app/api/agents/route.ts` — GET список агентов
- `app/api/agents/[slug]/route.ts` — GET агент по slug
- `app/api/agents/by-name/[name]/route.ts` — GET агент по имени (ТЗ-2)
- `app/api/chats/[id]/agent/route.ts` — PATCH смена агента

**@-mentions & UI (ТЗ-2):**
- `lib/agents/parse-mentions.ts` — Парсинг @-mentions
- `components/mention-autocomplete.tsx` — Автокомплит @-mentions
- `components/action-buttons.tsx` — Кнопки действий в сообщениях
- `components/chat-hint.tsx` — Подсказки для новых пользователей

**User Profile (ТЗ-3A):**
- `app/(chat)/api/user/profile/route.ts` — API профиля (GET/PATCH)
- `app/(chat)/settings/page.tsx` — Страница настроек
- `app/(chat)/settings/settings-page.tsx` — UI настроек
- `components/sidebar-user-nav.tsx` — Меню пользователя
- `components/onboarding-dialog.tsx` — Онбординг
- `hooks/use-theme-sync.ts` — Синхронизация темы
- `lib/ai/prompts.ts` — buildUserContext

**Agent Personalization (ТЗ-3B):**
- `app/(chat)/api/user-agents/route.ts` — API персональных агентов (GET/POST)
- `app/(chat)/api/user-agents/[id]/route.ts` — PATCH/DELETE персонального агента
- `app/(chat)/agents/[slug]/add-to-my-agents-button.tsx` — Кнопка "В мои агенты"
- `components/personalization-dialog.tsx` — Диалог персонализации (4 шага)
- `components/delete-agent-dialog.tsx` — Подтверждение удаления
- `lib/ai/prompts.ts` — buildAgentCustomizations

**Config:**
- `.env.local` — API keys (НЕ коммитить!)
- `next.config.ts` — Next.js config
- `drizzle.config.ts` — Database config

---

## 🚀 Текущий этап

**Завершены:** Этап 0-6 (ТЗ-1 → ТЗ-6)
**Следующий:** Этап 7+ — Мультипровайдер, биллинг
**Прогресс:** См. [SIMPLY_STATUS.md](SIMPLY_STATUS.md)

**Выполнено в ТЗ-6:**
- Новый тип документа: Excel с формулами, графиками и стилями
- Excel через артефакты: createDocument + updateDocument + parseExcel
- 10 профессиональных шаблонов (бюджеты, медиапланы, инвойсы и др.)
- 5 цветовых тем
- Загрузка и анализ .xlsx/.xls файлов
- Экспорт: .xlsx, .pdf, Copy CSV
- Интеграция с агентами (Маркетолог, Копирайтер, Универсальный)

**Документы в холсте (5 типов):**
- `text` — plain text для соцсетей
- `markdown` — форматированные документы
- `excel` — таблицы с формулами и графиками (NEW)
- `presentation-reveal` — веб-презентации
- `presentation-pptx` — PowerPoint

**Детали:** [docs/ai-artifacts.md](docs/ai-artifacts.md)

---

## 📋 Команды

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

## 🔍 Навигация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — Текущее состояние проекта
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая (AI):**
- [docs/ai-agents.md](docs/ai-agents.md) — AI-агенты, модели, промпты
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Документы в холсте (text, markdown, presentations)
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

## 💡 Workflow

**При работе с новыми задачами:**
1. Читай [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние
2. Читай [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — куда идём
3. Читай docs/ — техническая документация
4. Выполняй задачу
5. Обновляй SIMPLY_STATUS.md и CHANGELOG.md

**Правило:** Не читай `_archive/` — там только история.

---

**Обновлено:** 2026-01-29
