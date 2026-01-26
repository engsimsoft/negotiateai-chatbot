# Детальный анализ системы авторизации

**Дата анализа:** 2026-01-26
**Статус:** ✅ Работает, но есть отключенные функции

---

## 📋 Содержание

1. [Текущее состояние](#текущее-состояние)
2. [Архитектура авторизации](#архитектура-авторизации)
3. [Отключенные функции](#отключенные-функции)
4. [Известные проблемы](#известные-проблемы)
5. [Конфигурация](#конфигурация)
6. [Потоки авторизации](#потоки-авторизации)
7. [Безопасность](#безопасность)
8. [Рекомендации](#рекомендации)

---

## 1. Текущее состояние

### ✅ Работает

| Функция | Статус | Файл |
|---------|--------|------|
| Email + Password авторизация | ✅ Работает | [auth.ts](app/(auth)/auth.ts) |
| Guest режим | ✅ Работает | [guest/route.ts](app/(auth)/api/auth/guest/route.ts) |
| Регистрация | ✅ Работает | [register/page.tsx](app/(auth)/register/page.tsx) |
| Вход (Login) | ✅ Работает | [login/page.tsx](app/(auth)/login/page.tsx) |
| Middleware защита | ✅ Работает | [middleware.ts](middleware.ts) |
| JWT токены | ✅ Работает | NextAuth JWT |
| Password hashing | ✅ Работает | bcrypt-ts |
| Session management | ✅ Работает | NextAuth |

### ❌ Отключено / Не реализовано

| Функция | Статус | Причина |
|---------|--------|---------|
| OAuth провайдеры (Google, GitHub) | ❌ Не реализовано | Callbacks пустые в [auth.config.ts](app/(auth)/auth.config.ts#L12) |
| Resumable streams | ❌ Отключено | Требует Redis, закомментировано |
| Redis интеграция | ❌ Не настроено | REDIS_URL не установлен |
| Платная подписка (paid tier) | ❌ Не реализовано | TODO в [entitlements.ts](lib/ai/entitlements.ts#L27) |

---

## 2. Архитектура авторизации

### Stack

```
NextAuth.js 5.0-beta.25
├── Credentials Provider (Email + Password)
├── Guest Provider (Anonymous access)
├── JWT Strategy
└── bcrypt-ts (Password hashing)
```

### Компоненты

#### 2.1 NextAuth Configuration

**Файл:** [app/(auth)/auth.config.ts](app/(auth)/auth.config.ts)

```typescript
export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/",
  },
  providers: [
    // ⚠️ ПУСТО - провайдеры добавляются в auth.ts
    // Это сделано потому что bcrypt требует Node.js,
    // а auth.config.ts используется в non-Node.js окружении
  ],
  callbacks: {},  // ⚠️ ПУСТО - callbacks в auth.ts
} satisfies NextAuthConfig;
```

**Проблема:** Callbacks пустые. Это означает, что:
- ❌ Нет OAuth провайдеров (Google, GitHub)
- ❌ Нет дополнительной логики при sign-in
- ❌ Нет redirect logic после входа

#### 2.2 NextAuth Main Config

**Файл:** [app/(auth)/auth.ts](app/(auth)/auth.ts)

**Провайдеры:**

1. **Credentials Provider (Email + Password)**
   ```typescript
   Credentials({
     credentials: {},
     async authorize({ email, password }: any) {
       // 1. Получает юзера из БД
       const users = await getUser(email);

       // 2. Timing attack protection (важно!)
       if (users.length === 0) {
         await compare(password, DUMMY_PASSWORD);  // ⚡ защита
         return null;
       }

       // 3. Проверяет пароль
       const passwordsMatch = await compare(password, user.password);
       if (!passwordsMatch) return null;

       // 4. Возвращает юзера с типом
       return { ...user, type: "regular" };
     },
   })
   ```

   **Безопасность:** ✅
   - Timing attack protection через dummy password
   - bcrypt для хеширования
   - Server-side validation

2. **Guest Provider (Anonymous)**
   ```typescript
   Credentials({
     id: "guest",
     credentials: {},
     async authorize() {
       // Создаёт guest юзера с email: guest-{timestamp}
       const [guestUser] = await createGuestUser();
       return { ...guestUser, type: "guest" };
     },
   })
   ```

**JWT Callbacks:**
```typescript
callbacks: {
  jwt({ token, user }) {
    if (user) {
      token.id = user.id as string;
      token.type = user.type;  // "guest" | "regular"
    }
    return token;
  },
  session({ session, token }) {
    if (session.user) {
      session.user.id = token.id;
      session.user.type = token.type;
    }
    return session;
  },
}
```

#### 2.3 User Types

**Файл:** [app/(auth)/auth.ts](app/(auth)/auth.ts#L9)

```typescript
export type UserType = "guest" | "regular";
```

**Entitlements по типам:**

**Файл:** [lib/ai/entitlements.ts](lib/ai/entitlements.ts)

```typescript
export const entitlementsByUserType: Record<UserType, Entitlements> = {
  guest: {
    maxMessagesPerDay: 999999,  // ⚠️ Практически без ограничений
    availableChatModelIds: ["claude-sonnet-4", "claude-haiku-3.5"],
  },
  regular: {
    maxMessagesPerDay: 999999,  // ⚠️ Практически без ограничений
    availableChatModelIds: ["claude-sonnet-4", "claude-haiku-3.5"],
  },

  // ⚠️ TODO: For users with an account and a paid membership
};
```

**Проблема:**
- Нет rate limiting (999999 сообщений/день)
- Нет платного tier
- Guest и regular имеют одинаковые лимиты

---

## 3. Отключенные функции

### 3.1 Resumable Streams (закомментировано)

**Файл:** [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts#L393-401)

```typescript
// const streamContext = getStreamContext();

// if (streamContext) {
//   return new Response(
//     await streamContext.resumableStream(streamId, () =>
//       stream.pipeThrough(new JsonToSseTransformStream())
//     )
//   );
// }

return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
```

**Причина отключения:**
- Требует Redis (`REDIS_URL` environment variable)
- Redis не настроен в production
- Функция работает, но без resumable streams

**Влияние:**
- ⚠️ При обрыве соединения стрим не может быть восстановлен
- ⚠️ Пользователь потеряет частично полученный ответ
- ✅ Но базовый streaming работает нормально

**Что делает resumable streams:**
- Сохраняет состояние стрима в Redis
- Позволяет восстановить стрим при обрыве
- Endpoint для восстановления: `/api/chat/[id]/stream`

**Как включить:**
1. Установить Redis (KV Store на Vercel)
2. Добавить `REDIS_URL` в environment variables
3. Раскомментировать код
4. Redeploy

### 3.2 OAuth Providers (не реализовано)

**Файл:** [app/(auth)/auth.config.ts](app/(auth)/auth.config.ts#L8-11)

```typescript
providers: [
  // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
  // while this file is also used in non-Node.js environments
],
```

**Что отсутствует:**
- ❌ Google OAuth
- ❌ GitHub OAuth
- ❌ Twitter/Discord OAuth
- ❌ Email magic links

**Почему не реализовано:**
- Комментарий говорит о bcrypt и Node.js, но это не причина
- Скорее всего просто не было времени/необходимости
- Credentials provider достаточен для MVP

**Как добавить Google OAuth:**

```typescript
// В auth.ts (НЕ auth.config.ts)
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    // ... existing providers
  ],
});
```

### 3.3 Платный tier (не реализовано)

**Файл:** [lib/ai/entitlements.ts](lib/ai/entitlements.ts#L27-29)

```typescript
/*
 * TODO: For users with an account and a paid membership
 */
```

**Что отсутствует:**
- ❌ Платная подписка
- ❌ Stripe интеграция
- ❌ Premium features
- ❌ Разные лимиты для paid users

**Почему не реализовано:**
- Проект в MVP стадии
- Личный проект (комментарий: "платные API")
- Не нужно монетизировать пока

---

## 4. Известные проблемы

### 4.1 Отсутствие rate limiting

**Проблема:**
```typescript
maxMessagesPerDay: 999999  // Практически без ограничений
```

**Риски:**
- 💰 Неконтролируемые расходы на API (Google Gemini, Brave Search)
- 🚨 Возможность злоупотребления (spam, DDoS через API)
- ⚠️ Нет защиты от ботов

**Решение:**
Реализовать настоящий rate limiting:

```typescript
export const entitlementsByUserType: Record<UserType, Entitlements> = {
  guest: {
    maxMessagesPerDay: 50,     // 50 сообщений/день для гостей
    availableChatModelIds: ["claude-haiku-3.5"],  // Только быстрая модель
  },
  regular: {
    maxMessagesPerDay: 200,    // 200 сообщений/день для зарег
    availableChatModelIds: ["claude-sonnet-4", "claude-haiku-3.5"],
  },
};
```

**Где проверяется:**
[app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts#L121-128)

```typescript
const messageCount = await getMessageCountByUserId({
  id: session.user.id,
  differenceInHours: 24,
});

if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
  return new ChatSDKError("rate_limit:chat").toResponse();
}
```

✅ Логика проверки есть, но лимиты слишком высокие!

### 4.2 Guest users накапливаются в БД

**Проблема:**
[lib/db/queries.ts](lib/db/queries.ts#L66-81)

```typescript
export async function createGuestUser() {
  const email = `guest-${Date.now()}`;  // guest-1737891234567
  const password = generateHashedPassword(generateUUID());

  return await db.insert(user).values({ email, password }).returning({
    id: user.id,
    email: user.email,
  });
}
```

**Каждый** анонимный визит создаёт нового юзера в БД!

**Риски:**
- 📊 Быстрый рост таблицы users
- 💾 Неиспользуемые данные
- 🐢 Замедление запросов со временем

**Решение:**
Добавить cleanup job для удаления старых guest users:

```typescript
// Удалять guest пользователей старше 7 дней без активности
DELETE FROM "User"
WHERE email LIKE 'guest-%'
  AND id NOT IN (
    SELECT DISTINCT userId FROM "Chat"
    WHERE createdAt > NOW() - INTERVAL '7 days'
  );
```

### 4.3 Нет email verification

**Проблема:**
При регистрации email не проверяется:
[app/(auth)/actions.ts](app/(auth)/actions.ts#L54-84)

```typescript
export const register = async (...) => {
  // Просто создаёт юзера, никакой верификации
  await createUser(validatedData.email, validatedData.password);
  await signIn("credentials", { ... });
  return { status: "success" };
};
```

**Риски:**
- ✉️ Любой может зарегистрироваться с чужим email
- 🎭 Impersonation attacks
- 📧 Нет возможности восстановить пароль

**Решение:**
Добавить email verification:
1. Send verification email при регистрации
2. Хранить `emailVerified` в БД
3. Блокировать чат пока email не подтверждён

### 4.4 Нет функции "Забыл пароль"

**Проблема:**
Если пользователь забыл пароль - его аккаунт потерян навсегда.

**Решение:**
Реализовать password reset flow:
1. "Forgot password" link на /login
2. Отправка reset token на email
3. Страница для сброса пароля
4. Update password в БД

---

## 5. Конфигурация

### Environment Variables

**Обязательные:**
```bash
AUTH_SECRET=<base64_string>  # openssl rand -base64 32
POSTGRES_URL=postgresql://...
```

**Опциональные (для OAuth):**
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_ID=...
GITHUB_SECRET=...
```

**Опциональные (для resumable streams):**
```bash
REDIS_URL=redis://...
```

### Middleware Configuration

**Файл:** [middleware.ts](middleware.ts)

**Защищенные routes:**
```typescript
export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
```

**Логика:**
1. Все routes требуют авторизации (кроме `/api/auth/*`)
2. Если нет токена → redirect на `/api/auth/guest` (auto guest login)
3. Если guest пытается зайти на `/login` → ничего не происходит
4. Если regular пытается зайти на `/login` → redirect на `/`

### Constants

**Файл:** [lib/constants.ts](lib/constants.ts)

```typescript
export const guestRegex = /^guest-\d+$/;  // Определение guest user
export const DUMMY_PASSWORD = generateDummyPassword();  // Timing attack protection
```

---

## 6. Потоки авторизации

### 6.1 Регистрация (Register)

```
User                  Frontend                  Backend                  Database
  |                      |                         |                         |
  |-- Fill form -------->|                         |                         |
  |                      |-- POST /register ------>|                         |
  |                      |                         |-- getUser(email) ------>|
  |                      |                         |<-- user exists? --------|
  |                      |                         |                         |
  |                      |                         |-- createUser() -------->|
  |                      |                         |<-- userId --------------|
  |                      |                         |                         |
  |                      |                         |-- signIn() ------------>|
  |                      |                         |<-- JWT token ----------|
  |                      |<-- Success + cookie ----|                         |
  |<-- Redirect to / ----|                         |                         |
```

**Код:** [app/(auth)/actions.ts](app/(auth)/actions.ts#L54-84)

### 6.2 Вход (Login)

```
User                  Frontend                  Backend                  Database
  |                      |                         |                         |
  |-- Fill form -------->|                         |                         |
  |                      |-- POST /login --------->|                         |
  |                      |                         |-- getUser(email) ------>|
  |                      |                         |<-- user ----------------|
  |                      |                         |                         |
  |                      |                         |-- compare(password) --->|
  |                      |                         |<-- match? --------------|
  |                      |                         |                         |
  |                      |<-- Success + JWT -------|                         |
  |<-- Redirect to / ----|                         |                         |
```

**Код:** [app/(auth)/actions.ts](app/(auth)/actions.ts#L18-42)

### 6.3 Guest Mode

```
User                  Middleware                Backend                  Database
  |                      |                         |                         |
  |-- Visit site ------->|                         |                         |
  |                      |-- No token? ----------->|                         |
  |                      |                         |                         |
  |                      |-- Redirect to           |                         |
  |                      |   /api/auth/guest ----->|                         |
  |                      |                         |-- createGuestUser() --->|
  |                      |                         |<-- guest-{timestamp} ---|
  |                      |                         |                         |
  |                      |<-- JWT token -----------|                         |
  |<-- Redirect to / ----|                         |                         |
```

**Код:** [app/(auth)/api/auth/guest/route.ts](app/(auth)/api/auth/guest/route.ts)

**Особенности:**
- Автоматическое создание guest user при первом визите
- Email формата: `guest-1737891234567`
- Случайный password (хеширован, но бесполезен)
- Полный доступ к чату (те же права что и regular)

---

## 7. Безопасность

### ✅ Реализовано

1. **Password hashing (bcrypt)**
   - Cost factor: default (10-12 rounds)
   - Алгоритм: bcrypt (через bcrypt-ts)
   - Файл: [lib/db/utils.ts](lib/db/utils.ts)

2. **Timing attack protection**
   ```typescript
   if (users.length === 0) {
     await compare(password, DUMMY_PASSWORD);  // Защита
     return null;
   }
   ```
   Время выполнения одинаковое для существующего и несуществующего юзера!

3. **JWT токены**
   - Secret: `AUTH_SECRET` environment variable
   - Storage: HTTP-only cookies (secure)
   - Expiration: Session-based

4. **SQL Injection защита**
   - Используется Drizzle ORM (prepared statements)
   - Нет прямых SQL запросов с конкатенацией

5. **XSS защита**
   - React автоматически escapes HTML
   - Нет `dangerouslySetInnerHTML`

### ⚠️ Не реализовано

1. **CSRF protection**
   - NextAuth имеет встроенную защиту, но callbacks пустые
   - Нужно проверить работает ли

2. **Rate limiting на login**
   - Нет защиты от brute force на `/login`
   - Можно перебирать пароли

3. **Email verification**
   - Нет проверки email при регистрации

4. **Password strength requirements**
   - Только `min(6)` в validation
   - Нет требований к сложности

5. **2FA / MFA**
   - Не реализовано

### 🔒 Рекомендации

**Критичные (сделать в ближайшее время):**

1. **Добавить rate limiting на login**
   ```typescript
   // Использовать Vercel KV для tracking попыток
   const attempts = await kv.get(`login-attempts:${ip}`);
   if (attempts > 5) {
     return { status: "rate_limited" };
   }
   ```

2. **Усилить требования к паролю**
   ```typescript
   password: z.string()
     .min(8, "Password must be at least 8 characters")
     .regex(/[A-Z]/, "Must contain uppercase")
     .regex(/[a-z]/, "Must contain lowercase")
     .regex(/[0-9]/, "Must contain number")
     .regex(/[^A-Za-z0-9]/, "Must contain special character")
   ```

3. **Добавить password reset**
   - Endpoint для request reset
   - Email с временным токеном
   - Страница для ввода нового пароля

**Желательные (можно сделать позже):**

4. **Email verification**
   - Send verification email
   - Block chat until verified

5. **OAuth providers**
   - Google Sign-In
   - GitHub Sign-In

6. **Cleanup guest users**
   - Cron job для удаления старых
   - Или используй Vercel Cron

---

## 8. Рекомендации

### 8.1 Краткосрочные (1-2 недели)

**Приоритет: ВЫСОКИЙ**

1. **Включить resumable streams**
   - ✅ Улучшит UX при обрыве соединения
   - Setup: Vercel KV (Redis)
   - Effort: 1 час

2. **Настроить rate limiting**
   - ✅ Защита от злоупотреблений
   - ✅ Контроль расходов
   - Изменить лимиты в [entitlements.ts](lib/ai/entitlements.ts)
   - Effort: 30 минут

3. **Добавить cleanup для guest users**
   - ✅ Предотвратит рост БД
   - Vercel Cron или API endpoint
   - Effort: 2 часа

**Приоритет: СРЕДНИЙ**

4. **Добавить rate limiting на login**
   - ✅ Защита от brute force
   - Используй Vercel KV
   - Effort: 3 часа

5. **Усилить требования к паролю**
   - ✅ Повышение безопасности
   - Изменить validation schema
   - Effort: 1 час

### 8.2 Среднесрочные (1-2 месяца)

6. **Реализовать password reset**
   - ✅ Критичная функция
   - Email integration (Resend, SendGrid)
   - Effort: 1 день

7. **Email verification**
   - ✅ Предотвращение fake accounts
   - Email integration
   - Effort: 1 день

8. **Добавить Google OAuth**
   - ✅ Удобство для пользователей
   - Google Console setup
   - Effort: 2-3 часа

### 8.3 Долгосрочные (3+ месяца)

9. **Платный tier**
   - Stripe integration
   - Premium features
   - Effort: 1-2 недели

10. **2FA / MFA**
    - Дополнительная безопасность
    - TOTP (Google Authenticator)
    - Effort: 3-4 дня

11. **Admin dashboard**
    - Управление пользователями
    - Статистика
    - Effort: 1-2 недели

---

## 9. Ссылки

### Документация

- [NextAuth.js Docs](https://authjs.dev/)
- [NextAuth.js v5 Beta](https://authjs.dev/getting-started/migrating-to-v5)
- [Drizzle ORM](https://orm.drizzle.team/)
- [bcrypt-ts](https://github.com/OWASP/NodeGoat)

### Файлы проекта

**Auth Core:**
- [app/(auth)/auth.ts](app/(auth)/auth.ts) - NextAuth configuration
- [app/(auth)/auth.config.ts](app/(auth)/auth.config.ts) - Auth config
- [app/(auth)/actions.ts](app/(auth)/actions.ts) - Login/Register actions

**Routes:**
- [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx) - Login page
- [app/(auth)/register/page.tsx](app/(auth)/register/page.tsx) - Register page
- [app/(auth)/api/auth/guest/route.ts](app/(auth)/api/auth/guest/route.ts) - Guest endpoint

**Database:**
- [lib/db/queries.ts](lib/db/queries.ts) - User queries
- [lib/db/schema.ts](lib/db/schema.ts) - Database schema
- [lib/db/utils.ts](lib/db/utils.ts) - Password hashing

**Middleware:**
- [middleware.ts](middleware.ts) - Auth middleware

**Config:**
- [lib/constants.ts](lib/constants.ts) - Constants (guestRegex, DUMMY_PASSWORD)
- [lib/ai/entitlements.ts](lib/ai/entitlements.ts) - Rate limits

---

## 10. История изменений

- **2026-01-26** - Первый полный аудит системы авторизации
- Обнаружены отключенные функции (resumable streams, OAuth)
- Выявлены проблемы (rate limiting, guest cleanup)
- Созданы рекомендации по улучшению

---

**Конец отчета**
