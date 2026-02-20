# ТЗ-А5: Прогресс генерации брифинга

**Цель:** Заменить "крутилку" на живой storytelling-прогресс с реальными шагами и цифрами от сервера. Автопереход на выпуск по завершении.

**Версия:** 3.32.0 → 3.33.0

---

## Суть

Сейчас при генерации пользователь видит кнопку с `<Loader2 />` и текст "Генерация...". Ждёт 30-60 секунд вслепую. Это плохой UX — особенно для аудитории 40-60+, которая может подумать что приложение зависло.

После этого ТЗ пользователь видит живой прогресс:

```
☀️ Готовим ваш брифинг

📡 Подключаемся к источникам...        ✓ 18 источников
📥 Собираем новости...                  ✓ 196 статей
🔍 Фильтруем и отбираем лучшее...      ✓ 28 прошли отбор
✍️ Пишем статью...                      ✓ 5 тем, 14 новостей
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

→ [Переход на выпуск]
```

---

## Архитектура

### Streaming endpoint

Конвертировать `POST /api/briefing/generate` из обычного Response.json() в **streaming response**. Endpoint эмитит JSON-события прогресса по мере прохождения шагов.

**Формат событий (JSON Lines, разделитель `\n`):**

```json
{"step":"connecting","message":"Подключаемся к источникам..."}
{"step":"connecting","message":"Подключаемся к источникам...","done":true,"detail":"18 источников"}
{"step":"fetching","message":"Собираем новости..."}
{"step":"fetching","message":"Собираем новости...","done":true,"detail":"196 статей"}
{"step":"filtering","message":"Фильтруем и отбираем лучшее..."}
{"step":"filtering","message":"Фильтруем и отбираем лучшее...","done":true,"detail":"28 прошли отбор"}
{"step":"writing","message":"Пишем статью..."}
{"step":"writing","message":"Пишем статью...","done":true,"detail":"5 тем, 14 новостей"}
{"step":"complete","message":"Готово!","redirectUrl":"/briefing"}
```

**Ошибка:**
```json
{"step":"error","message":"Не удалось собрать новости. Попробуйте позже."}
```

**Реализация в route.ts:**

```typescript
return new Response(
  new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        emit({ step: "connecting", message: "Подключаемся к источникам..." });
        // ... fetch sources ...
        emit({ step: "connecting", message: "Подключаемся к источникам...", done: true, detail: `${sourcesToFetch.length} источников` });

        emit({ step: "fetching", message: "Собираем новости..." });
        // ... fetch all ...
        emit({ step: "fetching", message: "Собираем новости...", done: true, detail: `${allItems.length} статей` });

        // ... и т.д.

        emit({ step: "complete", message: "Готово!", redirectUrl: "/briefing" });
      } catch (err) {
        emit({ step: "error", message: "Не удалось сгенерировать брифинг." });
      } finally {
        controller.close();
      }
    }
  }),
  { headers: { "Content-Type": "application/x-ndjson", "Transfer-Encoding": "chunked" } }
);
```

Вся текущая логика (fetch → filter → author → save) остаётся, добавляются только emit-вызовы между шагами.

### UI-компонент

`BriefingGenerationProgress` — Client Component. Полноэкранный (или модальный) компонент, отображает шаги прогресса.

**Поведение:**
- Вызывается при нажатии "Сгенерировать" (из sidebar, из success card онбординга, из empty state)
- Делает `fetch('/api/briefing/generate', { method: 'POST' })` и читает body как stream
- Парсит JSON Lines, обновляет список шагов
- Каждый шаг: иконка + текст + (spinner | ✓ detail)
- При `step: "complete"` — задержка 1 сек → `router.push(redirectUrl)`
- При `step: "error"` — показать ошибку + кнопка "Попробовать снова"

**Визуал:**
- Центрирован на странице, карточка
- Заголовок "☀️ Готовим ваш брифинг"
- Шаги появляются последовательно (анимация fade-in)
- Текущий шаг — spinner, завершённый — галочка + detail серым текстом
- Прогресс-бар внизу (опционально, 4 шага = 25% каждый)

