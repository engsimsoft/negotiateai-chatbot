# Передача сессии ТЗ-Б2: PodcastUI

**Последнее обновление:** 2026-02-22
**Сессия:** 4 (финальная)

---

## Статус этапов

- [x] Этап 1: Data Pipeline — аудио-данные на клиент ✅
- [x] Этап 2: Кнопка генерации + Streaming Hook + Прогресс ✅
- [x] Этап 3: Аудио-плеер + Переключатель режимов ✅
- [x] Этап 4: Sidebar треклист + навигация ✅
- [x] Этап 5: Edge Cases + Mobile ✅
- [x] Этап 6: Финализация ✅

---

## ТЗ ЗАВЕРШЕНО (v3.44.0)

Все 6 этапов выполнены. Документация обновлена. Готово к архивации.

---

## Коммиты (хронологически)

```
ab890ed feat(tz-b2): wire audio data from server to client components
ea154a2 feat(tz-b2): podcast generation button, streaming hook, progress banner
cd47af2 feat(tz-b2): full-screen podcast progress, sidebar generation state
244eff7 feat(tz-b2): audio player, mode toggle, read/listen switching
9f89d77 feat(tz-b2): sidebar tracklist with player navigation
59e167f feat(tz-b2): edge cases, outdated state, mobile touch targets
[final]  chore(tz-b2): finalize v3.44.0 — PodcastUI
```

---

## Файлы созданные/изменённые

| Файл | Тип | Описание |
|------|-----|----------|
| `hooks/use-podcast-generation.ts` | NEW | Streaming hook генерации подкаста |
| `hooks/use-podcast-player.ts` | NEW | Player hook (Audio management) |
| `components/briefing/podcast-button.tsx` | NEW | Кнопка генерации + Popover |
| `components/briefing/podcast-progress.tsx` | NEW | Full-screen прогресс |
| `components/briefing/podcast-player.tsx` | NEW | Full-screen плеер |
| `components/briefing/briefing-mode-toggle.tsx` | NEW | [Читать \| Слушать] toggle |
| `components/briefing/podcast-sidebar.tsx` | NEW | Sidebar треклист |
| `components/briefing/briefing-page-client.tsx` | MOD | Podcast orchestrator |
| `components/briefing/briefing-issue-content.tsx` | MOD | View switching + props |
| `components/briefing/briefing-issue-header.tsx` | MOD | podcastSlot |
| `components/briefing/briefing-sidebar.tsx` | MOD | +tracklist/generation state |
| `lib/briefing/briefing-types.ts` | MOD | +audio types |
| `app/(dashboard)/briefing/page.tsx` | MOD | +audio fields |
| `app/globals.css` | MOD | +podcast-wave, podcast-equalizer keyframes |

---

## Ключевые решения

1. **Прогресс — full-screen view** — заменяет статью во время генерации
2. **Sidebar** — три состояния: listen → tracklist, generating → per-topic statuses, read → topic navigation
3. **`<audio>`** — `new Audio()` (lazy, SSR-safe), НЕ DOM-элемент
4. **Mode toggle** — в header, заменяет PodcastButton когда audioStatus === ready/partial
5. **Кнопка "Пересоздать"** — убрана из UI, будет при шлифовке (решение пользователя)
6. **Дизайн** — строго по design-system.md: только семантические токены
