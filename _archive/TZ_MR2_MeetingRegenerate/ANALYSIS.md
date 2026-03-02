# Анализ ТЗ — Стенограмма: Повторная генерация + Инструкции + Экспорт PDF

## Резюме

Три связанные фичи для инструмента "Стенограмма":
- **А.** Дополнительные инструкции пользователя перед генерацией — collapsible textarea + backend
- **Б.** Повторная генерация по существующему транскрипту — modal + новый API route + DB связка
- **В.** Экспорт в PDF — серверная генерация с Cyrillic + markdown rendering

Все три фичи затрагивают одни и те же файлы (meeting-page, meeting-result, pipeline, schema, queries), поэтому логично реализовывать последовательно А → Б → В.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Фича А: UX** — collapsible textarea между карточками формата и кнопкой "Создать". Ложится идеально в текущий `pageState === "ready"` блок в `meeting-page.tsx:390-457`
- **Фича А: Backend** — инструкции в user message, system prompt без изменений. Правильный подход, так и устроен текущий `meeting-pipeline.ts:107-113`
- **Фича А: DB** — `userInstructions TEXT NULL`. ОК, nullable, backwards-compatible
- **Фича Б: UX** — модальное окно а не переход на страницу. Правильно — пользователь сравнивает результаты
- **Фича Б: Новая запись** — не перезаписываем старую. Правильно — сохраняем историю
- **Фича Б: API** — отдельный route `POST /api/meeting/regenerate`. ОК, логично выделить из основного pipeline
- **Фича В: Серверная генерация** — правильно, клиентский PDF не справится с кириллицей и форматированием

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | Puppeteer как вариант для PDF | **Исключить puppeteer**, использовать `pdfmake` | Puppeteer **не работает на Vercel Serverless** (нет headless Chrome). `pdfmake` — pure JS, serverless-compatible, встроенная поддержка таблиц, custom fonts через VFS. Идеально для markdown → PDF |
| 2 | Регенерация через новый полный pipeline | **Извлечь шаг суммаризации** из `meeting-pipeline.ts` в reusable функцию | Текущий `runMeetingPipeline()` тесно связан: transcribe → summarize → save → cleanup. Для регенерации нужен только summarize → save. Дублировать весь pipeline избыточно — лучше выделить `summarizeTranscript(transcript, level, instructions)` и переиспользовать в обоих flow |
| 3 | `originalRecordId UUID NULL REFERENCES` без ON DELETE | Добавить `ON DELETE SET NULL` | Если пользователь удалит оригинальную запись (что разрешено через `deleteMeetingRecord` в `queries.ts:4444`), дочерние записи с FK упадут с constraint violation. `SET NULL` безопасно разрывает связь |
| 4 | Не указан лимит для `userInstructions` | Рекомендую добавить `maxLength` на textarea и валидацию на backend | Без лимита пользователь может вставить огромный текст. Рекомендую 2000 символов — достаточно для контекста, не раздувает prompt. Валидация и на клиенте (textarea maxLength), и на сервере (route validation) |
| 5 | "Стриминг при регенерации — не делаем" | ОК, но рекомендую **показывать loading state в модалке** | Регенерация = ~15-30 сек (только Claude, без Deepgram). Без индикации пользователь подумает что завис. Простой Loader2 + "Создаём документ..." в модальном окне достаточно |

### ❓ Требует уточнения

1. **Шрифт PDF**: ТЗ говорит "с поддержкой кириллицы". В design-system проекта: Source Sans 3 (sans), Lora (serif), JetBrains Mono (mono). **Использовать Source Sans 3 для PDF** (consistency с приложением) или любой кириллический шрифт (например Noto Sans)?

2. **Удаление оригинала**: Если пользователь удаляет оригинальную запись, а от неё есть регенерации — что показывать? С `ON DELETE SET NULL` дочерние записи останутся, просто `originalRecordId` станет null. Это ок? Или запретить удаление оригинала если есть дочерние?

3. **Регенерация из регенерации**: Если пользователь открыл документ, созданный через "Создать другой отчёт", и нажимает "Создать другой отчёт" снова — что ставить в `originalRecordId`? Всегда оригинал (цепочка к root), или непосредственного родителя?

