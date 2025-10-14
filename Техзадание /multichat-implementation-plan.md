# План реализации мультичата для NegotiateAI Chatbot

**Статус:** Планируется после MVP (Phase 5)
**Дата создания:** 2025-10-14
**Версия:** 1.0
**Приоритет:** High (после завершения Phase 1-4)

---

## 📋 Содержание

1. [Обзор](#обзор)
2. [Текущая архитектура](#текущая-архитектура)
3. [Целевая архитектура](#целевая-архитектура)
4. [Технический стек](#технический-стек)
5. [План реализации](#план-реализации)
6. [Схема БД](#схема-бд)
7. [API эндпоинты](#api-эндпоинты)
8. [UI компоненты](#ui-компоненты)
9. [Оценка времени](#оценка-времени)
10. [Риски и митигация](#риски-и-митигация)
11. [Тестирование](#тестирование)
12. [Миграция данных](#миграция-данных)

---

## 🎯 Обзор

### Проблема
В текущей версии чат-бота (MVP):
- Только одна сессия чата
- История сообщений хранится в памяти браузера (useChat state)
- При refresh страницы вся история теряется
- Невозможно вернуться к старым разговорам
- Контекстное окно может переполниться при длинном диалоге

### Решение
Реализация системы мультичата по аналогии с Claude.ai:
- Сайдбар со списком всех чатов пользователя
- Кнопка "New chat" для создания новой сессии
- Каждый чат хранится в БД с полной историей
- Возможность переключаться между чатами
- Автогенерация названий чатов
- Операции: удаление, переименование, архивация чатов

### Бизнес-ценность
1. **Организация работы:** Разные чаты для разных стран/проектов
2. **Сохранение истории:** Доступ к старым переговорам и решениям
3. **Масштабируемость:** Неограниченное количество контекстов
4. **UX:** Привычный интерфейс (как ChatGPT, Claude.ai)
5. **Решение проблемы контекста:** Каждый чат = новое контекстное окно

---

## 📊 Текущая архитектура (MVP)

```
┌─────────────────────────────────────────┐
│         Browser (Next.js Client)        │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │       app/page.tsx                │ │
│  │                                   │ │
│  │  useChat() hook                   │ │
│  │  ├─ messages: []  (in-memory)     │ │
│  │  ├─ sendMessage()                 │ │
│  │  └─ status                        │ │
│  └───────────────────────────────────┘ │
│                 │                       │
│                 ▼                       │
│         HTTP POST /api/chat             │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Server (Next.js API Route)         │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │    app/api/chat/route.ts          │ │
│  │                                   │ │
│  │  streamText()                     │ │
│  │  └─ toUIMessageStreamResponse()   │ │
│  └───────────────────────────────────┘ │
│                 │                       │
│                 ▼                       │
│         Anthropic API                   │
│       (Claude Sonnet 4.5)               │
└─────────────────────────────────────────┘

ПРОБЛЕМЫ:
❌ История в памяти браузера (теряется при refresh)
❌ Нет персистентности
❌ Один чат = одно контекстное окно (может переполниться)
❌ Невозможно вернуться к старым разговорам
```

---

## 🏗️ Целевая архитектура (с мультичатом)

```
┌──────────────────────────────────────────────────────────────┐
│              Browser (Next.js Client)                        │
│                                                              │
│  ┌────────────────┐  ┌──────────────────────────────────┐  │
│  │   Sidebar      │  │      ChatWindow                  │  │
│  │                │  │                                  │  │
│  │ New Chat [+]   │  │  useChat({ id: chatId })         │  │
│  │                │  │  ├─ messages: []                 │  │
│  │ Chat List:     │  │  ├─ sendMessage()                │  │
│  │ ┌────────────┐ │  │  └─ status                      │  │
│  │ │ Chat 1  ✓  │ │  │                                  │  │
│  │ │ Chat 2     │ │  │  Message List                    │  │
│  │ │ Chat 3     │ │  │  Input Form                      │  │
│  │ └────────────┘ │  └──────────────────────────────────┘  │
│  │                │                                         │
│  └────────────────┘                                         │
│         │                          │                        │
│         ▼                          ▼                        │
│   GET /api/chats          POST /api/chat?chatId=xxx         │
└──────────────────────────────────────────────────────────────┘
                │                          │
                ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│              Server (Next.js API Routes)                     │
│                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │  /api/chats         │    │  /api/chat               │   │
│  │                     │    │                          │   │
│  │  GET - список чатов │    │  POST - новое сообщение  │   │
│  │  POST - новый чат   │    │  └─ Сохранить в БД       │   │
│  │  DELETE - удалить   │    │  └─ Вызвать Claude       │   │
│  │  PATCH - обновить   │    │  └─ Вернуть stream       │   │
│  └─────────────────────┘    └──────────────────────────┘   │
│              │                          │                    │
│              ▼                          ▼                    │
│         Supabase Client           Anthropic API              │
└──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│                   Supabase (PostgreSQL)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  chats                                             │    │
│  │  ├─ id (uuid, PK)                                  │    │
│  │  ├─ title (text)                                   │    │
│  │  ├─ user_id (uuid, FK) - для будущей аутентификации│   │
│  │  ├─ created_at (timestamp)                         │    │
│  │  └─ updated_at (timestamp)                         │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          │ 1:N                               │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  messages                                          │    │
│  │  ├─ id (uuid, PK)                                  │    │
│  │  ├─ chat_id (uuid, FK)                             │    │
│  │  ├─ role (text) - 'user' | 'assistant'            │    │
│  │  ├─ content (text)                                 │    │
│  │  ├─ created_at (timestamp)                         │    │
│  │  └─ metadata (jsonb) - для tool_use, attachments   │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘

ПРЕИМУЩЕСТВА:
✅ История сохраняется навсегда (PostgreSQL)
✅ Неограниченное количество чатов
✅ Каждый чат = новое контекстное окно (проблема переполнения решена)
✅ Возможность вернуться к старым разговорам
✅ Синхронизация между устройствами (через БД)
✅ Возможность аналитики (статистика, поиск)
```

---

## 🛠️ Технический стек

### База данных
**Рекомендация: Supabase** ⭐

**Почему Supabase:**
- ✅ Бесплатный tier: 500MB БД, 2GB transfer/месяц, unlimited API requests
- ✅ PostgreSQL из коробки (production-ready)
- ✅ Real-time subscriptions (опционально для live updates)
- ✅ Row Level Security (RLS) для безопасности
- ✅ Простая интеграция с Next.js
- ✅ Auth из коробки (для будущей multi-user функциональности)
- ✅ Dashboard для управления данными
- ✅ Automatic backups на платных планах

**Альтернативы:**
1. **Vercel Postgres** - интеграция с Vercel, но платный после free tier
2. **PlanetScale** - MySQL, serverless, но сложнее setup
3. **Neon** - serverless Postgres, хороший free tier
4. **LocalStorage** - ❌ НЕ рекомендуется (данные только локально, нет sync)

### Клиентская библиотека
- `@supabase/supabase-js` - официальный клиент для JS/TS
- `@supabase/ssr` - для server-side рендеринга в Next.js

### State Management
- React Context API или Zustand (для глобального состояния активного чата)
- AI SDK useChat с параметром `id` (для привязки к chat_id)

---

## 📅 План реализации

### Phase 5: Мультичат (после завершения MVP)

#### **5.1 Настройка Supabase** (30 мин)

**Задачи:**
1. Создать проект на [supabase.com](https://supabase.com)
2. Получить API credentials (URL, anon key)
3. Добавить в .env.local:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
   ```
4. Установить зависимости:
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```
5. Создать `lib/supabase.ts` - клиент для browser
6. Создать `lib/supabase-server.ts` - клиент для server-side

**Файлы:**
- `lib/supabase.ts`
- `lib/supabase-server.ts`
- `.env.example` (обновить с Supabase credentials)

---

#### **5.2 Создание схемы БД** (20 мин)

**SQL миграция:**

```sql
-- Таблица чатов
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Новый чат',
  user_id UUID, -- для будущей аутентификации (пока NULL)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица сообщений
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- для tool_use, attachments, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_chats_created_at ON chats(created_at DESC);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (пока отключено, включим при добавлении auth)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Временная политика: все могут всё (пока нет auth)
CREATE POLICY "Allow all for now" ON chats FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON messages FOR ALL USING (true);
```

**Выполнение:**
1. Открыть Supabase Dashboard → SQL Editor
2. Вставить SQL выше
3. Запустить (RUN)
4. Проверить таблицы в Table Editor

---

#### **5.3 API маршруты для чатов** (45 мин)

**Создать файлы:**

##### `app/api/chats/route.ts` - CRUD операции

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/chats - Получить список всех чатов
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();

    const { data: chats, error } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ chats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

// POST /api/chats - Создать новый чат
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { title } = await req.json();

    const { data: chat, error } = await supabase
      .from('chats')
      .insert({ title: title || 'Новый чат' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}
```

##### `app/api/chats/[id]/route.ts` - Операции с конкретным чатом

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/chats/:id - Получить чат с сообщениями
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    // Получить чат
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', id)
      .single();

    if (chatError) throw chatError;

    // Получить сообщения
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    return NextResponse.json({ chat, messages });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

// PATCH /api/chats/:id - Обновить название чата
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;
    const { title } = await req.json();

    const { data: chat, error } = await supabase
      .from('chats')
      .update({ title })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Error updating chat:', error);
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    );
  }
}

// DELETE /api/chats/:id - Удалить чат
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    // Каскадное удаление сообщений настроено в БД (ON DELETE CASCADE)
    const { error } = await supabase.from('chats').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}
```

---

#### **5.4 Обновление Chat API** (30 мин)

**Изменить `app/api/chat/route.ts`:**

```typescript
import { streamText, convertToModelMessages } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createClient } from '@/lib/supabase-server';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages, chatId } = await req.json();

    // Валидация
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: messages array required', {
        status: 400,
      });
    }

    if (!chatId) {
      return new Response('Invalid request: chatId required', {
        status: 400,
      });
    }

    const supabase = createClient();

    // Сохранить user message в БД
    const userMessage = messages[messages.length - 1];
    if (userMessage.role === 'user') {
      await supabase.from('messages').insert({
        chat_id: chatId,
        role: 'user',
        content: userMessage.parts[0].text,
      });
    }

    // Конвертировать UI messages в model messages
    const modelMessages = convertToModelMessages(messages);

    // Stream chat completion
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: modelMessages,
      maxTokens: 4096,
      temperature: 1,
      // Callback для сохранения assistant message после завершения
      onFinish: async ({ text }) => {
        await supabase.from('messages').insert({
          chat_id: chatId,
          role: 'assistant',
          content: text,
        });

        // Обновить updated_at чата
        await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId);
      },
    });

    // Return UI message stream response
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Error in chat API:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
```

**Ключевые изменения:**
1. Добавлен параметр `chatId` в запросе
2. Сохранение user message перед отправкой Claude
3. Сохранение assistant response через `onFinish` callback
4. Обновление `updated_at` чата (для сортировки в списке)

---

#### **5.5 Создание UI компонентов** (60 мин)

##### **5.5.1 Sidebar компонент** (25 мин)

**Создать `components/Sidebar.tsx`:**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'; // опционально

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SidebarProps {
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

export default function Sidebar({
  currentChatId,
  onSelectChat,
  onNewChat,
}: SidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  // Загрузить список чатов
  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const response = await fetch('/api/chats');
      const data = await response.json();
      setChats(data.chats || []);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Не переключаться на чат при удалении

    if (!confirm('Удалить этот чат?')) return;

    try {
      await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));

      // Если удалили активный чат - создать новый
      if (chatId === currentChatId) {
        onNewChat();
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  return (
    <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Новый чат</span>
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-gray-400 text-center">Загрузка...</div>
        ) : chats.length === 0 ? (
          <div className="p-4 text-gray-400 text-center text-sm">
            Нет чатов. Создайте новый!
          </div>
        ) : (
          <div className="py-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors flex items-center justify-between group ${
                  chat.id === currentChatId ? 'bg-gray-800' : ''
                }`}
              >
                <div className="flex-1 truncate">
                  <div className="text-sm font-medium truncate">
                    {chat.title}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(chat.updated_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity"
                  aria-label="Удалить чат"
                >
                  <TrashIcon className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer (опционально) */}
      <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
        <div>NegotiateAI Chatbot</div>
        <div>Всего чатов: {chats.length}</div>
      </div>
    </div>
  );
}
```

---

##### **5.5.2 ChatWindow компонент** (20 мин)

**Создать `components/ChatWindow.tsx`:**

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react';

interface ChatWindowProps {
  chatId: string;
}

export default function ChatWindow({ chatId }: ChatWindowProps) {
  const { messages, sendMessage, status, error } = useChat({
    api: '/api/chat',
    body: { chatId }, // Передаём chatId в API
  });
  const [input, setInput] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  // Загрузить историю сообщений при смене чата
  useEffect(() => {
    loadChatHistory();
  }, [chatId]);

  const loadChatHistory = async () => {
    try {
      setInitialLoading(true);
      const response = await fetch(`/api/chats/${chatId}`);
      const data = await response.json();

      // TODO: Инициализировать useChat с существующими сообщениями
      // В текущей версии AI SDK нет прямого способа,
      // нужно использовать initialMessages prop или state management

      // Временное решение: просто покажем пустой чат
      // В production нужно реализовать через Zustand или Context
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    await sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: userMessage }],
    });
  };

  const isLoading = status === 'submitted' || status === 'streaming';

  if (initialLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Загрузка чата...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">
          NegotiateAI Chatbot
        </h1>
        <p className="text-sm text-gray-500">
          AI-ассистент для переговоров по проекту MIR.TRADE
        </p>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium mb-2">Начните разговор</p>
              <p className="text-sm">Задайте вопрос о проекте MIR.TRADE</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return <span key={index}>{part.text}</span>;
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-lg px-4 py-3 bg-white text-gray-900 border border-gray-200">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="text-sm">
                Ошибка: {error.message || 'Произошла ошибка'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Введите ваше сообщение..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

##### **5.5.3 Главная страница** (15 мин)

**Обновить `app/page.tsx`:**

```typescript
'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';

export default function HomePage() {
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // При первой загрузке создать новый чат
  useEffect(() => {
    if (!currentChatId) {
      createNewChat();
    }
  }, []);

  const createNewChat = async () => {
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Новый чат' }),
      });
      const data = await response.json();
      setCurrentChatId(data.chat.id);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        currentChatId={currentChatId}
        onSelectChat={setCurrentChatId}
        onNewChat={createNewChat}
      />
      {currentChatId ? (
        <ChatWindow key={currentChatId} chatId={currentChatId} />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-gray-500">Загрузка...</div>
        </div>
      )}
    </div>
  );
}
```

---

#### **5.6 Автогенерация названий чатов** (20 мин)

**Создать `lib/generate-chat-title.ts`:**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function generateChatTitle(
  firstUserMessage: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `Сгенерируй короткий заголовок (3-5 слов) для чата, основываясь на этом первом сообщении пользователя:

"${firstUserMessage}"

Верни ТОЛЬКО заголовок, без лишних слов.`,
        },
      ],
    });

    const title = response.content[0].text.trim();
    return title || 'Новый чат';
  } catch (error) {
    console.error('Failed to generate chat title:', error);
    return 'Новый чат';
  }
}
```

**Обновить `app/api/chat/route.ts`:**

```typescript
import { generateChatTitle } from '@/lib/generate-chat-title';

// В функции POST, после сохранения первого user message:

const userMessage = messages[messages.length - 1];
if (userMessage.role === 'user') {
  const { data: insertedMessage } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      role: 'user',
      content: userMessage.parts[0].text,
    })
    .select()
    .single();

  // Если это первое сообщение в чате - сгенерировать title
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('chat_id', chatId);

  if (count === 1) {
    // Первое сообщение - генерируем title асинхронно
    generateChatTitle(userMessage.parts[0].text).then(async (title) => {
      await supabase.from('chats').update({ title }).eq('id', chatId);
    });
  }
}
```

---

#### **5.7 Тестирование** (30 мин)

**Тест-кейсы:**

1. **Создание нового чата**
   - Клик на "Новый чат"
   - Проверить появление чата в списке
   - Отправить сообщение
   - Проверить автогенерацию title

2. **Переключение между чатами**
   - Создать 3 чата
   - Отправить сообщения в каждый
   - Переключаться между чатами
   - Проверить сохранность истории

3. **Удаление чата**
   - Удалить чат
   - Проверить исчезновение из списка
   - Проверить удаление из БД (Supabase Dashboard)

4. **Сортировка чатов**
   - Отправить сообщение в старый чат
   - Проверить что он поднялся наверх списка

5. **Обновление страницы**
   - Отправить сообщения
   - Обновить страницу (F5)
   - Проверить что чаты и история сохранились

6. **Длинный диалог**
   - Отправить 20+ сообщений в один чат
   - Проверить что контекст не переполнился (каждый чат = новое окно)

---

#### **5.8 Финализация и документация** (15 мин)

**Обновить документацию:**

1. **README.md:**
   - Добавить информацию о Supabase setup
   - Добавить переменные окружения
   - Обновить скриншоты (с сайдбаром)

2. **docs/architecture.md:**
   - Добавить диаграмму с Supabase
   - Описать схему БД
   - Описать flow создания/переключения чатов

3. **docs/setup.md:**
   - Шаги по настройке Supabase
   - SQL миграция
   - Получение credentials

4. **CHANGELOG.md:**
   - Добавить версию с мультичатом (например, v0.4.0)

---

## ⏱️ Оценка времени

| Задача | Время | Детали |
|--------|-------|--------|
| 5.1 Настройка Supabase | 30 мин | Регистрация, credentials, установка пакетов |
| 5.2 Схема БД | 20 мин | SQL миграция, индексы, RLS |
| 5.3 API маршруты | 45 мин | /api/chats CRUD операции |
| 5.4 Обновление Chat API | 30 мин | Интеграция с БД, сохранение сообщений |
| 5.5 UI компоненты | 60 мин | Sidebar (25м), ChatWindow (20м), Page (15м) |
| 5.6 Автогенерация title | 20 мин | Claude API для названий |
| 5.7 Тестирование | 30 мин | Все сценарии |
| 5.8 Документация | 15 мин | Обновление README, architecture |
| **ИТОГО** | **3 часа 30 мин** | |

**С запасом на баги:** ~4 часа

---

## 🚨 Риски и митигация

### Риск 1: Проблемы с Supabase RLS
**Описание:** Row Level Security может блокировать запросы
**Вероятность:** Средняя
**Влияние:** Высокое (ничего не работает)
**Митигация:**
- На первом этапе использовать политику "Allow all"
- Включить строгие RLS только при добавлении аутентификации
- Тестировать запросы через Supabase Dashboard

### Риск 2: Переполнение БД на free tier
**Описание:** Supabase free tier - 500MB
**Вероятность:** Низкая (для MVP)
**Влияние:** Среднее
**Митигация:**
- Мониторить размер БД в Supabase Dashboard
- При приближении к лимиту - добавить функцию архивации старых чатов
- Или перейти на платный план ($25/мес)

### Риск 3: useChat не поддерживает загрузку истории
**Описание:** AI SDK useChat не имеет встроенной загрузки existing messages
**Вероятность:** Высокая
**Влияние:** Среднее
**Митигация:**
- Использовать Zustand/Context для управления messages state
- Или использовать initialMessages prop (если добавят в будущих версиях)
- Временное решение: просто показывать новые сообщения, старые доступны в БД

### Риск 4: Race conditions при сохранении
**Описание:** Streaming response может завершиться раньше чем сохранится user message
**Вероятность:** Средняя
**Влияние:** Низкое
**Митигация:**
- Использовать await при сохранении user message
- onFinish callback для assistant message (уже реализовано)
- Добавить retry логику при ошибках БД

---

## 🧪 Тестирование

### Unit тесты
- API routes (jest + msw)
- Supabase клиент (mock)
- generateChatTitle функция

### Integration тесты
- Создание чата → отправка сообщения → проверка в БД
- Удаление чата → проверка каскадного удаления messages
- Автогенерация title

### E2E тесты (Playwright)
- User journey: создать чат → отправить сообщение → переключиться → вернуться
- Проверка сохранности после refresh
- Тест удаления чата

---

## 🔄 Миграция данных

### Сценарий: У пользователей уже есть чаты в localStorage

**План миграции:**

1. **При первом запуске новой версии:**
   - Проверить наличие данных в localStorage
   - Если есть - показать модалку: "Мигрировать старые чаты в новую систему?"

2. **Если пользователь согласился:**
   - Создать новый чат в Supabase
   - Скопировать все сообщения из localStorage в БД
   - Сгенерировать title для чата
   - Очистить localStorage
   - Показать success уведомление

3. **Если отказался:**
   - Сохранить флаг в localStorage: `migration_declined`
   - Больше не показывать модалку
   - Старые данные останутся в localStorage (не трогаем)

**Код миграции:**

```typescript
// lib/migrate-from-localstorage.ts
export async function migrateFromLocalStorage() {
  const oldMessages = localStorage.getItem('chat_messages');
  if (!oldMessages) return null;

  const messages = JSON.parse(oldMessages);
  if (messages.length === 0) return null;

  // Создать новый чат
  const response = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Мигрированный чат' }),
  });
  const { chat } = await response.json();

  // Сохранить все сообщения
  for (const message of messages) {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat.id,
        role: message.role,
        content: message.content,
      }),
    });
  }

  // Очистить localStorage
  localStorage.removeItem('chat_messages');

  return chat.id;
}
```

---

## 📊 Метрики успеха

После запуска мультичата отслеживать:

1. **Количество созданных чатов** (avg per user)
2. **Количество сообщений на чат** (показатель engagement)
3. **Частота переключения между чатами** (показатель полезности)
4. **Частота удаления чатов** (если высокая - UX проблема)
5. **Время загрузки чата** (должно быть <500ms)
6. **Размер БД** (мониторинг free tier лимита)

---

## 🔮 Будущие улучшения (Phase 6+)

### После запуска мультичата:

1. **Аутентификация** (Firebase Auth / Supabase Auth)
   - Вход через Google/Email
   - Row Level Security в Supabase
   - Личные чаты для каждого пользователя

2. **Поиск по чатам**
   - Full-text search в PostgreSQL
   - Поиск по содержимому сообщений

3. **Экспорт чата**
   - Скачать историю в PDF/TXT
   - Поделиться ссылкой на чат (публичный доступ)

4. **Папки/теги для чатов**
   - Группировка по странам (Египет, Алжир, ОАЭ...)
   - Теги: "тендер", "коммерция", "техническая спецификация"

5. **Архивация старых чатов**
   - Автоматическая архивация через 90 дней неактивности
   - Перенос в отдельную таблицу (экономия места)

6. **Мультимодальность**
   - Загрузка файлов в чат (PDF, DOCX, изображения)
   - Claude анализирует загруженные файлы
   - Сохранение attachments в Supabase Storage

7. **Collaborative режим**
   - Несколько пользователей в одном чате
   - Real-time updates через Supabase Realtime

8. **Голосовой ввод**
   - Speech-to-text для сообщений
   - Text-to-speech для ответов Claude

---

## 📝 Чек-лист перед началом реализации

**Перед тем как начать Phase 5, убедись что:**

- [ ] Phase 1-4 (MVP) полностью завершены и протестированы
- [ ] read_document, web_search, get_current_date работают стабильно
- [ ] У тебя есть ~4 часа непрерывного времени для реализации
- [ ] Создан аккаунт на supabase.com
- [ ] Понимаешь как работает PostgreSQL (базовый уровень)
- [ ] Понимаешь как работают React hooks (useEffect, useState)
- [ ] Есть план тестирования после реализации

---

## 🎯 Success Criteria для Phase 5

**Считаем Phase 5 завершённой когда:**

- [ ] Supabase подключен, БД создана
- [ ] Можно создать несколько чатов
- [ ] Сайдбар показывает список чатов
- [ ] Можно переключаться между чатами без потери истории
- [ ] История сохраняется в БД (проверено в Supabase Dashboard)
- [ ] После refresh страницы все чаты на месте
- [ ] Можно удалить чат
- [ ] Автогенерация названий работает для первого сообщения
- [ ] Чаты сортируются по updated_at (последние наверху)
- [ ] Нет критических багов
- [ ] Документация обновлена

---

## 📚 Полезные ресурсы

**Supabase:**
- [Официальная документация](https://supabase.com/docs)
- [Next.js integration](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security guide](https://supabase.com/docs/guides/auth/row-level-security)

**AI SDK:**
- [useChat documentation](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [streamText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)

**UI Inspiration:**
- [ChatGPT](https://chat.openai.com) - для UX паттернов
- [Claude.ai](https://claude.ai) - для сайдбара и списка чатов

---

## 💡 Заключение

Реализация мультичата - это **критически важная фича** для production системы NegotiateAI Chatbot. Она решает не только UX проблему, но и **техническую проблему переполнения контекста** (каждый чат = новое контекстное окно).

**Рекомендуемая последовательность:**

1. ✅ **Phase 0-1:** Документация + Базовый чат (завершено)
2. ⏳ **Phase 2-3:** База знаний + AI tools (в процессе)
3. ⏳ **Phase 4:** Полировка MVP
4. 🔜 **Phase 5:** Мультичат (этот документ)
5. 🔮 **Phase 6+:** Аутентификация, поиск, дополнительные фичи

**Ключевые преимущества мультичата:**
- ✅ Решает проблему переполнения контекста
- ✅ Улучшает организацию работы (разные чаты для разных стран)
- ✅ Сохраняет историю навсегда (PostgreSQL)
- ✅ Привычный UX для пользователей
- ✅ Масштабируется на неограниченное количество разговоров

**Время реализации:** ~4 часа
**Сложность:** 🟡 Средняя
**Приоритет:** High (после MVP)

---

**Автор:** Claude Code
**Дата:** 2025-10-14
**Версия:** 1.0
**Статус:** Готово к реализации
