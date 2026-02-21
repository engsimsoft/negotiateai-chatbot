# Changelog ТЗ-BRIEFING-AUTHOR-CLAUDE

## Сессия 1 — 2026-02-21

### Changed
- `briefing-author.ts` — провайдер Gemini → Anthropic Claude Sonnet 4.6
- `briefing-config.ts` — AUTHOR_MODEL и AUTHOR_MODEL_FALLBACK → Claude модели
- `briefing-author.md` — метаданные промпта (модель)
- `generate/route.ts` — комментарий (Gemini Pro → Claude Sonnet)
- `service-chat/route.ts` — adaptive thinking effort=high для briefing-onboarding
- `plan/route.ts` — adaptive thinking effort=high для профессора планирования
- `task-reviewer.ts` — adaptive thinking effort=high для ревьюера задач

### Discovered
- generateObject + thinking/effort несовместимы (Anthropic: "Thinking may not be enabled when tool_choice forces tool use")
- Убрали providerOptions из generateObject, оставили только в streamText/generateText

### Results
- outputTokens: 10163 (было 5104 на Gemini — рост 2x)
- finishReason: stop
- Пользователь подтвердил качество: "другой уровень совсем"

### Files
- `lib/briefing/briefing-config.ts`
- `lib/briefing/briefing-author.ts`
- `lib/prompts/briefing/briefing-author.md`
- `app/(chat)/api/briefing/generate/route.ts`
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/projects/[id]/plan/route.ts`
- `lib/ai/professors/task-reviewer.ts`

### Git
- `c0910d8` — feat(tz-briefing-author-claude): replace Gemini with Claude Sonnet 4.6 + configure effort
