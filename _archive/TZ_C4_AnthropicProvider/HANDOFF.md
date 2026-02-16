# Передача сессии ТЗ-C4

**Последнее обновление:** 2026-02-16
**Сессия:** 2 (финальная)
**Статус:** ✅ ЗАВЕРШЁН

---

## Статус этапов

- [x] Этап 1: Зависимости + Core Provider
- [x] Этап 2: Routes + Pipeline + Clerks
- [x] Этап 3: UI + Config + Cleanup
- [x] Этап 4: Финализация (документация, версия, архив)

---

## Что сделано в сессии 2

**Этапы 1-3 выполнены одним проходом** (Stage 2 файлы блокировали build — top-level `myProvider.languageModel("gemini-*")` вызовы).

### Файлы изменены (28 файлов):

**Core (Этап 1):**
- `package.json` — `@ai-sdk/anthropic@2.0.63` (совместим с ai@5.0.123)
- `lib/ai/providers.ts` — полная перезапись: Anthropic вместо Google
- `lib/prompts/types.ts` — ModelId: claude-haiku/sonnet/opus
- `lib/ai/models.ts` — chatModels: Claude Sonnet/Haiku/Opus
- `lib/ai/entitlements.ts` — availableChatModelIds
- `app/(chat)/api/chat/schema.ts` — Zod enum

**Routes + Pipeline (Этап 2):**
- `lib/prompts/builder/composer.ts` — 3 defaultModel fallbacks
- `lib/prompts/builder/registry.ts` — agent model fallback
- `lib/ai/model-tiers.ts` — полная перезапись: Claude модели + pricing
- `lib/ai/professor-pipeline.ts` — Opus/Haiku модели
- `app/(chat)/api/chat/route.ts` — убран providerOptions, включён convertTextFilePartsInMessage, прямой selectedChatModel
- `app/(chat)/api/service-chat/route.ts` — getModelId() → claude-sonnet/haiku
- `app/(chat)/api/projects/[id]/generate-summary/route.ts` — claude-haiku
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — claude-haiku
- `app/(chat)/api/projects/[id]/plan/route.ts` — claude-opus
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — claude-sonnet
- `lib/ai/clerks/task-summarizer.ts` — claude-haiku
- `lib/ai/clerks/snapshot-creator.ts` — claude-haiku
- `lib/ai/professors/task-reviewer.ts` — claude-opus
- `app/(chat)/api/chat/[id]/generate-title/route.ts` — обновлён комментарий

**UI + Config (Этап 3):**
- `components/input/input-context.tsx` — defaultModelId = "claude-sonnet"
- `components/input/compact-input.tsx` — defaultModelId = "claude-sonnet"
- `components/service-chat/types.ts` — model type: "claude-haiku" | "claude-sonnet"
- `components/service-chat/configs/ben.ts` — claude-haiku
- `components/service-chat/configs/project-creation.ts` — claude-haiku
- `components/service-chat/configs/project-manager.ts` — claude-haiku
- `components/projects/task-chat.tsx` — selectedModelId = "claude-sonnet" (3 места)
- `components/input/input-model-selector.tsx` — обновлены комментарии
- `components/compact-model-selector.tsx` — обновлены комментарии
- `components/multimodal-input.tsx` — обновлён комментарий
- `lib/prompts/agents/ben/config.yaml` — model: claude-haiku
- `lib/prompts/agents/_template/config.yaml` — model: claude-haiku

### Валидация:
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] `grep gemini **/*.{ts,tsx}` — только vision-ocr.ts + 1 design comment

---

## Блокеры / Вопросы

> Блокеров нет. ТЗ завершён.

- [x] thinkingConfig — удалён
- [x] text/plain — convertTextFilePartsInMessage включён обратно
- [x] vision-ocr.ts — не тронут (свой экземпляр Google)
- [x] API key — готов в .env.local
- [x] Мануальный тест в браузере — все 4 проверки пройдены
- [x] Документация обновлена (SIMPLY_STATUS, CHANGELOG, CLAUDE.md, ai-chats-map, ai-providers)
- [x] package.json → 3.23.0
- [ ] **Vercel Environment Variables — нужно добавить ANTHROPIC_API_KEY перед deploy**

---

## Ключевые решения

1. **@ai-sdk/anthropic@2.0.63** (не 3.x): v3.x возвращает LanguageModelV3, несовместим с `ai@5.0.123` (ожидает V2). Установлен v2.0.63.
2. **thinkingConfig:** Удалён Gemini providerOptions блок.
3. **text/plain:** Включён convertTextFilePartsInMessage — Claude не поддерживает text/plain attachments нативно.
4. **vision-ocr.ts:** Не тронут — свой экземпляр Google.
5. **Карта моделей:** gemini-3-pro → claude-sonnet, gemini-2.5-flash → claude-haiku, professor → claude-opus.
6. **Этапы объединены:** Stage 2 файлы имели top-level `myProvider.languageModel()` вызовы, которые блокировали build. Решено обновлением всех файлов за один проход.
