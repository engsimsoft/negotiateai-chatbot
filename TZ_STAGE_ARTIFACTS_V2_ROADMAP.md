# Roadmap: Система артефактов v2.0

**Дата создания:** 2026-01-27
**Автор:** Владимир + Claude Code
**Версия:** 1.0

---

## Цель проекта

Полностью переработать систему артефактов для непрограммиста (Юлия):
- Удалить неиспользуемые `code` и `sheet` артефакты
- Упростить `text` (plain text + emoji для соцсетей)
- Добавить профессиональные презентации двух типов
- Добавить публичный шаринг без истории чата

---

## Текущий статус

- **Этап:** Этап 2 / 4 — Public Share инфраструктура ✅
- **Прогресс:** 45/78 задач (58%)
- **Следующее:** Этап 3, Фаза 3.1 — Исследование Reveal.js

---

## Исходные документы

| Документ | Назначение |
|----------|------------|
| [TZ_ARTIFACTS_SYSTEM_V2.md](TZ_ARTIFACTS_SYSTEM_V2.md) | Техническое задание |
| [ARTIFACTS_ARCHITECTURE.md](ARTIFACTS_ARCHITECTURE.md) | Текущая архитектура |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Контекст проекта |

---

## Уточнённые решения

| Параметр | Решение |
|----------|---------|
| PPTX Preview | Cloud API (CloudConvert/Cloudmersive) |
| Количество тем | 5 штук |
| Темы | Corporate, Modern, Minimal, Dark, Creative |

---

## Этапы разработки

### Этап 1: Очистка (2-3 дня)

**Цель:** Удалить неиспользуемые артефакты, упростить text

---

#### Фаза 1.1: Анализ и подготовка (2-3 часа) ✅

- [x] Изучить текущий код артефактов (`artifacts/`, `lib/ai/tools/`)
- [x] Составить список всех файлов для удаления/изменения
- [x] Создать backup branch: `git checkout -b backup/artifacts-v1`

**Критические файлы для анализа:**
```
artifacts/
├── code/
│   ├── server.ts      # handler генерации
│   └── client.tsx     # UI компонент
├── sheet/
│   ├── server.ts
│   └── client.tsx
└── text/
    ├── server.ts
    └── client.tsx

lib/
├── artifacts/server.ts  # registry handlers
├── ai/prompts.ts        # codePrompt, sheetPrompt, textPrompt
└── ai/tools/
    ├── create-document.ts
    └── update-document.ts
```

---

#### Фаза 1.2: Удаление code артефакта (2-3 часа) ✅

- [x] Удалить `artifacts/code/server.ts`
- [x] Удалить `artifacts/code/client.tsx`
- [x] Удалить папку `artifacts/code/` полностью
- [x] Удалить из registry `lib/artifacts/server.ts`
- [x] Удалить `codePrompt` из `lib/ai/prompts.ts`
- [x] Проверить build: `npm run build`

---

#### Фаза 1.3: Удаление sheet артефакта (2-3 часа) ✅

- [x] Удалить `artifacts/sheet/server.ts`
- [x] Удалить `artifacts/sheet/client.tsx`
- [x] Удалить папку `artifacts/sheet/` полностью
- [x] Удалить из registry `lib/artifacts/server.ts`
- [x] Удалить `sheetPrompt` из `lib/ai/prompts.ts`
- [x] Проверить build: `npm run build`

---

#### Фаза 1.4: Упрощение text артефакта (3-4 часа) ✅

- [x] Обновить system prompt в `artifacts/text/server.ts` (plain text, emoji)
- [x] Создать `components/plain-text-editor.tsx` (простой textarea)
- [x] Упростить UI в `artifacts/text/client.tsx`:
  - Заменён Editor на PlainTextEditor
  - Убран Markdown рендеринг
  - Оставлена кнопка "Copy"
- [x] Добавить кнопку "Download" (.txt файл)
- [x] Убраны AI suggestions (toolbar очищен)

---

#### Фаза 1.5: Очистка и проверка (1-2 часа) ✅

- [x] Build проверен: `npm run build` без ошибок
- [x] Очистка неиспользуемых imports
- [x] Тест: создание text артефакта работает (manual) ✅
- [x] Тест: старые text артефакты открываются (manual) — N/A, нет старых

---

### Этап 2: Public Share инфраструктура (3-4 дня)

**Цель:** Публичные ссылки на артефакты без авторизации

---

