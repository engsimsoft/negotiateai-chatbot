# MCP Tools — Инструменты для Claude Code

> Документация по настроенным MCP-серверам и CLI-инструментам для проекта Simply.
> **Обновлено:** 2026-02-26

---

## Что такое MCP?

**MCP (Model Context Protocol)** — протокол, позволяющий Claude Code подключаться к внешним сервисам напрямую: базы данных, GitHub и др.

**Преимущества:**
- Прямой доступ к данным без копирования в чат
- Автоматизация рутинных операций
- Меньше переключений между инструментами

---

## Настроенные серверы

### 1. PostgreSQL (Neon)

**Статус:** ✅ Работает в VS Code (MCP)

**Возможности:**
- Выполнение SQL-запросов (только чтение)
- Просмотр структуры таблиц
- Анализ данных

**Примеры использования:**
```
- Покажи всех пользователей
- Сколько чатов в базе?
- Какая структура таблицы Message?
```

**Инструмент:** `mcp__postgres__query`

**Ограничение:** Только SELECT-запросы. Для INSERT/UPDATE/DELETE использовать `psql` через Bash.

---

### 2. GitHub

**Статус:** ✅ Работает в VS Code (MCP)

**Возможности:**
- Просмотр коммитов
- Создание и просмотр issues
- Работа с Pull Requests
- Чтение файлов из репозитория

**Примеры использования:**
```
- Покажи последние коммиты
- Создай issue для бага X
- Какие PR открыты?
```

**Инструменты:**
- `mcp__github__list_commits`
- `mcp__github__create_issue`
- `mcp__github__list_issues`
- `mcp__github__create_pull_request`
- `mcp__github__get_file_contents`

---

### 3. Vercel (через CLI)

**Статус:** ✅ Работает через Vercel CLI (Bash tool)

**Важно:** Vercel MCP (HTTP + OAuth) нестабилен и работает только в терминальной версии Claude Code. **Рабочий способ — Vercel CLI через Bash tool.** Это проверенный подход, который полностью покрывает все потребности.

**Предварительная настройка (одноразово):**

Vercel CLI должен быть авторизован на машине пользователя:
```bash
npx vercel login
```
Аутентификация сохраняется в `~/.local/share/com.vercel.cli/auth.json`.

**Проверка авторизации:**
```bash
npx vercel whoami
# Ожидание: имя аккаунта (например engsimsoft-6051)
```

#### Команды деплоя

```bash
# Деплой в production
npx vercel --prod

# Посмотреть информацию о деплое
npx vercel inspect <deployment-url> --logs
```

#### Команды environment variables

```bash
# Список всех env vars
npx vercel env ls production

# Добавить env var (ВАЖНО: printf, НЕ echo!)
printf 'значение_без_переноса' | npx vercel env add ИМЯ_ПЕРЕМЕННОЙ production

# Удалить env var
npx vercel env rm ИМЯ_ПЕРЕМЕННОЙ production -y

# Скачать env vars в .env.local
npx vercel env pull .env.local
```

> **КРИТИЧНО: `printf` вместо `echo`!**
> `echo` добавляет `\n` (перенос строки) в конец значения. Это ломает:
> - API-ключи (Deepgram WebSocket отклоняет ключ с `\n`)
> - URL (Telegram отклоняет URL с `\n` в inline-кнопках)
> - Секреты (grammY сравнивает webhook secret побайтово)
>
> **Всегда** используй `printf 'value'` при пайпинге в `vercel env add`.

#### Команды логов

```bash
# Просмотр runtime логов production (в реальном времени)
npx vercel logs <domain>

# Пример: ловить логи 30 секунд
npx vercel logs negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app 2>&1 &
BGPID=$!
sleep 30
kill $BGPID 2>/dev/null
wait $BGPID 2>/dev/null
```

> **Совет по дебагу:** Запустить сбор логов, попросить пользователя выполнить действие на сайте, прочитать ошибку из логов.