---

## Что сделать

### 1. Конвертация route.ts в streaming

Текущий `POST /api/briefing/generate` возвращает `Response.json()`. Переделать на `ReadableStream` с JSON Lines.

Логика пайплайна НЕ меняется. Только оборачиваем каждый этап в emit-вызовы:

| Этап | step | detail (при done) |
|------|------|-------------------|
| Загрузка настроек + определение источников | `connecting` | "{N} источников" |
| Параллельный fetch всех источников | `fetching` | "{N} статей" |
| Фильтрация (Gemini Flash) | `filtering` | "{N} прошли отбор" |
| Генерация статьи (Gemini Pro) | `writing` | "{topicsCount} тем, {totalNews} новостей" |
| Сохранение + финал | `complete` | redirectUrl |

**maxDuration** остаётся 90.

### 2. Компонент `BriefingGenerationProgress`

`components/briefing/briefing-generation-progress.tsx` — Client Component.

Принимает `onComplete?: () => void` и `onError?: (msg: string) => void`.

Внутри:
- `useState` для массива шагов `{ step, message, done?, detail? }[]`
- `fetch` + `ReadableStream` reader для парсинга JSON Lines
- Рендер: карточка с заголовком и списком шагов
- Каждый шаг: иконка (emoji), текст, справа spinner или "✓ detail"
- Анимация появления шагов (motion.div / CSS)

**Иконки шагов:**
- connecting → 📡
- fetching → 📥
- filtering → 🔍
- writing → ✍️
- complete → ✅
- error → ❌

### 3. Интеграция в UI

Генерация вызывается из трёх мест:

1. **Sidebar** (`briefing-sidebar.tsx`) — кнопка "Сгенерировать"
2. **Success card** (`briefing-setup-client.tsx`) — кнопка после онбординга
3. **Empty state** (если нет выпусков)

Все три места переключают UI на `BriefingGenerationProgress`. Варианты:
- **(а) Полноэкранная замена** — при генерации показать только прогресс, скрыть sidebar/article
- **(б) Оверлей/модаль** — прогресс поверх текущей страницы

Рекомендую **(а)** — полноэкранная замена. Чище, нет проблем с z-index. Пользователь не отвлекается. По завершении — redirect на выпуск.

Для sidebar и empty state — состояние `isGenerating` на уровне страницы `/briefing`. Когда true → рендерить `BriefingGenerationProgress` вместо основного контента.

Для success card онбординга — аналогично, вместо карточки показать прогресс.

### 4. Парсинг JSON Lines на клиенте

```typescript
const response = await fetch('/api/briefing/generate', { method: 'POST' });
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  
  for (const line of lines) {
    if (line.trim()) {
      const event = JSON.parse(line);
      // обновить состояние шагов
    }
  }
}
```

---

## Что НЕ трогать

- Логику пайплайна (fetch, filter, author) — только оборачиваем в emit
- Сохранение в БД — как было
- UI страницы выпуска (А4) — не трогаем
- Онбординг (А2) — меняем только success card (подключаем прогресс)

---

## Ожидаемый результат

- Генерация показывает 4 реальных шага с цифрами от сервера
- Пользователь видит что происходит, не думает что зависло
- Автопереход на выпуск по завершении
- Ошибки показываются понятно с возможностью повторить
- Фаза А полностью закрыта

---

## Ключевые файлы

| Файл | Действие |
|------|----------|
| `app/(chat)/api/briefing/generate/route.ts` | **ИЗМЕНИТЬ** — streaming response + emit |
| `components/briefing/briefing-generation-progress.tsx` | **НОВЫЙ** — UI прогресса |
| `components/briefing/briefing-sidebar.tsx` | **ИЗМЕНИТЬ** — переключение на прогресс |
| `app/(dashboard)/briefing/page.tsx` | **ИЗМЕНИТЬ** — состояние isGenerating |
| `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` | **ИЗМЕНИТЬ** — прогресс вместо Loader2 в success card |
