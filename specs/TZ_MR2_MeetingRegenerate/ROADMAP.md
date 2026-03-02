# Roadmap ТЗ-MR2: Стенограмма — Регенерация + Инструкции + PDF

**Создан:** 2026-03-02
**Версия проекта:** 3.61.0 → 3.62.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 3 |
| Сессий (оценка) | 2-3 |

---

## Этап 1: Фича А — Дополнительные инструкции

**Статус:** ✅ Завершён

**Цель:** Пользователь может добавить контекст встречи перед генерацией документа. Инструкции передаются в Claude и сохраняются в БД.

**Задачи:**

**DB + Backend:**
- [x] Добавить `userInstructions TEXT NULL` в схему `meetingRecord` (`lib/db/schema.ts`)
- [x] Создать Drizzle миграцию (`0045_meeting-user-instructions.sql`)
- [x] Обновить `saveMeetingRecord` в `lib/db/queries.ts` — принимать + сохранять `userInstructions`
- [x] Добавить `userInstructions?: string | null` в `MeetingPipelineInput` (`lib/meeting/meeting-types.ts`)
- [x] Обновить `runMeetingPipeline` в `lib/meeting/meeting-pipeline.ts` — инструкции в user message перед транскриптом
- [x] Обновить `POST /api/meeting/process` (`route.ts`) — принимать `userInstructions`, валидация maxLength 2000
- [x] Обновить `GET /api/meeting/records/[id]` — уже возвращает все поля (select * from meetingRecord), userInstructions подтянется автоматически

**UI:**
- [x] Добавить state `userInstructions` в `meeting-page.tsx`
- [x] Добавить collapsible textarea в `pageState === "ready"` между блоком формата и кнопками (триггер "+ Добавить контекст встречи", expand/collapse, placeholder по ТЗ, maxLength 2000)
- [x] Обновить `use-meeting-processing.ts` — `startProcessing` принимает + передаёт `userInstructions`
- [x] Передать `userInstructions` из state в `processing.startProcessing()` в `handleCreateDocument`

**Файлы:**
- `lib/db/schema.ts` — +column `userInstructions`
- `lib/db/queries.ts` → `saveMeetingRecord` — +param
- `lib/meeting/meeting-types.ts` — +field в `MeetingPipelineInput`
- `lib/meeting/meeting-pipeline.ts` — user message composition
- `app/(chat)/api/meeting/process/route.ts` — +body param + validation
- `app/(chat)/api/meeting/records/[id]/route.ts` — уже возвращает все поля, проверить
- `hooks/use-meeting-processing.ts` — +param в startProcessing
- `components/meeting/meeting-page.tsx` — +textarea state + UI
- `drizzle/` — новая миграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: на /meeting записать или загрузить аудио → на экране "ready" видна ссылка "+ Добавить контекст встречи" → раскрывается textarea → создать документ с инструкциями → результат учитывает контекст
- [ ] Браузер: без инструкций — работает как раньше
- [ ] SQL: `SELECT id, "userInstructions" FROM "MeetingRecord" ORDER BY "createdAt" DESC LIMIT 3` — инструкции сохранены
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-mr2): user instructions for meeting summary"
```

**Критерий готовности:** Инструкции пользователя передаются в Claude, влияют на результат, сохраняются в БД. Без инструкций — поведение идентично текущему.

---

## Этап 2: Фича Б — Повторная генерация

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Статус:** ✅ Завершён

**Цель:** На экране результата кнопка "Создать другой отчёт" открывает модалку с выбором формата и инструкциями. Генерация без повторной транскрипции, новая запись в БД со ссылкой на оригинал (root).

**Задачи:**

**DB + Backend:**
- [x] Добавить `originalRecordId UUID NULL REFERENCES "MeetingRecord"("id") ON DELETE SET NULL` в схему `meetingRecord`
- [x] Создать Drizzle миграцию (`0046_meeting-original-record-id.sql`)
- [x] Обновить `saveMeetingRecord` — принимать `originalRecordId`
- [x] Извлечь `summarizeTranscript(transcript, summaryLevel, userInstructions?)` из `meeting-pipeline.ts` в reusable функцию (используется и в pipeline, и в regenerate)
- [x] Рефакторить `runMeetingPipeline` — использовать `summarizeTranscript()` вместо inline кода
- [x] Создать `POST /api/meeting/regenerate/route.ts` — принимает `recordId`, `summaryLevel`, `userInstructions`; загружает transcript из БД; вызывает `summarizeTranscript`; сохраняет новую запись с `originalRecordId` = root; возвращает новую запись
- [x] Логика определения root: если `originalRecordId` у исходной записи не null — использовать его, иначе — `recordId` самой записи

**UI:**
- [x] Создать `components/meeting/regenerate-modal.tsx` — Dialog (shadcn) с: radio-выбор формата (предвыбран текущий), textarea инструкций (предзаполнена прошлыми), кнопка "Создать", loading state (Loader2 + "Создаём документ...")
- [x] Добавить кнопку "Создать другой отчёт" в `meeting-result.tsx` в секцию Actions
- [x] Обновить `MeetingResultProps` — добавить `userInstructions`, `onRegenerate` callback
- [x] В `meeting-page.tsx` — state для модалки (open/close), handler `handleRegenerate` (fetch POST → обновить resultRecord + добавить в records list), передать props в MeetingResult
- [x] После успешной регенерации — закрыть модалку, показать новый результат, добавить в list

**Файлы:**
- `lib/db/schema.ts` — +column `originalRecordId`
- `lib/db/queries.ts` → `saveMeetingRecord` — +param `originalRecordId`
- `lib/meeting/meeting-pipeline.ts` — extract `summarizeTranscript()` + refactor
- `app/(chat)/api/meeting/regenerate/route.ts` — **новый**
- `components/meeting/regenerate-modal.tsx` — **новый**
- `components/meeting/meeting-result.tsx` — +кнопка + props
- `components/meeting/meeting-page.tsx` — +modal state + handler + props threading
- `drizzle/` — новая миграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: на экране результата видна кнопка "Создать другой отчёт" → модалка с форматом и инструкциями → "Создать" → loading → новый документ отображается → старый не удалён
- [x] Браузер: в списке записей обе версии видны (плоский список)
- [x] Браузер: регенерация от регенерации → `originalRecordId` указывает на root
- [x] SQL: `SELECT id, "originalRecordId", "summaryLevel" FROM "MeetingRecord" ORDER BY "createdAt" DESC LIMIT 5` — связи корректны
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-mr2): meeting regeneration with format/instructions"
```

