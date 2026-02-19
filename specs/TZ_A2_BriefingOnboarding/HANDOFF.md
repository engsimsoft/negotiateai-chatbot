# Передача сессии ТЗ-A2: Briefing Onboarding

**Последнее обновление:** 2026-02-20
**Сессия:** 2

---

## Статус этапов

- [x] Этап 1: БД + Queries + Промпт-файлы ✅ (commit `bc2db18`)
- [x] Этап 2: Backend — service-chat расширение ✅ (commit `b46cfc6`)
- [x] Этап 3: Frontend — split layout + чат ✅ (ожидает коммит)
- [ ] Этап 4: Edit mode + edge cases + polish ← СЛЕДУЮЩИЙ
- [ ] Этап 5: Финализация

---

## Следующая сессия: начни с

1. Прочитай ROADMAP.md — Этап 4 (Edit mode + edge cases)
2. Мануальный тест Этапа 3 в браузере: `/briefing/setup` → create mode flow
3. **Первая задача:** Edit mode в Server Component — загрузить topics/sources

---

## Что сделано в Сессии 2

### Этап 2 (завершён, commit `b46cfc6`)
- `"briefing-onboarding"` добавлен в `ServiceChatContext` и `requestSchema` (+ поле `briefingMode: "create" | "edit"`)
- `maxDuration` поднят с 60 до 120 (глобальный ceiling)
- `stepCountIs` динамический: 8 для briefing-onboarding, 3 для остальных
- `getModelId()` case: `"briefing-onboarding"` → `"claude-sonnet-4-6"`
- `buildBriefingOnboardingPrompt()`: загрузка .md шаблона, подстановка USER_CONTEXT/DATE/YEAR/MODE_INJECTION
- `buildBriefingEditModeInjection()`: программная сборка из БД (settings + topics + sources)
- Tool `updateBriefingPreview`: Zod schema, return preview (только для UI)
- Tool `saveBriefingProfile`: Zod schema, пишет в БД (upsert settings + replace topics + replace sources)
- `deepResearch({ defaultDepth: "pro" })` и `fetchUrl` подключены через прямой импорт
- Валидация: tsc 0 ошибок, build успешен

### Этап 3 (завершён, ожидает коммит)
- `page.tsx` переписан: Server Component с auth, getBriefingSettings для mode detection, getUserById для profile
- `briefing-setup-client.tsx`: split layout (400px aside + main), useChat + DefaultChatTransport, extractPreviewUpdate/checkSaveComplete, success card с генерацией
- `components/briefing-profile-preview.tsx`: темы с emoji, источники под темами, tier badges, settings summary, empty state
- `components/briefing-chat-panel.tsx`: ScrollArea + animated messages + typing indicator + ServiceChatInput
- `configs/briefing-onboarding.ts`: reference config + export в index.ts
- Валидация: tsc 0 ошибок, build успешен (11.7 kB client bundle)

---

## Что сделано в Сессии 1

### Фаза анализа
- Глубокий анализ 5 подсистем параллельно (service-chat, projects/new, briefing backend, AI providers/tools, prompt builders)
- Выявлены 6 технических проблем, все согласованы с архитектором
- ANALYSIS.md с код-ревью, ROADMAP.md с 5 этапами

### Этап 1 (завершён)
- Таблица `BriefingTopics` в schema.ts + миграция `0032_briefing-topics.sql` (применена к production БД)
- 4 новых query: `getBriefingTopics`, `addBriefingTopic`, `deleteAllBriefingTopicsByUser`, `deleteAllBriefingSourcesByUser`
- Default `generationTime` изменён с "06:00" на "07:00"
- Промпт `briefing-onboarding.md` — адаптирован из PE v2, добавлены инструкции для `updateBriefingPreview`
- Mode injection `briefing-onboarding-mode-injection.md` — справочный документ (без Handlebars)
- Модель `claude-sonnet-4-6` добавлена в providers.ts как отдельный entry
- Валидация: tsc 0 ошибок, build успешен, SQL подтверждён, мануальный тест ОК

---

## Ключевые решения

1. **Два tool вместо одного:** `updateBriefingPreview` (live, только для клиента) + `saveBriefingProfile` (финальный, пишет в БД)
2. **Mode injection строится программно** — как Manager `buildFirstContactMode()`, через string concatenation
3. **stepCountIs динамический:** 8 для briefing-onboarding, 3 для остальных
4. **maxDuration:** поднят с 60 до 120 (глобальный ceiling)
5. **Модель:** `claude-sonnet-4-6` (отдельный entry, НЕ alias `claude-sonnet`)
6. **Prompt builder:** `buildBriefingOnboardingPrompt()` — загрузка .md, подстановка `{{USER_CONTEXT}}`, `{{DATE}}`, `{{YEAR}}`, `{{MODE_INJECTION}}`
7. **Новое поле в requestSchema:** `briefingMode: "create" | "edit"` — клиент определяет
8. **deepResearch + fetchUrl** — прямой импорт из `lib/ai/tools/`
9. **Standalone split layout** — не через ServiceChatCore, а как project-creation (useChat напрямую)
10. **Tool result extraction** — `tool-updateBriefingPreview` / `tool-saveBriefingProfile` part types + processedIdsRef

---

## Файлы в работе

| Файл | Статус | Примечание |
|------|--------|------------|
| `lib/db/schema.ts` | Готов | +BriefingTopics таблица |
| `lib/db/queries.ts` | Готов | +4 queries, generationTime 07:00 |
| `lib/ai/providers.ts` | Готов | +claude-sonnet-4-6 |
| `lib/prompts/service-chats/briefing-onboarding.md` | Готов | Промпт с updateBriefingPreview |
| `lib/prompts/service-chats/briefing-onboarding-mode-injection.md` | Готов | Справочный документ |
| `app/(chat)/api/service-chat/route.ts` | Готов | Этап 2: контекст, tools, prompt builder, mode injection |
| `app/(dashboard)/briefing/setup/page.tsx` | Готов | Этап 3: Server Component с mode detection |
| `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` | Готов | Этап 3: split layout + chat + preview |
| `app/(dashboard)/briefing/setup/components/` | Готов | Этап 3: preview + chat panel |
| `components/service-chat/configs/briefing-onboarding.ts` | Готов | Reference config |

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
npm run db:migrate   # Применить миграции
```
