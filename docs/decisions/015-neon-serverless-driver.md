# ADR 015: Переход на @neondatabase/serverless

**Дата:** 2026-02-18
**Статус:** Принято

---

## Контекст

Simply использовал `postgres` (postgres.js) — TCP-драйвер для PostgreSQL — для подключения к Neon Serverless Postgres. При работе в dev-режиме и на Vercel (serverless functions) наблюдались массовые ошибки `ECONNRESET`:

```
[Error: read ECONNRESET] { errno: -54, code: 'ECONNRESET', syscall: 'read' }
```

**Масштаб проблемы:** за одну сессию — десятки ошибок. Страницы проектов и задач возвращали 500. Пользователь не мог зайти в проект, каждая загрузка — лотерея.

**Причина:** postgres.js использует постоянные TCP-соединения. Neon Serverless Proxy агрессивно закрывает idle-соединения (~30 секунд). При следующем запросе по "мёртвому" соединению — `ECONNRESET`.

**Почему это критично для 10–10 000 пользователей:**

| Сценарий | postgres.js (TCP) | Реальность |
|----------|-------------------|------------|
| 10 пользователей | ~10 TCP-соединений | Периодические ECONNRESET, терпимо |
| 100 пользователей | ~100 TCP-соединений | Частые обрывы, деградация UX |
| 1 000 пользователей | ~1 000 TCP-соединений | Neon лимит (300 connections) → массовые отказы |
| 10 000 пользователей | Невозможно | Connection limit исчерпан, приложение не работает |

На Vercel каждая serverless function создаёт **собственный пул соединений**. При 100 concurrent users это сотни TCP-соединений, каждое из которых может "протухнуть" в любой момент.

---

## Решение

Заменить `postgres` + `drizzle-orm/postgres-js` на `@neondatabase/serverless` + `drizzle-orm/neon-serverless`.

### До:
```typescript
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);
```

### После:
```typescript
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL! });
const db = drizzle(pool);
```

**Все drizzle-запросы остались без изменений.** Изменены только 6 строк инициализации.

---

## Причины

1. **WebSocket вместо TCP** — Neon's proxy оптимизирован для WebSocket. Нет "протухших" соединений, нет ECONNRESET
2. **Serverless-native** — `@neondatabase/serverless` спроектирован для serverless-окружений (Vercel, Cloudflare Workers, Deno Deploy)
3. **Connection pooling на стороне Neon** — не упирается в лимит соединений при масштабировании
4. **Официальный драйвер** — разработан и поддерживается командой Neon, гарантирована совместимость
5. **Быстрее** — нет overhead от TLS handshake при каждом реконнекте. Маршрутизация через Neon proxy оптимизирована

---

## Масштабирование (10–10 000 пользователей)

### Архитектурный принцип

> Каждое архитектурное решение должно проходить тест: "Будет ли это работать при 10 000 пользователей?"

### Как @neondatabase/serverless решает проблему масштаба

| Характеристика | postgres.js (TCP) | @neondatabase/serverless (WebSocket) |
|----------------|-------------------|--------------------------------------|
| Модель соединения | Постоянный TCP пул | WebSocket через Neon proxy |
| Idle timeout | Neon убивает → ECONNRESET | Управляется proxy, авто-реконнект |
| Лимит соединений | max_connections (~300) | Pooler на стороне Neon (тысячи) |
| Serverless совместимость | Плохая (cold start = new pool) | Нативная |
| Масштаб | ~100 concurrent users | 10 000+ concurrent users |
| Retry логика | Нужна вручную | Встроена в драйвер |

### Что это значит для Simply

- **Dev-режим:** Больше нет ECONNRESET при hot reload
- **Production (Vercel):** Каждая serverless function корректно работает с Neon proxy
- **Масштабирование:** Можем расти до 10 000 пользователей без изменений в DB-слое
- **Стабильность:** iPhone-level reliability — каждый запрос проходит с первого раза

---

## Альтернативы

### Альтернатива 1: Retry-обёртка для postgres.js

**Что это:** `withRetry()` функция, которая повторяет запрос при ECONNRESET.

**Почему отклонили:**
- Костыль — не решает корневую проблему
- Увеличивает latency (100-200ms задержка на retry)
- Нужно обернуть каждую функцию (50+ запросов)
- Не решает лимит соединений при масштабировании
- Маскирует проблему вместо решения

### Альтернатива 2: postgres.js с настройками idle_timeout

**Что это:** `idle_timeout: 20, max_lifetime: 1800` — закрывать соединения до того, как Neon их убьёт.

**Почему отклонили:**
- Уменьшает частоту ошибок, но не устраняет
- Race condition: между проверкой и использованием соединение может умереть
- Не решает проблему serverless (каждая function = новый пул)

### Альтернатива 3: drizzle-orm/neon-http (HTTP вместо WebSocket)

**Что это:** Каждый запрос — отдельный HTTP request. Абсолютно stateless.

**Почему отклонили:**
- `db.update()` без `.returning()` возвращает не-итерируемый результат — потребовалось бы менять ~12 запросов
- Не поддерживает транзакции (пригодятся в будущем: биллинг, RAG)
- WebSocket (neon-serverless) — оптимальный баланс: совместимость + производительность

---

## Последствия

### Плюсы

- **0 ECONNRESET** после переключения (проверено)
- Субъективно быстрее загрузка страниц (нет failed requests → нет retries)
- Готовность к масштабированию до 10 000 пользователей
- Поддержка транзакций для будущих фич (биллинг, RAG)
- `postgres` остаётся для CLI-тулинга (`drizzle-kit`, `seed.ts`, `migrate.ts`)

### Минусы

- Новая зависимость: `@neondatabase/serverless`, `@types/ws`
- Привязка к Neon (уже была — используем Neon как БД)
- WebSocket в dev-режиме требует `ws` пакет (в production Vercel предоставляет нативный WebSocket)

---

## Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `lib/db/queries.ts` | Заменён драйвер: postgres.js → @neondatabase/serverless |
| `package.json` | Добавлен `@neondatabase/serverless`, `@types/ws` |
| `lib/db/seed.ts` | Без изменений (использует postgres.js для CLI) |
| `lib/db/migrate.ts` | Без изменений (использует postgres.js для CLI) |

---

## Урок

> Выбор драйвера БД — не техническая мелочь. Это **архитектурное решение**, определяющее потолок масштабирования продукта. postgres.js отлично работает с обычным PostgreSQL, но Neon Serverless — это другая инфраструктура, требующая своего драйвера. Костыли (retry, timeout-настройки) маскируют проблему, но не решают её. Правильный инструмент для правильной задачи.

---

## Ссылки

- Драйвер: [@neondatabase/serverless](https://github.com/neondatabase/serverless)
- Drizzle адаптер: [drizzle-orm/neon-serverless](https://orm.drizzle.team/docs/get-started-postgresql#neon)
- Neon pooling docs: [neon.tech/docs/connect/connection-pooling](https://neon.tech/docs/connect/connection-pooling)
- Файл: `lib/db/queries.ts`

---

## История изменений

- **2026-02-18** — ADR создан. Переход с postgres.js на @neondatabase/serverless
