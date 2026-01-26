# ТЗ: Этап 2 - Авторизация и роли

**Дата:** 2026-01-26
**Версия:** 1.0.0
**Оценка времени:** 6-9 часов
**Статус:** 📋 План создан

---

## 📋 Содержание

1. [Обзор](#обзор)
2. [Цели](#цели)
3. [Детальный план](#детальный-план)
4. [Файлы для изменения](#файлы-для-изменения)
5. [Последовательность выполнения](#последовательность-выполнения)
6. [Проверка](#проверка)

---

## Обзор

**Цель:** Удалить guest режим, добавить систему ролей, создать seed скрипт для 2 пользователей.

**Контекст:**
- Проект Family AI Assistant - приватный, для 2 пользователей
- Guest режим больше не нужен (см. [docs/decisions/003-no-guest-mode.md](docs/decisions/003-no-guest-mode.md))
- Нужны роли: `engineer` (Владимир), `marketer` (Юлия)

**Результат:**
- ✅ Guest режим полностью удалён
- ✅ User schema содержит role (enum: engineer, marketer)
- ✅ Seed скрипт создаёт 2 пользователей
- ✅ Middleware требует авторизацию (редирект на /login)
- ✅ Сборка и тесты проходят

---

## Цели

### Основные
1. Удалить guest режим (3-4 ч)
2. Добавить роли в БД (2-3 ч)
3. Seed скрипт с 2 пользователями (1-2 ч)

### Дополнительные
- Упростить auth код (~200-300 строк меньше)
- Улучшить безопасность (нет анонимного доступа)
- Подготовить базу для персонализации (system prompts по ролям)

---

## Детальный план

### Задача 1: Добавить роли в БД (2-3 ч)

#### 1.1 Обновить schema.ts
**Файл:** `lib/db/schema.ts`

**Изменения:**
```typescript
// БЫЛО:
export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
});

// СТАНЕТ:
export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  role: varchar("role", { enum: ["engineer", "marketer"] })
    .notNull()
    .default("engineer"),
});

export type UserRole = "engineer" | "marketer";
```

#### 1.2 Создать миграцию
**Команда:**
```bash
npm run db:migrate
```

**Миграция SQL:**
```sql
-- Migration: Add role column to User table
ALTER TABLE "User" ADD COLUMN "role" VARCHAR NOT NULL DEFAULT 'engineer';
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('engineer', 'marketer'));
```

**Проверка:**
```bash
npm run db:studio
```

---

### Задача 2: Удалить guest режим (3-4 ч)

#### 2.1 Удалить guest provider
**Файл:** `app/(auth)/auth.ts`

**Изменения:**
1. Удалить строки 68-75 (guest Credentials provider)
2. Удалить `type UserType = "guest" | "regular"` (строка 9)
3. Упростить Session/User типы:

```typescript
// УДАЛИТЬ:
export type UserType = "guest" | "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;  // ← УДАЛИТЬ
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;  // ← УДАЛИТЬ
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;  // ← УДАЛИТЬ
  }
}
```

**НОВАЯ ВЕРСИЯ:**
```typescript
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role?: string;  // ← ДОБАВИТЬ (для будущего использования)
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    role?: string;  // ← ДОБАВИТЬ
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role?: string;  // ← ДОБАВИТЬ
  }
}
```

4. Обновить callbacks:
```typescript
callbacks: {
  jwt({ token, user }) {
    if (user) {
      token.id = user.id as string;
      token.role = user.role;  // ← ДОБАВИТЬ
    }
    return token;
  },
  session({ session, token }) {
    if (session.user) {
      session.user.id = token.id;
      session.user.role = token.role;  // ← ДОБАВИТЬ
    }
    return session;
  },
},
```

5. Обновить authorize() в Credentials provider:
```typescript
// БЫЛО:
return { ...user, type: "regular" };

// СТАНЕТ:
return { ...user, role: user.role };
```

#### 2.2 Удалить createGuestUser
**Файл:** `lib/db/queries.ts`

**Действие:** Удалить функцию `createGuestUser()` (строки 66-80)

**Также удалить импорт в auth.ts:**
```typescript
// УДАЛИТЬ:
import { createGuestUser, getUser } from "@/lib/db/queries";

// СТАНЕТ:
import { getUser } from "@/lib/db/queries";
```

#### 2.3 Обновить middleware
**Файл:** `middleware.ts`

**Изменения:**
```typescript
// БЫЛО (строки 26-32):
if (!token) {
  const redirectUrl = encodeURIComponent(request.url);
  return NextResponse.redirect(
    new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
  );
}

// СТАНЕТ:
if (!token) {
  return NextResponse.redirect(new URL("/login", request.url));
}
```

**Удалить строки 34-38:**
```typescript
// УДАЛИТЬ:
const isGuest = guestRegex.test(token?.email ?? "");

if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
  return NextResponse.redirect(new URL("/", request.url));
}
```

**НОВАЯ ВЕРСИЯ:**
```typescript
if (token && ["/login", "/register"].includes(pathname)) {
  return NextResponse.redirect(new URL("/", request.url));
}
```

**Удалить импорт:**
```typescript
// УДАЛИТЬ:
import { guestRegex, isDevelopmentEnvironment } from "./lib/constants";

// СТАНЕТ:
import { isDevelopmentEnvironment } from "./lib/constants";
```

#### 2.4 Удалить guest endpoint
**Файл:** `app/(auth)/api/auth/guest/route.ts`

**Действие:** Удалить весь файл
```bash
rm app/\(auth\)/api/auth/guest/route.ts
```

#### 2.5 Удалить guestRegex
**Файл:** `lib/constants.ts`

**Удалить строку 11:**
```typescript
// УДАЛИТЬ:
export const guestRegex = /^guest-\d+$/;
```

---

### Задача 3: Seed скрипт (1-2 ч)

#### 3.1 Создать seed скрипт
**Файл:** `lib/db/seed.ts`

```typescript
import "server-only";
import { hash } from "bcrypt-ts";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "./schema";

async function main() {
  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  console.log("🌱 Seeding database...");

  // Хеширование паролей
  const vladimirPassword = await hash("change-me-vladimir", 10);
  const juliaPassword = await hash("change-me-julia", 10);

  try {
    // Вставка пользователей
    await db.insert(user).values([
      {
        email: "vladimir@family.local",
        password: vladimirPassword,
        role: "engineer",
      },
      {
        email: "julia@family.local",
        password: juliaPassword,
        role: "marketer",
      },
    ]);

    console.log("✅ Seed completed!");
    console.log("\nUsers created:");
    console.log("- vladimir@family.local (engineer) / password: change-me-vladimir");
    console.log("- julia@family.local (marketer) / password: change-me-julia");
    console.log("\n⚠️  Don't forget to change passwords after first login!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
```

#### 3.2 Добавить npm script
**Файл:** `package.json`

```json
{
  "scripts": {
    "db:seed": "tsx lib/db/seed.ts"
  }
}
```

**Запуск:**
```bash
npm run db:seed
```

---

### Задача 4: Проверка и тестирование (30 мин)

#### 4.1 Проверить UI
**Файлы для проверки:**
- `app/(auth)/login/page.tsx` - нет упоминаний guest
- `app/(auth)/register/page.tsx` - нет упоминаний guest

**Действие:** Прочитать файлы и убедиться, что нет guest логики

#### 4.2 Тестирование
```bash
# 1. Сборка
npm run build

# 2. Dev сервер
npm run dev

# 3. Проверить flow:
# - Открыть http://localhost:3000
# - Должен редирект на /login (не на guest)
# - Залогиниться: vladimir@family.local / change-me-vladimir
# - Проверить, что чат работает

# 4. Проверить БД
npm run db:studio
# Проверить, что есть 2 юзера с ролями
```

---

## Файлы для изменения

### Обязательные изменения (10 файлов)

| Файл | Действие | Оценка времени |
|------|----------|----------------|
| `lib/db/schema.ts` | Добавить role колонку | 15 мин |
| `app/(auth)/auth.ts` | Удалить guest provider, обновить типы | 45 мин |
| `lib/db/queries.ts` | Удалить createGuestUser | 5 мин |
| `middleware.ts` | Обновить redirect логику | 20 мин |
| `app/(auth)/api/auth/guest/route.ts` | Удалить файл | 2 мин |
| `lib/constants.ts` | Удалить guestRegex | 2 мин |
| `lib/db/seed.ts` | Создать seed скрипт | 30 мин |
| `package.json` | Добавить db:seed script | 2 мин |
| `app/(auth)/login/page.tsx` | Проверить/обновить UI | 15 мин |
| `app/(auth)/register/page.tsx` | Проверить/обновить UI | 15 мин |

### Опциональные изменения

| Файл | Действие | Оценка времени |
|------|----------|----------------|
| `ROADMAP.md` | Обновить прогресс Этапа 2 | 10 мин |
| `CHANGELOG.md` | Добавить v2.1.0 entry | 10 мин |
| `docs/architecture.md` | Обновить auth секцию | 20 мин |
| `.env.example` | Добавить комментарии про seed | 5 мин |

---

## Последовательность выполнения

### Фаза 1: Database (30 мин)
1. Обновить `lib/db/schema.ts` (добавить role)
2. Создать миграцию (`npm run db:migrate`)
3. Проверить БД (`npm run db:studio`)

### Фаза 2: Auth Logic (2 ч)
1. Обновить `app/(auth)/auth.ts`:
   - Удалить guest provider
   - Упростить типы
   - Обновить callbacks
2. Удалить `createGuestUser` из `lib/db/queries.ts`
3. Обновить `middleware.ts` (redirect на /login)
4. Удалить `app/(auth)/api/auth/guest/route.ts`
5. Удалить `guestRegex` из `lib/constants.ts`

### Фаза 3: Seed Script (1 ч)
1. Создать `lib/db/seed.ts`
2. Добавить npm script в `package.json`
3. Запустить seed (`npm run db:seed`)
4. Проверить в БД (2 юзера с ролями)

### Фаза 4: Testing (30 мин)
1. `npm run build` - проверить сборку
2. `npm run dev` - проверить dev сервер
3. Проверить login flow (редирект на /login, не guest)
4. Залогиниться как vladimir и julia
5. Проверить, что чат работает

### Фаза 5: Documentation (30 мин)
1. Обновить `ROADMAP.md` (отметить задачи Этапа 2)
2. Обновить `CHANGELOG.md` (v2.1.0)
3. Коммит и пуш

---

## Проверка

### Чеклист успешного выполнения

**Database:**
- [ ] User schema содержит role колонку
- [ ] Миграция применена успешно
- [ ] Seed создаёт 2 пользователя (vladimir, julia)
- [ ] Роли установлены правильно (engineer, marketer)

**Auth:**
- [ ] Guest provider удалён из auth.ts
- [ ] Session не содержит type: "guest"
- [ ] Middleware редиректит на /login (не /api/auth/guest)
- [ ] Guest endpoint удалён
- [ ] guestRegex удалён из constants

**Code Quality:**
- [ ] npm run build проходит без ошибок
- [ ] npm run dev запускается
- [ ] Login flow работает (vladimir и julia)
- [ ] Чат работает после логина
- [ ] Нет ошибок в консоли браузера

**Documentation:**
- [ ] ROADMAP.md обновлён (Этап 2 отмечен)
- [ ] CHANGELOG.md содержит v2.1.0
- [ ] Коммит создан и запушен на GitHub

---

## Риски и митigation

### Риск 1: Миграция может сломать существующих пользователей
**Вероятность:** Средняя
**Impact:** Высокий
**Митigation:**
- Добавить DEFAULT 'engineer' в миграции
- Проверить seed скрипт перед production
- Backup БД перед миграцией

### Риск 2: Сломается middleware
**Вероятность:** Низкая
**Impact:** Высокий (приложение не работает)
**Mitigation:**
- Тестировать каждое изменение отдельно
- Проверить редирект на /login
- Fallback на /login если ошибка

### Риск 3: Auth типы сломают TypeScript
**Вероятность:** Средняя
**Impact:** Средний
**Mitigation:**
- Обновлять типы постепенно
- Проверять npm run build после каждого изменения
- Использовать optional fields (role?: string)

---

## Примечания

**Важно:**
- Не удалять register страницу (может понадобиться позже)
- Сохранить login/logout функциональность
- Пароли в seed скрипте - временные (change-me-*)
- После seed пользователи должны сменить пароли

**Следующий этап:**
Этап 3 - Персонализация (динамические system prompts по ролям)

---

**Обновлено:** 2026-01-26 | **Автор:** Владимир