4. **Количество регенераций**: Есть ли лимит? Без лимита пользователь может создать десятки записей от одного транскрипта. Возможно не проблема для MVP, но стоит озвучить.

---

## Технические детали по каждой фиче

### Фича А: Затронутые файлы

| Файл | Что менять |
|------|-----------|
| `lib/db/schema.ts` | +`userInstructions` TEXT NULL в `meetingRecord` |
| `lib/db/queries.ts` → `saveMeetingRecord` | +`userInstructions` параметр |
| `lib/meeting/meeting-types.ts` | +`userInstructions` в `MeetingPipelineInput` |
| `lib/meeting/meeting-pipeline.ts` | Передать instructions в user message перед transcript |
| `app/(chat)/api/meeting/process/route.ts` | +`userInstructions` в body parsing |
| `hooks/use-meeting-processing.ts` | +`userInstructions` в `startProcessing` params |
| `components/meeting/meeting-page.tsx` | +collapsible textarea state + передача в processing |
| Drizzle migration | ALTER TABLE + nullable column |

### Фича Б: Затронутые файлы

| Файл | Что менять |
|------|-----------|
| `lib/db/schema.ts` | +`originalRecordId` UUID NULL FK в `meetingRecord` |
| `lib/db/queries.ts` | +`saveMeetingRecord` с `originalRecordId` |
| `lib/meeting/meeting-pipeline.ts` | Извлечь `summarizeTranscript()` в reusable функцию |
| `app/(chat)/api/meeting/regenerate/route.ts` | **Новый** — POST endpoint |
| `components/meeting/meeting-result.tsx` | +кнопка "Создать другой отчёт" |
| `components/meeting/meeting-page.tsx` | +modal state, +regeneration handler, +обновление records list |
| Компонент модального окна | **Новый** — RegenerateModal (Dialog с формой) |
| Drizzle migration | ALTER TABLE + nullable FK column |

### Фича В: Затронутые файлы

| Файл | Что менять |
|------|-----------|
| `app/(chat)/api/meeting/export-pdf/route.ts` | **Новый** — POST endpoint |
| `lib/meeting/pdf-generator.ts` | **Новый** — markdown → pdfmake docDefinition → PDF buffer |
| `components/meeting/meeting-result.tsx` | +кнопка "Скачать PDF" |
| `package.json` | +`pdfmake` dependency |
| Font files (VFS) | Встроенный Cyrillic шрифт для pdfmake |

---

## Потенциальные риски

1. **pdfmake bundle size** — pdfmake + шрифты могут добавить ~2-5 МБ к серверному бандлу. Для serverless function это ок (лимит Vercel 250 МБ), но стоит мониторить
2. **Markdown → pdfmake conversion** — нет готовой библиотеки "markdown to pdfmake". Нужно написать конвертер (parse markdown AST → pdfmake document definition). Основные элементы: headers, bold/italic, tables, lists, blockquotes, code blocks
3. **Таблицы в PDF** — meeting summaries могут содержать таблицы (GFM). pdfmake поддерживает таблицы нативно, но конвертер должен корректно обрабатывать их
4. **Self-referencing FK в Drizzle** — `meetingRecord.originalRecordId → meetingRecord.id` — Drizzle поддерживает через callback pattern в `references(() => meetingRecord.id)`, но нужно протестировать миграцию

---

## Зависимости

- **Фича А** не зависит от Б и В — можно реализовать первой
- **Фича Б** использует `userInstructions` из Фичи А (предзаполнение прошлых инструкций) — реализовать после А
- **Фича В** не зависит от А и Б технически, но кнопка на экране результата рядом с кнопкой из Б — реализовать после Б для цельного UI

**Порядок:** А → Б → В

---

## Оценка сложности

- [x] Среднее (2-3 сессии)
  - А: 1 этап (collapsible textarea + backend + migration)
  - Б: 1-2 этапа (modal + API + pipeline extraction + migration)
  - В: 1-2 этапа (pdfmake setup + markdown converter + API + UI)
  - Финализация: 1 этап