#### Фаза 2.1: Database schema (2-3 часа) ✅

- [x] Добавить поля в таблицу `Document` (`lib/db/schema.ts`):
  ```typescript
  isPublic: boolean("is_public").default(false),
  shareToken: varchar("share_token", { length: 32 }).unique(),
  sharedAt: timestamp("shared_at"),
  ```
- [x] Создать миграцию: `npm run db:generate`
- [x] Применить миграцию: `npm run db:migrate`
- [ ] Проверить в Drizzle Studio: `npm run db:studio` (manual)

---

#### Фаза 2.2: Database queries (2-3 часа) ✅

- [x] Добавить в `lib/db/queries.ts`:
  ```typescript
  // Создать публичную ссылку
  export async function shareDocument(documentId: string, userId: string)

  // Отозвать публичную ссылку
  export async function unshareDocument(documentId: string, userId: string)

  // Получить документ по токену (без auth!)
  export async function getPublicDocument(token: string)
  ```
- [x] Генерация токена: `generateUUID().replace(/-/g, "")` (32 chars)
- [x] Проверка владения документом при share/unshare
- [ ] Тест queries в dev (manual)

---

#### Фаза 2.3: API endpoints (2-3 часа) ✅

- [x] Создать `app/(chat)/api/document/[id]/share/route.ts`:
  ```typescript
  // POST - создать публичную ссылку
  // DELETE - отозвать публичную ссылку
  ```
- [x] Проверка авторизации (только владелец может share)
- [x] Возврат `{ shareToken, shareUrl, alreadyShared }` при создании
- [ ] Тест через Postman/curl (manual)

---

#### Фаза 2.4: Public share page (3-4 часа) ✅

- [x] Создать `app/share/[token]/page.tsx`
- [x] Получение документа по токену (БЕЗ auth middleware!)
- [x] Рендеринг артефакта по типу:
  - `text`: текст + Copy + Download ✅
  - `presentation-reveal`: будет в Этапе 3
  - `presentation-pptx`: будет в Этапе 4
- [x] Meta tags: `robots: { index: false, follow: false }`
- [x] 404 страница `not-found.tsx`
- [x] Минималистичный UI (только артефакт, без sidebar/header)

---

#### Фаза 2.5: UI для шаринга (2-3 часа) ✅

- [x] Добавить кнопку "Share" в `artifacts/text/client.tsx` actions
- [x] Расширить `ArtifactActionContext` — добавлен `documentId` и `openShareModal`
- [x] Создать `components/share-modal.tsx`:
  - Input с ссылкой (readonly)
  - Кнопка "Copy link"
  - Кнопка "Unshare" (если уже shared)
  - Статус: "Private" / "Public"
- [x] Добавлен `CheckIcon` в icons.tsx

---

#### Фаза 2.6: Тестирование (1-2 часа) ✅

- [x] Создать text артефакт
- [x] Нажать Share → получить ссылку
- [x] Открыть ссылку в incognito → видно ТОЛЬКО артефакт
- [x] Проверить: история чата НЕ видна
- [x] Нажать Unshare → ссылка перестаёт работать
- [x] Commit: `feat: public share for artifacts (v2.3.0)`

---

### Этап 3: Presentation-Reveal (4-5 дней)

**Цель:** Wow-презентации на Reveal.js в браузере

---

#### Фаза 3.1: Исследование Reveal.js (2-3 часа)

