# ТЗ-А2: Онбординг брифинга `/briefing/setup`

**Версия:** 3.29.0  
**Зависимости:** ТЗ-А1 ✅, промпт от PE ✅  
**Фаза:** А (Текстовый брифинг MVP)

---

## Что делаем и зачем

Заменяем заглушку `/briefing/setup` на интерактивный онбординг. Через AI-беседу пользователь рассказывает о своих интересах, AI находит персональные источники через deepResearch, и сохраняет профиль в БД. Это первое взаимодействие пользователя с брифингом — первое впечатление от инструмента.

---

## Паттерн: как "Создание проекта", но для брифинга

Переиспользуем архитектуру `projects/new`:

- **Split layout:** Левая панель (превью профиля) + правая (чат)
- **Service-chat API:** Новый контекст `"briefing-onboarding"` в существующем route
- **Live Preview:** Левая панель обновляется в реальном времени при tool calls
- **Tool-driven:** AI вызывает tools → результат отображается в превью

Референсные файлы:
- `app/(dashboard)/projects/new/project-creation-client.tsx` — split layout паттерн
- `app/(chat)/api/service-chat/route.ts` — service-chat API
- `components/service-chat/` — конфигурация, ядро

---

## Backend: service-chat расширение

### 1. Новый контекст `"briefing-onboarding"`

В `service-chat/route.ts`:

- Добавить `"briefing-onboarding"` в `ServiceChatContext` тип и `requestSchema`
- **Модель:** Claude Sonnet 4.6 (`claude-sonnet-4-6`). Новая модель, обкатываем на брифинге. Добавить в providers.ts как отдельный entry, НЕ менять существующий alias `claude-sonnet` — остальная платформа пока на старой модели.
- **Промпт:** Загрузить из `lib/prompts/service-chats/briefing-onboarding.md` (приложен к ТЗ)
- **Mode injection:** из `lib/prompts/service-chats/briefing-onboarding-mode-injection.md` (приложен к ТЗ)
- **stepCountIs:** увеличить до 5 (deepResearch может потребовать несколько шагов)
- **maxDuration:** 120 секунд (deepResearch медленный)

### 2. Определение режима

```
Запрос содержит body.briefingMode: "create" | "edit" (клиент определяет)

Клиент проверяет:
  GET /api/briefing/latest → есть settings? → "edit" : "create"
```

### 3. Сборка промпта (buildBriefingOnboardingPrompt)

По аналогии с `buildProjectCreationPrompt` и `buildFullManagerPrompt`:

1. Загрузить базовый промпт из .md файла
2. Подставить `{{USER_CONTEXT}}` — из профиля пользователя (displayName, pronouns, occupation, bio). Пустые поля не включать. Паттерн один в один как у Секретаря.
3. Подставить `{{DATE}}` — текущая дата ISO
4. Подставить `{{MODE_INJECTION}}`:
   - mode "create" → блок из mode-injection.md (секция create)
   - mode "edit" → блок из mode-injection.md (секция edit), подставить текущие settings/topics/sources из БД

### 4. Tools (три штуки)

**saveBriefingProfile** (новый tool, определить в route.ts):
```typescript
tools.saveBriefingProfile = tool({
  description: "Сохранить профиль брифинга. Вызывай когда пользователь подтвердил настройки.",
  inputSchema: saveBriefingProfileSchema, // Zod: settings + topics[] + sources[]
  execute: async (input) => {
    // 1. upsertBriefingSettings(userId, input.settings)
    // 2. Удалить старые briefingSources пользователя
    // 3. Добавить новые из input.sources (addBriefingSource для каждого)
    // 4. return { success: true, topicsCount, sourcesCount }
  }
});
```

**deepResearch** — уже существует как tool платформы (`lib/ai/tools/deep-research.ts`). Подключить через `getStandardTools()` или импортировать напрямую. Использовать depth "pro" по умолчанию.

**fetchUrl** — уже существует (`lib/ai/tools/fetch-url.ts`). Подключить аналогично.

---

## Frontend: страница `/briefing/setup`

### 1. Заменить заглушку

Текущий файл `app/(dashboard)/briefing/setup/page.tsx` — Server Component, заглушка "Скоро". Заменить на:

- Server Component: auth guard + определение mode (есть ли briefingSettings) + загрузка userProfile
- Client Component: `BriefingSetupClient` — split layout

### 2. Split Layout (как projects/new)

```
┌─────────────────────────────────────────────────────────┐
│  ← Назад    Настройка брифинга                   👤     │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  ПРЕВЬЮ      │  ЧАТ (ServiceChat)                      │
│  ПРОФИЛЯ     │                                          │
│              │  AI: Привет, Владимир! Расскажи,         │
│  Темы:       │  что тебе важно знать каждое утро?       │
│  (пусто)     │                                          │
│              │  User: Интересуюсь AI, слежу за F1...    │
│  Источники:  │                                          │
│  (пусто)     │  AI: Отлично! Ищу лучшие источники...   │
│              │                                          │
│              │  [deepResearch working...]                │
│              │                                          │
│  ──────────  │  AI: Нашёл! Вот что подобрал:            │
│  [Сохранить] │  🤖 AI для бизнеса: ...                  │
│  (неактивна) │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### 3. Левая панель — BriefingProfilePreview

Показывает собранный профиль в реальном времени:

- **Темы** — список с emoji, появляются по мере tool calls
- **Источники** — под каждой темой, с иконкой tier
- **Настройки** — язык, кол-во новостей (мелким шрифтом внизу)
- **Кнопка "Сохранить"** — активна только после успешного saveBriefingProfile

Обновление: отслеживать tool results `saveBriefingProfile` в parts сообщений (как `updateProjectDraft` в projects/new). Но также отслеживать `deepResearch` — показывать найденные источники в превью ДО финального сохранения.

### 4. Правая панель — чат

Переиспользовать `ProjectChatPanel` или создать аналогичный `BriefingChatPanel`. Тот же паттерн: ScrollArea + сообщения + ServiceChatInput.

### 5. Transport

```typescript
const transport = new DefaultChatTransport({
  api: "/api/service-chat",
  body: {
    context: "briefing-onboarding",
    briefingMode: mode, // "create" | "edit"
    userProfile,
  },
});
```

### 6. После сохранения

Когда saveBriefingProfile вернул success:
- Показать success card в левой панели (как при создании проекта)
- Кнопка "Сгенерировать первый брифинг" → `POST /api/briefing/generate` → редирект на `/briefing`

---

## Файлы промптов (приложены)

Положить в `lib/prompts/service-chats/`:

1. **briefing-onboarding.md** — основной промпт (из uploads)
2. **briefing-onboarding-mode-injection.md** — шаблоны mode injection (из uploads)

---

## Что НЕ входит в это ТЗ

- Генерация брифинга (ТЗ-А3)
- Страница выпуска /briefing/[date] (ТЗ-А4)
- Прогресс генерации (ТЗ-А5)
- TTS/аудио (Фаза Б)

---

## Ожидаемый результат

1. Пользователь нажимает "Настроить мой брифинг" на лендинге → `/briefing/setup`
2. AI-беседа: 3-5 реплик, deepResearch для каждой темы
3. Превью профиля обновляется в реальном времени
4. Пользователь подтверждает → saveBriefingProfile → данные в БД
5. Предлагается сгенерировать первый брифинг
6. Повторный визит: mode "edit" с текущими настройками
