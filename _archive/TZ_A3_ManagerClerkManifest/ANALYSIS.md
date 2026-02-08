# Анализ ТЗ-A3: Manager + Clerk + Manifest

**Дата анализа:** 2026-02-08

---

## Резюме

Оживить Фазу 1 (Подготовка) проекта: подключить Менеджера в drawer через ServiceChat, создать backend Клерка-анализатора для автоматической классификации файлов, реализовать manifest проекта. Результат: загрузил файлы → они автоматически разложены по папкам с описаниями → Менеджер видит manifest и общается с пользователем.

**Три компонента:**
1. Менеджер в drawer → ServiceChat интеграция (каркас из A1 + config из A1)
2. Клерк-анализатор → новый endpoint + промпт (CLERK_FILE_ANALYZER.md готов)
3. Manifest → миграция БД + логика обновления

---

## Что уже есть в коде (из исследования)

| Компонент | Статус | Детали |
|-----------|--------|--------|
| ManagerDrawer UI | ✅ Каркас | Desktop push 400px + mobile bottom sheet. Контент — заглушка |
| ServiceChat система | ✅ Готова | Core, Drawer, Floating, Types — всё работает |
| project-manager config | ✅ Есть | `configs/project-manager.ts`, model: gemini-flash, shell: drawer |
| ServiceChat API | ✅ Работает | `/api/service-chat` с context routing. Менеджер — inline prompt |
| Загрузка файлов | ✅ Работает | Upload + content extraction (PDF/DOCX/XLSX/TXT) |
| ProjectFile/Folder | ✅ В БД | Таблицы, CRUD, UI (перетаскивание в папки) |
| project-files-card | ✅ Работает | Загрузка, папки, drag & drop, file viewer |
| Промпт Клерка | ✅ Готов | CLERK_FILE_ANALYZER.md — полный, протестирован |
| `lib/prompts/clerks/` | ❌ Нет | Директория не создана |
| `lib/prompts/service-chats/project-manager.md` | ❌ Нет | Промпт Менеджера inline в API |
| Project.manifestJson | ❌ Нет | Нужна миграция |
| `/api/projects/[id]/analyze-file` | ❌ Нет | Нужен новый endpoint |
| Контекст в system prompt | ❌ Нет | passport/manifest/phase не инжектятся |

---

## Вопросы для уточнения

> Ответь на эти вопросы перед началом разработки

### Блокирующие

1. **[Промпт Менеджера]:** Промпт Клерка готов (CLERK_FILE_ANALYZER.md). А промпт Менеджера? ТЗ говорит «.md файл от PE, положить в `lib/prompts/service-chats/project-manager.md`». У тебя есть этот файл, или мне написать рабочий промпт на основе контракта 2.1 из MVP_ROLES_AND_CONTRACTS.md? Там достаточно деталей для первой версии.

2. **[Анализ — trigger]:** ТЗ показывает flow: upload файла → *автоматически* вызывается analyze-file. Два варианта реализации:
   - **A)** Frontend после успешного upload делает второй запрос `POST /analyze-file` (параллельно, fire-and-forget, UI обновляется когда ответ пришёл)
   - **B)** Backend внутри upload endpoint сам вызывает анализ (один запрос от клиента, но upload будет дольше)

   Рекомендую **A** — upload быстрый, файл сразу виден, анализ идёт параллельно, UI показывает спиннер. Подтверждаешь?

### Уточняющие

3. **[Хранение анализа]:** Результаты Клерка для каждого файла — куда сохранять? Два варианта:
   - **A)** В `ProjectFile.metadata` (jsonb, уже есть) — добавить поля `analysis: { description, documentType, relevance, keyTopics, language }`
   - **B)** Только в manifest (Project.manifestJson) — файл-уровневые данные не дублируются

   Рекомендую **A** — metadata уже jsonb, данные анализа рядом с файлом, manifest строится из них. Подтверждаешь?

4. **[История чата Менеджера]:** ServiceChat config имеет `persistMessages: true`. Текущая реализация ServiceChat хранит сообщения в localStorage (ben, project-creation). Для Менеджера проекта нужна серверная персистенция? Или пока localStorage достаточно? Если серверная — нужен Chat в БД привязанный к проекту (как service-chat).

5. **[Фаза documents]:** Сейчас при первом входе в проект page.tsx автоматически переключает `setup → documents`. Кнопка «Начать планирование» переключает `documents → planning`. Это корректно? Или нужна промежуточная логика (например, показывать кнопку только когда есть файлы в manifest)?

6. **[CLERK_SUMMARIZER.md]:** Этот промпт предоставлен, но по ТЗ суммаризатор НЕ входит в A3 (это ТЗ-C2). Подтверди — просто кладу в папку ТЗ для контекста, не реализую?

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Gemini Flash не вернёт валидный JSON | Средняя | Среднее | Парсинг с fallback, retry 1 раз, temperature 0.1 |
| Большие файлы — extractedContent слишком длинный для Клерка | Низкая | Среднее | Обрезать preview до ~2000 символов перед отправкой |
| Параллельная загрузка множества файлов — race condition на manifest | Средняя | Среднее | Последовательное обновление manifest (atomic update) |
| ServiceChat drawer не поддерживает inject контекста | Низкая | Высокое | Расширить API — передавать passport/manifest/phase в запросе |

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-A1 layout + drawer (готово)
- [x] Файловая система ProjectFile + ProjectFolder (готово)
- [x] ServiceChat система (готово)
- [x] Промпт Клерка (CLERK_FILE_ANALYZER.md готов)
- [ ] Промпт Менеджера (ожидает ответа на вопрос 1)

**Затронутые компоненты:**
- `components/projects/manager-drawer.tsx` — заменить заглушку на ServiceChat
- `app/(chat)/api/service-chat/route.ts` — расширить context injection для project-manager
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — новый endpoint
- `lib/db/schema.ts` — миграция: manifestJson в Project
- `lib/prompts/clerks/file-analyzer.md` — новый файл (из CLERK_FILE_ANALYZER.md)
- `lib/prompts/service-chats/project-manager.md` — новый файл (промпт Менеджера)
- `components/projects/project-files-card.tsx` — trigger анализа после upload
- `components/projects/project-pulse.tsx` — отображение описаний файлов (опционально)
- `components/projects/phase-states/welcome-state.tsx` — кнопка «Начать планирование»

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Основная инфраструктура (ServiceChat, файлы, drawer) уже работает. Нужно: 1 миграция, 1 новый endpoint, интеграция drawer с ServiceChat, промпт Менеджера, trigger анализа, manifest логика. Чистая работа без архитектурных рисков.

---

## Ответы на вопросы

1. **[Промпт Менеджера]:** Предоставлен — MANAGER_PROMPT.md. Базовый промпт + 3 режима через conditional injection. ✅
2. **[Trigger анализа]:** **A — Frontend fire-and-forget.** Upload не ждёт AI. Файл виден сразу, анализ параллельно. Если упал — файл без описания, не критично.
3. **[Хранение анализа]:** **A — `ProjectFile.metadata.analysis`.** JSONB уже есть, manifest генерируется агрегацией из metadata.
4. **[История чата Менеджера]:** **Серверная персистенция.** Chat запись при первом открытии drawer, привязка к проекту. Тот же паттерн что Секретарь, но долгоживущий.
5. **[Фаза documents]:** **Кнопка всегда видна, адаптивна.** Есть файлы → «Начать планирование». Нет файлов → «Начать планирование без документов» + подсказка.
6. **[CLERK_SUMMARIZER]:** Подтверждено — НЕ в A3. Для контекста в папке.