- [ ] Изучить [Reveal.js документацию](https://revealjs.com/)
- [ ] Изучить [демо](https://revealjs.com/demo/)
- [ ] Выбрать способ подключения:
  - CDN (проще, но зависимость)
  - npm (сложнее, но контроль)
  - Рекомендация: CDN для начала
- [ ] Прототип: создать простую презентацию в Next.js iframe

---

#### Фаза 3.2: Система тем (3-4 часа)

- [ ] Создать `lib/presentations/themes.ts`:
  ```typescript
  export const revealThemes = {
    corporate: { /* синий, строгий */ },
    modern: { /* градиенты, яркий */ },
    minimal: { /* белый, чистый */ },
    dark: { /* тёмный фон */ },
    creative: { /* нестандартный */ }
  }
  ```
- [ ] Для каждой темы:
  - Цветовая палитра (primary, secondary, background, text)
  - Шрифты (Google Fonts)
  - CSS стили
- [ ] Тип темы:
  ```typescript
  interface RevealTheme {
    id: string;
    name: string;
    colors: { primary, secondary, background, text };
    fonts: { heading, body };
    css: string;
  }
  ```

---

#### Фаза 3.3: Server handler (3-4 часа)

- [ ] Создать `artifacts/presentation-reveal/server.ts`:
  ```typescript
  export const revealDocumentHandler = createDocumentHandler<"presentation-reveal">({
    kind: "presentation-reveal",
    onCreateDocument: async ({ title, dataStream }) => {
      // 1. Генерация структуры слайдов через AI
      // 2. Применение темы
      // 3. Сборка HTML с Reveal.js
      // 4. Streaming
    }
  });
  ```
- [ ] Промпт для AI (генерация JSON структуры слайдов):
  ```
  Генерируй массив слайдов:
  [
    { type: "title", title: "...", subtitle: "..." },
    { type: "content", title: "...", bullets: [...] },
    { type: "image", title: "...", imageUrl: "..." },
    ...
  ]
  ```
- [ ] Шаблон Reveal.js HTML (с CDN)
- [ ] Регистрация в `lib/artifacts/server.ts`

---

#### Фаза 3.4: Client component (4-5 часов)

- [ ] Создать `artifacts/presentation-reveal/client.tsx`:
  ```typescript
  export const revealArtifact = new Artifact<"presentation-reveal", Metadata>({
    kind: "presentation-reveal",
    content: ({ content }) => {
      return (
        <iframe
          srcDoc={content}
          className="w-full h-full"
          sandbox="allow-scripts"
        />
      );
    }
  });
  ```
- [ ] Обработка streaming (показ по мере генерации)
- [ ] Инициализация Reveal.js в iframe
- [ ] Навигация стрелками (keyboard events)
- [ ] Плавные переходы между слайдами

---

#### Фаза 3.5: Actions (2-3 часа)

- [ ] Кнопка "Fullscreen":
  ```typescript
  onClick: () => {
    iframeRef.current?.requestFullscreen();
  }
  ```
- [ ] Кнопка "Share" (использует Public Share из Этапа 2)
- [ ] Опционально: "Download PDF" (через Reveal.js export)

---

#### Фаза 3.6: Интеграция с AI (2-3 часа)

- [ ] Обновить `lib/ai/tools/create-document.ts`:
  - Добавить `presentation-reveal` в enum `kind`
- [ ] Обновить промпт AI чтобы он знал о новом типе
- [ ] Тест: попросить AI создать презентацию

---

#### Фаза 3.7: Тестирование (1-2 часа)

- [ ] Создать презентацию через AI: "Сделай презентацию про AI"
- [ ] Проверить все 5 тем (переключение)
- [ ] Проверить навигацию (стрелки, клик)
- [ ] Проверить Fullscreen
- [ ] Share и открыть публично
- [ ] Commit: `feat: presentation-reveal artifact (v2.4.0)`

---

### Этап 4: Presentation-PPTX (5-6 дней)

**Цель:** Настоящие PPTX файлы с профессиональным дизайном

---

#### Фаза 4.1: Исследование PptxGenJS (2-3 часа)

- [ ] Изучить [PptxGenJS документацию](https://gitbrent.github.io/PptxGenJS/)
- [ ] Установить: `npm install pptxgenjs`
- [ ] Прототип: создать простую презентацию программно
- [ ] Понять ограничения (шрифты, изображения, анимации)

---

#### Фаза 4.2: Cloud API для preview (3-4 часа)

- [ ] Выбрать сервис:
  - [CloudConvert](https://cloudconvert.com/) - популярный, надёжный
  - [Cloudmersive](https://cloudmersive.com/) - дешевле
  - Рекомендация: CloudConvert
- [ ] Создать аккаунт, получить API key
- [ ] Добавить `CLOUDCONVERT_API_KEY` в `.env.local`
- [ ] Создать `lib/services/pptx-preview.ts`:
  ```typescript
  export async function generatePptxPreview(pptxBuffer: Buffer): Promise<string[]> {
    // 1. Upload PPTX to CloudConvert
    // 2. Convert to PNG images
    // 3. Upload images to Vercel Blob
    // 4. Return array of image URLs
  }
  ```
- [ ] Тест: конвертация тестового PPTX

---

#### Фаза 4.3: Система тем PPTX (4-5 часов)

- [ ] Создать `lib/presentations/pptx-themes.ts`:
  ```typescript
  export const pptxThemes = {
    corporate: {
      colors: { ... },
      fonts: { ... },
      masterSlide: { ... }
    },
    // ... другие темы
  }
  ```
- [ ] Для каждой темы:
  - Title slide layout
  - Content slide layout (bullets)
  - Two-column layout
  - Image + text layout
  - Quote/highlight layout
- [ ] Цветовые палитры совместимые с PowerPoint
- [ ] Шрифты (безопасные: Arial, Calibri, или embedded)

---

#### Фаза 4.4: Server handler (4-5 часов)

- [ ] Создать `artifacts/presentation-pptx/server.ts`:
  ```typescript
  export const pptxDocumentHandler = createDocumentHandler<"presentation-pptx">({
    kind: "presentation-pptx",
    onCreateDocument: async ({ title, dataStream }) => {
      // 1. AI генерирует структуру слайдов (JSON)
      // 2. PptxGenJS создаёт PPTX
      // 3. Сохранение в Vercel Blob
      // 4. Cloud API генерирует preview images
      // 5. Streaming статуса
    }
  });
  ```
- [ ] Промпт для AI (структура слайдов)
- [ ] Генерация PPTX через PptxGenJS
- [ ] Сохранение PPTX в Vercel Blob
- [ ] Вызов Cloud API для preview
- [ ] Сохранение preview images
- [ ] Регистрация в registry

---

#### Фаза 4.5: Client component (3-4 часа)

- [ ] Создать `artifacts/presentation-pptx/client.tsx`:
  ```typescript
  interface PptxMetadata {
    pptxUrl: string;      // URL для скачивания
    previewImages: string[]; // URLs превью слайдов
    slideCount: number;
  }
  ```
- [ ] Галерея слайдов (preview images)
- [ ] Навигация между слайдами (стрелки, thumbnails)
- [ ] Индикатор загрузки (пока генерируется)

---

#### Фаза 4.6: Actions (2-3 часа)

- [ ] Кнопка "Download":
  ```typescript
  onClick: ({ metadata }) => {
    window.open(metadata.pptxUrl, "_blank");
  }
  ```
- [ ] Кнопка "Share" (Public Share)
- [ ] Выбор темы при создании (dropdown в UI?)

---

#### Фаза 4.7: Интеграция с AI (2-3 часа)

- [ ] Обновить `create-document.ts`: добавить `presentation-pptx`
- [ ] AI выбирает тему автоматически по контексту
- [ ] Или пользователь указывает: "Сделай презентацию в тёмной теме"
- [ ] Тест генерации

---

#### Фаза 4.8: Тестирование (2-3 часа)

- [ ] Создать PPTX через AI
- [ ] Скачать и открыть в Microsoft PowerPoint
- [ ] Открыть в Google Slides
- [ ] Открыть в Keynote (Mac)
- [ ] Проверить все 5 тем
- [ ] Share и скачать публично
- [ ] Commit: `feat: presentation-pptx artifact (v2.5.0)`

---

## Критические файлы

### Существующие (модификация)

| Файл | Изменения |
|------|-----------|
| `lib/artifacts/server.ts` | Registry: удалить code/sheet, добавить reveal/pptx |
| `lib/ai/tools/create-document.ts` | Добавить новые типы |
| `lib/ai/prompts.ts` | Удалить code/sheet промпты, обновить text |
| `lib/db/schema.ts` | Добавить поля для share |
| `lib/db/queries.ts` | Добавить share/unshare queries |
| `artifacts/text/client.tsx` | Упростить, добавить Download |

### Новые файлы

| Файл | Назначение |
|------|------------|
| `artifacts/presentation-reveal/server.ts` | Handler генерации Reveal |
| `artifacts/presentation-reveal/client.tsx` | UI компонент Reveal |
| `artifacts/presentation-pptx/server.ts` | Handler генерации PPTX |
| `artifacts/presentation-pptx/client.tsx` | UI компонент PPTX |
| `lib/presentations/themes.ts` | Темы для Reveal.js |
| `lib/presentations/pptx-themes.ts` | Темы для PPTX |
| `lib/services/pptx-preview.ts` | Cloud API интеграция |
| `app/share/[token]/page.tsx` | Публичная страница |
| `app/api/document/[id]/share/route.ts` | API для шаринга |
| `components/share-modal.tsx` | Модальное окно шаринга |

---

## Оценка времени

| Этап | Задачи | Время |
|------|--------|-------|
| Этап 1: Очистка | 15 | 2-3 дня |
| Этап 2: Public Share | 18 | 3-4 дня |
| Этап 3: Reveal | 21 | 4-5 дней |
| Этап 4: PPTX | 24 | 5-6 дней |
| **Итого** | **78** | **14-18 дней** |

---

## Зависимости между этапами

```
Этап 1 (Очистка)
     │
     ▼
Этап 2 (Public Share) ← базовая инфраструктура
     │
     ├─────────────────┐
     ▼                 ▼
Этап 3 (Reveal)    Этап 4 (PPTX)
     │                 │
     └────────┬────────┘
              ▼
         Финализация
```

**Примечание:** Этапы 3 и 4 могут выполняться параллельно после завершения Этапа 2.

---

## Верификация

После каждого этапа:

1. **Build:** `npm run build` — без ошибок
2. **Dev:** `npm run dev` — локальное тестирование
3. **Функционал:** Создание артефакта через AI работает
4. **Share:** Публичная ссылка работает (для Этапов 2+)
5. **Production:** Deploy на Vercel, проверка

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Cloud API дорого/медленно | Средняя | Fallback: HTML-preview или без preview |
| PptxGenJS ограничения дизайна | Высокая | Упростить темы, фокус на контент |
| Reveal.js конфликт с Next.js | Низкая | Использовать iframe изоляцию |
| Большой объём работы | Высокая | Итеративный подход, MVP first |

---

## Текущая сессия

**2026-01-27:**
- [X] Изучено ТЗ (TZ_ARTIFACTS_SYSTEM_V2.md)
- [X] Изучена текущая архитектура (ARTIFACTS_ARCHITECTURE.md)
- [X] Изучен контекст проекта (PROJECT_STATUS.md)
- [X] Создана дорожная карта (этот файл)

**2026-01-28:**
- [X] Завершена Фаза 1.1 — Анализ и подготовка
- [X] Завершена Фаза 1.2 — Удаление code артефакта
- [X] Завершена Фаза 1.3 — Удаление sheet артефакта
- [X] Удалены неиспользуемые компоненты (code-editor.tsx, sheet-editor.tsx)
- [X] Завершена Фаза 1.4 — Упрощение text артефакта
  - Создан PlainTextEditor (plain text без Markdown)
  - Обновлён system prompt (emoji formatting)
  - Добавлена кнопка Download (.txt)
- [X] Завершена Фаза 1.5 — Build успешен
- [X] Завершена Фаза 2.1 — Database schema для Public Share
  - Добавлены поля: isPublic, shareToken, sharedAt
  - Миграция: 0011_abnormal_black_queen.sql
  - Исправлен document-preview.tsx (добавлены новые поля в streaming object)
- [X] Завершена Фаза 2.2 — Database queries
  - shareDocument() — создание публичной ссылки с проверкой владения
  - unshareDocument() — отзыв публичной ссылки
  - getPublicDocument() — получение документа по токену (без auth)
- [X] Завершена Фаза 2.3 — API endpoints
  - POST /api/document/[id]/share → { shareToken, shareUrl, alreadyShared }
  - DELETE /api/document/[id]/share → { success, wasShared }
- [X] Завершена Фаза 2.4 — Public share page
  - app/share/[token]/page.tsx — серверный компонент
  - shared-document-view.tsx — клиентский компонент (Copy, Download)
  - not-found.tsx — 404 страница
  - Meta tags noindex/nofollow
- [X] Завершена Фаза 2.5 — UI для шаринга
  - Расширен ArtifactActionContext (documentId, openShareModal)
  - Создан share-modal.tsx (Create/Copy/Unshare)
  - Добавлен Share action в text artifact
  - Добавлен CheckIcon в icons.tsx
- [X] Завершена Фаза 2.6 — Тестирование ✅
  - Все тесты пройдены (manual)
- ⏸️ Следующее: Этап 3, Фаза 3.1 — Исследование Reveal.js

---

## Версионирование

| Версия | Этап | Описание |
|--------|------|----------|
| v2.2.0 | 1 | Удаление code/sheet, упрощение text |
| v2.3.0 | 2 | Public Share инфраструктура |
| v2.4.0 | 3 | Presentation-Reveal (Reveal.js) |
| v2.5.0 | 4 | Presentation-PPTX (PptxGenJS) |

---

**Документ готов к реализации.**

**Следующий шаг:** Открыть новый чат, указать на этот roadmap, начать с Фазы 1.1.
