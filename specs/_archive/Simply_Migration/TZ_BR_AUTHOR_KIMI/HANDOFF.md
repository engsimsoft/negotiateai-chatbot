# Передача сессии ТЗ-BR-AUTHOR-KIMI

**Последнее обновление:** 2026-04-27
**Сессия:** 1 (старт)

---

## Статус этапов

- [x] Фаза 1 — Анализ + Код-ревью ТЗ
- [x] Фаза 2 — Планирование
- [x] Фаза 3 — Разработка
- [x] Фаза 4 — Финализация

### Этапы Фазы 3 (все ✅)
- [x] Этап 1: Provider setup (registry + catalog + установка пакета)
- [x] Этап 2: Task assignments + call-sites + usage-utils + getDefaultParamsForTask getter
- [x] Этап 3: Dev-панель (display names, PROVIDER_ENV_MAP)
- [x] Этап 4: Скрипт `test-kimi-via-registry.ts` + smoke 3/3 PASS
- [x] Этап 5: Зачистка ~30 комментариев + ENV + CLAUDE.md (npm → pnpm)
- [x] Этап 6: Локальный production smoke (владелец проверил briefing UI) + 5 docs/ обновлены
- [x] Этап 7: CHANGELOG/SIMPLY_STATUS/package.json bump + FINDINGS → backlog + 1 коммит + архивация

**ТЗ закрыто 2026-04-27 в v3.99.2.**

---

## Следующая сессия: начни с

1. Прочитать `ROADMAP.md` — текущий этап (Этап 1)
2. Прочитать `SPEC.md` (повторно перед стартом — освежить контекст)
3. Прочитать ответы архитектора в `ANALYSIS.md` секция «Ответы архитектора»
4. Запустить `pnpm dev` для baseline
5. **Первая задача Этапа 1:** удалить `package-lock.json` + `pnpm rm vercel-minimax-ai-provider` + `pnpm add @ai-sdk/moonshotai@ai-v6`

---

## Что сделано в этой сессии

- Аудит briefing pipeline для миграции (3 taskId на MiniMax: author / section / podcast-script)
- Создана папка ТЗ + SPEC.md (от владельца)
- Изучена официальная документация (Правило 1): `@ai-sdk/moonshotai`, Kimi K2.6 quickstart, Moonshot API spec — занесено в ANALYSIS «Изученная документация»
- Глубокая разведка кода через Explore-агент: registry, catalog, getModel, 3 call-sites, dev-панель, lockfile, MINIMAX_API_KEY usage
- Создан ANALYSIS.md с код-ревью SPEC, вопросами, риск-матрицей
- Получены ответы архитектора на 5 вопросов + дополнительные уточнения (lockfile pnpm, удалить cacheControl, pricing раздельно, defaultParams в catalog, type cast `as MoonshotAIChatModelId`, версия `@ai-v6` тег)
- Создан ROADMAP.md (7 этапов)
- HANDOFF обновлён

---

## Контекст из аудита

**Что меняем:**
- `briefing:author` → Kimi K2.6 (вместо `MiniMax-M2.7-long`)
- `briefing:section` → Kimi K2.6 (вместо `MiniMax-M2.7-long`)
- `briefing:podcast-script` → Kimi K2.6 (вместо `MiniMax-M2.7`)

**Что удаляем:**
- Зависимость `vercel-minimax-ai-provider@^0.0.2`
- Namespace `minimax` и `minimaxLong` в `lib/ai/registry.ts:28-46`
- 2 скрипта `scripts/test-minimax-*.ts`

**Что добавляем:**
- Зависимость `@ai-sdk/openai-compatible` (отсутствует в package.json)
- Namespace для Kimi (Moonshot) в `lib/ai/registry.ts`
- Запись в `lib/ai/model-catalog.ts` (pricing, capabilities)
- Сохранить `AbortSignal.timeout(180_000)` для long-running briefing author

**Затронутые файлы:**
- `lib/ai/registry.ts`
- `lib/ai/model-catalog.ts`
- `lib/ai/task-assignments.ts`
- `lib/briefing/briefing-author.ts`
- `lib/briefing/briefing-section-author.ts`
- `lib/podcast/script-generator.ts`
- `package.json`

**Промпты:** уже в формате Markdown Skills (`lib/prompts/briefing/*.md`) — переписывать не надо.

**Тесты:** integration-тестов нет, есть 2 интеграционных скрипта в `scripts/` для проверки registry — можно скопировать паттерн для Kimi.

---

## Backlog проверен (Правило 9)

- `TZ_ExpertiseReasoningRestore` — не связан с briefing, не блокирует
- `TZ_BriefingConcurrencyGuard` — рядом с BR-AUTHOR-KIMI (тот же endpoint), не блокирует миграцию модели. Решение владельца: делать отдельным ТЗ после.

---

## Команды

```bash
npm run dev              # Dev сервер
npm run build            # Сборка (⚠ накатывает миграции — для этого ТЗ нерелевантно, схема не меняется)
npx tsc --noEmit         # Проверка TypeScript
```

---

## Ключевые решения

(заполняется по ходу работы)
