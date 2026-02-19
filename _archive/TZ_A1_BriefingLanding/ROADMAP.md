# Roadmap ТЗ-A1: BriefingLanding

**Создан:** 2026-02-19
**Версия проекта:** 3.27.1 → 3.28.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

**Скоуп (после согласования):**
- Удаляем: 5 UI-компонентов JSON-карточек
- НЕ удаляем: `topics-catalog.ts`, `seed-briefing.ts`, fallback-логику (до ТЗ-А2)
- Создаём: лендинг (hero + демо + CTA), заглушка `/briefing/setup`

---

## Этапы

### Этап 1: Очистка старых UI-компонентов + лендинг

**Статус:** ✅ Завершён

**Цель:** Удалить компоненты JSON-карточек, переписать `/briefing` в лендинг с hero, демо-блоком и CTA.

**Задачи:**
- [x] Удалить `components/briefing/briefing-content.tsx`
- [x] Удалить `components/briefing/briefing-block.tsx`
- [x] Удалить `components/briefing/briefing-item.tsx`
- [x] Удалить `components/briefing/briefing-empty.tsx`
- [x] Удалить `components/briefing/briefing-generate-button.tsx`
- [x] Обновить `components/briefing/index.ts` — убрать экспорты удалённых компонентов
- [x] Адаптировать `components/briefing/briefing-header.tsx` — убрать зависимость от BriefingJSON, оставить навигацию + UserMenu. Для лендинга: без счётчиков, без кнопки Settings
- [x] Переписать `components/briefing/briefing-page.tsx` → лендинг (hero + демо + CTA)
- [x] Упростить `app/(dashboard)/briefing/page.tsx` — убрать fetch briefingHistory (лендинг не использует данные), оставить auth guard
- [x] Создать `app/(dashboard)/briefing/setup/page.tsx` — заглушка "Скоро"

**Файлы:**
- `components/briefing/briefing-content.tsx` — удалить
- `components/briefing/briefing-block.tsx` — удалить
- `components/briefing/briefing-item.tsx` — удалить
- `components/briefing/briefing-empty.tsx` — удалить
- `components/briefing/briefing-generate-button.tsx` — удалить
- `components/briefing/index.ts` — обновить
- `components/briefing/briefing-header.tsx` — адаптировать
- `components/briefing/briefing-page.tsx` — полная перезапись → лендинг
- `app/(dashboard)/briefing/page.tsx` — упростить
- `app/(dashboard)/briefing/setup/page.tsx` — новый (заглушка)

**Лендинг — три блока:**
1. **Hero** — заголовок font-serif, подзаголовок (AI-подкаст, персональный, каждое утро), воздушно
2. **Демо** — 2-3 темы, статичный JSX, живой текст с inline-ссылками. Лёгкий фон (bg-muted/30 или bg-card). Показывает формат результата
3. **CTA** — кнопка "Настроить мой брифинг" → `/briefing/setup`, короткий текст под кнопкой

**Дизайн-система:**
- Цвета: ТОЛЬКО семантические токены
- Заголовки: `font-serif`
- Header: паттерн h-14, sticky, border-b, bg-background
- Hover на CTA кнопке: стандартный Button из shadcn
- Dark mode: корректная работа

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/briefing` — лендинг с hero, демо, кнопка "Настроить"
- [ ] Браузер: `/briefing/setup` — заглушка "Скоро" с кнопкой назад
- [ ] Браузер: дашборд → карточка "Утренний брифинг" → клик → лендинг
- [ ] Dark mode: корректные цвета
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/briefing/ app/(dashboard)/briefing/
git commit -m "feat(tz-a1): briefing landing page + cleanup old card components"
```

**Критерий готовности:** `/briefing` показывает лендинг, старые JSON-компоненты удалены, `/briefing/setup` работает как заглушка

---

### Этап 2: Финализация

**Статус:** ✅ Завершён

**Цель:** Обновить документацию, финализировать версию.

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (секция Briefing UI — удалённые компоненты, новые файлы)
- [x] Обновить `package.json` (версия 3.28.0)
- [x] Обновить `docs/design-system.md` (карта страниц: `/briefing` описание, `/briefing/setup`)
- [x] Переместить папку `specs/TZ_A1_BriefingLanding/` → `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна
- [ ] Все файлы в коммите

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json docs/design-system.md
git commit -m "docs(tz-a1): finalize v3.28.0 — briefing landing"
```

**Критерий готовности:** Документация обновлена, версия 3.28.0, ТЗ в архиве
