# Roadmap ТЗ-FIX3: Восстановление инструментов create mode

**Создан:** 2026-02-27
**Версия проекта:** 3.52.0 → 3.53.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 3 (завершён) |
| Сессий (оценка) | 1 |

---

## Этап 1: route.ts — единый набор инструментов

**Статус:** ✅ Завершён

**Цель:** Убрать разделение tools по режимам. Create и edit получают одинаковые 5 инструментов. maxSteps=30 для обоих.

**Задачи:**
- [x] Удалить `if (isCreateMode)` блок с startResearch tool
- [x] Убрать `if (!isCreateMode)` обёртку — deepResearch/fetchUrl/readTelegramChannel доступны безусловно
- [x] Удалить объявление `progressRef`
- [x] Удалить присвоение `progressRef.write` внутри createUIMessageStream
- [x] Удалить неиспользуемые импорты (`researchTopics`, `ResearchProgressEvent`)
- [x] Изменить maxSteps: `const maxSteps = context === "briefing-onboarding" ? 30 : 3;`
- [x] Обновить комментарий в saveBriefingProfile — убрать ссылку на startResearch

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — единственный файл

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: /briefing/setup — чат открывается, приветствие отображается
- [x] 🧪 Мануальный тест: create mode — AI использует deepResearch/fetchUrl (видно в DEV-бейдже), НЕ startResearch

**Git (после валидации):**
```bash
git add app/(chat)/api/service-chat/route.ts
git commit -m "fix(tz-fix3): restore unified tools for create mode"
```

**Критерий готовности:** Create mode имеет те же 5 инструментов что и edit mode, maxSteps=30.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Guardian bypass + temperature + Save button + промпт v11

**Статус:** ✅ Завершён
**Источник:** [TZ_FIX3_ETAP2_CLAUDE_CODE.md](TZ_FIX3_ETAP2_CLAUDE_CODE.md)

**Цель:** Убрать Guardian-блокировки для briefing-onboarding, перенести сохранение в UI-кнопку, обновить промпт.

### 2.1 Temperature 0.5

- [x] Изменить temperature для briefing-onboarding на 0.5 в route.ts
- [x] Добавить комментарий: при adaptive thinking temperature игнорируется

**Файл:** `app/(chat)/api/service-chat/route.ts` (строка temperature)

### 2.2 Guardian bypass для briefing-onboarding

- [x] Для `context === "briefing-onboarding"` — пропускать буферизацию в instrumentedStream
- [x] Guardian log-only: текст идёт напрямую к клиенту, Guardian только console.warn
- [x] Для остальных контекстов (chat, project tasks) — без изменений

**Файл:** `app/(chat)/api/service-chat/route.ts` (instrumentedStream)

### 2.3 Save API endpoint

- [x] Создать `lib/briefing/save-briefing-profile.ts` — выделить логику сохранения (settings + topics + sources в БД)
- [x] Создать `app/(chat)/api/briefing/save-profile/route.ts` — POST endpoint, вызывает save logic
- [x] Принимает JSON: `{ topics, sources, settings }`, возвращает `{ success, topicsCount, sourcesCount }`

**Файлы:**
- `lib/briefing/save-briefing-profile.ts` — новый
- `app/(chat)/api/briefing/save-profile/route.ts` — новый

### 2.4 Убрать saveBriefingProfile tool

- [x] Удалить регистрацию `tools.saveBriefingProfile` в route.ts
- [x] Удалить неиспользуемые импорты если останутся

**Файл:** `app/(chat)/api/service-chat/route.ts`

### 2.5 Кнопка «Сохранить» + unsaved guard

- [x] Кнопка в header `/briefing/setup`, справа (перед UserMenu)
- [x] Текст: "Сохранить" (create) / "Сохранить изменения" (edit)
- [x] Состояния: disabled (превью пустое) → active (≥1 тема + ≥1 источник) → loading → redirect `/briefing`
- [x] Логика: POST `/api/briefing/save-profile` с данными из `preview` state
- [x] Unsaved changes guard: AlertDialog при нажатии ← если превью не пустое и не сохранено
- [x] Убрать `checkSaveComplete()` и `isSaved` state (больше не нужен — redirect сразу)

**Файл:** `app/(dashboard)/briefing/setup/briefing-setup-client.tsx`

### 2.6 Промпт v11

- [x] Подложить файл `lib/prompts/service-chats/briefing-onboarding.md` (v11 из specs)

**Валидация этапа (после каждой подзадачи — `npx tsc --noEmit`):**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест create: AI → deepResearch → fetchUrl → updateBriefingPreview → текст пользователю (Guardian не блокирует)
- [x] 🧪 Мануальный тест save: кнопка active → нажатие → loading → redirect → данные в БД
- [x] 🧪 Unsaved guard: ← при непустом превью → AlertDialog
- [x] 🧪 SQL: источники и темы в БД после save

**Git (после валидации):**
```bash
git add -A
git commit -m "fix(tz-fix3): guardian bypass + save button + temperature"
```

Если промпт готов к этому моменту — отдельный коммит:
```bash
git add lib/prompts/service-chats/briefing-onboarding.md
git commit -m "fix(tz-fix3): prompt v11 — unified tools, save via button"
```

**Критерий готовности:** AI работает без Guardian-блокировок. Сохранение через UI-кнопку. Промпт v11 направляет AI к updateBriefingPreview.

---

⛔ НЕ НАЧИНАТЬ Этап 3 без подтверждения Этапа 2

---

## Этап 3: Финализация

**Статус:** ✅ Завершён

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Документация (обязательная):**
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (секция Briefing UI — save button, guardian bypass, prompt v11)
- [x] Обновить package.json: 3.52.0 → 3.53.0

**Документация (по чеклисту — оценить каждый пункт):**
- [x] ADR нужен? → Да → [ADR 025: Guardian Bypass](../../docs/decisions/025-guardian-bypass-pattern.md)
- [x] docs/ai-chats-map.md нужно обновить? → Да (tools changed, guardian bypass, save via UI)
- [x] docs/ai-agents.md нужно обновить? → Да (версия 3.43.0 → 3.53.0)

**Завершение:**
- [x] Финальное мануальное тестирование (пользователь) — подтверждено
- [ ] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна (проверено по чеклисту выше)
