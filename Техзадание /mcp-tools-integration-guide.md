# MCP Tools Integration Guide for AI Agents

> This document serves as a reference for AI coding agents. Read this document at the start of any project to identify and connect relevant tools based on the technical requirements.

## How to Use This Guide

1. **Analyze the project requirements** — identify what services are needed (database, deployment, payments, etc.)
2. **Select appropriate tools** from the categories below
3. **Follow the configuration instructions** to connect each tool
4. **Verify connection** before proceeding with development

---

## Table of Contents

1. [Deployment & Hosting](#deployment--hosting)
2. [Databases](#databases)
3. [Version Control](#version-control)
4. [Error Tracking](#error-tracking)
5. [Payments (Russia)](#payments-russia)
6. [Email Services](#email-services)
7. [Additional Tools](#additional-tools)
8. [Configuration Examples](#configuration-examples)
9. [Troubleshooting](#troubleshooting)

---

## Deployment & Hosting

### Vercel MCP

**When to use:** Next.js projects, static sites, serverless functions, frontend applications.

**Capabilities:**
- View deployment logs and build errors
- List projects and deployments
- Check environment variables
- Manage domains
- Search Vercel documentation

**Official Endpoint:**
```
https://mcp.vercel.com
```

**Project-specific URL (recommended):**
```
https://mcp.vercel.com/<teamSlug>/<projectSlug>
```

**Claude Code Installation:**
```bash
# General access
claude mcp add --transport http vercel https://mcp.vercel.com

# Project-specific (recommended)
claude mcp add --transport http vercel https://mcp.vercel.com/team-slug/project-slug
```

**JSON Configuration:**
```json
{
  "mcpServers": {
    "vercel": {
      "url": "https://mcp.vercel.com/team-slug/project-slug"
    }
  }
}
```

**Authorization:** Run `/mcp` in Claude Code to complete OAuth flow.

**Available Tools:**
| Tool | Description |
|------|-------------|
| `search-vercel-docs` | Search official Vercel documentation |
| `list-projects` | Get all team projects |
| `get-project` | Project details |
| `list-deployments` | List project deployments |
| `get-deployment` | Deployment information |
| `get-deployment-logs` | Build and runtime logs |
| `list-domains` | Project domains |
| `get-environment-variables` | Environment variables |

---

### Railway MCP

**When to use:** Full-stack applications, projects requiring persistent servers, background jobs, cron tasks, or when you need more control than serverless.

**Capabilities:**
- Deploy and manage services
- View logs and metrics
- Manage environment variables
- Database provisioning
- Monitor resource usage

**Installation:**
```bash
npm install -g @anthropic-ai/claude-code
claude mcp add railway -- npx -y @anthropic-ai/mcp-railway
```

**JSON Configuration:**
```json
{
  "mcpServers": {
    "railway": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-railway"],
      "env": {
        "RAILWAY_API_TOKEN": "your_railway_token"
      }
    }
  }
}
```

**Getting API Token:**
1. Go to Railway Dashboard → Account Settings → Tokens
2. Create new token with appropriate permissions
3. Add to environment configuration

**Available Tools:**
| Tool | Description |
|------|-------------|
| `list-projects` | List all Railway projects |
| `get-project` | Project details and services |
| `list-services` | Services within a project |
| `get-service-logs` | View service logs |
| `list-deployments` | Deployment history |
| `get-variables` | Environment variables |

---

## Databases

### Supabase MCP

**When to use:** Projects needing PostgreSQL + Authentication + File Storage + Realtime subscriptions. Best choice for Vercel deployments.

**Capabilities:**
- Execute SQL queries
- View database schema
- Manage tables and data
- Access to auth, storage, and realtime features

**Installation:**
```bash
claude mcp add supabase -- npx -y @supabase/mcp-server
```

**JSON Configuration:**
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_supabase_access_token"
      }
    }
  }
}
```

**Getting Access Token:**
1. Go to Supabase Dashboard → Account → Access Tokens
2. Generate new token
3. Add to configuration

**Available Tools:**
| Tool | Description |
|------|-------------|
| `list-projects` | List Supabase projects |
| `get-project` | Project details |
| `execute-sql` | Run SQL queries |
| `get-schema` | Database schema information |
| `list-tables` | List all tables |
| `get-table` | Table structure and data |

---

### PostgreSQL MCP

**When to use:** Direct PostgreSQL access, Railway Postgres, or any standard PostgreSQL database.

**Installation:**
```bash
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres
```

**JSON Configuration:**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@host:5432/database"
      }
    }
  }
}
```

**Connection String Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require
```

**Available Tools:**
| Tool | Description |
|------|-------------|
| `query` | Execute SQL queries |
| `describe-table` | Get table schema |
| `list-tables` | List all tables |

---

### Upstash Redis

**When to use:** Caching, session storage, rate limiting, queues, real-time leaderboards. Serverless-friendly, works great with Vercel.

**Note:** Upstash doesn't have an official MCP server yet. Use REST API directly.

**Integration Pattern:**
```typescript
// Install: npm install @upstash/redis

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Usage
await redis.set('key', 'value')
const value = await redis.get('key')
```

**Environment Variables:**
```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

**Getting Credentials:**
1. Create database at console.upstash.com
2. Copy REST URL and Token from database details

---

## Version Control

### GitHub MCP

**When to use:** Access to repositories, issues, pull requests, actions, and GitHub-specific features.

**Capabilities:**
- Read repository contents
- Create/manage issues and PRs
- View commit history
- Access GitHub Actions logs
- Manage branches

**Installation:**
```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```

**JSON Configuration:**
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    }
  }
}
```

**Getting Personal Access Token:**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with scopes: `repo`, `read:org`, `read:user`
3. Copy token immediately (shown only once)

**Available Tools:**
| Tool | Description |
|------|-------------|
| `get-repository` | Repository information |
| `list-repositories` | User/org repositories |
| `get-file-contents` | Read file from repo |
| `create-issue` | Create new issue |
| `list-issues` | List repository issues |
| `create-pull-request` | Create PR |
| `list-pull-requests` | List PRs |
| `get-commit` | Commit details |

---

## Error Tracking

### Sentry MCP

**When to use:** Production applications where you need to catch and debug errors. Essential for any user-facing application.

**What is Error Tracking?**
Error tracking automatically captures errors that occur in production, providing:
- Stack traces and error context
- User information and browser details
- Error frequency and trends
- Release tracking

**Installation:**
```bash
claude mcp add sentry -- npx -y @sentry/mcp-server
```

**JSON Configuration:**
```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@sentry/mcp-server"],
      "env": {
        "SENTRY_AUTH_TOKEN": "your_sentry_auth_token"
      }
    }
  }
}
```

**Getting Auth Token:**
1. Sentry → Settings → Auth Tokens
2. Create new token with `project:read`, `org:read`, `event:read` scopes

**Application Integration (Next.js example):**
```bash
npx @sentry/wizard@latest -i nextjs
```

**Available Tools:**
| Tool | Description |
|------|-------------|
| `list-projects` | List Sentry projects |
| `get-project` | Project details |
| `list-issues` | List error issues |
| `get-issue` | Issue details with stack trace |
| `list-events` | Error events |

---

## Payments (Russia)

> **Important:** Stripe does not work for Russian merchants or Russian bank cards. Use the following alternatives.

### YooKassa (ЮKassa)

**When to use:** Primary choice for accepting payments in Russia. Formerly Yandex.Kassa.

**Supported Methods:** Bank cards, YooMoney, SBP, Tinkoff Pay, installments

**No MCP available.** Use API directly.

**Integration:**
```bash
npm install @a2seven/yoo-checkout
```

```typescript
import { YooCheckout } from '@a2seven/yoo-checkout'

