# Дорожная карта: ТЗ-6 — Excel Tool

## Цель

Создать инструмент для работы с Excel-файлами, который позволяет пользователям создавать, просматривать, редактировать и скачивать профессиональные таблицы через диалог с AI-агентами.

**Философия:** iPhone-уровень качества. Пользователь говорит "сделай бюджет" — получает профессионально оформленный файл.

**Детали:** См. [TZ_EXCEL_TOOL.md](TZ_EXCEL_TOOL.md)

## Текущий статус

- **Этап:** ТЗ-6 (Excel Tool) — 🔄 В РАБОТЕ
- **Прогресс:** 0/65 задач (0%)
- **Предыдущий:** ТЗ-5 — Markdown артефакты (завершён)

---

## Этапы реализации

### 6.0 Пререквизиты — Валидация текущего состояния

**Цель:** Убедиться, что проект работает перед началом разработки.

- [ ] Production build успешен (`npm run build`)
- [ ] Приложение запускается локально (`npm run dev`)
- [ ] Текущие артефакты работают (text, markdown, presentations)
- [ ] Загрузка файлов работает (pdf, docx, images)

---

### 6.1 Установка зависимостей (4 задачи)

**Цель:** Установить необходимые библиотеки для работы с Excel.

- [ ] Установить `exceljs` для генерации .xlsx файлов
- [ ] Установить `xlsx` для парсинга загруженных файлов
- [ ] Установить `react-datasheet-grid` для рендеринга таблиц в артефакте
- [ ] Проверить что `recharts` установлен (для графиков)

**Команды:**
```bash
npm install exceljs xlsx react-datasheet-grid
```

---

### 6.2 Загрузка Excel файлов (5 задач)

**Цель:** Добавить поддержку загрузки .xlsx и .xls файлов для анализа.

