# Changelog ТЗ-BR-AUTHOR-KIMI

> История изменений в рамках этого ТЗ.
> Финальная запись перенесена в главный [CHANGELOG.md](../../../CHANGELOG.md) (v3.99.2).

---

## Сессия 1 — 2026-04-27 (single-session ТЗ)

### Added
- `@ai-sdk/moonshotai@2.0.11` (dist-tag `ai-v6`) в зависимости
- Namespace `moonshotai` в [lib/ai/registry.ts](../../../lib/ai/registry.ts) с 180s `AbortSignal.timeout` через custom fetch
- Catalog entry `kimi-k2.6` в [lib/ai/model-catalog.ts](../../../lib/ai/model-catalog.ts) с `defaultParams: { temperature: 0.6, topP: 0.95, providerOptions.moonshotai.thinking: { type: "disabled" } }`
- `CAPS_MOONSHOT` capability preset
- Новый getter `getDefaultParamsForTask(taskId)` + тип `DefaultTaskParams` в [lib/ai/getModel.ts](../../../lib/ai/getModel.ts) — параметры из catalog (Блок 9 концепта), не hardcode
- `MOONSHOT_API_KEY` в `.env.example` и `.env.local`
- Скрипт [scripts/test-kimi-via-registry.ts](../../../scripts/test-kimi-via-registry.ts) — smoke 3 briefing taskId через registry
- `FINDINGS.md` с одной находкой → перенесён в `specs/_backlog/TZ_BriefingScriptwriterPromptUpdate.md`

### Changed
- 3 briefing taskId в [task-assignments.ts](../../../lib/ai/task-assignments.ts) → `kimi-k2.6`
- Три call-sites ([briefing-author.ts](../../../lib/briefing/briefing-author.ts), [briefing-section-author.ts](../../../lib/briefing/briefing-section-author.ts), [script-generator.ts](../../../lib/podcast/script-generator.ts)) — заменили hardcode `temperature: 0.7` на spread `...getDefaultParamsForTask(...)`
- В [script-generator.ts](../../../lib/podcast/script-generator.ts) удалены оба `providerOptions.anthropic.cacheControl` блока (zombie после миграции)
- [usage-utils.ts:128](../../../lib/ai/usage-utils.ts#L128) `inferProviderFromModelId` детектит `kimi*` → `moonshotai`
- [chat/route.ts](../../../app/(chat)/api/chat/route.ts) `isAnthropicProtocolModel` — убрано `|| === "minimax"` (Moonshot — openai-протокол)
- [PROVIDER_ENV_MAP](../../../app/(dashboard)/dev/models/page.tsx) — `minimax/MINIMAX_API_KEY` → `moonshotai/MOONSHOT_API_KEY`
- 3 файла dev-panel display names — `MiniMax-M2.7`/`MiniMax-M2.7-long` строки → одна `kimi-k2.6: "Kimi K2.6"`
- ~30 комментариев в lib/, app/, components/ обновлены (зачистка MiniMax-упоминаний)
- [CLAUDE.md](../../../CLAUDE.md) — команды `npm install/dev/build/start/db:migrate/db:studio` → `pnpm`. Правила 2/3/5 — `npx tsc → pnpm exec tsc`, `npm run build → pnpm build`. wc -l = 215 ≤ 220 ✓
- Главный [CHANGELOG.md](../../../CHANGELOG.md) — запись 3.99.2
- [SIMPLY_STATUS.md](../../../SIMPLY_STATUS.md) — Кухня: MiniMax → Kimi K2.6, briefing строка таблицы, активная серия (BR-AUTHOR-KIMI закрыт, следующий ТЗ-2)
- 5 docs/ обновлены (ai-chats-map, ai-providers, architecture, model-catalog-ops, ai-tools)
- [package.json](../../../package.json) — version 3.99.1 → 3.99.2

### Removed
- Пакет `vercel-minimax-ai-provider@0.0.2`
- Namespaces `minimax` и `minimaxLong` в registry.ts
- `CAPS_MINIMAX` + 2 catalog entries (`MiniMax-M2.7`, `MiniMax-M2.7-long`)
- Special case в `getModel.ts` `buildRegistryId` (`MiniMax-M2.7-long → minimaxLong:MiniMax-M2.7`)
- ENV `MINIMAX_API_KEY` (.env.local, dev-панель)
- Скрипты `scripts/test-minimax-via-registry.ts`, `scripts/test-minimax-anthropic-compat.ts`
- `package-lock.json` (lockfile-конфликт с pnpm-lock.yaml)
- `simply-chat` MiniMax-override в dev-панели — сброшен владельцем через UI

### Fixed
- Production silent hang briefing-генерации (был с 23.04.2026 после апгрейда `ai@6.0.168`, корень — pinned `@ai-sdk/anthropic@3.0.6` внутри `vercel-minimax-ai-provider@0.0.2`)
- Скрипт смоук-теста: dynamic imports после `dotenv.config()` (без этого ES module hoisting инициализирует registry с пустым apiKey → 401)
- Thinking mode disable: добавлен `providerOptions.moonshotai.thinking: { type: "disabled" }` в catalog defaultParams (без этого Kimi возвращал `content: ""` + только `reasoning_content`, finish_reason: length)

### Files
22 production-файла + 5 docs/ + 1 новый скрипт + 2 удалённых скрипта + 1 удалённый lockfile.
