# Roadmap ТЗ-C4: Переключение AI-провайдера на Anthropic Claude

**Создан:** 2026-02-16
**Версия проекта:** 3.22.0 → 3.23.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 4 (завершён) |
| Сессий (оценка) | 1-2 |

---

## Этап 1: Зависимости + Core Provider

**Статус:** ✅ Завершён

**Цель:** Установить `@ai-sdk/anthropic`, переключить центральный провайдер и типы. После этого этапа `myProvider` отдаёт Claude-модели.

**Задачи:**
- [x] `npm install @ai-sdk/anthropic` (v2.0.63 — совместим с ai@5.0.123)
- [x] Переписать `lib/ai/providers.ts` — заменить Google на Anthropic (шаг 1 ТЗ)
- [x] Обновить `lib/prompts/types.ts` — ModelId (шаг 2 ТЗ)
- [x] Обновить `lib/ai/models.ts` — UI-список моделей, убрать "auto" (шаг 4 ТЗ)
- [x] Обновить `lib/ai/entitlements.ts` — доступные модели (шаг 6 ТЗ)
- [x] Обновить `app/(chat)/api/chat/schema.ts` — Zod enum (шаг 8a ТЗ)

**Файлы:**
- `lib/ai/providers.ts` — полная перезапись
- `lib/prompts/types.ts` — ModelId
- `lib/ai/models.ts` — chatModels[], DEFAULT_CHAT_MODEL
- `lib/ai/entitlements.ts` — availableChatModelIds
- `app/(chat)/api/chat/schema.ts` — selectedChatModel enum

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (объединён с Этапом 2)
- [x] 🧪 Мануальный тест: НЕ требуется

**Git (после валидации):**
```bash
git add lib/ai/providers.ts lib/prompts/types.ts lib/ai/models.ts lib/ai/entitlements.ts app/(chat)/api/chat/schema.ts
git commit -m "feat(tz-c4): switch core provider from Gemini to Anthropic Claude"
```

**Критерий готовности:** `npm run build` проходит, `myProvider` экспортирует claude-sonnet/haiku/opus

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

## Этап 2: Routes + Pipeline + Clerks

**Статус:** ✅ Завершён (объединён с Этапом 1 — top-level model refs блокировали build)

**Цель:** Обновить все API routes, pipeline и клерки чтобы использовали новые model IDs. После этого этапа всё AI-взаимодействие идёт через Claude.

**Задачи:**
- [x] Обновить `lib/prompts/builder/composer.ts` — defaultModel fallbacks (шаг 3 ТЗ)
- [x] Обновить `lib/ai/model-tiers.ts` — модели проектов (шаг 5 ТЗ)
- [x] Обновить `app/(chat)/api/chat/route.ts` — 3 изменения (шаг 8b ТЗ):
  - [x] 8b-1: Удалить `providerOptions` с `google.thinkingConfig`
  - [x] 8b-2: Заменить логику `"auto" ? "gemini-3-pro"` на прямой `selectedChatModel`
  - [x] 8b-3: Включить `convertTextFilePartsInMessage` обратно
- [x] Обновить `lib/ai/professor-pipeline.ts` — модели Opus/Haiku (шаг 8c ТЗ)
- [x] Обновить `app/(chat)/api/service-chat/route.ts` — getModelId() (шаг 8d ТЗ)
- [x] Обновить `app/(chat)/api/projects/[id]/generate-summary/route.ts` (шаг 8e ТЗ)
- [x] Обновить `lib/ai/clerks/task-summarizer.ts` — env fallback (шаг 8f ТЗ)
- [x] Обновить `lib/ai/professors/task-reviewer.ts` — env fallback (шаг 8f ТЗ)
- [x] Обновить `lib/ai/clerks/snapshot-creator.ts` — env fallback (шаг 8f ТЗ)