- [ ] Добавить MIME types в Zod schema: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`
- [ ] Добавить парсинг xlsx через библиотеку xlsx → конвертация в text/CSV
- [ ] Обновить accept атрибут в multimodal-input.tsx
- [ ] Добавить иконку 📊 для Excel файлов в preview-attachment.tsx
- [ ] Протестировать загрузку и чтение xlsx файла

**Файлы:**
- `app/(chat)/api/files/upload/route.ts` — валидация и парсинг
- `components/multimodal-input.tsx` — accept attribute
- `components/preview-attachment.tsx` — иконка

---

### 6.3 Excel Tools — Типы и утилиты (4 задачи)

**Цель:** Создать базовую инфраструктуру для Excel tools.

- [ ] Создать `lib/ai/tools/excel/types.ts` — TypeScript типы (Sheet, Column, Cell, Chart, Style)
- [ ] Создать `lib/ai/tools/excel/styles.ts` — 5 цветовых схем (Corporate Blue, Forest Green, Warm Orange, Professional Gray, Modern Teal)
- [ ] Создать `lib/ai/tools/excel/utils.ts` — утилиты форматирования (валюта ₽, даты ДД.ММ.ГГГГ, числа с пробелами)
- [ ] Создать `lib/ai/tools/excel/index.ts` — экспорт всех модулей

**Файлы:**
- `lib/ai/tools/excel/types.ts`
- `lib/ai/tools/excel/styles.ts`
- `lib/ai/tools/excel/utils.ts`
- `lib/ai/tools/excel/index.ts`

---

### 6.4 Excel Tools — createExcel (5 задач)

**Цель:** Инструмент создания новых Excel файлов.

- [ ] Создать `lib/ai/tools/excel/create-excel.ts`
- [ ] Реализовать создание workbook с несколькими sheets
- [ ] Реализовать поддержку формул (SUM, AVERAGE, IF, VLOOKUP и др.)
- [ ] Реализовать поддержку графиков (column, bar, line, pie)
- [ ] Реализовать профессиональное форматирование (заголовки, чередование строк, итоговые строки)

**API:**
```typescript
createExcel({
  filename: string,
  sheets: [{
    name: string,
    columns: [{ header, key, width?, type? }],
    data: Array<Record<string, any>>,
    formulas?: [{ cell, formula }],
    charts?: [{ type, title, dataRange, position }],
    styles?: { theme?, freezeHeader?, alternateRows? }
  }]
})
```

---

### 6.5 Excel Tools — parseExcel (3 задачи)

**Цель:** Инструмент анализа загруженных Excel файлов.

- [ ] Создать `lib/ai/tools/excel/parse-excel.ts`
- [ ] Реализовать чтение структуры (sheets, columns, row count)
- [ ] Реализовать preview данных (первые 10 строк) и summary

**API:**
```typescript
parseExcel({ fileUrl: string })
// Returns: { filename, sheets: [{ name, columns, preview, formulas, summary }] }
```

---

### 6.6 Excel Tools — editExcel (4 задачи)

**Цель:** Инструмент редактирования существующих Excel файлов.

- [ ] Создать `lib/ai/tools/excel/edit-excel.ts`
- [ ] Реализовать операции: addColumn, addRow, updateCell, addFormula
- [ ] Реализовать операции: addChart, deleteColumn, deleteRow
- [ ] Реализовать автоматический пересчёт формул

**API:**
```typescript
editExcel({
  fileUrl: string,
  operations: [{ type, sheet?, ...params }]
})
```

---

### 6.7 Шаблоны Excel (10 задач)

**Цель:** Создать 10 профессиональных шаблонов.

- [ ] `templates/budget-family.ts` — Семейный бюджет (Категории, План, Факт, Разница)
- [ ] `templates/budget-project.ts` — Бюджет проекта (Статьи, Бюджет, Потрачено, Остаток)
- [ ] `templates/income-expense-ip.ts` — Учёт ИП (Дата, Тип, Сумма, Категория, Итоги)
- [ ] `templates/content-plan.ts` — Контент-план (Дата, Площадка, Тема, Статус, Ответственный)
- [ ] `templates/media-plan.ts` — Медиаплан (Канал, Бюджет, Охват, CPM, ROI)
- [ ] `templates/invoice.ts` — Счёт/Инвойс (Товар, Кол-во, Цена, Сумма, Итого+НДС)
- [ ] `templates/clients.ts` — Учёт клиентов (Имя, Контакт, Статус, Сумма сделки, Дата)
- [ ] `templates/vacation.ts` — График отпусков (Сотрудник, Янв-Дек, Всего дней)
- [ ] `templates/comparison.ts` — Сравнительная таблица (Параметр, Вариант А/Б/В)
- [ ] `templates/task-tracker.ts` — Трекер задач (Задача, Статус, Приоритет, Дедлайн)

**Файлы:**
- `lib/ai/tools/excel/templates/*.ts`

---

### 6.8 Артефакт Excel — Database и Server (5 задач)

**Цель:** Добавить тип "excel" в систему артефактов.

- [ ] Добавить "excel" в enum kind в `lib/db/schema.ts`
- [ ] Добавить `excelDelta` и `excelComplete` в CustomUIDataTypes (`lib/types.ts`)
- [ ] Создать `artifacts/excel/server.ts` — handler для генерации
- [ ] Зарегистрировать handler в `lib/artifacts/server.ts`
- [ ] Протестировать создание документа типа excel

**Файлы:**
- `lib/db/schema.ts` — enum
- `lib/types.ts` — CustomUIDataTypes
- `artifacts/excel/server.ts` — handler
- `lib/artifacts/server.ts` — регистрация

---

### 6.9 Артефакт Excel — UI компоненты (6 задач)

**Цель:** Создать UI для отображения Excel в холсте.

- [ ] Создать `components/excel-tabs.tsx` — табы листов
- [ ] Создать `components/excel-table.tsx` — рендеринг таблицы (react-datasheet-grid)
- [ ] Создать `components/excel-chart.tsx` — рендеринг графиков (recharts)
- [ ] Создать `artifacts/excel/client.tsx` — основной компонент артефакта
- [ ] Добавить actions: Copy, Download XLSX, Download PDF (без Share)
- [ ] Зарегистрировать в `components/artifact.tsx`

**Файлы:**
- `components/excel-tabs.tsx`
- `components/excel-table.tsx`
- `components/excel-chart.tsx`
- `artifacts/excel/client.tsx`
- `components/artifact.tsx`

---

### 6.10 PDF экспорт (3 задачи)

**Цель:** Экспорт Excel артефакта в PDF.

- [ ] Реализовать рендеринг таблицы в HTML
- [ ] Использовать html2pdf.js (уже в проекте для markdown) для конвертации
- [ ] Добавить кнопку "Download PDF" в артефакт

**Файлы:**
- `artifacts/excel/client.tsx`
- `lib/ai/tools/excel/export-pdf.ts` (опционально)

---

### 6.11 Интеграция с Chat Route (4 задачи)

**Цель:** Подключить Excel tools к chat API.

- [ ] Импортировать createExcel, parseExcel, editExcel в chat route
- [ ] Добавить в experimental_activeTools
- [ ] Добавить в tools object (factory pattern с session, dataStream)
- [ ] Протестировать вызов через чат

**Файлы:**
- `app/(chat)/api/chat/route.ts`

---

### 6.12 Интеграция с агентами (4 задачи)

**Цель:** Настроить агентов для работы с Excel.

- [ ] Обновить system prompt Помощника — добавить знание о Excel Tool и шаблонах
- [ ] Обновить system prompt Маркетолога — медиапланы, контент-планы, ROI
- [ ] Обновить system prompt Копирайтера — контент-планы, редакционные календари
- [ ] Обновить system prompt Универсального — все возможности Excel

**Файлы:**
- `lib/db/seed-agents.ts`

---

### 6.13 Тестирование (8 задач)

**Цель:** Полное тестирование функционала.

#### Автоматическое:
- [ ] `npm run build` — production build успешен
- [ ] `npm run lint` — без ошибок (если есть)

#### Мануальное — Создание:
- [ ] "Сделай таблицу расходов: продукты 15000, транспорт 5000, связь 2000" → таблица с итогами и процентами
- [ ] "Создай бюджет на январь по шаблону" → шаблон семейного бюджета
- [ ] "Сделай счёт для клиента: 3 товара, НДС 20%" → инвойс с формулами

#### Мануальное — Анализ:
- [ ] Загрузить xlsx → "Какой итог за март?" → ответ с числом
- [ ] "Объясни структуру этого файла" → описание листов, колонок, формул

#### Мануальное — Редактирование (итерации):
- [ ] После создания: "Добавь колонку с НДС" → обновлённый артефакт
- [ ] "Добавь круговой график" → артефакт с диаграммой
- [ ] "Поменяй цвета на зелёные" → обновлённый стиль

#### Мануальное — Экспорт:
- [ ] Скачать .xlsx → файл открывается в Excel, формулы работают
- [ ] Скачать .pdf → корректный PDF

---

### 6.14 Документация и финализация (8 задач)

**Цель:** Обновить документацию и завершить этап.

- [ ] Обновить `docs/ai-artifacts.md` — добавить тип excel
- [ ] Обновить `docs/ai-tools.md` — добавить createExcel, parseExcel, editExcel
- [ ] Обновить `CLAUDE.md` — версия 2.9.0, Excel Tool
- [ ] Обновить `SIMPLY_STATUS.md` — текущее состояние
- [ ] Обновить `CHANGELOG.md` — v2.9.0
- [ ] Переместить `TZ_EXCEL_TOOL.md` в `_archive/TZ_06_EXCEL_TOOL.md`
- [ ] Переместить `TZ_06_ROADMAP.md` в `_archive/TZ_06_ROADMAP.md`
- [ ] Коммит: "feat: Excel Tool — ТЗ-6 complete"

---

## Ключевые файлы

### Новые файлы:

```
lib/ai/tools/excel/
├── index.ts              — экспорт инструментов
├── types.ts              — TypeScript типы
├── styles.ts             — цветовые схемы
├── utils.ts              — утилиты форматирования
├── create-excel.ts       — создание файлов
├── parse-excel.ts        — анализ файлов
├── edit-excel.ts         — редактирование
└── templates/
    ├── budget-family.ts
    ├── budget-project.ts
    ├── income-expense-ip.ts
    ├── content-plan.ts
    ├── media-plan.ts
    ├── invoice.ts
    ├── clients.ts
    ├── vacation.ts
    ├── comparison.ts
    └── task-tracker.ts

artifacts/excel/
├── server.ts             — server handler
└── client.tsx            — UI компонент

components/
├── excel-tabs.tsx        — табы листов
├── excel-table.tsx       — рендеринг таблицы
└── excel-chart.tsx       — рендеринг графиков
```

### Модифицируемые файлы:

| Файл | Изменение |
|------|-----------|
| `lib/db/schema.ts` | Добавить "excel" в enum kind |
| `lib/types.ts` | Добавить excelDelta, excelComplete |
| `lib/artifacts/server.ts` | Зарегистрировать excelDocumentHandler |
| `components/artifact.tsx` | Импорт и регистрация excelArtifact |
| `app/(chat)/api/chat/route.ts` | Импорт и регистрация Excel tools |
| `app/(chat)/api/files/upload/route.ts` | Поддержка xlsx/xls |
| `components/multimodal-input.tsx` | accept=".xlsx,.xls" |
| `components/preview-attachment.tsx` | Иконка 📊 |
| `lib/db/seed-agents.ts` | System prompts для агентов |

---

## Критерии готовности (Definition of Done)

### Создание файлов
- [ ] Создание таблицы по описанию работает
- [ ] Формулы создаются и работают
- [ ] Графики создаются (column, bar, line, pie)
- [ ] Профессиональное форматирование применяется
- [ ] Русская локализация (₽, ДД.ММ.ГГГГ, пробелы в числах)

### Артефакт
- [ ] Таблица отображается корректно
- [ ] Графики рендерятся
- [ ] Табы листов переключаются
- [ ] Кнопки Download XLSX, Download PDF работают

### Анализ
- [ ] Загрузка xlsx файлов работает
- [ ] AI понимает структуру файла
- [ ] AI отвечает на вопросы по данным

### Редактирование
- [ ] Диалоговые итерации работают
- [ ] Артефакт обновляется при изменениях
- [ ] Формулы пересчитываются

### Шаблоны
- [ ] 10 шаблонов доступны
- [ ] AI использует шаблоны при соответствующих запросах

### Интеграция
- [ ] Помощник работает с Excel
- [ ] Маркетолог работает с Excel
- [ ] Копирайтер работает с Excel
- [ ] Универсальный работает с Excel

### Общее
- [ ] Production build успешен
- [ ] Документация обновлена
- [ ] ТЗ в архиве

---

## Связанные документы

- [TZ_EXCEL_TOOL.md](TZ_EXCEL_TOOL.md) — полное техническое задание
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — документация по артефактам
- [docs/ai-tools.md](docs/ai-tools.md) — документация по инструментам
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние проекта
- [SIMPLY_ROADMAP.md](SIMPLY_ROADMAP.md) — общая дорожная карта

---

**Создано:** 2026-01-29
**Статус:** К разработке
**Источник:** TZ_EXCEL_TOOL.md
