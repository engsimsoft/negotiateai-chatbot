# Roadmap ТЗ-Б2: PodcastUI

**Создан:** 2026-02-22
**Версия проекта:** 3.43.0 → 3.44.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 2 |
| Сессий (оценка) | 3-4 |

**Архитектурные решения (согласованы с архитектором):**
- Прогресс генерации — компактный баннер, статья остаётся видимой
- Sidebar — треклист как доп. секция, навигация не заменяется
- `<audio>` — на уровне `briefing-page-client.tsx`, ref вниз
- Popover — toggle «Все темы / Выбрать» вместо radio+checkboxes
- Скачивание — только текущий трек, без zip
- Persistent state — нет для MVP
- Эквалайзер — CSS-only декорация

---

## Этап 1: Data Pipeline — аудио-данные на клиент

**Статус:** ✅ Завершён

**Цель:** Audio-поля (`audioStatus`, `audioUrls`, `audioDurations`) доступны в клиентских компонентах брифинга.

**Задачи:**
- [x] Добавить client-safe аудио типы в `lib/briefing/briefing-types.ts` (`AudioStatus`, `AudioUrls`, `AudioDurations` — реэкспорт из podcast/types или дублирование для client-safe)
- [x] В `app/(dashboard)/briefing/page.tsx` — извлечь `audioStatus`, `audioUrls`, `audioDurations` из результата `getBriefingHistory` и передать в `BriefingPageClient`
- [x] В `components/briefing/briefing-page-client.tsx` — добавить props и state для аудио-данных, пробросить в дочерние компоненты
- [x] В `components/briefing/briefing-issue-header.tsx` — принять `audioStatus` как prop (пока только для conditional rendering кнопки)

