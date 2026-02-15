# Передача сессии ТЗ-08: Chat Sidebar

**Дата:** 2026-02-15
**Сессия:** 1

## Статус этапов
- [ ] Этап 1: Панель + кнопка toggle + извлечение данных ← ТЕКУЩИЙ
- [ ] Этап 2: Интерактивность (клик + скачивание + превью)
- [ ] Этап 3: Финализация

## Что сделано в сессии 1
- ✅ Фаза 1 (Анализ): изучена кодовая база, создан ANALYSIS.md
- ✅ Фаза 2 (Планирование): создан ROADMAP.md (3 этапа), CHANGELOG.md, HANDOFF.md
- ✅ Все вопросы архитектору согласованы (5 пунктов)
- ⬜ Код ещё не писали — готов к разработке (Фаза 3)

## Следующая сессия: начни с
1. `Read specs/TZ_08_ChatSidebar/ROADMAP.md` → Этап 1
2. `Read docs/design-system.md` (обязательно перед UI работой, по CLAUDE.md)
3. `Read components/chat-header.tsx` — сюда добавляем кнопку PanelRight
4. `Read components/chat.tsx` — сюда добавляем state и рендер ChatSidebar
5. `Read components/projects/manager-drawer.tsx` — референс паттерна правой панели
6. Создать `components/chat-sidebar.tsx` — новый компонент
7. Модифицировать `chat-header.tsx` и `chat.tsx`

## Ключевые решения (согласовано с архитектором)
- **Паттерн панели:** push-drawer (как `manager-drawer.tsx`) — `fixed right-0 top-[3.5rem] z-30 w-[380px]`, slide-in `translate-x-full → translate-x-0`
- **Иконка:** `PanelRight` из Lucide (как у Claude.ai)
- **Клик вложений:** `ImageLightbox` (изображения) + `FileViewer` (остальные)
- **Клик артефактов:** `useArtifact` → `setArtifact({ isVisible: true })` → существующий Artifact panel
- **Кнопка ↓ скачивания** на каждом элементе (Download из Lucide, появляется на hover)
- **Кнопка sidebar** показывается **всегда** (не прыгает) + empty state внутри
- **Mobile:** панель на `w-full`

## Источники данных (из messages)
```typescript
// Артефакты: tool-createDocument + tool-updateDocument → { id, title, kind }
// Дедупликация по id обязательна
// Вложения: type === "file" → { name: filename, url, contentType: mediaType }
```

## Ключевые файлы для изучения
| Файл | Зачем читать |
|------|-------------|
| `specs/TZ_08_ChatSidebar/ROADMAP.md` | Рабочий чеклист — задачи, файлы, валидация |
| `components/chat-header.tsx` | Сюда добавляем кнопку (строка 114, ml-auto блок) |
| `components/chat.tsx` | Сюда добавляем state + рендер (строка 394-503, основной layout) |
| `components/projects/manager-drawer.tsx` | Паттерн push-drawer (копируем подход) |
| `components/document-preview.tsx` | Паттерн карточки артефакта (CompactDocumentCard) |
| `components/file-viewer/` | Система превью файлов (для вложений) |
| `components/image-lightbox.tsx` | Lightbox для изображений |
| `hooks/use-artifact.ts` | Zustand store для открытия артефакта |
| `lib/types.ts` | Типы ChatMessage, Attachment |

## Блокеры / Вопросы
- Нет блокеров. Все решения приняты, можно сразу кодить.
