# Передача сессии ТЗ-Б2: PodcastUI

**Последнее обновление:** 2026-02-22
**Сессия:** 3

---

## Статус этапов

- [x] Этап 1: Data Pipeline — аудио-данные на клиент ✅
- [x] Этап 2: Кнопка генерации + Streaming Hook + Прогресс ✅
- [x] Этап 3: Аудио-плеер + Переключатель режимов ✅
- [ ] Этап 4: Sidebar треклист + навигация ← СЛЕДУЮЩИЙ
- [ ] Этап 5: Edge Cases + Mobile
- [ ] Этап 6: Финализация

---

## Следующая сессия: начни с

1. Прочитай этот файл
2. Прочитай `specs/TZ_B2_PodcastUI/ROADMAP.md` → Этап 4 (подробные задачи)
3. Прочитай `docs/design-system.md` — ОБЯЗАТЕЛЬНО перед любым UI
4. Запусти `npm run dev`
5. **Первая задача:** Создать `components/briefing/podcast-sidebar.tsx` — секция треклиста в sidebar

---

## Что сделано в сессии 2-3

### Сессия 2 (Этап 2)
- **Streaming hook:** `hooks/use-podcast-generation.ts` — fetch POST, JSON Lines парсинг, per-topic status tracking
- **Кнопка:** `components/briefing/podcast-button.tsx` — Popover с toggle «Все темы / Выбрать» + checkboxes
- **Header:** `components/briefing/briefing-issue-header.tsx` — `podcastSlot` ReactNode composition pattern
- **Page client:** `briefing-page-client.tsx` — `usePodcastGeneration()`, audioStatus state management
- **Коммит:** `ea154a2 feat(tz-b2): podcast generation button, streaming hook, progress banner`

### Сессия 3 (Full-screen progress + Этап 3)
- **Full-screen progress redesign:** Переделан `podcast-progress.tsx` из компактного баннера в полноэкранный вид с artwork, spinner/mic icon, sound wave анимацией, per-topic steps (по эскизу `simply-podcast-prototype.html`)
- **Sidebar generation state:** В `briefing-sidebar.tsx` добавлена секция "Создаём подкаст" с per-topic статусами (заменяет "Текущий выпуск" во время генерации)
- **CSS animations:** В `globals.css` добавлены `podcast-wave` и `podcast-equalizer` keyframes
- **Button fix:** `podcast-button.tsx` — исправлена логика видимости (скрывается только при generating, показывает "Пересоздать" для ready/partial/outdated)
- **Коммит:** `cd47af2 feat(tz-b2): full-screen podcast progress, sidebar generation state`

- **Player hook:** `hooks/use-podcast-player.ts` — play/pause, seek, speed (0.75/1/1.25/1.5), track switching, skip ±15s, autoplay next, cleanup on unmount
- **Player UI:** `components/briefing/podcast-player.tsx` — artwork (bg-primary, Mic icon, date, sound wave), track info, clickable progress bar with thumb, controls (⏮ -15 ▶/❚❚ +15 ⏭), speed pills, download button, meta line
- **Mode toggle:** `components/briefing/briefing-mode-toggle.tsx` — [Читать | Слушать] segmented button, bg-primary for active listen
- **Integration:** `briefing-page-client.tsx` — viewMode state, usePodcastPlayer hook, auto-switch to listen after generation. `briefing-issue-content.tsx` — PodcastPlayer view when viewMode === "listen"
- **Коммит:** `244eff7 feat(tz-b2): audio player, mode toggle, read/listen switching`

---

## Ключевые решения

1. **Прогресс — full-screen view** (переделано в сессии 3, исходно планировался баннер) — заменяет статью во время генерации
2. **Sidebar** — треклист как доп. секция (Этап 4), во время генерации показывает per-topic статусы
3. **`<audio>`** — создаётся в `usePodcastPlayer` через `new Audio()` (lazy, SSR-safe), НЕ как DOM-элемент
4. **Mode toggle** — в header, заменяет PodcastButton когда `audioStatus === ready/partial`
5. **Кнопка "Пересоздать"** — пока убрана из UI, будет добавлена при шлифовке после ТЗ (решение пользователя)
6. **Дизайн** — строго по `docs/design-system.md`: только семантические токены, bg-primary для artwork, NO inline gradients/shadows

---

## Файлы в работе

| Файл | Статус | Примечание |
|------|--------|------------|
| `hooks/use-podcast-generation.ts` | Готов | Streaming hook, per-topic statuses |
| `hooks/use-podcast-player.ts` | Готов | Audio management, all controls |
| `components/briefing/podcast-button.tsx` | Готов | Popover + topic selection |
| `components/briefing/podcast-progress.tsx` | Готов | Full-screen progress view |
| `components/briefing/podcast-player.tsx` | Готов | Full player UI |
| `components/briefing/briefing-mode-toggle.tsx` | Готов | [Читать\|Слушать] toggle |
| `components/briefing/briefing-page-client.tsx` | Готов | Orchestrator: все hooks + state |
| `components/briefing/briefing-issue-content.tsx` | Готов | View switching (article/player/progress) |
| `components/briefing/briefing-issue-header.tsx` | Готов | podcastSlot (toggle or button) |
| `components/briefing/briefing-sidebar.tsx` | Готов | +generation state section |
| `app/globals.css` | Готов | +podcast-wave, podcast-equalizer keyframes |

---

## Непроверенные функции (Этап 3 — проверить в Этап 4/5)

- ⏮/⏭ переключение треков (нужно >1 трека для теста)
- -15/+15 перемотка
- Скорость воспроизведения (0.75×, 1.25×, 1.5×)
- Скачивание MP3
- Аудио НЕ прерывается при переключении Читать ↔ Слушать

---

## Важные паттерны

- **Design system:** `docs/design-system.md` — ОБЯЗАТЕЛЬНО читать. Только семантические токены. Без хардкоженных цветов/теней
- **Streaming:** JSON Lines через fetch + TextDecoder buffer + split("\n")
- **Audio URLs:** публичные Vercel Blob URLs, формат `briefing-podcast/{userId}/{topicId}-{timestamp}.mp3`
- **Prototype reference:** `specs/TZ_B2_PodcastUI/simply-podcast-prototype.html` — HTML эскиз 4 состояний (статья, popover, прогресс, плеер + sidebar треклист)

---

## Коммиты (хронологически)

```
ab890ed feat(tz-b2): wire audio data from server to client components
ea154a2 feat(tz-b2): podcast generation button, streaming hook, progress banner
cd47af2 feat(tz-b2): full-screen podcast progress, sidebar generation state
244eff7 feat(tz-b2): audio player, mode toggle, read/listen switching
```

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```
