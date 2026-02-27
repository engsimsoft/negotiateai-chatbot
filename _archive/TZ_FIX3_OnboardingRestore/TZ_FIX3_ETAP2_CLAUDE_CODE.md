# ТЗ-FIX3 Этап 2: Guardian bypass + temperature + Save button + промпт v11

**Контекст:** Этап 1 выполнен (unified tools, maxSteps=30). AI корректно вызывает инструменты. Осталось три архитектурных фикса + промпт + UX-изменение.

---

## 1. Temperature 0.5 для briefing-onboarding

**Файл:** `app/(chat)/api/service-chat/route.ts`

Briefing onboarding — структурированный flow. Temperature 1.0 даёт лишнюю вариативность. Снизить до 0.5.

---

## 2. Guardian bypass для briefing-onboarding

**Файл:** `app/(chat)/api/service-chat/route.ts` (instrumentedStream)

Для context === "briefing-onboarding" Guardian должен только логировать, без буферизации и блокировки текста. Briefing-onboarding использует 30-шаговый flow где AI законно пересказывает результаты предыдущих шагов — Guardian это ломает (ложные срабатывания, 233 chunks suppressed).

Guardian для остальных контекстов (chat, project tasks) — без изменений.

---

## 3. Кнопка «Сохранить» в header + убрать saveBriefingProfile tool

Сохранение брифинга переносится из AI-инструмента в UI-кнопку. Пользователь контролирует момент сохранения, не AI.

### Кнопка

Расположение: header `/briefing/setup`, справа (рядом со стрелкой «назад» слева). Текст: "Сохранить" (create) / "Сохранить изменения" (edit).

Состояния:
- **Disabled** — превью пустое (нет тем и источников)
- **Active** — в превью есть ≥1 тема и ≥1 источник
- **Loading** — идёт сохранение
- **Success** — редирект на `/briefing`

Логика сохранения: та же что была в saveBriefingProfile tool (settings + topics + sources в БД). Данные берутся из текущего состояния превью (previewData).

### Убрать saveBriefingProfile tool

Из route.ts убрать регистрацию saveBriefingProfile для briefing-onboarding. Код самого сохранения (запись в БД) переиспользовать в новом API endpoint или вызывать напрямую из server action.

### Unsaved changes guard

При нажатии стрелки «назад» (← в header) — если превью не пустое и не сохранено:

Модальное окно:
- Заголовок: "Выйти без сохранения?"
- Текст create: "Настройки брифинга не сохранены. При выходе все изменения будут потеряны."
- Текст edit: "Изменения не сохранены. Всё вернётся к прежним настройкам."
- Кнопки: [Остаться] (primary) / [Выйти] (secondary, деструктивная)

---

## 4. Промпт v11

Владимир предоставит обновлённый промпт `lib/prompts/service-chats/briefing-onboarding.md` подготовленный в PE проекте. Подложить файл. Ключевые отличия от v10:
- Убран startResearch — единый набор инструментов для обоих режимов
- Убран saveBriefingProfile — AI направляет к кнопке «Сохранить»
- Правило: после research → сначала updateBriefingPreview, потом текст
- Последовательная работа: один инструмент за шаг, одна тема за раз

---

## Не трогать

- `research-engine.ts`, `perplexity-client.ts` — нужны для TG4
- `ResearchProgressCard` компонент — оставить
- Guardian для chat и project tasks — без изменений
- Edit mode flow — без изменений (кроме общих: кнопка Save, убрать saveBriefingProfile)
