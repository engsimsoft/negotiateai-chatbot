# ТЗ-А5: Анализ — Прогресс генерации брифинга

**Дата:** 2026-02-20
**Статус:** Анализ завершён, ожидает обсуждения

---

## 1. Что хотим

Заменить слепую "крутилку" (Loader2 + "Генерация...") на живой storytelling-прогресс с 4 реальными шагами и цифрами от сервера. Автопереход на выпуск по завершении.

**Масштаб:** Средний. Затрагивает 1 API route + 1 новый компонент + 3-4 точки интеграции.

---

## 2. Текущее состояние кода

### 2.1 Генерация (backend)

**Файл:** `app/(chat)/api/briefing/generate/route.ts`

Текущий pipeline (линейный, синхронный):
1. Auth + getBriefingSettings + getBriefingTopics (`Promise.all`)
2. getBriefingSources (или defaults)
3. saveBriefingHistory(status: "generating") — создаёт запись в БД
4. `Promise.allSettled` — параллельный fetch всех источников
5. filterContent (Gemini Flash) → candidates
6. generateArticle (Gemini Pro) → article
7. saveBriefingHistory(status: "ready") — сохраняет результат
8. `Response.json({ briefingJson, meta })`

**Оценка:** Pipeline чистый, хорошо структурирован. Обернуть emit-вызовами — тривиально. Никаких рефакторингов pipeline не нужно.

### 2.2 Три точки запуска генерации (frontend)

| # | Компонент | Файл | Текущее поведение | Контекст |
|---|-----------|------|-------------------|----------|
| 1 | SidebarContent `handleGenerate` | `briefing-sidebar.tsx:139-149` | `fetch` → `router.refresh()` | Внутри `BriefingIssueContent` (клиентский) |
| 2 | NoBriefingsYet `handleGenerate` | `briefing-article-view.tsx:163-173` | `fetch` → `router.refresh()` | Отдельный клиентский компонент на `/briefing` |
| 3 | Success card `handleGenerate` | `briefing-setup-client.tsx:224-243` | `fetch` → `router.push('/briefing')` | Страница `/briefing/setup` |

### 2.3 Страница /briefing — Server Component

**Файл:** `app/(dashboard)/briefing/page.tsx`

Это **async Server Component**. Нельзя добавить `useState`. Рендерит:
- `BriefingPage` (лендинг) — если `!settings.isActive`
- `BriefingIssueContent` + `BriefingIssueHeader` — если есть article
- `NoBriefingsYet` — если active, но нет выпуска

**Проблема:** ТЗ предлагает `isGenerating` state на уровне `/briefing` page, но page — Server Component.

---

## 3. Проблемы и рекомендации

### 3.1 КРИТИЧНО: Server Component не может держать state

**Проблема:** `/briefing/page.tsx` — Server Component. ТЗ предлагает `isGenerating` на уровне страницы, но это невозможно без рефакторинга.

**Решение:** Создать клиентскую обёртку `BriefingPageClient`, которая:
- Получает серверные данные как props (article, history, sidebarProps)
- Управляет `isGenerating` state
- При `isGenerating=true` → рендерит `BriefingGenerationProgress` вместо контента
- При `isGenerating=false` → рендерит контент как раньше

Server Component (`page.tsx`) остаётся, но передаёт данные в клиентскую обёртку.

### 3.2 ВАЖНО: `router.push('/briefing')` с той же страницы

**Проблема:** Когда пользователь уже на `/briefing` (sidebar, NoBriefingsYet) и генерация завершается, `router.push('/briefing')` может не вызвать полный re-fetch серверных данных.

**Решение:** Использовать `router.refresh()` вместо `router.push()` когда мы уже на `/briefing`. Сервер вернёт `redirectUrl`, но клиент может решить: если уже на этом URL — делать `refresh()`, иначе — `push()`.

### 3.3 Координация трёх точек запуска

**Проблема:** Три независимых компонента запускают генерацию. Нужна единая точка управления.

**Решение:** Кастомный хук `useBriefingGeneration()`:
- Инкапсулирует `fetch` + streaming reader + parse JSON Lines
- Возвращает `{ steps, isGenerating, error, startGeneration }`
- Используется во всех трёх точках

Для `/briefing` — хук живёт в `BriefingPageClient` и передаётся вниз через props/callback.
Для `/briefing/setup` — хук живёт в `BriefingSetupClient`.

### 3.4 Dashboard card (briefing-card.tsx) — не затрагиваем

ТЗ не упоминает обновление карточки на дашборде. Карточка server-rendered, показывает status из БД. Поскольку мы по-прежнему делаем `saveBriefingHistory(status: "generating")` в начале, карточка на дашборде будет корректно показывать "Генерируется..." (Loader2). Это ОК — пользователь и так уйдёт на progress UI.

### 3.5 Анимации

ТЗ упоминает `motion.div` / CSS для fade-in шагов. В проекте уже есть `framer-motion` (используется в `briefing-setup-client.tsx`). Рекомендую `framer-motion` для fade-in + height-auto анимации шагов.

### 3.6 Типы для streaming events

**Рекомендация:** Вынести `BriefingProgressEvent` тип в `lib/briefing/briefing-types.ts` (client-safe). Используется и на сервере (emit), и на клиенте (parse).