const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY
})

// Create payment
const payment = await checkout.createPayment({
  amount: { value: '1000.00', currency: 'RUB' },
  confirmation: { type: 'redirect', return_url: 'https://yoursite.com/return' },
  capture: true,
  description: 'Order #123'
})
```

**Documentation:** https://yookassa.ru/developers

**Getting Credentials:**
1. Register at yookassa.ru
2. Complete business verification
3. Get shopId and secretKey from dashboard

---

### Robokassa

**When to use:** Alternative to YooKassa, many payment methods, good for digital goods.

**Supported Methods:** Bank cards, e-wallets, mobile payments, cryptocurrency

**Integration:**
```typescript
import crypto from 'crypto'

function generateRobokassaUrl(orderId: string, amount: number, description: string) {
  const merchantLogin = process.env.ROBOKASSA_LOGIN
  const password1 = process.env.ROBOKASSA_PASSWORD1
  
  const signature = crypto
    .createHash('md5')
    .update(`${merchantLogin}:${amount}:${orderId}:${password1}`)
    .digest('hex')
  
  return `https://auth.robokassa.ru/Merchant/Index.aspx?MerchantLogin=${merchantLogin}&OutSum=${amount}&InvId=${orderId}&Description=${encodeURIComponent(description)}&SignatureValue=${signature}`
}
```

**Documentation:** https://docs.robokassa.ru

---

### CloudPayments

**When to use:** Good API, recurrent payments, Apple Pay/Google Pay support.

**Integration:**
```bash
npm install cloudpayments
```

```typescript
import { ClientService } from 'cloudpayments'