**Критерий готовности:** Пользователь может создать N документов по одному транскрипту с разными форматами и инструкциями. Каждый — отдельная запись в БД. originalRecordId всегда ссылается на root.

---

## Этап 3: Фича В — Экспорт PDF

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Статус:** ⬜ Не начат

**Цель:** Кнопка "Скачать PDF" на экране результата. Серверная генерация PDF с кириллицей, markdown formatting, футером "Создано в Simply".

**Задачи:**

**Setup:**
- [ ] Установить `pdfmake` (`npm install pdfmake @types/pdfmake`)
- [ ] Подготовить шрифт Source Sans 3 для VFS pdfmake (Regular, Bold, Italic, BoldItalic). Fallback: Noto Sans если Source Sans 3 проблематичен

**Backend:**
- [ ] Создать `lib/meeting/pdf-generator.ts` — конвертер markdown → pdfmake docDefinition:
  - Parse markdown в AST (через `remark` или `marked` — уже есть `remark-gfm` в проекте)
  - Walk AST → pdfmake content nodes (headings, paragraphs, bold/italic, tables, lists, blockquotes, code)
  - Document header: title + дата
  - Footer на каждой странице: "Создано в Simply"
  - Размер: A4
- [ ] Создать `app/(chat)/api/meeting/export-pdf/route.ts` — POST с `recordId`, auth, загрузка из БД, генерация PDF, возврат Response с `Content-Type: application/pdf` и `Content-Disposition: attachment`
- [ ] Утилита транслитерации для имени файла (`{title}.pdf` → `{transliterated_title}.pdf`)

**UI:**
- [ ] Добавить кнопку "📄 Скачать PDF" в `meeting-result.tsx` между "Копировать" и "Создать другой отчёт"
- [ ] Handler: fetch POST → получить blob → trigger download через `URL.createObjectURL` + `<a>` click

**Файлы:**
- `lib/meeting/pdf-generator.ts` — **новый** (markdown → PDF)
- `app/(chat)/api/meeting/export-pdf/route.ts` — **новый**
- `components/meeting/meeting-result.tsx` — +кнопка PDF + download handler
- `package.json` — +pdfmake

**Edge cases:**
- Длинные документы (Детальный формат) — pdfmake handles pagination автоматически
- Таблицы в markdown (GFM) — pdfmake поддерживает таблицы нативно
- Пустой summary — edge case, проверить gracefully

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: на экране результата видна кнопка "Скачать PDF" → скачивается файл → открывается → кириллица корректна → заголовки, таблицы, списки, blockquotes отображаются → футер "Создано в Simply" на каждой странице
- [ ] Проверить PDF для всех трёх форматов (compact, standard, detailed)
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы этапа]
git commit -m "feat(tz-mr2): PDF export with Cyrillic support"
```

**Критерий готовности:** PDF скачивается, корректно отображает markdown с кириллицей, имеет футер "Создано в Simply", имя файла читаемое.

---

## Этап 4: Финализация

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Проверка БД:**
- [ ] SQL: проверить новые колонки `userInstructions`, `originalRecordId` в MeetingRecord
- [ ] SQL: проверить FK constraint и ON DELETE SET NULL

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (Meeting Recorder section — новые файлы)
- [ ] Обновить package.json: 3.61.0 → 3.62.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Да: `docs/decisions/NNN-pdfmake-serverless-pdf.md` (выбор pdfmake вместо puppeteer для serverless PDF)
- [ ] docs/architecture.md нужно обновить? → Да (новый модуль pdf-generator)
- [ ] docs/ai-tools.md нужно обновить? → Нет
- [ ] docs/ai-chats-map.md нужно обновить? → Нет (модели не менялись)
- [ ] docs/ai-agents.md нужно обновить? → Нет
- [ ] docs/design-system.md нужно обновить? → Нет (страница /meeting уже задокументирована)

**Верификация docs vs code (Правило 5):**
- [ ] `CLAUDE.md` → секция Meeting Recorder — все новые файлы перечислены
- [ ] `docs/ai-providers.md` → Реестр — Claude Sonnet для meeting не менялся, просто проверить

**Завершение:**
- [ ] Финальное мануальное тестирование (полный flow: запись → инструкции → создать → регенерация → PDF)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)

**Git (после валидации):**
```bash
git add [файлы документации]
git commit -m "chore(tz-mr2): finalization + docs — v3.62.0"
```