**Дополнительно (не в исходном плане, найдено при build):**
- [x] `lib/prompts/builder/registry.ts` — agent model fallback
- [x] `app/(chat)/api/projects/[id]/analyze-file/route.ts` — model ID
- [x] `app/(chat)/api/projects/[id]/plan/route.ts` — professor model fallback
- [x] `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — expert model fallback
- [x] `components/service-chat/types.ts` — model type union
- [x] `components/service-chat/configs/ben.ts` — model config
- [x] `components/service-chat/configs/project-creation.ts` — model config
- [x] `components/service-chat/configs/project-manager.ts` — model config
- [x] `components/projects/task-chat.tsx` — selectedModelId (3 occurrences)

**Файлы:**
- `lib/prompts/builder/composer.ts` — 3 замены defaultModel
- `lib/ai/model-tiers.ts` — 3 замены model ID
- `app/(chat)/api/chat/route.ts` — providerOptions, model logic, text/plain
- `lib/ai/professor-pipeline.ts` — 3 замены model ID
- `app/(chat)/api/service-chat/route.ts` — getModelId()
- `app/(chat)/api/projects/[id]/generate-summary/route.ts` — 1 замена
- `lib/ai/clerks/task-summarizer.ts` — 1 замена fallback
- `lib/ai/professors/task-reviewer.ts` — 1 замена fallback
- `lib/ai/clerks/snapshot-creator.ts` — 1 замена fallback

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается
- [ ] Браузер: отправить сообщение в чат — получить ответ от Claude
- [ ] Браузер: Бен (кнопка ?) — отвечает
- [ ] 🧪 Мануальный тест: основной чат + Бен + Секретарь

**Git (после валидации):**
```bash
git add lib/prompts/builder/composer.ts lib/ai/model-tiers.ts app/(chat)/api/chat/route.ts lib/ai/professor-pipeline.ts app/(chat)/api/service-chat/route.ts "app/(chat)/api/projects/[id]/generate-summary/route.ts" lib/ai/clerks/task-summarizer.ts lib/ai/professors/task-reviewer.ts lib/ai/clerks/snapshot-creator.ts
git commit -m "feat(tz-c4): update all routes, pipeline and clerks to Claude models"
```

**Критерий готовности:** Основной чат отвечает от Claude. Бен работает. Секретарь работает.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

## Этап 3: UI + Config + Cleanup

**Статус:** ✅ Завершён

**Цель:** Обновить UI-компоненты, конфиг Бена, убрать устаревшие комментарии "ВРЕМЕННО".

**Задачи:**
- [x] Обновить `components/input/input-context.tsx` — defaultModelId (шаг 8g ТЗ)
- [x] Обновить `components/input/compact-input.tsx` — defaultModelId (шаг 8g ТЗ)
- [x] Обновить `lib/prompts/agents/ben/config.yaml` — model: claude-haiku (шаг 7 ТЗ)
- [x] Удалить/обновить все `⚠️ ВРЕМЕННО (v3.7.1)` комментарии в затронутых файлах (шаг 9 ТЗ)
- [x] Финальный поиск `grep -r "gemini"` — только vision-ocr.ts + 1 design comment

**Дополнительно:**
- [x] `components/input/input-model-selector.tsx` — обновлены комментарии
- [x] `components/compact-model-selector.tsx` — обновлены комментарии
- [x] `components/multimodal-input.tsx` — обновлён комментарий
- [x] `lib/prompts/agents/_template/config.yaml` — model: claude-haiku

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается
- [ ] Браузер: селектор моделей показывает Claude Sonnet/Haiku/Opus
- [ ] 🧪 Мануальный тест: проверить селектор моделей, главную страницу

**Git (после валидации):**
```bash
git add components/input/input-context.tsx components/input/compact-input.tsx lib/prompts/agents/ben/config.yaml
git commit -m "feat(tz-c4): update UI components and cleanup temporary comments"
```

**Критерий готовности:** Нет упоминаний gemini model IDs в .ts/.tsx (кроме vision-ocr.ts). UI показывает Claude модели.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, версия, архив.

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь):
  - [x] Основной чат — ответ от Claude
  - [x] Бен — работает
  - [x] Секретарь (создание проекта) — интервью работает
  - [x] Селектор моделей — Claude Sonnet/Haiku/Opus
  - [ ] console.anthropic.com — видны запросы в Simply_1
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md
- [x] Обновить docs/ai-chats-map.md
- [x] Обновить docs/ai-providers.md
- [x] Обновить package.json: версия → 3.23.0
- [ ] Переместить `specs/TZ_C4_AnthropicProvider/` в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Все функции работают в браузере
- [x] Документация актуальна
- [ ] Vercel: ANTHROPIC_API_KEY добавлен для production

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-c4): finalize Anthropic Claude provider switch v3.23.0"
```

**Критерий готовности:** Все AI-запросы идут через Claude. Документация обновлена. Версия 3.23.0.