**Файлы:**
- `lib/briefing/briefing-types.ts` — добавить аудио типы (client-safe)
- `app/(dashboard)/briefing/page.tsx` — пробросить audio fields
- `components/briefing/briefing-page-client.tsx` — props + state
- `components/briefing/briefing-issue-content.tsx` — пробросить props
- `components/briefing/briefing-issue-header.tsx` — принять audioStatus

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/briefing` загружается без ошибок, внешних изменений нет
- [x] 🧪 Мануальный тест: открыть /briefing — всё работает как раньше

**Git (после валидации):**
```bash
git add lib/briefing/briefing-types.ts app/(dashboard)/briefing/page.tsx components/briefing/briefing-page-client.tsx components/briefing/briefing-issue-content.tsx components/briefing/briefing-issue-header.tsx
git commit -m "feat(tz-b2): wire audio data from server to client components"
```

**Критерий готовности:** `audioStatus` доступен в header component, `audioUrls/audioDurations` доступны в page-client state.

---

## Этап 2: Кнопка генерации + Streaming Hook + Прогресс

**Статус:** ✅ Завершён

**Цель:** Пользователь нажимает кнопку, выбирает темы, видит компактный прогресс генерации.

**Задачи:**
- [x] Создать `hooks/use-podcast-generation.ts` — streaming hook по паттерну `use-briefing-generation.ts`. Fetch `POST /api/briefing/podcast/generate`, парсинг JSON Lines, state machine (idle → generating → done/error). Адаптировать под `PodcastProgressEvent`
- [x] Создать `components/briefing/podcast-button.tsx` — кнопка «🎙 Создать подкаст» (при `audioStatus === 'none'`) / «🎙 Пересоздать» (при `audioStatus === 'outdated'`). Popover с toggle «Все темы / Выбрать» + чекбоксы тем + кнопка «Создать»
- [x] Создать `components/briefing/podcast-progress.tsx` — компактный прогресс-баннер (sticky наверху контентной области). Список тем со статусами: ○ ожидание, 🎙 скрипт/запись, ✅ готово, ❌ ошибка
- [x] Интегрировать в `briefing-issue-header.tsx` — заменить disabled кнопку на `podcastSlot` (ReactNode slot для composition)
- [x] Интегрировать в `briefing-page-client.tsx` — подключить `usePodcastGeneration()`, управлять прогресс-баннером, обновлять `audioStatus` state после завершения
- [x] Интегрировать прогресс-баннер в `briefing-issue-content.tsx` — показать над контентной областью при `isGenerating`

**Файлы:**
- `hooks/use-podcast-generation.ts` — новый
- `components/briefing/podcast-button.tsx` — новый
- `components/briefing/podcast-progress.tsx` — новый
- `components/briefing/briefing-issue-header.tsx` — замена кнопки
- `components/briefing/briefing-page-client.tsx` — hook + state
- `components/briefing/briefing-issue-content.tsx` — прогресс-баннер

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: кнопка «Создать подкаст» видна в header при готовом брифинге
- [x] Браузер: клик → popover с темами, toggle работает
- [x] Браузер: «Создать» → прогресс-баннер появляется, статья остаётся видимой
- [x] Браузер: прогресс обновляется в реальном времени (шаги по каждой теме)
- [x] 🧪 Мануальный тест: полный цикл генерации с прогрессом

**Git (после валидации):**
```bash
git add hooks/use-podcast-generation.ts components/briefing/podcast-button.tsx components/briefing/podcast-progress.tsx components/briefing/briefing-issue-header.tsx components/briefing/briefing-page-client.tsx components/briefing/briefing-issue-content.tsx
git commit -m "feat(tz-b2): podcast generation button, streaming hook, progress banner"
```

**Критерий готовности:** Полный цикл: кнопка → popover → генерация → прогресс в реальном времени → audioStatus обновлён. Статья остаётся видимой во время генерации.

---

## Этап 3: Аудио-плеер + Переключатель режимов

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Цель:** Полноценный плеер с контролами. Переключатель «Читать / Слушать».

**Задачи:**
- [ ] Создать `hooks/use-podcast-player.ts` — логика плеера: `<audio>` ref management, play/pause, seek, speed control (0.75/1/1.25/1.5), track switching (prev/next), skip ±15s, progress tracking, autoplay next track. Expose: `isPlaying`, `currentTime`, `duration`, `currentTrackIndex`, `speed`, `play()`, `pause()`, `seekTo()`, `setSpeed()`, `nextTrack()`, `prevTrack()`, `skipForward()`, `skipBackward()`
- [ ] Создать `components/briefing/podcast-player.tsx` — UI плеера: обложка CSS-only (gradient bg-primary, 🎙 иконка, дата), инфо текущего трека (emoji + название), прогресс-бар кликабельный, контролы (⏮ -15 ▶/❚❚ +15 ⏭), pill-кнопки скорости, кнопка скачивания (текущий трек), мета-строка (N тем · X мин Y сек), CSS эквалайзер при воспроизведении
- [ ] Создать `components/briefing/briefing-mode-toggle.tsx` — сегментированная кнопка [📖 Читать | 🎧 Слушать]. Видна при `audioStatus === 'ready' || 'partial'`. Терракотовый фон активного = `bg-primary`
- [ ] Интегрировать `<audio>` элемент в `briefing-page-client.tsx` — hidden audio element, ref для хука
- [ ] Интегрировать переключатель в `briefing-issue-header.tsx` — заменяет кнопку «Создать подкаст» когда аудио готово
- [ ] Интегрировать плеер в `briefing-issue-content.tsx` — новый view mode: при viewMode === 'listen' показывать `PodcastPlayer` вместо `BriefingArticleView`

**Файлы:**
- `hooks/use-podcast-player.ts` — новый
- `components/briefing/podcast-player.tsx` — новый
- `components/briefing/briefing-mode-toggle.tsx` — новый
- `components/briefing/briefing-page-client.tsx` — `<audio>`, viewMode state
- `components/briefing/briefing-issue-header.tsx` — mode toggle
- `components/briefing/briefing-issue-content.tsx` — podcast view

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: переключатель «Читать/Слушать» виден после генерации подкаста
- [ ] Браузер: плеер — play/pause работает, звук воспроизводится
- [ ] Браузер: прогресс-бар обновляется, кликабелен (seek)
- [ ] Браузер: ⏮/⏭ переключают треки, -15/+15 перематывают
- [ ] Браузер: скорость воспроизведения переключается (0.75×, 1×, 1.25×, 1.5×)
- [ ] Браузер: скачивание текущего трека работает
- [ ] Браузер: аудио НЕ прерывается при переключении «Читать ↔ Слушать»
- [ ] 🧪 Мануальный тест: полный плеер, переключение режимов

**Git (после валидации):**
```bash
git add hooks/use-podcast-player.ts components/briefing/podcast-player.tsx components/briefing/briefing-mode-toggle.tsx components/briefing/briefing-page-client.tsx components/briefing/briefing-issue-header.tsx components/briefing/briefing-issue-content.tsx
git commit -m "feat(tz-b2): audio player, mode toggle, read/listen switching"
```

**Критерий готовности:** Полный плеер с контролами, переключение режимов мгновенное, аудио не прерывается. Все контролы функциональны.

---

## Этап 4: Sidebar треклист + навигация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Цель:** Треклист в sidebar, кликабельная навигация по трекам, синхронизация с плеером.

**Задачи:**
- [ ] Создать `components/briefing/podcast-sidebar.tsx` — секция «🎧 ТРЕКЛИСТ»: список тем (emoji + название + длительность), индикатор текущего трека (эквалайзер-анимация CSS), клик → плеер переключается, карточка «Полный выпуск» (кол-во тем + общее время)
- [ ] Интегрировать в `components/briefing/briefing-sidebar.tsx` — добавить секцию треклиста наверху sidebar (перед «Текущий выпуск») когда `viewMode === 'listen'` и `audioStatus === 'ready' || 'partial'`. Остальные секции остаются
- [ ] Связать sidebar с плеером: клик по треку → callback → `use-podcast-player.setTrack(index)` → плеер переключается
- [ ] Синхронизация: текущий трек в плеере → подсветка в sidebar (через `currentTrackIndex`)

**Файлы:**
- `components/briefing/podcast-sidebar.tsx` — новый
- `components/briefing/briefing-sidebar.tsx` — интеграция треклист-секции
- `components/briefing/briefing-page-client.tsx` — пробросить player state в sidebar

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: при режиме «Слушать» в sidebar виден треклист
- [ ] Браузер: клик по треку → плеер переключается на эту тему
- [ ] Браузер: текущий трек подсвечен в sidebar (анимация эквалайзера)
- [ ] Браузер: остальные секции sidebar (навигация, saved topics, Simply) видны
- [ ] 🧪 Мануальный тест: навигация по трекам через sidebar

**Git (после валидации):**
```bash
git add components/briefing/podcast-sidebar.tsx components/briefing/briefing-sidebar.tsx components/briefing/briefing-page-client.tsx
git commit -m "feat(tz-b2): sidebar tracklist with player navigation"
```

**Критерий готовности:** Треклист в sidebar, двусторонняя синхронизация с плеером, остальные секции sidebar не затронуты.

---

## Этап 5: Edge Cases + Mobile

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

**Цель:** Обработка partial/outdated/error состояний, мобильная адаптация.

**Задачи:**
- [ ] **Partial state:** в треклисте упавшие темы — серые + кнопка «↻ Повторить» (вызов `POST /api/briefing/podcast/generate` с `{ topicIds: [failedId] }`). Плеер показывает только готовые треки
- [ ] **Outdated state:** при `audioStatus === 'outdated'` — баннер в подкаст-экране «Текст обновлён, подкаст может быть неактуален» + кнопка «Пересоздать». В header переключатель с визуальным индикатором (точка/бейдж)
- [ ] **Мобильная адаптация:** подкаст-экран на полную ширину, кнопки управления ≥ 44px touch targets, переключатель в header адаптивный, треклист в Sheet (через существующий `BriefingSidebarMobile`)
- [ ] **Auto-transition:** после завершения генерации — автоматическое переключение на режим «Слушать» (обновить `audioStatus` state из streaming hook, переключить viewMode)
- [ ] **Safari Audio Policy:** первый play только по user gesture, preload audio

**Файлы:**
- `components/briefing/podcast-sidebar.tsx` — partial state, retry
- `components/briefing/podcast-player.tsx` — outdated banner, mobile responsive
- `components/briefing/briefing-mode-toggle.tsx` — outdated indicator
- `components/briefing/briefing-page-client.tsx` — auto-transition, retry handler
- `hooks/use-podcast-player.ts` — filter ready tracks, preload
- `hooks/use-podcast-generation.ts` — auto-transition callback

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер (desktop): outdated баннер виден при устаревшем подкасте
- [ ] Браузер (desktop): «Пересоздать» запускает генерацию
- [ ] Браузер (mobile): layout адаптивный, кнопки достаточного размера
- [ ] Браузер (mobile): sidebar = Sheet с треклистом
- [ ] Браузер: auto-transition после генерации
- [ ] 🧪 Мануальный тест: partial state (ошибка темы), outdated state, мобилка

**Git (после валидации):**
```bash
git add components/briefing/podcast-sidebar.tsx components/briefing/podcast-player.tsx components/briefing/briefing-mode-toggle.tsx components/briefing/briefing-page-client.tsx hooks/use-podcast-player.ts hooks/use-podcast-generation.ts
git commit -m "feat(tz-b2): edge cases (partial, outdated), mobile, auto-transition"
```

**Критерий готовности:** Все edge cases обработаны, мобильная версия функциональна, auto-transition работает.

---

## Этап 6: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 5

**Цель:** Документация, версионирование, архив.

**Задачи:**
- [ ] Финальное мануальное тестирование (пользователь): полный цикл от кнопки до плеера
- [ ] SQL-проверка БД: audioStatus/audioUrls/audioDurations заполнены после генерации
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md — чеклист документации
- [ ] Обновить главный `CHANGELOG.md`
- [ ] Обновить `SIMPLY_STATUS.md`
- [ ] Обновить `CLAUDE.md` (новые компоненты в структуре кода)
- [ ] Обновить `package.json` (версия 3.44.0)
- [ ] Обновить `docs/design-system.md` (если новые паттерны)
- [ ] ⛔ Верификация docs против кода (Правило 5)
- [ ] Переместить папку в `_archive/`

**Валидация этапа:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна и верифицирована

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-b2): finalize v3.44.0 — PodcastUI"
```

**Критерий готовности:** Всё задокументировано, версия обновлена, ТЗ в архиве.