```typescript
export type BriefingProgressStep =
  | 'connecting' | 'fetching' | 'filtering' | 'writing' | 'complete' | 'error';

export interface BriefingProgressEvent {
  step: BriefingProgressStep;
  message: string;
  done?: boolean;
  detail?: string;
  redirectUrl?: string;
}
```

---

## 4. Архитектура (как я вижу реализацию)

```
┌─ /api/briefing/generate (streaming) ─────────────────┐
│  emit({ step: "connecting", message })                │
│  ... settings + sources ...                           │
│  emit({ step: "connecting", done: true, detail })     │
│  emit({ step: "fetching", message })                  │
│  ... Promise.allSettled ...                            │
│  emit({ step: "fetching", done: true, detail })       │
│  ... и т.д. ...                                       │
│  emit({ step: "complete", redirectUrl: "/briefing" }) │
└───────────────────────────────────────────────────────┘
           │ ReadableStream (JSON Lines)
           ▼
┌─ useBriefingGeneration() hook ────────────────────────┐
│  fetch → reader.read() → parse lines → setState       │
│  returns { steps, isGenerating, error, start }        │
└───────────────────────────────────────────────────────┘
           │
     ┌─────┴──────────────┐
     ▼                    ▼
BriefingPageClient   BriefingSetupClient
(isGenerating?       (isSaved + isGenerating?
  Progress : Content)  Progress : SuccessCard)
```

---

## 5. Оценка объёма

| Задача | Файлы | Сложность |
|--------|-------|-----------|
| Streaming route | 1 (generate/route.ts) | Низкая — обёртка вокруг существующего pipeline |
| Тип BriefingProgressEvent | 1 (briefing-types.ts) | Тривиально |
| Хук useBriefingGeneration | 1 (новый) | Средняя — streaming reader + parse |
| Компонент BriefingGenerationProgress | 1 (новый) | Средняя — UI + анимации |
| BriefingPageClient (обёртка) | 1 (новый) | Средняя — рефактор page.tsx |
| Интеграция: page.tsx | 1 (изменение) | Низкая |
| Интеграция: briefing-sidebar.tsx | 1 (изменение) | Низкая |
| Интеграция: briefing-article-view.tsx | 1 (изменение NoBriefingsYet) | Низкая |
| Интеграция: briefing-setup-client.tsx | 1 (изменение success card) | Низкая |

**Итого:** ~5 файлов изменить, ~3 новых файла. Оценка: 1 сессия.

---

## 6. Вопросы к архитектору

### Q1: Полноэкранная замена vs модаль

ТЗ рекомендует вариант (а) — полноэкранная замена. Я согласен. Но уточню:

**При запуске из sidebar** — пользователь видит статью + sidebar. Заменяем ВСЮ страницу (включая header?) или только контент-область (оставляем header с "← Dashboard")?

**Моя рекомендация:** Оставить header, заменить только контент-область под ним. Так пользователь:
- Видит где он (header с заголовком)
- Может вернуться на dashboard через "←"
- Не теряется на пустом экране

### Q2: Прогресс на страницe /briefing/setup

В success card после онбординга — пользователь нажимает "Сгенерировать первый брифинг". ТЗ говорит "вместо карточки показать прогресс".

**Вопрос:** Заменяем только success card (карточку в центре экрана) на прогресс-компонент, или показываем полноэкранный прогресс как на /briefing?

**Моя рекомендация:** Заменить success card на прогресс-компонент, без дополнительной обёртки. На setup нет sidebar/article — карточка уже по центру. Прогресс будет в той же карточке (визуально).

### Q3: Retry на ошибку

ТЗ упоминает "Попробовать снова" при ошибке. Просто повторный вызов `startGeneration()`?

**Моя рекомендация:** Да. Кнопка retry → очистить steps/error → вызвать startGeneration() заново. Без дополнительной логики.

### Q4: Прогресс-бар внизу

ТЗ говорит "(опционально, 4 шага = 25% каждый)". Делаем?

**Моя рекомендация:** Нет. Шаги с иконками + галочками уже дают достаточно визуальной обратной связи. Прогресс-бар добавит шум без пользы. Если хотим — можно добавить позже.

---

## 7. Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Vercel serverless streaming disconnect (90 сек timeout) | Низкая | maxDuration=90 уже стоит. Pipeline обычно укладывается в 30-60 сек |
| Пользователь закрывает вкладку во время генерации | Средняя | Pipeline продолжит работу на сервере. Статус "generating" в БД. При следующем открытии — карточка покажет "Генерируется..." или уже "ready" |
| ReadableStream не поддерживается в старых браузерах | Низкая | Целевая аудитория 40-60+, но Safari/Chrome 2024+ поддерживают. Fallback: показать статичную "Генерация..." если reader недоступен |
| Параллельные генерации (двойной клик) | Средняя | `isGenerating` guard уже есть во всех точках. Backend тоже переживёт — перезапишет history |

---

## 8. Что НЕ трогаем (подтверждаю)

- Pipeline логика (fetch, filter, author) — только emit обёртки
- Сохранение в БД — как было
- UI страницы выпуска (А4) — не трогаем
- Онбординг (А2) — меняем только success card
- Dashboard card — не трогаем
- `/briefing/[date]` route — не трогаем (там нет триггера генерации)
