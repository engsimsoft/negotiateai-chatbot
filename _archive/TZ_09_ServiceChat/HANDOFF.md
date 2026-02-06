# ТЗ-09: ServiceChat — HANDOFF

**Последнее обновление:** 2026-02-06
**Статус:** ✅ ЗАВЕРШЁН — готов к мануальному тестированию

---

## Краткое резюме

**ТЗ-09** — унификация сервисных чатов (Бен, создание проекта, менеджер) в единую архитектуру.

**Результат:**
- ✅ Удалён Prompt-Agent
- ✅ Создана новая система `components/service-chat/`
- ✅ Создан унифицированный API `/api/service-chat`
- ✅ Бен мигрирован на ServiceChatFloating
- ✅ Создание проекта мигрировано на ProjectCreationClient
- ✅ Менеджер мигрирован на ServiceChatDrawer
- ✅ Очищены старые компоненты (modal-assistants, universal-dialog)
- ✅ Документация обновлена
- ✅ `npm run build` успешен

---

## Что сделано

### Сессия 1: Фундамент

```
components/service-chat/
├── index.ts                    # Экспорты
├── types.ts                    # ServiceChatConfig, etc.
├── service-chat-core.tsx       # Ядро (messages, input, streaming, quickActions)
├── service-chat-floating.tsx   # Floating modal (center/bottom-right)
├── service-chat-drawer.tsx     # Drawer справа
├── service-chat-trigger.tsx    # Универсальная кнопка
├── ben-intro-bubble.tsx        # Перенесено из modal-assistants
└── configs/
    ├── index.ts
    ├── ben.ts                  # Бен: floating bottom-right, 380×500
    ├── project-creation.ts     # Создание: center, 440×540
    └── project-manager.ts      # Менеджер: drawer, 420px

app/(chat)/api/service-chat/route.ts   # Унифицированный API
```

### Сессия 2: Миграция + Очистка

**Обновлены:**
- `components/chat-header.tsx` — ServiceChatFloating + ServiceChatTrigger
- `components/glavnaya/glavnaya-header.tsx` — ServiceChatFloating
- `components/projects/project-actions.tsx` — ServiceChatDrawer
- `app/(dashboard)/projects/new/page.tsx` — ProjectCreationClient
- `app/(dashboard)/projects/new/project-creation-client.tsx` — новый клиент

**Удалены:**
- `components/modal-assistants/` — вся папка
- `components/universal-dialog/` — вся папка
- `components/projects/manager-dialog.tsx`
- `app/(chat)/api/universal-dialog/route.ts`
- `lib/prompts/skills/utility/prompt-helper/` (Сессия 1)

**Сохранены:**
- `_archive/prompts/prompt-agent-skill.md` — архив промпта
- `app/(chat)/api/assistant/ben/route.ts` — legacy API (используется)

---

## Мануальное тестирование

**Чеклист для тестирования:**

| Функция | URL | Действие |
|---------|-----|----------|
| Бен (chat) | `/chat` | Нажать ❓, задать вопрос, проверить ответ |
| Бен (glavnaya) | `/` | Нажать ❓, проверить floating modal |
| Создание проекта | `/projects/new` | Описать проект, дождаться создания, проверить redirect |
| Менеджер | `/projects/[id]` | Нажать "Менеджер", проверить drawer справа |
| Quick Actions | Все чаты | Проверить что карточки работают |
| Intro Bubble | `/chat` (новый юзер) | Должен появиться bubble около ❓ |
| Mobile | Все | Проверить bottom sheet вместо modal |

**Дополнительно:**
- [ ] Escape закрывает модалки
- [ ] Клик вне модалки закрывает её
- [ ] Фокус возвращается после закрытия

---

## Документы

**Обновлены:**
- `CLAUDE.md` — версия 3.8.0, раздел ServiceChat
- `SIMPLY_STATUS.md` — ТЗ-09 добавлен
- `CHANGELOG.md` — версия 3.8.0

**Specs:**
- [TZ_09_SERVICE_CHAT.md](TZ_09_SERVICE_CHAT.md) — ТЗ
- [ANALYSIS.md](ANALYSIS.md) — Анализ
- [ROADMAP.md](ROADMAP.md) — Дорожная карта с отметками ✅

---

## После тестирования

```bash
# После успешного мануального теста:
git add -A
git commit -m "feat(tz-09): ServiceChat унификация v3.8.0"
mv specs/TZ_09_ServiceChat _archive/TZ_09_ServiceChat
```
