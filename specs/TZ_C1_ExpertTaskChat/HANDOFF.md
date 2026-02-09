# Передача сессии ТЗ-C1: ExpertTaskChat

**Последнее обновление:** 2026-02-10
**Сессия:** 2 (Разработка — Этап 1)
**Фаза:** Разработка (Этап 1 завершён, ожидает мануального теста)

---

## Статус этапов

- [x] Этап 1: Инфраструктура (Route Group + Shared Tools + Prompt Builder + DB Queries)
- [ ] Этап 2: API Route + TaskSidebar + Page
- [ ] Этап 3: TaskChat + Полноценный чат
- [ ] Этап 4: Навигация из страницы проекта + Phase Transitions
- [ ] Этап 5: Финализация

---

## Следующая сессия: начни с

1. Прочитай этот файл (HANDOFF.md)
2. Прочитай ROADMAP.md → Этап 1 (детальные задачи)
3. Запусти `npm run dev` — убедись что проект запускается
4. **Первая задача:** Создать `app/(task)/layout.tsx`

**Порядок Этапа 1:**
1. Route group + layout → `app/(task)/layout.tsx` + заглушка page.tsx
2. Shared tools → `lib/ai/tools/chat-tools.ts` + рефакторинг `chat/route.ts`
3. Expert prompt → `lib/prompts/experts/task-expert.md` + `build-task-expert-prompt.ts`
4. DB queries → 3 функции в `lib/db/queries.ts`
5. Валидация: `npx tsc --noEmit` + `npm run build` + проверить что основной чат НЕ СЛОМАЛСЯ

---

## Что сделано в сессии 1

- Создана структура `specs/TZ_C1_ExpertTaskChat/` (8 файлов)
- Изучены 3 документа ТЗ: SPEC, EXPERT_PROMPT, MVP_ROLES_AND_CONTRACTS
- Изучена кодовая база: chat route (775 строк, tools импортируются), chat.tsx (503 строк, useChat + transport), schema.ts, queries.ts (2306 строк), project-pulse.tsx (425 строк, нет onClick), approved-state.tsx (187 строк, toast заглушка)
- ANALYSIS.md: 7 вопросов → все ответы получены
- ROADMAP.md: 5 этапов детально спланированы

---

## Ключевые решения

1. **Route group:** `app/(task)/` — отдельная от `(chat)`, свой layout без AppSidebar
2. **Эксперт первым:** Auto-trigger `sendMessage()` при `initialMessages.length === 0` (только первый визит)
3. **createTaskSnapshot:** Пропускаем полностью (C1.5)
4. **Tools:** Извлечь в `lib/ai/tools/chat-tools.ts` — фабрика `getStandardTools({ session, dataStream, isProjectChat })`
5. **Модель:** Env variable `EXPERT_MODEL` с fallback на `gemini-3-pro`
6. **Input:** InputContext система (mode="send"), без multimodal-input, без ModelSelector
7. **Locked tasks:** AlertDialog, разблокировка по подтверждению (locked → pending → navigate)

---

## Критичные детали из анализа кодовой базы

**Tools в chat/route.ts (строки 29-37, 451-465):**
- Tools ИМПОРТИРУЮТСЯ из `lib/ai/tools/`, не определяются inline
- Factory-паттерн: `createDocument({ session, dataStream })` — нужны session и dataStream
- Простые tools: `webSearch`, `parseExcel`, `getCurrentDate`, `getWeather` — без параметров
- `readDocument` исключается для project chats (`isProjectChat ? {} : { readDocument }`)

**Chat.tsx (строки 169-189):**
- Использует `DefaultChatTransport` с кастомным `prepareSendMessagesRequest`
- Отправляет ТОЛЬКО последнее сообщение (`request.messages.at(-1)`)
- Retry логика через `retryableFetch` (для TaskChat НЕ нужна)

**Prompt system:**
- `buildChatPrompt()` из `lib/prompts/server.ts` → наш `buildTaskExpertPrompt()` будет аналогичный, но проще
- Возвращает `{ systemPrompt: string }`

**DB schema:**
- `ProjectTask.chatId` — uuid, nullable, ссылка на Chat
- `ProjectTask.status` — enum: locked/pending/in_progress/review/issues/done
- `Chat.projectId` — nullable, привязка к проекту

**Streaming response:**
- `createUIMessageStream()` + `JsonToSseTransformStream()` → SSE
- Messages сохраняются ДО (user) и ПОСЛЕ (assistant) streaming

---

## Файлы в работе

| Файл | Статус | Примечание |
|------|--------|------------|
| `specs/TZ_C1_ExpertTaskChat/ROADMAP.md` | Готов | Основной рабочий документ |
| `specs/TZ_C1_ExpertTaskChat/ANALYSIS.md` | Готов | 7 вопросов + ответы |
| `specs/TZ_C1_ExpertTaskChat/EXPERT_PROMPT.md` | Готов | Промпт от PE (исходник) |

---

## Документы для чтения в начале сессии

| Приоритет | Документ | Зачем |
|-----------|----------|-------|
| 1 | Этот HANDOFF.md | Контекст передачи |
| 2 | ROADMAP.md → текущий этап | Задачи, файлы, валидация |
| 3 | EXPERT_PROMPT.md | Промпт для task-expert.md (при работе над Этапом 1, задача 3) |

**НЕ читать:** _archive/, MVP_ROLES_AND_CONTRACTS.md (уже извлечено что нужно), TZ_C1_ExpertTaskChat.md (= SPEC.md)

---

## Блокеры / Вопросы

Нет блокеров. Все вопросы разрешены. Можно приступать к Этапу 1.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```
