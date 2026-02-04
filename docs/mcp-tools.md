# MCP Tools — Инструменты для Claude Code

> Документация по настроенным MCP-серверам для проекта Simply.
> **Обновлено:** 2026-02-03

---

## Что такое MCP?

**MCP (Model Context Protocol)** — протокол, позволяющий Claude Code подключаться к внешним сервисам напрямую: базы данных, GitHub, Vercel и др.

**Преимущества:**
- Прямой доступ к данным без копирования в чат
- Автоматизация рутинных операций
- Меньше переключений между инструментами

---

## Настроенные серверы

### 1. PostgreSQL (Neon)

**Статус:** ✅ Работает в VS Code

**Возможности:**
- Выполнение SQL-запросов
- Просмотр структуры таблиц
- Анализ данных

**Примеры использования:**
```
- Покажи всех пользователей
- Сколько чатов в базе?
- Какая структура таблицы Message?
```

**Инструмент:** `mcp__postgres__query`

---

### 2. GitHub

**Статус:** ✅ Работает в VS Code

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

### 3. Vercel

**Статус:** ⚠️ Работает только в терминале (требует OAuth)

**Возможности:**
- Просмотр деплоев
- Логи сборки и ошибок
- Environment variables
- Управление доменами

**Как использовать:**

В терминале запустить:
```bash
claude "покажи деплои vercel"
```

Или любой запрос к Vercel — откроется терминальный Claude с доступом к Vercel MCP.

**Почему только терминал?**
Vercel MCP использует HTTP + OAuth. Авторизация происходит через браузер при первом запросе в терминальной версии Claude Code.

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
    },
    "vercel": {
      "type": "http",
      "url": "https://mcp.vercel.com/<team>/<project>"
    }
  }
}
```

---

## Токены и ключи

| Сервис | Где получить | Срок действия |
|--------|--------------|---------------|
| **GitHub** | [github.com/settings/tokens](https://github.com/settings/tokens) | 90 дней (настраивается) |
| **PostgreSQL** | `.env.local` → `POSTGRES_URL` | Бессрочно |
| **Vercel** | OAuth через браузер | Автоматически |

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

### Vercel требует авторизации

В терминале выполнить любой запрос к Vercel:
```bash
claude "list vercel deployments"
```
Откроется браузер для OAuth.

### GitHub: 401 Unauthorized

Токен истёк. Создать новый и обновить конфигурацию (см. выше).

### PostgreSQL: Connection refused

Проверить что Neon база активна (может уснуть при неактивности).

---

## Полезные команды

```bash
# Список всех MCP серверов
claude mcp list

# Удалить сервер
claude mcp remove <name>

# Добавить сервер
claude mcp add <name> -- <command>

# Справка
claude mcp --help
```