const client = new ClientService({
  publicId: process.env.CLOUDPAYMENTS_PUBLIC_ID,
  apiSecret: process.env.CLOUDPAYMENTS_API_SECRET
})

// Charge payment
const result = await client.chargeCard({
  Amount: 1000,
  Currency: 'RUB',
  IpAddress: userIp,
  CardCryptogramPacket: cryptogram,
  Description: 'Order #123'
})
```

**Documentation:** https://developers.cloudpayments.ru

---

### Tinkoff Acquiring

**When to use:** If the business already uses Tinkoff for banking.

**Documentation:** https://www.tinkoff.ru/kassa/develop/api/payments/

---

## Email Services

### Resend

**When to use:** Transactional emails, notifications, marketing emails. Works globally including Russia.

**No MCP available.** Use API directly.

**Installation:**
```bash
npm install resend
```

**Integration:**
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'noreply@yourdomain.com',
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to our service</h1>'
})
```

**Getting API Key:**
1. Sign up at resend.com
2. Verify your domain
3. Create API key in dashboard

**Documentation:** https://resend.com/docs

---

### Russian Alternatives

**Unisender:**
- Popular in Russia
- Email + SMS
- Documentation: https://www.unisender.com/ru/support/api/

**SendPulse:**
- Email + SMS + Push
- Documentation: https://sendpulse.com/integrations/api

---

## Additional Tools

### Filesystem MCP

**When to use:** When AI agent needs to read/write local project files.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]
    }
  }
}
```

### Puppeteer MCP (Browser Automation)

**When to use:** Testing, screenshots, web scraping, automated interactions.

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```

---

## Configuration Examples

### Minimal Setup (Vercel + GitHub)

```json
{
  "mcpServers": {
    "vercel": {
      "url": "https://mcp.vercel.com/team/project"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

### Full Stack (Vercel + Supabase + Sentry + GitHub)

```json
{
  "mcpServers": {
    "vercel": {
      "url": "https://mcp.vercel.com/team/project"
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_xxx"
      }
    },
    "sentry": {
      "command": "npx",
      "args": ["-y", "@sentry/mcp-server"],
      "env": {
        "SENTRY_AUTH_TOKEN": "sntrys_xxx"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

### Railway Full Stack

```json
{
  "mcpServers": {
    "railway": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-railway"],
      "env": {
        "RAILWAY_API_TOKEN": "xxx"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

---

## Troubleshooting

### MCP Server Not Responding

1. Check internet connection
2. Verify endpoint URL is correct
3. Restart the MCP client
4. Check if required environment variables are set

### Authorization Errors

1. Verify tokens are valid and not expired
2. Check token permissions/scopes
3. Re-run authorization flow (`/mcp` in Claude Code)
4. For OAuth services, check if access was revoked in dashboard

### "Project slug required" Error (Vercel)

Use project-specific URL:
```
https://mcp.vercel.com/team-slug/project-slug
```

### Tools Not Appearing

1. Wait for authorization to complete
2. Restart IDE/client
3. Check JSON configuration for syntax errors
4. Verify the MCP server package is installed

### Database Connection Issues

1. Verify connection string format
2. Check if SSL is required (`?sslmode=require`)
3. Verify IP is whitelisted (if applicable)
4. Test connection with external tool first

---

## Quick Reference: When to Use What

| Scenario | Tools to Connect |
|----------|-----------------|
| Simple Vercel site | Vercel MCP |
| Vercel + Database | Vercel MCP, Supabase MCP |
| Full production app | Vercel MCP, Supabase MCP, Sentry MCP, GitHub MCP |
| Railway backend | Railway MCP, Postgres MCP |
| Need to debug deploy | Vercel MCP or Railway MCP (check logs) |
| Database issues | Supabase MCP or Postgres MCP |
| Production errors | Sentry MCP |
| Need repo access | GitHub MCP |
| Payments (Russia) | YooKassa API (no MCP) |
| Email sending | Resend API (no MCP) |

---

*Document version: 1.0*
*Last updated: January 2025*
