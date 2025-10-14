# ADR 002: Почему Next.js для этого проекта

**Дата:** 2025-10-14
**Статус:** Принято

---

## Контекст

Для проекта NegotiateAI Assistant нужно было выбрать технологию для создания веб-приложения с чат-ботом.

Требования:
- Быстрая разработка (дедлайн 2-4 часа)
- Frontend + Backend в одном проекте
- Streaming responses для чата
- Безопасное хранение API ключей (server-side)
- Лёгкий деплой на Vercel
- Поддержка React компонентов

Рассматривались варианты:
- Next.js (Full-stack React framework)
- Отдельный Frontend (React/Vite) + Backend (FastAPI/Express)
- Astro (Static site generator)

---

## Решение

Выбрали **Next.js 14 с App Router** для всего проекта (frontend + backend).

---

## Причины

### 1. Unified Codebase (Frontend + Backend)

**Next.js:**
```
project/
├── app/
│   ├── page.tsx           - Frontend (React)
│   └── api/chat/route.ts  - Backend (API routes)
├── components/            - React компоненты
└── lib/                   - Shared utilities
```

Всё в одном репозитории, один язык (TypeScript), одна команда `npm run dev`.

**Альтернатива (разделённые):**
```
frontend/          - React + Vite
backend/           - FastAPI/Express
```
Два репозитория, два сервера, два деплоя, больше сложности.

### 2. Server-Side Rendering + API Routes

**App Router** даёт:
- **Server Components** - рендеринг на сервере, безопасный доступ к API ключам
- **API Routes** - встроенный backend для обработки запросов
- **Route Handlers** - легко создавать endpoints

Пример:
```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  // API ключ безопасен - это серверный код
  const response = await anthropic.messages.create({
    apiKey: process.env.ANTHROPIC_API_KEY, // не уйдёт на клиент!
    ...
  });
  return Response.json(response);
}
```

**Безопасность:** API ключи никогда не попадают в браузер.

### 3. Vercel AI SDK Integration

Next.js отлично работает с **Vercel AI SDK** (`ai` package):

```typescript
import { useChat } from 'ai/react';

// В одну строку получаем:
// - Streaming ответов
// - Управление состоянием
// - Обработку ошибок
const { messages, input, handleSubmit } = useChat();
```

Для других фреймворков пришлось бы писать это вручную.

### 4. Быстрая разработка

Next.js предоставляет:
- ✅ **Zero-config** - работает из коробки
- ✅ **Hot reload** - мгновенные обновления
- ✅ **TypeScript** - полная поддержка
- ✅ **Routing** - файловая система = роуты
- ✅ **Styling** - Tailwind CSS из коробки

**Time to first deploy:** <1 час

С разделёнными стеками (React + FastAPI) - минимум 2-3 часа только на setup.

### 5. Vercel Deployment

Next.js создан **Vercel** - деплой максимально простой:

1. `git push` → автоматический деплой
2. Environment variables через UI
3. Edge Functions для быстрых ответов
4. Automatic HTTPS, CDN, caching

**Бесплатный tier:** достаточно для production.

С другими стеками:
- Frontend на Vercel
- Backend на Railway/Render/AWS
- Настройка CORS между ними
- Два отдельных деплоя

### 6. Streaming Support

Next.js 14 **нативно поддерживает streaming**:

```typescript
// Server-side streaming из коробки
return new Response(stream.toReadableStream(), {
  headers: {
    'Content-Type': 'text/event-stream'
  }
});
```

В клиенте:
```typescript
// Vercel AI SDK автоматически обрабатывает streaming
const { messages } = useChat(); // streaming включен по умолчанию
```

---

## Последствия

### Плюсы

- ✅ **Быстрая разработка** - всё из коробки
- ✅ **Единый codebase** - меньше сложности
- ✅ **Type safety** - TypeScript везде (frontend + backend)
- ✅ **Безопасность** - API ключи на сервере
- ✅ **Простой деплой** - one-click на Vercel
- ✅ **Отличный DX** - hot reload, error messages, документация
- ✅ **Streaming из коробки** - для чата критично

