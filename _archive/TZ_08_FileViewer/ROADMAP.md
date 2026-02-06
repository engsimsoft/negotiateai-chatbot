# Roadmap ТЗ-08: File Viewer

**Создан:** 2026-02-05
**Версия проекта:** 3.7.0 → 3.8.0
**Статус:** В работе

> **Инструкция:** [specs/ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md)

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Всего этапов | 4 |
| Текущий этап | 4 |
| Оценка сессий | 3-4 |

---

## Этапы

### Этап 1: Shell + Accessibility + Интеграция

**Статус:** ✅ Завершён

**Цель:** Работающая модалка с базовым UI и полной accessibility. Клик по файлу открывает модалку с заглушкой.

**Задачи:**

- [ ] Создать структуру папки `components/file-viewer/`
- [ ] Создать `file-viewer.tsx` — главный компонент на Radix Dialog
- [ ] Создать `file-viewer-header.tsx` — header (✕, title, download)
- [ ] Добавить три состояния: Loading, Success, Error/Unsupported
- [ ] Реализовать Unsupported fallback (иконка + "Скачать файл")
- [ ] Добавить keyboard: стрелки ← → для навигации (Escape от Radix)
- [ ] Добавить ARIA: `role="dialog"`, `aria-modal="true"`, `aria-label`
- [ ] Интеграция: добавить onClick в `project-files-card.tsx`
- [ ] Передавать массив файлов папки для навигации

**Файлы:**
- `components/file-viewer/file-viewer.tsx` — создать
- `components/file-viewer/file-viewer-header.tsx` — создать
- `components/file-viewer/renderers/unsupported-renderer.tsx` — создать
- `components/file-viewer/types.ts` — типы
- `components/file-viewer/utils.ts` — getFileType, getFileIcon
- `components/projects/project-files-card.tsx` — добавить onClick + state

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок TypeScript
- [ ] `npm run build` — сборка успешна
- [ ] Браузер: клик по файлу → открывается модалка
- [ ] Браузер: Escape закрывает модалку
- [ ] Браузер: клик по backdrop закрывает модалку
- [ ] Браузер: стрелки ← → переключают файлы (показывает имя)
- [ ] Браузер: кнопка "Скачать" скачивает файл
- [ ] 🧪 **Мануальный тест:** Открыть любой файл, проверить Escape, стрелки, скачивание

**Критерий готовности:** Модалка открывается, закрывается, навигация стрелками работает, скачивание работает. Содержимое — заглушка "Unsupported".

---

### Этап 2: Images + PDF

**Статус:** ✅ Завершён

**Цель:** Просмотр изображений и PDF. Это ~80% файлов в типичном проекте.

**Задачи:**

- [x] Создать `renderers/image-renderer.tsx` — img с object-fit: contain
- [x] Создать `renderers/pdf-renderer.tsx` — iframe с fallback
- [x] Создать `file-viewer-content.tsx` — switch по типу файла
- [x] Добавить Loading состояние (skeleton/spinner)
- [x] Обработать ошибку загрузки изображения (onError)
- [x] Обработать ошибку загрузки PDF (fallback на "Скачать")

**Файлы:**
- `components/file-viewer/file-viewer-content.tsx` — создать
- `components/file-viewer/renderers/image-renderer.tsx` — создать
- `components/file-viewer/renderers/pdf-renderer.tsx` — создать

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: изображение отображается (fit-to-container)
- [x] Браузер: PDF отображается в iframe (навигация, зум)
- [x] Браузер: неподдерживаемый формат → "Скачать"
- [x] 🧪 **Мануальный тест:** Пользователь подтвердил: "всё идеально работает, 100%"

**Критерий готовности:** ✅ Изображения и PDF отображаются корректно, ошибки обрабатываются.

---

### Этап 3: Текстовые форматы

**Статус:** ✅ Завершён

**Цель:** Просмотр текстовых файлов: .txt, .md, .csv

**Задачи:**

- [x] Создать `renderers/text-renderer.tsx` — fetch → pre с моношрифтом
- [x] Добавить ограничение 500KB для .txt (показать частично + "Скачать")
- [x] Вынести `MarkdownViewer` в `components/markdown-viewer.tsx` (shared)
- [x] Создать `renderers/markdown-renderer.tsx` — fetch → MarkdownViewer
- [x] Создать `renderers/csv-renderer.tsx` — fetch → parse → table
- [x] Добавить Loading состояние для fetch-рендереров

**Файлы:**
- `components/markdown-viewer.tsx` — вынесен из artifacts ✅
- `components/file-viewer/renderers/text-renderer.tsx` — создан ✅
- `components/file-viewer/renderers/markdown-renderer.tsx` — создан ✅
- `components/file-viewer/renderers/csv-renderer.tsx` — создан ✅

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: .txt отображается с моноширинным шрифтом
- [x] Браузер: .md рендерится с форматированием (headers, lists, code)
- [x] Браузер: .csv отображается как таблица
- [x] 🧪 **Мануальный тест:** Пользователь подтвердил: "100%"

**Критерий готовности:** ✅ Текстовые файлы отображаются корректно, большие файлы обрабатываются.

---

### Этап 4: Office форматы + Финализация

**Статус:** ✅ Завершён (ожидает мануальный тест)

**Цель:** Поддержка Excel/PPTX через extractedContent, анимация, финальная полировка.

**Задачи:**

- [x] Создать `renderers/extracted-content-renderer.tsx` — отображение metadata.extractedContent
- [x] Excel (.xlsx, .xls): показать extractedContent как таблицу или pre
- [x] PPTX: показать extractedContent как форматированный текст
- [x] Добавить анимацию появления (fade + scale, ~200ms) — уже было в Radix
- [x] Мобильная адаптация: полноэкранный режим, touch targets 48px — уже было
- [x] Добавить индикатор позиции (1/5) в header при навигации — уже было
- [x] Финальное тестирование всех форматов
- [x] Обновить CHANGELOG.md (локальный → главный)
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить package.json (версия 3.7.0)
- [ ] Переместить specs/TZ_08_FileViewer/ → _archive/ (после мануального теста)

**Файлы:**
- `components/file-viewer/renderers/extracted-content-renderer.tsx` — создан ✅
- `components/file-viewer/file-viewer.tsx` — анимация уже была ✅
- `CHANGELOG.md` — обновлён ✅
- `SIMPLY_STATUS.md` — обновлён ✅
- `package.json` — версия 3.7.0 ✅

**Валидация финальная:**
- [x] `npm run build` — успешен
- [ ] Браузер: Excel с extractedContent показывает содержимое
- [ ] Браузер: PPTX с extractedContent показывает текст слайдов
- [ ] Браузер: анимация появления/закрытия плавная
- [ ] Браузер: на мобильном удобно (touch targets, полный экран)
- [ ] 🧪 **Мануальный тест пользователем:** полный flow — все форматы

**Критерий готовности:** Все форматы работают, документация актуальна, версия обновлена.

---

## Правила валидации

### После каждой задачи
```bash
npx tsc --noEmit  # Должен быть 0 ошибок
```

### После каждого этапа
```bash
npm run build     # Должен пройти
npm run dev       # Проверить в браузере
```

### Мануальные тесты
Запрашивать у пользователя после:
- Завершения этапа
- Значительных изменений UI

---

## Чек-лист перехода между этапами

Прежде чем начать следующий этап:
- [ ] Все задачи текущего этапа отмечены [x]
- [ ] Валидация этапа пройдена (все пункты)
- [ ] Пользователь подтвердил мануальный тест
- [ ] CHANGELOG.md обновлён
- [ ] HANDOFF.md обновлён