#### Vercel API (для продвинутых операций)

Токен для API берётся из файла авторизации CLI:
```bash
# Получить auth token
cat ~/.local/share/com.vercel.cli/auth.json
# → {"token": "..."}

# Пример: отключить SSO Deployment Protection
curl -X PATCH "https://api.vercel.com/v9/projects/PROJECT_ID?teamId=TEAM_ID" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection": null}'
```

**Данные проекта Simply:**
- Project ID: `prj_d5tHiDG7bENXnX7pH0VCYDkOxSi5`
- Team ID: `team_273D1fJIokYxvzxgDUpeXNPe`
- Production domain: `negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app`
- Short domain: `negotiateai-chatbot.vercel.app`

---

## Как добавить новый MCP-сервер

### Через терминал (рекомендуется)

```bash
# HTTP сервер (с OAuth)
claude mcp add --transport http <name> <url>

# Stdio сервер (с env переменными)
claude mcp add -e API_KEY=xxx <name> -- npx -y <package>
```

### Проверка статуса

```bash
claude mcp list
```

---

## Конфигурация

MCP-серверы хранятся в `~/.claude.json` в секции `projects.<path>.mcpServers`:

```json
{
  "mcpServers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "<connection_string>"]
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<token>"
      }
    }
  }
}
```

> **Примечание:** Vercel MCP (`"type": "http"`) удалён из конфигурации. Используется Vercel CLI (см. раздел 3).

---

## Токены и ключи

| Сервис | Где получить | Срок действия |
|--------|--------------|---------------|
| **GitHub** | [github.com/settings/tokens](https://github.com/settings/tokens) | 90 дней (настраивается) |
| **PostgreSQL** | `.env.local` → `POSTGRES_URL` | Бессрочно |
| **Vercel CLI** | `npx vercel login` → `~/.local/share/com.vercel.cli/auth.json` | Длительный |

**Обновление GitHub токена:**
1. Создать новый токен на GitHub
2. В терминале: `claude mcp remove github`
3. Добавить заново: `claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=<new_token> -- npx -y @modelcontextprotocol/server-github`

---

## Troubleshooting

### MCP не работает после перезагрузки VS Code

```bash
# Проверить статус
claude mcp list

# Если сервер отключён — перезапустить VS Code
Cmd+Shift+P → "Developer: Reload Window"
```

### Vercel CLI: не авторизован

```bash
npx vercel whoami
# Если ошибка — нужна авторизация:
npx vercel login
```

### Vercel: env var с trailing newline

Если API-ключ или URL не работает на Vercel, но работает локально — проверь trailing newline:
```bash
# Удалить и добавить заново с printf (НЕ echo!)
npx vercel env rm ИМЯ production -y
printf 'корректное_значение' | npx vercel env add ИМЯ production

# После исправления — редеплой:
npx vercel --prod
```

### Vercel: socket hang up при деплое

Vercel CLI может зависнуть из-за нестабильной сети. Решение — пуш в git (Vercel автоматически деплоит):
```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push origin master
```

### Vercel: ERR_REQUIRE_ESM

Если в логах `require() of ES Module ... not supported` — значит транзитивная зависимость стала ESM-only. Типичный пример: `jsdom@27+` тянет `@exodus/bytes` (ESM-only). Решение — даунгрейд до CJS-совместимой версии.

### GitHub: 401 Unauthorized

Токен истёк. Создать новый и обновить конфигурацию (см. выше).

### PostgreSQL: Connection refused

Проверить что Neon база активна (может уснуть при неактивности).

---

## Полезные команды

```bash
# MCP серверы
claude mcp list
claude mcp remove <name>
claude mcp add <name> -- <command>

# Vercel CLI
npx vercel whoami           # проверить авторизацию
npx vercel --prod           # деплой
npx vercel env ls production  # env vars
npx vercel logs <domain>    # логи в реальном времени

# PostgreSQL
psql "$POSTGRES_URL"        # прямой доступ к БД (для записи)
```