### Минусы

- ❌ **Vercel lock-in** - лучше всего работает на Vercel
- ❌ **Сложность Next.js** - много концепций (Server/Client Components, App Router)
- ❌ **Overkill для простых проектов** - если нужен только статичный сайт
- ❌ **Bundle size** - Next.js тяжелее чем простой React

### Trade-offs

Мы выбрали **скорость разработки над гибкостью**.

С разделённым стеком (React + FastAPI):
- Больше гибкости (можно менять части независимо)
- Но медленнее разработка
- Сложнее поддержка
- Два деплоя

Next.js даёт:
- Быстрый старт
- Всё работает together
- Один деплой
- Но больше привязки к экосистеме

---

## Альтернативы

### Альтернатива 1: React (Vite) + FastAPI

**Что это:**
- Frontend: React + Vite
- Backend: FastAPI (Python)

**Плюсы:**
- Разделение ответственности (frontend/backend teams)
- Python лучше для ML/AI если нужна тяжёлая обработка
- Независимый scaling (frontend ≠ backend)

**Почему отклонили:**
- **Дольше setup** - нужно настроить два проекта
- **CORS** - нужно настраивать между frontend/backend
- **Два деплоя** - сложнее CI/CD
- **Два языка** - TypeScript + Python
- **Для нашего случая Python не нужен** - просто проксируем запросы к Anthropic API

**Когда лучше:**
- Большая команда (разделённые frontend/backend разработчики)
- Нужна тяжёлая обработка на Python (ML models, numpy, pandas)
- Backend используется другими клиентами (mobile app, CLI)

### Альтернатива 2: Astro + API Routes

**Что это:** Static site generator с поддержкой React компонентов

**Плюсы:**
- Очень быстрый (static generation)
- Меньше JavaScript на клиенте
- Хорошая SEO

**Почему отклонили:**
- **Не подходит для чата** - нужен interactive runtime, не static
- **Меньше интеграций** - нет Vercel AI SDK из коробки
- **Streaming сложнее** - не заточен под realtime

**Когда лучше:**
- Блог, документация, landing pages
- SEO критично
- Минимальный JavaScript на клиенте

### Альтернатива 3: SvelteKit

**Что это:** Full-stack Svelte framework (аналог Next.js для Svelte)

**Плюсы:**
- Легче Next.js (меньше concepts)
- Меньше boilerplate
- Отличная производительность

**Почему отклонили:**
- **Меньше ecosystem** - Vercel AI SDK лучше работает с React
- **Меньше примеров** - для AI чатов больше примеров на Next.js
- **Team knowledge** - команда лучше знает React

**Когда лучше:**
- Любишь Svelte
- Простой проект без сложных зависимостей
- Performance критична

---

## Ссылки и ресурсы

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Next.js Examples - AI Chatbot](https://github.com/vercel/ai-chatbot)

---

## Примечания

### Vercel AI Chatbot Template

Проект можно было начать с официального template:
```bash
npx create-next-app --example https://github.com/vercel/ai-chatbot
```

Это даёт готовый чат с:
- Streaming
- Markdown rendering
- Tool calling
- Authentication (опционально)

Но мы создаём с нуля для:
- Полного понимания кода
- Кастомизации под наши нужды
- Обучения

### Next.js 13 vs 14

Используем **Next.js 14 с App Router** (не Pages Router).

App Router:
- ✅ Server Components
- ✅ Лучший streaming
- ✅ Улучшенная производительность
- ✅ Будущее Next.js

Pages Router:
- ❌ Устаревший подход
- ❌ Меньше возможностей
- ❌ Постепенно deprecated

---

## История изменений

- **2025-10-14** - Документ создан (Владимир)
- Решение принято для быстрой разработки MVP
