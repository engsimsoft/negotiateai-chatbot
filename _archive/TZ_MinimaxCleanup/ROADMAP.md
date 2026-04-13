# Roadmap ТЗ-MinimaxCleanup: MiniMax M2.7 + Расчистка

**Создан:** 2026-04-08
**Версия проекта:** 3.76.0 → 3.77.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1-2 |

---

## Этап 1: Удаление saveFact + updateFact

**Статус:** ✅ Завершён

**Цель:** Убрать мёртвый код saveFact/updateFact — tools, config, промпт-инструкции

**Задачи:**
- [x] Удалить `lib/ai/tools/save-fact.ts`
- [x] Удалить `lib/ai/tools/update-fact.ts`
- [x] `lib/ai/tools/chat-tools.ts` — убрать импорты и подключение saveFact/updateFact для simply
- [x] `lib/ai/tools/chat-tools.ts` — убрать saveFact/updateFact из getActiveToolNames
- [x] `lib/ai/tool-activity-config.ts` — удалить записи saveFact и updateFact
- [x] `lib/prompts/chat/simply-chat.md` — удалить блок инструкций saveFact/updateFact (строки ~16-77)
- [x] Проверить нет ли других импортов saveFact/updateFact в проекте (grep)

**Файлы:**
- `lib/ai/tools/save-fact.ts` — удалить
- `lib/ai/tools/update-fact.ts` — удалить
- `lib/ai/tools/chat-tools.ts` — убрать импорты и подключение
- `lib/ai/tool-activity-config.ts` — убрать записи
- `lib/prompts/chat/simply-chat.md` — убрать инструкции

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок (ошибки только в scripts/ — исключены из tsconfig)
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: отправить сообщение "запомни что я люблю кофе" в Simply → модель НЕ пытается вызвать saveFact

**Git (после валидации):**
```bash
git add lib/ai/tools/chat-tools.ts lib/ai/tool-activity-config.ts lib/prompts/chat/simply-chat.md
git commit -m "chore(tz-minimax): remove saveFact + updateFact tools"
```

**Критерий готовности:** saveFact и updateFact полностью удалены из кодовой базы

---

## Этап 2: Откат скользящего окна + отключение Extract

**Статус:** ✅ Завершён

**Цель:** Убрать 20-сообщений ограничение для simply, отключить extractAndStoreFacts для simply

**Задачи:**
- [x] `lib/ai/context-limits.ts` — удалить константу `SIMPLY_SLIDING_WINDOW_SIZE`
- [x] `lib/ai/context-limits.ts` — проверить используется ли `trimToUserStart()` где-то кроме route.ts для simply. Если нет — удалить
- [x] `app/(chat)/api/chat/route.ts` ~строка 338-347 — убрать isSimply ветвление, simply использует те же параметры что и остальные chatMode
- [x] `app/(chat)/api/chat/route.ts` ~строка 1192-1218 — отключить extractAndStoreFacts для chatMode=simply (оставить для других chatMode)
- [x] Проверить другие импорты `SIMPLY_SLIDING_WINDOW_SIZE` (grep)

**Файлы:**
- `lib/ai/context-limits.ts` — удалён SIMPLY_SLIDING_WINDOW_SIZE и trimToUserStart
- `app/(chat)/api/chat/route.ts` — убрано isSimply ветвление + extract отключён для simply

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: отправить 25+ сообщений в Simply → все видны и отправляются модели (отложено до Этапа 3, после подключения MiniMax)
- [x] 🧪 Мануальный тест: после сообщения в Simply → в логах НЕТ extractAndStoreFacts (проверено: 11 сообщений, 0 вызовов [MIND] Extract)

**Git (после валидации):**
```bash
git add lib/ai/context-limits.ts app/\(chat\)/api/chat/route.ts
git commit -m "refactor(tz-minimax): remove sliding window + disable extract for simply"
```

**Критерий готовности:** Simply загружает все сообщения (как expertise/create), extract не вызывается

---

## Этап 3: Подключение MiniMax + Gemini + маршрутизация

**Статус:** ✅ Завершён

**Цель:** MiniMax M2.7 = дефолт для simply, Gemini 3 Flash = вложения, Sonnet = think

**Задачи:**
- [x] `npm install vercel-minimax-ai-provider`
- [x] `app/(chat)/api/chat/route.ts` — маршрутизация модели для simply:
  - think → Sonnet (без изменений)
  - вложения (image, PDF, document кроме text/plain) → Gemini 3 Flash
  - иначе → MiniMax M2.7
- [x] `app/(chat)/api/chat/route.ts` — для MiniMax: temperature 0.7, без tools
- [x] `app/(chat)/api/chat/route.ts` — для Gemini Flash: без tools
- [x] `lib/ai/providers.ts` — добавить MiniMax-M2.7 и gemini-3-flash-preview в MODEL_PRICING_RUB
- [x] `lib/ai/providers.ts` — добавить MiniMax-M2.7 в MODEL_CONTEXT_WINDOW (204800)
- [x] `lib/ai/chat-mode-config.ts` — обновить modelId для simply на "MiniMax-M2.7"
- [x] `lib/ai/usage-utils.ts` — проверить что extractUsageFields работает с MiniMax usage format (без изменений — AI SDK v6 unified format)
- [x] Убедиться что onFinish корректно логирует model ID для MiniMax и Gemini

**Файлы:**
- `app/(chat)/api/chat/route.ts` — маршрутизация + model creation + hasAttachments()
- `lib/ai/providers.ts` — pricing + context window
- `lib/ai/chat-mode-config.ts` — default model ID → MiniMax-M2.7
- `package.json` — vercel-minimax-ai-provider

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: текстовое сообщение в Simply → DevPanel показывает MiniMax-M2.7
- [x] 🧪 Мануальный тест: кнопка «Думать» → DevPanel показывает Sonnet 4.6 (₽6.71, 19.4k tok)
- [x] 🧪 Мануальный тест: отправить фото → DevPanel показывает gemini-3-flash-preview (₽0.16)
- [x] 🧪 Мануальный тест: DevPanel → usage корректные (inputTokens, outputTokens, стоимость в рублях)

**Git (после валидации):**
```bash
git add app/\(chat\)/api/chat/route.ts lib/ai/providers.ts lib/ai/chat-mode-config.ts package.json package-lock.json
git commit -m "feat(tz-minimax): MiniMax M2.7 + Gemini 3 Flash routing for simply"
```

**Критерий готовности:** Три модели работают в Simply, DevPanel показывает корректные данные

---

## Этап 4: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3
⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать DOCUMENTATION_GUIDE.md → пройти чеклист.

**Документация (обязательная):**
- [ ] Прочитать DOCUMENTATION_GUIDE.md → пройти "Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (Simply Chat секция — новые модели, удалённые tools)
- [ ] Обновить package.json (версия 3.77.0)

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Да: docs/decisions/NNN-minimax-simply-routing.md (новый провайдер, маршрутизация)
- [ ] docs/ai-providers.md → обновить Реестр конфигураций (MiniMax, Gemini 3 Flash)
- [ ] docs/ai-chats-map.md → обновить модель для simply
- [ ] docs/ai-tools.md → убрать saveFact/updateFact

**Верификация docs против кода (Правило 5):**
- [ ] `ai-providers.md` → Реестр сверен с grep по коду
- [ ] `ai-chats-map.md` → код-блок myProvider совпадает с providers.ts
- [ ] `CLAUDE.md` → пути файлов и описания актуальны

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Переместить папку в _archive/

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Документация актуальна (проверено по чеклисту выше)
