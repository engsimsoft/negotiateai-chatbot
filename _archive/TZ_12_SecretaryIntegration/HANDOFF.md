# Передача сессии ТЗ-12

**Последнее обновление:** 2026-02-07
**Сессия:** 1

---

## Статус этапов

- [ ] Этап 1: Замена промпта и модели (backend) ← ТЕКУЩИЙ
- [ ] Этап 2: Передача pronouns + обновление greeting
- [ ] Этап 3: Убрать Quick Actions + Финализация

---

## Следующая сессия: начни с

1. Прочитай этот файл
2. Прочитай `ROADMAP.md` — Этап 1 (задачи 1.2–1.5)
3. Прочитай `SECRETARY_PROMPT.md` — XML-промпт для вставки
4. Открой `app/(chat)/api/service-chat/route.ts`
5. **Первая задача:** Задача 1.2 — расширить `buildSystemPrompt()` options

---

## Что сделано в сессии 1

- Изучена кодовая база (service-chat API, configs, preview, client, chat-panel)
- Созданы документы: SPEC.md, ANALYSIS.md, ROADMAP.md, HANDOFF.md
- Получены ответы: модель = Gemini 3 Pro, quick actions = убрать
- **Задача 1.1 выполнена:** `getModelId()` обновлён на `gemini-3-pro` для project-creation

---

## Файлы в работе

| Файл | Статус | Примечание |
|------|--------|------------|
| `app/(chat)/api/service-chat/route.ts` | В процессе | Модель обновлена (1.1). Осталось: промпт (1.3), profile fields (1.2, 1.4), tool desc (1.5) |
| `app/(dashboard)/projects/new/page.tsx` | Ожидает | Этап 2 |
| `app/(dashboard)/projects/new/project-creation-client.tsx` | Ожидает | Этапы 2, 3 |
| `app/(dashboard)/projects/new/components/project-chat-panel.tsx` | Ожидает | Этап 3 |
| `components/service-chat/configs/project-creation.ts` | Ожидает | Этап 3 |

---

## Блокеры / Вопросы

- Нет блокеров. Все вопросы отвечены.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```

---

## Ключевые решения

1. **Модель Gemini 3 Pro:** Пользователь выбрал Pro вместо Flash для качественного интервью
2. **Quick Actions убрать:** Секретарь сам ведёт диалог, кнопки не нужны
3. **Промпт XML:** Из SECRETARY_PROMPT.md, динамический `<user_context>` (пустые поля не включать)

---

## Ключевые находки из анализа кода

- API уже берёт профиль из БД (`getUserById`), но передаёт только `displayName` и `occupation` → нужно добавить `pronouns` и `bio`
- Tool schema уже корректна (name, description, context) после ТЗ-11
- UI лейблы уже правильные ("Контекст проекта") после ТЗ-11
- `extractDraftUpdate()` уже работает с partial updates
- Greeting формируется на клиенте как static message (не от API) — нужно учитывать pronouns
